/* verilog.js — a Verilog-2001 interpreter: preprocessor + lexer, parser, elaborator and an
   event-driven 4-state simulator. No dependencies.
   Browser / worker: self.Verilog.run(src, opts)      Node: require('./verilog.js').run(src, opts)
   Behaviour in unspecified corners (time-0 ordering, formatting widths) follows Icarus Verilog. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Verilog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

class VError extends Error {
  constructor(msg, line) { super(line ? `line ${line}: ${msg}` : msg); this.raw = msg; this.line = line || 0; }
}

// ───────────────────────────── 4-state values ─────────────────────────────
// A vector is {w, a, b}; bit i of (a, b) encodes 00 = 0, 10 = 1, 01 = z, 11 = x.
// ponytail: BigInt for every width. Simple and exact; add a Number fast path for w <= 32 if speed matters.
const MASKS = [];
const mask = w => MASKS[w] || (MASKS[w] = (1n << BigInt(w)) - 1n);
const V = (w, a, b) => ({ w, a, b });
const vn = (w, n) => V(w, BigInt.asUintN(w, BigInt(n)), 0n);
const vx = w => V(w, mask(w), mask(w));
const vz = w => V(w, 0n, mask(w));
const V0 = V(1, 0n, 0n), V1 = V(1, 1n, 0n), VX = V(1, 1n, 1n), VZ = V(1, 0n, 1n);
const MAXW = 1 << 20;

function resize(v, w, signed) {
  if (v.w === w) return v;
  const m = mask(w);
  if (w < v.w) return V(w, v.a & m, v.b & m);
  if (!signed) return V(w, v.a, v.b);
  const top = BigInt(v.w - 1), ext = m ^ mask(v.w);
  return V(w, (v.a >> top) & 1n ? v.a | ext : v.a, (v.b >> top) & 1n ? v.b | ext : v.b);
}
const sbig = v => (v.a >> BigInt(v.w - 1)) & 1n ? v.a - (1n << BigInt(v.w)) : v.a;   // signed value of a known vector
const truth = v => (v.a & ~v.b) !== 0n ? 1 : v.b !== 0n ? -1 : 0;                     // 1 true, 0 false, -1 unknown
const roundR = r => BigInt(Math.sign(r) * Math.round(Math.abs(r)) || 0);              // half away from zero (r finite)
const r2v = (r, w) => Number.isFinite(r) ? vn(w, roundR(r)) : vx(w);
const v2r = (v, s) => { if (v.b) v = V(v.w, v.a & ~v.b, 0n); return Number(s ? sbig(v) : v.a); };   // x/z bits count as 0
const initVal = s => s.real ? 0 : s.isEvent ? V(32, 0n, 0n) : s.net ? vz(s.w) : vx(s.w);

function extract(v, lo, w) {            // bits [lo, lo+w) of v; bits outside v read as x
  const m = mask(w);
  if (lo >= 0 && lo + w <= v.w) { const s = BigInt(lo); return V(w, (v.a >> s) & m, (v.b >> s) & m); }
  if (lo >= v.w || lo + w <= 0) return vx(w);
  let a, b, valid;
  if (lo < 0) { const s = BigInt(-lo); a = v.a << s; b = v.b << s; valid = (mask(v.w) << s) & m; }
  else { const s = BigInt(lo); a = v.a >> s; b = v.b >> s; valid = mask(v.w - lo) & m; }
  const inv = m ^ valid;
  return V(w, (a & valid) | inv, (b & valid) | inv);
}
function insert(cur, lo, w, v) {        // cur with bits [lo, lo+w) replaced by v; out-of-range bits are dropped
  if (lo >= cur.w || lo + w <= 0) return cur;
  let a = v.a, b = v.b;
  if (lo < 0) { a >>= BigInt(-lo); b >>= BigInt(-lo); w += lo; lo = 0; }
  if (lo + w > cur.w) w = cur.w - lo;
  const m = mask(w), s = BigInt(lo), fm = m << s;
  return V(cur.w, (cur.a & ~fm) | ((a & m) << s), (cur.b & ~fm) | ((b & m) << s));
}
function resolve2(p, q) {               // wire resolution: z yields, agreement keeps, conflict is x
  const zp = ~p.a & p.b, zq = ~q.a & q.b, m = mask(p.w);
  const diff = ((p.a ^ q.a) | (p.b ^ q.b)) & ~zp & ~zq;
  return V(p.w, ((zp & q.a) | (~zp & p.a) | diff) & m, ((zp & q.b) | (~zp & p.b) | diff) & m);
}
function wired(p, q, f) {               // wand / wor resolution: z yields, otherwise the drivers are ANDed / ORed
  const zp = ~p.a & p.b, zq = ~q.a & q.b, m = mask(p.w), both = zp & zq & m;
  const P = V(p.w, ((p.a & ~zp) | (q.a & zp)) & m, ((p.b & ~zp) | (q.b & zp)) & m);
  const Q = V(p.w, ((q.a & ~zq) | (p.a & zq)) & m, ((q.b & ~zq) | (p.b & zq)) & m);
  const r = f(P, Q, p.w, m);
  return both ? V(p.w, r.a & ~both, r.b | both) : r;
}
const pulled = (r, p) => { const z = ~r.a & r.b & p.m; return z ? V(r.w, r.a | (z & p.a), r.b & ~z) : r; };   // tri0 / tri1 / pullup / pulldown
function strToV(s, w) {
  let a = 0n;
  for (let i = 0; i < s.length; i++) a = (a << 8n) | BigInt(s.charCodeAt(i) & 255);
  return V(w, a & mask(w), 0n);
}
function bytesStr(v) {                  // the text held in a vector; unknown bits count as 0, NUL bytes are dropped
  const bits = v.a & ~v.b;
  let s = '';
  for (let i = Math.ceil(v.w / 8) - 1; i >= 0; i--) { const c = Number((bits >> BigInt(8 * i)) & 255n); if (c) s += String.fromCharCode(c); }
  return s;
}
const parity = a => { let p = 0; for (const c of a.toString(2)) if (c === '1') p ^= 1; return p; };
const bitState = v => Number((v.a & 1n) | ((v.b & 1n) << 1n));   // 0, 1, 2 = z, 3 = x

function vpow(a, e, W, m, S, es) {
  if (a.b || e.b) return vx(W);
  const base = S ? sbig(a) : a.a, exp = es ? sbig(e) : e.a;
  if (exp < 0n) {
    if (base === 1n) return V(W, 1n, 0n);
    if (base === -1n) return V(W, (exp & 1n ? -1n : 1n) & m, 0n);
    return base === 0n ? vx(W) : V(W, 0n, 0n);
  }
  let r = 1n & m, b = base & m, x = exp;
  while (x > 0n) { if (x & 1n) r = (r * b) & m; b = (b * b) & m; x >>= 1n; }
  return V(W, r, 0n);
}

const ARITH = {
  '+': (a, b, W, m) => (a.b || b.b) ? vx(W) : V(W, (a.a + b.a) & m, 0n),
  '-': (a, b, W, m) => (a.b || b.b) ? vx(W) : V(W, (a.a - b.a) & m, 0n),
  '*': (a, b, W, m) => (a.b || b.b) ? vx(W) : V(W, (a.a * b.a) & m, 0n),
  '/': (a, b, W, m, S) => (a.b || b.b || !b.a) ? vx(W) : V(W, (S ? sbig(a) / sbig(b) : a.a / b.a) & m, 0n),
  '%': (a, b, W, m, S) => (a.b || b.b || !b.a) ? vx(W) : V(W, (S ? sbig(a) % sbig(b) : a.a % b.a) & m, 0n),
  '&': (a, b, W, m) => {
    if (!a.b && !b.b) return V(W, a.a & b.a, 0n);
    const one = a.a & ~a.b & b.a & ~b.b, zero = (~a.a & ~a.b) | (~b.a & ~b.b), x = m & ~one & ~zero;
    return V(W, (one | x) & m, x);
  },
  '|': (a, b, W, m) => {
    if (!a.b && !b.b) return V(W, a.a | b.a, 0n);
    const one = (a.a & ~a.b) | (b.a & ~b.b), zero = ~a.a & ~a.b & ~b.a & ~b.b, x = m & ~one & ~zero;
    return V(W, (one | x) & m, x);
  },
  '^': (a, b, W, m) => { const x = a.b | b.b; return V(W, (((a.a ^ b.a) & ~x) | x) & m, x); },
  '~^': (a, b, W, m) => { const x = a.b | b.b; return V(W, ((~(a.a ^ b.a) & ~x) | x) & m, x); },
};
ARITH['^~'] = ARITH['~^'];
const wAnd = (p, q) => wired(p, q, ARITH['&']), wOr = (p, q) => wired(p, q, ARITH['|']);
const eqv = (a, b) => (!a.b && !b.b) ? (a.a === b.a ? V1 : V0) : ((a.a ^ b.a) & ~a.b & ~b.b) ? V0 : VX;
const rel = f => (a, b, S) => (a.b || b.b) ? VX : (S ? f(sbig(a), sbig(b)) : f(a.a, b.a)) ? V1 : V0;
const CMP = {
  '==': eqv,
  '!=': (a, b) => { const r = eqv(a, b); return r === V1 ? V0 : r === V0 ? V1 : VX; },
  '===': (a, b) => a.a === b.a && a.b === b.b ? V1 : V0,
  '!==': (a, b) => a.a === b.a && a.b === b.b ? V0 : V1,
  '<': rel((x, y) => x < y), '<=': rel((x, y) => x <= y), '>': rel((x, y) => x > y), '>=': rel((x, y) => x >= y),
};
const RCMP = { '==': (x, y) => x === y, '!=': (x, y) => x !== y, '<': (x, y) => x < y, '<=': (x, y) => x <= y, '>': (x, y) => x > y, '>=': (x, y) => x >= y };
const RARITH = { '+': (x, y) => x + y, '-': (x, y) => x - y, '*': (x, y) => x * y, '/': (x, y) => x / y };
const REDUCE = {
  '&': (v, m) => (~v.a & ~v.b & m) ? V0 : v.b ? VX : V1,
  '|': v => (v.a & ~v.b) ? V1 : v.b ? VX : V0,
  '^': v => v.b ? VX : parity(v.a) ? V1 : V0,
};
const inv1 = v => v === V1 ? V0 : v === V0 ? V1 : VX;
REDUCE['~&'] = (v, m) => inv1(REDUCE['&'](v, m));
REDUCE['~|'] = (v, m) => inv1(REDUCE['|'](v, m));
REDUCE['~^'] = REDUCE['^~'] = (v, m) => inv1(REDUCE['^'](v, m));

// ───────────────────────────── formatting ─────────────────────────────
function padNum(s, width, zero, left) {
  if (width === undefined) return s;
  if (left) return s.padEnd(width);
  if (!zero) return s.padStart(width);
  return s[0] === '-' ? '-' + s.slice(1).padStart(width - 1, '0') : s.padStart(width, '0');
}
function fmtVec(base, v, signed, width, zero, left) {
  let s, nat;
  if (base === 'd') {
    nat = signed ? (1n << BigInt(v.w - 1)).toString().length + 1 : mask(v.w).toString().length;
    if (v.b) { const m = mask(v.w); s = v.b === m && v.a === m ? 'x' : v.b === m && v.a === 0n ? 'z' : (v.a & v.b) ? 'X' : 'Z'; }
    else s = (signed ? sbig(v) : v.a).toString();
  } else {
    const bits = base === 'b' ? 1 : base === 'o' ? 3 : 4;
    nat = Math.ceil(v.w / bits); s = '';
    for (let i = nat - 1; i >= 0; i--) {
      const sh = BigInt(i * bits), gm = mask(Math.min(bits, v.w - i * bits));
      const a = (v.a >> sh) & gm, b = (v.b >> sh) & gm;
      s += !b ? a.toString(16) : b === gm && a === gm ? 'x' : b === gm && a === 0n ? 'z' : (a & b) ? 'X' : 'Z';
    }
    if (width === 0) s = s.replace(/^0+(?=.)/, '');
  }
  return padNum(s, width === undefined ? nat : width, zero, left);
}
// Real formatting done exactly (C printf semantics: ties round to even, no exponent form in %f).
const nonFinite = r => Number.isNaN(r) ? 'nan' : r > 0 ? 'inf' : '-inf';
const F64 = new DataView(new ArrayBuffer(8));
function decDigits(x, p) {               // |x| * 10^p rounded to an integer, as a BigInt
  F64.setFloat64(0, Math.abs(x));
  const bits = F64.getBigUint64(0), ex = Number(bits >> 52n) & 0x7ff, fr = bits & 0xfffffffffffffn;
  const m = ex ? fr | (1n << 52n) : fr, e = ex ? ex - 1075 : -1074;                   // |x| = m * 2^e
  let num = m, den = 1n;
  if (p >= 0) num *= 10n ** BigInt(p); else den *= 10n ** BigInt(-p);
  if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
  let q = num / den;
  const r2 = (num % den) * 2n;
  if (r2 > den || (r2 === den && (q & 1n))) q += 1n;
  return q;
}
const isNeg = r => r < 0 || Object.is(r, -0);
function fmtF(r, p) {
  if (!Number.isFinite(r)) return nonFinite(r);
  const d = decDigits(r, p).toString().padStart(p + 1, '0');
  return (isNeg(r) ? '-' : '') + (p ? d.slice(0, -p) + '.' + d.slice(-p) : d);
}
function fmtE(r, p) {
  if (!Number.isFinite(r)) return nonFinite(r);
  let k = 0, d = '0'.repeat(p + 1);
  if (r !== 0) {
    k = Math.floor(Math.log10(Math.abs(r)));
    for (;;) { d = decDigits(r, p - k).toString(); if (d.length > p + 1) k++; else if (d.length < p + 1) k--; else break; }
  }
  return (isNeg(r) ? '-' : '') + d[0] + (p ? '.' + d.slice(1) : '') + 'e' + (k < 0 ? '-' : '+') + String(Math.abs(k)).padStart(2, '0');
}
function fmtG(r, p, alt) {              // alt = the '#' flag: keep trailing zeros
  if (!Number.isFinite(r)) return nonFinite(r);
  if (p === 0) p = 1;
  const e = fmtE(r, p - 1), x = parseInt(e.slice(e.indexOf('e') + 1), 10);
  if (x < -4 || x >= p) return alt ? e : e.replace(/\.?0+e/, 'e');
  const s = fmtF(r, p - 1 - x);
  return alt || !s.includes('.') ? s : s.replace(/\.?0+$/, '');
}
function binStr(v) {
  const a = v.a.toString(2).padStart(v.w, '0');
  if (!v.b) return a;
  const b = v.b.toString(2).padStart(v.w, '0');
  let s = '';
  for (let i = 0; i < v.w; i++) s += b[i] === '0' ? a[i] : a[i] === '1' ? 'x' : 'z';
  return s;
}
const tsStr = e => { const i = Math.max(0, Math.ceil(-e / 3)); return 10 ** (e + 3 * i) + ['s', 'ms', 'us', 'ns', 'ps', 'fs'][i]; };

// ───────────────────────────── lexer + preprocessor ─────────────────────────────
const NETS = new Set(['wire', 'tri', 'wand', 'wor', 'triand', 'trior', 'tri0', 'tri1', 'supply0', 'supply1']);
const VARS = new Set(['reg', 'integer', 'time', 'real', 'realtime']);
const GATES = new Set(['and', 'nand', 'or', 'nor', 'xor', 'xnor', 'buf', 'not', 'bufif0', 'bufif1', 'notif0', 'notif1', 'pullup', 'pulldown', 'nmos', 'pmos', 'rnmos', 'rpmos']);
const STRENGTHS = new Set(['supply0', 'supply1', 'strong0', 'strong1', 'pull0', 'pull1', 'weak0', 'weak1', 'highz0', 'highz1', 'small', 'medium', 'large']);
// Reserved words this interpreter has no support for; they still may not be used as names.
const UNSUPPORTED = new Set(('trireg tran tranif0 tranif1 rtran rtranif0 rtranif1 cmos rcmos primitive endprimitive table endtable config endconfig ' +
  'specparam cell design instance liblist library use incdir include ifnone edge scalared vectored showcancelled noshowcancelled ' +
  'pulsestyle_onevent pulsestyle_ondetect unsigned uwire').split(' '));
const KW = new Set(('module macromodule endmodule input output inout signed parameter localparam assign always initial begin end fork join ' +
  'if else case casez casex endcase default for while repeat forever wait function endfunction task endtask automatic generate endgenerate ' +
  'genvar posedge negedge or event disable deassign force release defparam specify endspecify').split(' ')
  .concat([...NETS], [...VARS], [...GATES], [...STRENGTHS], [...UNSUPPORTED]));
const OPS = ['<<<', '>>>', '===', '!==', '==', '!=', '<=', '>=', '&&', '||', '**', '<<', '>>', '~&', '~|', '~^', '^~', '->', '+:', '-:'];
const TS_EXP = { s: 0, ms: -3, us: -6, ns: -9, ps: -12, fs: -15 };

function lex(src) {
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);
  const toks = [], defs = new Map(), conds = [];
  let i = 0, line = 1, ts = null, nonet = false, expansions = 0;
  const err = m => { throw new VError(m, line); };
  const skipping = () => conds.length > 0 && !conds[conds.length - 1].on;
  const push = (t, v) => { const k = { t, v, line }; if (t === 'kw' && (v === 'module' || v === 'macromodule')) { k.ts = ts; k.nonet = nonet; } toks.push(k); return k; };
  const skipWs = () => { while (src[i] === ' ' || src[i] === '\t') i++; };
  const ident = () => { const m = /[A-Za-z_][\w$]*/y; m.lastIndex = i; const r = m.exec(src); if (!r) err('a name was expected here'); i = m.lastIndex; return r[0]; };
  const restOfLine = () => { let j = src.indexOf('\n', i); if (j < 0) j = src.length; const s = src.slice(i, j); i = j; return s; };

  function defineBody() {
    let out = '';
    for (;;) {
      const s = restOfLine();
      if (!/\\\r?$/.test(s)) { out += s; break; }
      out += s.replace(/\\\r?$/, ' '); i++; line++;
      if (i >= src.length) break;
    }
    let str = false;
    for (let j = 0; j < out.length; j++) {            // drop a trailing // comment
      if (out[j] === '"' && out[j - 1] !== '\\') str = !str;
      else if (!str && out[j] === '/' && out[j + 1] === '/') { out = out.slice(0, j); break; }
    }
    return out.trim();
  }
  function str() {
    let s = ''; i++;
    for (;;) {
      const c = src[i++];
      if (c === undefined || c === '\n') err('this string is missing its closing quote');
      if (c === '"') return s;
      if (c !== '\\') { s += c; continue; }
      const e = src[i++];
      if (e === 'n') s += '\n';
      else if (e === 't') s += '\t';
      else if (e === '\n') line++;                                      // backslash-newline continues the string on the next line
      else if (e === '\r' && src[i] === '\n') { i++; line++; }
      else if (e >= '0' && e <= '7') { let o = e; while (o.length < 3 && src[i] >= '0' && src[i] <= '7') o += src[i++]; s += String.fromCharCode(parseInt(o, 8) & 255); }
      else if (e === 'x' && /[0-9a-fA-F]/.test(src[i] || '')) { let h = src[i++]; if (/[0-9a-fA-F]/.test(src[i] || '')) h += src[i++]; s += String.fromCharCode(parseInt(h, 16)); }
      else if (e === undefined) err('this string is missing its closing quote');
      else s += e;
    }
  }
  function directive() {
    i++;
    const name = ident();
    if (name === 'ifdef' || name === 'ifndef') {
      skipWs(); const n = ident(), parentOn = !skipping(), c = defs.has(n) === (name === 'ifdef');
      conds.push({ on: parentOn && c, done: !parentOn || c, els: false, line }); return;
    }
    if (name === 'elsif' || name === 'else' || name === 'endif') {
      const top = conds[conds.length - 1];
      if (!top) err('`' + name + ' without a matching `ifdef');
      if (name === 'endif') { conds.pop(); return; }
      if (top.els) err('`' + name + ' after `else');
      if (name === 'else') { top.on = !top.done; top.done = top.els = true; }
      else { skipWs(); const n = ident(); if (top.done) top.on = false; else if (defs.has(n)) top.on = top.done = true; }
      return;
    }
    if (skipping()) return;
    switch (name) {
      case 'define': {
        skipWs(); const n = ident(); let args = null;
        if (src[i] === '(') { i++; args = []; for (;;) { skipWs(); args.push(ident()); skipWs(); if (src[i] === ',') { i++; continue; } if (src[i] !== ')') err('bad `define argument list'); i++; break; } }
        defs.set(n, { args, body: defineBody() }); return;
      }
      case 'undef': skipWs(); defs.delete(ident()); return;
      case 'timescale': {
        const m = /^\s*(10?0?)\s*([munpf]?s)\s*\/\s*(10?0?)\s*([munpf]?s)/.exec(restOfLine());
        if (!m) err('bad `timescale (expected for example `timescale 1ns/1ps)');
        ts = { unit: m[1].length - 1 + TS_EXP[m[2]], prec: m[3].length - 1 + TS_EXP[m[4]] };
        if (ts.prec > ts.unit) err('`timescale precision is larger than the time unit');
        return;
      }
      case 'default_nettype': nonet = /^\s*none\b/.test(restOfLine()); return;
      case 'resetall': ts = null; nonet = false; return;
      case 'include': err('`include is not supported (this interpreter runs a single file)');
      case 'line': case 'pragma': case 'begin_keywords': case 'unconnected_drive': restOfLine(); return;
      case 'celldefine': case 'endcelldefine': case 'nounconnected_drive': case 'end_keywords': return;
    }
    const d = defs.get(name);
    if (!d) err('`' + name + ' is not defined (missing `define?)');
    if (++expansions > 100000) err('macro expansion limit reached (a `define that expands to itself?)');
    let body = d.body;
    if (d.args) {
      skipWs(); if (src[i] !== '(') err('macro `' + name + ' needs arguments'); i++;
      const actual = []; let depth = 0, cur = '';
      for (;; i++) {
        const c = src[i];
        if (c === undefined) err('the arguments of macro `' + name + ' are not closed');
        if (c === '\n') line++;
        if (c === '"') { const st = i; str(); cur += src.slice(st, i); i--; continue; }
        if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = (e < 0 ? src.length : e) - 1; continue; }
        if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) err('unterminated /* comment'); for (let k = i; k < e; k++) if (src[k] === '\n') line++; i = e + 1; continue; }
        if (c === ')' && depth === 0) { actual.push(cur.trim()); i++; break; }
        if (c === ',' && depth === 0) { actual.push(cur.trim()); cur = ''; continue; }
        if (c === '(' || c === '[' || c === '{') depth++; else if (c === ')' || c === ']' || c === '}') depth--;
        cur += c;
      }
      if (actual.length !== d.args.length) err(`macro \`${name} expects ${d.args.length} argument(s)`);
      body = body.replace(/[A-Za-z_][\w$]*/g, id => { const k = d.args.indexOf(id); return k >= 0 ? actual[k] : id; });
    }
    src = body + ' ' + src.slice(i); i = 0;           // the lexer never looks back, so the consumed prefix can go
  }
  function based(size) {
    i++;
    let signed = false;
    if (src[i] === 's' || src[i] === 'S') { signed = true; i++; }
    const bc = src[i++];
    if (!bc || !/[bBoOdDhH]/.test(bc)) err("this number is incomplete (expected a base such as 'b, 'd or 'h)");
    const base = bc.toLowerCase();
    while (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r') { if (src[i] === '\n') line++; i++; }
    const m = /[0-9a-fA-FxXzZ?_]+/y; m.lastIndex = i;
    const r = m.exec(src);
    if (!r || r[0][0] === '_') err('this number has no digits after its base');
    i = m.lastIndex;
    const digs = r[0].replace(/_/g, '').toLowerCase();
    let a = 0n, b = 0n, nb, ext = null;
    if (base === 'd') {
      if (/^[xz?]$/.test(digs)) { ext = digs === 'x' ? 'x' : 'z'; nb = 1; b = 1n; if (ext === 'x') a = 1n; }
      else if (/^\d+$/.test(digs)) { a = BigInt(digs); nb = a.toString(2).length; }
      else err(`'${digs}' is not a decimal number`);
    } else {
      const bits = base === 'b' ? 1 : base === 'o' ? 3 : 4, radix = 1 << bits, full = BigInt(radix - 1), sh = BigInt(bits);
      for (const ch of digs) {
        a <<= sh; b <<= sh;
        if (ch === 'x') { a |= full; b |= full; }
        else if (ch === 'z' || ch === '?') b |= full;
        else { const d = parseInt(ch, radix); if (!(d < radix)) err(`'${ch}' is not a base-${radix} digit`); a |= BigInt(d); }
      }
      nb = digs.length * bits;
      if (digs[0] === 'x') ext = 'x'; else if (digs[0] === 'z' || digs[0] === '?') ext = 'z';
    }
    let w = size;
    if (w === null) w = Math.max(32, ext ? nb : (a | b).toString(2).length);   // unsized: at least 32 bits
    else if (w < 1 || w > MAXW) err('the size of this number must be between 1 and ' + MAXW);
    if (nb < w && ext) { const fill = mask(w) ^ mask(nb); b |= fill; if (ext === 'x') a |= fill; }
    const m2 = mask(w);
    Object.assign(push('num', null), { w, signed, a: a & m2, b: b & m2, ext: size === null ? ext : null, sized: size !== null });
  }
  function number() {
    const m = /\d[\d_]*/y; m.lastIndex = i;
    const dec = m.exec(src)[0], j = i + dec.length;
    const rm = /(\.\d[\d_]*)?([eE][+-]?\d[\d_]*)?/y; rm.lastIndex = j;
    const r = rm.exec(src);
    if (r[1] || r[2]) { i = j + r[0].length; push('num', null).real = parseFloat((dec + r[0]).replace(/_/g, '')); return; }
    const bm = /\s*'[sS]?[bBoOdDhH]/y; bm.lastIndex = j;
    if (bm.test(src)) {
      i = j; while (src[i] !== "'") { if (src[i] === '\n') line++; i++; }
      based(parseInt(dec.replace(/_/g, ''), 10)); return;
    }
    i = j;
    const n = BigInt(dec.replace(/_/g, ''));
    let w = 32; while (n >> BigInt(w - 1)) w++;
    Object.assign(push('num', null), { w, signed: true, a: n, b: 0n, ext: null, sized: false });
  }

  for (;;) {
    const c = src[i];
    if (c === undefined) break;
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2); if (j < 0) err('this /* comment is never closed');
      for (let k = i; k < j; k++) if (src[k] === '\n') line++;
      i = j + 2; continue;
    }
    if (c === '`') { directive(); continue; }
    if (c === '"') {
      if (skipping()) { const e = src.indexOf('"', i + 1), nl = src.indexOf('\n', i); i = e >= 0 && (nl < 0 || e < nl) ? e + 1 : i + 1; continue; }
      push('str', str()); continue;
    }
    if (skipping()) { i++; continue; }
    if (c >= '0' && c <= '9') { number(); continue; }
    if (c === "'") { based(null); continue; }
    if (/[A-Za-z_]/.test(c)) { const id = ident(); push(KW.has(id) ? 'kw' : 'id', id); continue; }
    if (c === '$') { const m = /\$[\w$]+/y; m.lastIndex = i; const r = m.exec(src); if (!r) err("unexpected '$'"); i = m.lastIndex; push('sys', r[0]); continue; }
    if (c === '\\') { const m = /\\(\S+)/y; m.lastIndex = i; const r = m.exec(src); if (!r) err("unexpected '\\'"); i = m.lastIndex; push('id', r[1]); continue; }
    if (c === '(' && src[i + 1] === '*') {            // (* attribute *) — but not the "(*)" of "@(*)"
      let j = i + 2; while (src[j] === ' ' || src[j] === '\t') j++;
      if (src[j] !== ')') {
        const e = src.indexOf('*)', i + 2); if (e < 0) err('this (* attribute is never closed');
        for (let k = i; k < e; k++) if (src[k] === '\n') line++;
        i = e + 2; continue;
      }
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (op) { push('op', op); i += op.length; continue; }
    if ('+-*/%!~&|^<>=?:;,.()[]{}#@'.includes(c)) { push('op', c); i++; continue; }
    err(`unexpected character '${c}'`);
  }
  if (conds.length) throw new VError('this `ifdef has no matching `endif', conds[conds.length - 1].line);
  toks.push({ t: 'eof', v: 'end of file', line });
  return toks;
}

// ───────────────────────────── parser ─────────────────────────────
const BINPREC = new Map(Object.entries({
  '||': 1, '&&': 2, '|': 3, '^': 4, '~^': 4, '^~': 4, '&': 5, '==': 6, '!=': 6, '===': 6, '!==': 6,
  '<': 7, '<=': 7, '>': 7, '>=': 7, '<<': 8, '>>': 8, '<<<': 8, '>>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10, '**': 11,
}));
const UNOPS = new Set(['+', '-', '!', '~', '&', '~&', '|', '~|', '^', '~^', '^~']);
const DIRS = new Set(['input', 'output', 'inout']);
const PTYPES = new Set(['integer', 'real', 'time', 'realtime']);

class Parser {
  constructor(toks) { this.t = toks; this.p = 0; }
  get tok() { return this.t[this.p]; }
  err(m) { throw new VError(m, this.tok.line); }
  show() { const k = this.tok; return k.t === 'num' ? 'a number' : k.t === 'str' ? 'a string' : k.t === 'eof' ? 'the end of the file' : `'${k.v}'`; }
  at(v) { const k = this.t[this.p]; return (k.t === 'op' || k.t === 'kw') && k.v === v; }
  atKw(set) { const k = this.t[this.p]; return k.t === 'kw' && set.has(k.v); }
  eat(v) { if (this.at(v)) { this.p++; return true; } return false; }
  need(v) { if (!this.eat(v)) this.err(`expected '${v}' but found ${this.show()}`); }
  id() {
    const k = this.tok;
    if (k.t !== 'id') this.err(k.t === 'kw' ? `'${k.v}' is a reserved word and cannot be used as a name` : `expected a name but found ${this.show()}`);
    this.p++; return k.v;
  }
  eof(what) { if (this.tok.t === 'eof') this.err(`'${what}' is missing`); }
  noStrength() { if (this.at('(') && this.t[this.p + 1].t === 'kw' && STRENGTHS.has(this.t[this.p + 1].v)) this.err('drive strengths are not supported'); }

  source() {
    const mods = [];
    while (this.tok.t !== 'eof') {
      if (this.at('module') || this.at('macromodule')) mods.push(this.module());
      else this.err(`expected 'module' but found ${this.show()}`);
    }
    return mods;
  }
  module() {
    const k = this.tok; this.p++;
    const m = { name: this.id(), line: k.line, ts: k.ts, nonet: k.nonet, ports: [], pint: null, items: [] };
    if (this.eat('#')) {
      this.need('(');
      let head = { signed: false, range: null, ptype: null };
      do {
        if (this.eat('parameter') || this.at('signed') || this.at('[') || this.atKw(PTYPES)) head = this.paramHead();
        m.items.push({ ...this.paramOne(head, false), hdr: true });
      } while (this.eat(','));
      this.need(')');
    }
    if (this.eat('(')) {
      if (!this.at(')')) {
        if (this.atKw(DIRS)) {
          let h = null;
          do {
            if (this.atKw(DIRS)) { const d = this.tok.v; this.p++; h = this.declHead(d); }
            const line = this.tok.line, name = this.id();
            const init = this.eat('=') ? this.expr() : null;
            m.ports.push(name); m.items.push({ k: 'decl', line, ...h, vars: [{ name, dims: [], init, line }] });
          } while (this.eat(','));
        } else do {
          if (this.eat('.')) {                         // .external(internal)
            const ext = this.id(); this.need('('); const int = this.id(); this.need(')');
            m.ports.push(ext); (m.pint || (m.pint = {}))[ext] = int;
          } else m.ports.push(this.id());
        } while (this.eat(','));
      }
      this.need(')');
    }
    this.need(';');
    while (!this.at('endmodule')) { this.eof('endmodule'); m.items.push(...this.item()); }
    this.p++;
    if (m.items.some(i => i.hdr)) for (const it of m.items) if (it.k === 'param' && !it.hdr) it.local = true;   // with a #( ) list, body parameters are local
    return m;
  }
  paramHead() {
    const o = { signed: false, range: null, ptype: null };
    if (this.atKw(PTYPES)) { o.ptype = this.tok.v; this.p++; }
    else { if (this.eat('signed')) o.signed = true; if (this.at('[')) o.range = this.range(); }
    return o;
  }
  paramOne(head, local) {
    const line = this.tok.line, name = this.id();
    this.need('=');
    return { k: 'param', line, local, name, expr: this.expr(), ...head };
  }
  declHead(dir) {
    const h = { dir, kind: null, signed: false, range: null, delay: null };
    if (this.atKw(NETS) || this.atKw(VARS)) { h.kind = this.tok.v; this.p++; }
    this.noStrength();
    if (this.eat('signed')) h.signed = true;
    if (this.at('[')) h.range = this.range();
    return h;
  }
  declVars() {
    const vars = [];
    do {
      const line = this.tok.line, name = this.id(), dims = [];
      while (this.at('[')) dims.push(this.range());
      vars.push({ name, dims, init: this.eat('=') ? this.expr() : null, line });
    } while (this.eat(','));
    return vars;
  }
  range() { this.need('['); const msb = this.expr(); this.need(':'); const lsb = this.expr(); this.need(']'); return { msb, lsb }; }

  item() {
    const k = this.tok, line = k.line;
    if (k.t === 'kw') {
      if (DIRS.has(k.v)) { this.p++; const h = this.declHead(k.v), vars = this.declVars(); this.need(';'); return [{ k: 'decl', line, ...h, vars }]; }
      if (NETS.has(k.v) || VARS.has(k.v)) {
        const h = this.declHead(null);
        if (this.at('#')) { if (!NETS.has(h.kind)) this.err(`a ${h.kind} cannot have a delay; only nets can`); h.delay = this.delayVal(); }
        const vars = this.declVars(); this.need(';');
        return [{ k: 'decl', line, ...h, vars }];
      }
      if (GATES.has(k.v)) return this.gates();
      switch (k.v) {
        case 'event': { this.p++; const vars = this.declVars(); this.need(';'); return [{ k: 'decl', line, dir: null, kind: 'event', signed: false, range: null, delay: null, vars }]; }
        case 'genvar': { this.p++; const names = []; do names.push(this.id()); while (this.eat(',')); this.need(';'); return [{ k: 'genvar', line, names }]; }
        case 'parameter': case 'localparam': {
          this.p++;
          const head = this.paramHead(), out = [];
          do out.push(this.paramOne(head, k.v === 'localparam')); while (this.eat(','));
          this.need(';'); return out;
        }
        case 'assign': {
          this.p++; this.noStrength();
          const delay = this.at('#') ? this.delayVal() : null, out = [];
          do { const l = this.tok.line, lhs = this.lvalue(); this.need('='); out.push({ k: 'assign', line: l, lhs, rhs: this.expr(), delay }); } while (this.eat(','));
          this.need(';'); return out;
        }
        case 'always': case 'initial': this.p++; return [{ k: k.v, line, body: this.stmt() }];
        case 'function': return [this.func()];
        case 'task': return [this.task()];
        case 'generate': { this.p++; const out = []; while (!this.eat('endgenerate')) { this.eof('endgenerate'); out.push(...this.item()); } return out; }
        case 'for': case 'if': case 'case': case 'begin': return [this.genItem()];
        case 'defparam': this.err('defparam is not supported; use #(...) parameter overrides');
        case 'specify': while (!this.eat('endspecify')) { this.eof('endspecify'); this.p++; } return [];
      }
      if (UNSUPPORTED.has(k.v)) this.err(`'${k.v}' is not supported by this interpreter`);
      this.err(`'${k.v}' cannot appear here` + (k.v === 'end' || k.v === 'else' ? ' (mismatched begin/end?)' : ''));
    }
    if (this.eat(';')) return [];
    if (k.t === 'id') return this.instances();
    this.err(`unexpected ${this.show()} in a module body`);
  }
  genItem() {
    const line = this.tok.line;
    if (this.eat('for')) {
      this.need('(');
      const inline = this.eat('genvar'), iv = this.id(); this.need('='); const init = this.expr(); this.need(';');
      const cond = this.expr(); this.need(';');
      const sv = this.id(); this.need('='); const step = this.expr(); this.need(')');
      if (sv !== iv) this.err('a generate loop must step its own genvar');
      return { k: 'genfor', line, iv, inline, init, cond, step, body: this.genBlock() };
    }
    if (this.eat('if')) { this.need('('); const cond = this.expr(); this.need(')'); const then = this.genBlock(); return { k: 'genif', line, cond, then, els: this.eat('else') ? this.genBlock() : null }; }
    if (this.eat('case')) {
      this.need('('); const expr = this.expr(); this.need(')');
      const items = [];
      while (!this.eat('endcase')) {
        this.eof('endcase');
        let exprs = null;
        if (this.eat('default')) this.eat(':'); else { exprs = []; do exprs.push(this.expr()); while (this.eat(',')); this.need(':'); }
        items.push({ exprs, body: this.genBlock() });
      }
      return { k: 'gencase', line, expr, items };
    }
    return this.genBlock();
  }
  genBlock() {
    const line = this.tok.line, bare = this.at('if') || this.at('case');   // a directly nested if/case shares its parent's scope
    if (!this.eat('begin')) return { k: 'genblock', line, name: null, bare, items: this.item() };
    const name = this.eat(':') ? this.id() : null, items = [];
    while (!this.eat('end')) { this.eof('end'); items.push(...this.item()); }
    if (this.eat(':')) this.id();
    return { k: 'genblock', line, name, bare: false, items };
  }
  gates() {
    const type = this.tok.v; this.p++;
    this.noStrength();
    const delay = this.at('#') ? this.delayVal() : null, out = [];
    do {
      const line = this.tok.line, name = this.tok.t === 'id' ? this.id() : null;
      if (this.at('[')) this.err('arrays of gates are not supported');
      this.need('('); const terms = []; do terms.push(this.expr()); while (this.eat(',')); this.need(')');
      out.push({ k: 'gate', line, type, name, terms, delay });
    } while (this.eat(','));
    this.need(';'); return out;
  }
  instances() {
    const mod = this.id();
    if (this.at('=') || this.at('<=') || this.at('[')) this.err(`an assignment to '${mod}' must be inside an initial or always block (or use: assign ${mod} = ...;)`);
    if (this.tok.t !== 'id' && !this.at('#')) this.err(`'${mod}' is not something that can start a module item (a misspelled keyword?)`);
    let params = null;
    if (this.eat('#')) { this.need('('); params = this.connList(); this.need(')'); }
    const out = [];
    do {
      const line = this.tok.line, name = this.id();
      if (this.at('[')) this.err('arrays of instances are not supported');
      if (!this.at('(')) this.err(`'${mod}' is not a keyword, so this looks like an instance of a module named '${mod}', which needs a port list: ${mod} ${name} (...);`);
      this.p++; const conns = this.connList(); this.need(')');
      out.push({ k: 'inst', line, mod, params, name, conns });
    } while (this.eat(','));
    this.need(';'); return out;
  }
  connList() {
    const list = []; let named = false;
    if (this.at(')')) return { named, list };
    do {
      if (this.eat('.')) { named = true; const name = this.id(); this.need('('); const expr = this.at(')') ? null : this.expr(); this.need(')'); list.push({ name, expr }); }
      else list.push({ name: null, expr: this.at(',') || this.at(')') ? null : this.expr() });
    } while (this.eat(','));
    if (named && list.some(c => c.name === null)) this.err('named (.port(signal)) and positional connections cannot be mixed');
    return { named, list };
  }
  func() {
    const line = this.tok.line; this.p++;
    const f = { k: 'function', line, auto: this.eat('automatic'), signed: false, range: null, rtype: null, ports: [], decls: [] };
    if (this.eat('signed')) f.signed = true;
    if (this.at('[')) f.range = this.range(); else if (this.atKw(PTYPES)) { f.rtype = this.tok.v; this.p++; }
    f.name = this.id(); this.tfHeader(f);
    f.body = this.stmt(); this.need('endfunction');
    return f;
  }
  task() {
    const line = this.tok.line; this.p++;
    const t = { k: 'task', line, auto: this.eat('automatic'), name: this.id(), ports: [], decls: [] };
    this.tfHeader(t);
    t.body = this.at('endtask') ? { k: 'null', line } : this.stmt();
    this.need('endtask');
    return t;
  }
  tfHeader(f) {
    if (this.eat('(')) {
      if (!this.at(')')) {
        let h = null;
        do {
          if (this.atKw(DIRS)) { const d = this.tok.v; this.p++; h = this.declHead(d); } else if (!h) this.err('expected input, output or inout');
          const line = this.tok.line, name = this.id();
          f.ports.push(name); f.decls.push({ k: 'decl', line, ...h, vars: [{ name, dims: [], init: null, line }] });
        } while (this.eat(','));
      }
      this.need(')');
    }
    this.need(';');
    for (;;) {
      const k = this.tok;
      if (this.atKw(DIRS)) {
        this.p++; const h = this.declHead(k.v), vars = this.declVars(); this.need(';');
        for (const v of vars) f.ports.push(v.name);
        f.decls.push({ k: 'decl', line: k.line, ...h, vars });
      } else if (this.atKw(VARS) || this.at('event') || this.at('parameter') || this.at('localparam')) f.decls.push(...this.item());
      else break;
    }
  }

  stmt() {
    const k = this.tok, line = k.line;
    if (k.t === 'kw') switch (k.v) {
      case 'begin': case 'fork': {
        this.p++;
        const end = k.v === 'begin' ? 'end' : 'join', name = this.eat(':') ? this.id() : null, decls = [], stmts = [];
        while (this.atKw(VARS) || this.at('event') || this.at('parameter') || this.at('localparam')) {
          if (!name) this.err(`variables can only be declared in a named block (${k.v} : some_name)`);
          decls.push(...this.item());
        }
        while (!this.eat(end)) { this.eof(end); stmts.push(this.stmt()); }
        if (this.eat(':')) this.id();
        return { k: k.v === 'begin' ? 'block' : 'fork', line, name, decls, stmts };
      }
      case 'if': { this.p++; this.need('('); const cond = this.expr(); this.need(')'); const then = this.stmt(); return { k: 'if', line, cond, then, els: this.eat('else') ? this.stmt() : null }; }
      case 'case': case 'casez': case 'casex': {
        this.p++; this.need('('); const expr = this.expr(); this.need(')');
        const items = [];
        while (!this.eat('endcase')) {
          this.eof('endcase');
          let exprs = null;
          if (this.eat('default')) this.eat(':'); else { exprs = []; do exprs.push(this.expr()); while (this.eat(',')); this.need(':'); }
          items.push({ exprs, body: this.stmt() });
        }
        return { k: 'case', line, type: k.v, expr, items };
      }
      case 'for': { this.p++; this.need('('); const init = this.assignment(); this.need(';'); const cond = this.expr(); this.need(';'); const step = this.assignment(); this.need(')'); return { k: 'for', line, init, cond, step, body: this.stmt() }; }
      case 'while': case 'repeat': case 'wait': { this.p++; this.need('('); const cond = this.expr(); this.need(')'); return { k: k.v, line, cond, body: this.stmt() }; }
      case 'forever': this.p++; return { k: 'forever', line, body: this.stmt() };
      case 'disable': { this.p++; const target = this.nameRef(); this.need(';'); return { k: 'disable', line, target }; }
      case 'assign': case 'deassign': case 'force': case 'release': this.err(`procedural '${k.v}' is not supported`);
    }
    if (this.eat(';')) return { k: 'null', line };
    if (this.at('#')) { const delay = this.delayVal(); return { k: 'delay', line, delay, body: this.stmt() }; }
    if (this.at('@')) { const ev = this.eventCtl(); return { k: 'evwait', line, ev, body: this.stmt() }; }
    if (this.eat('->')) { const target = this.nameRef(); this.need(';'); return { k: 'trigger', line, target }; }
    if (k.t === 'sys') { this.p++; const args = this.callArgs(true); this.need(';'); return { k: 'syscall', line, name: k.v, args }; }
    if (k.t === 'id') {
      const ref = this.nameRef();
      if (this.at('=') || this.at('<=')) return this.assignTail(ref, line, true);
      if (ref.sels.length) this.err(`expected '=' or '<=' but found ${this.show()}`);
      const args = this.callArgs(false);
      if (!this.at(';')) this.err(`expected '=', '<=' or ';' after '${ref.path[ref.path.length - 1].n}' but found ${this.show()}`);
      this.p++;
      return { k: 'taskcall', line, target: ref, args };
    }
    if (this.at('{')) return this.assignTail(this.lvalue(), line, true);
    this.err(`unexpected ${this.show()}`);
  }
  assignTail(lhs, line, semi) {
    if (!this.at('=') && !this.at('<=')) this.err(`expected '=' or '<=' but found ${this.show()}`);
    const nb = this.at('<='); this.p++;
    let delay = null, ev = null, rep = null;
    if (this.at('#')) delay = this.delayVal();
    else if (this.at('@')) ev = this.eventCtl();
    else if (this.at('repeat')) { this.p++; this.need('('); rep = this.expr(); this.need(')'); ev = this.eventCtl(); }
    const rhs = this.expr();
    if (semi) this.need(';');
    return { k: 'assign', line, lhs, rhs, nb, delay, ev, rep };
  }
  assignment() { const line = this.tok.line, lhs = this.lvalue(); if (!this.at('=')) this.err(`expected '=' but found ${this.show()}`); return this.assignTail(lhs, line, false); }
  callArgs(allowEmpty) {
    const args = [];
    if (!this.eat('(')) return args;
    if (this.eat(')')) return args;
    do args.push(allowEmpty && (this.at(',') || this.at(')')) ? null : this.expr()); while (this.eat(','));
    this.need(')');
    return args;
  }
  delayVal() {
    this.need('#');
    const k = this.tok;
    if (k.t === 'num') { this.p++; return numNode(k); }
    if (k.t === 'id') return this.nameRef();
    this.need('(');
    const list = [];
    do {
      let e = this.expr();
      if (this.eat(':')) { e = this.expr(); this.need(':'); this.expr(); }      // min:typ:max — the typical value is used
      list.push(e);
    } while (this.eat(','));
    this.need(')');
    if (list.length > 3) this.err('a delay has at most three values (rise, fall, turn-off)');
    return list.length === 1 ? list[0] : { k: 'delays', line: k.line, list };
  }
  eventCtl() {
    this.need('@');
    if (this.eat('*')) return { star: true };
    if (this.tok.t === 'id') return { items: [{ edge: 'any', expr: this.nameRef() }] };
    this.need('(');
    if (this.eat('*')) { this.need(')'); return { star: true }; }
    const items = [];
    do {
      const edge = this.eat('posedge') ? 'pos' : this.eat('negedge') ? 'neg' : 'any';
      items.push({ edge, expr: this.expr() });
    } while (this.eat('or') || this.eat(','));
    this.need(')');
    return { items };
  }
  nameRef() {
    const line = this.tok.line, path = [];
    for (;;) {
      const n = this.id(), sels = [];
      while (this.at('[')) sels.push(this.select());
      if (this.eat('.')) { path.push({ n, ix: sels.map(s => { if (s.k !== 'idx') this.err('a hierarchical name can only index a scope with a single number'); return s.e; }) }); continue; }
      path.push({ n, ix: [] });
      return { k: 'id', line, path, sels };
    }
  }
  select() {
    this.need('[');
    const e = this.expr();
    let s;
    if (this.eat(':')) s = { k: 'range', msb: e, lsb: this.expr() };
    else if (this.eat('+:')) s = { k: 'plus', base: e, width: this.expr() };
    else if (this.eat('-:')) s = { k: 'minus', base: e, width: this.expr() };
    else s = { k: 'idx', e };
    this.need(']');
    return s;
  }
  lvalue() {
    const line = this.tok.line;
    if (!this.eat('{')) return this.nameRef();
    const parts = []; do parts.push(this.lvalue()); while (this.eat(','));
    this.need('}');
    return { k: 'concat', line, parts };
  }
  expr() {
    const c = this.bin(1);
    if (!this.at('?')) return c;
    const line = this.tok.line; this.p++;
    const a = this.expr(); this.need(':');
    return { k: 'tern', line, c, a, b: this.expr() };
  }
  bin(min) {
    let l = this.unary();
    for (;;) {
      const k = this.tok, pr = k.t === 'op' ? BINPREC.get(k.v) : undefined;
      if (!pr || pr < min) return l;
      this.p++;
      l = { k: 'bin', line: k.line, op: k.v, l, r: this.bin(pr + 1) };
    }
  }
  unary() {
    const k = this.tok;
    if (k.t === 'op' && UNOPS.has(k.v)) { this.p++; return { k: 'un', line: k.line, op: k.v, e: this.unary() }; }
    return this.primary();
  }
  primary() {
    const k = this.tok, line = k.line;
    if (k.t === 'num') { this.p++; return numNode(k); }
    if (k.t === 'str') { this.p++; return { k: 'str', line, v: k.v }; }
    if (k.t === 'sys') { this.p++; return { k: 'sysfn', line, name: k.v, args: this.callArgs(false) }; }
    if (k.t === 'id') {
      const ref = this.nameRef();
      if (!this.at('(')) return ref;
      if (ref.sels.length) this.err("unexpected '('");
      return { k: 'call', line, target: ref, args: this.callArgs(false) };
    }
    if (this.eat('(')) {
      const e = this.expr();
      if (this.eat(':')) { const typ = this.expr(); this.need(':'); this.expr(); this.need(')'); return typ; }   // (min:typ:max)
      this.need(')'); return e;
    }
    if (this.eat('{')) {
      const first = this.expr();
      if (this.eat('{')) { const parts = []; do parts.push(this.expr()); while (this.eat(',')); this.need('}'); this.need('}'); return { k: 'repl', line, n: first, parts }; }
      const parts = [first]; while (this.eat(',')) parts.push(this.expr());
      this.need('}');
      return { k: 'concat', line, parts };
    }
    this.err(k.t === 'kw' ? `'${k.v}' is a reserved word and cannot be used in an expression` : `unexpected ${this.show()} in an expression`);
  }
}
const numNode = k => ({ k: 'num', line: k.line, w: k.w, signed: k.signed, a: k.a, b: k.b, ext: k.ext, sized: k.sized, real: k.real });

// ───────────────────────────── simulator ─────────────────────────────
const FINISH = { finish: true }, KILLED = { killed: true };
class Disable { constructor(target) { this.target = target; } }
const NOP = { blk: false, run() {} };
const realNode = f => ({ w: 64, s: true, real: true, mk: () => f });
const vecNode = (w, s, f) => ({ w, s, real: false, mk: (W, S) => W === w ? f : () => resize(f(), W, S) });
const bitNode = f => vecNode(1, false, f);
const MATH1 = { $ln: Math.log, $log10: Math.log10, $exp: Math.exp, $sqrt: Math.sqrt, $floor: Math.floor, $ceil: Math.ceil, $sin: Math.sin, $cos: Math.cos, $tan: Math.tan,
  $asin: Math.asin, $acos: Math.acos, $atan: Math.atan, $sinh: Math.sinh, $cosh: Math.cosh, $tanh: Math.tanh, $asinh: Math.asinh, $acosh: Math.acosh, $atanh: Math.atanh };
const MATH2 = { $pow: Math.pow, $atan2: Math.atan2, $hypot: Math.hypot };
const ARITY = { $time: 0, $stime: 0, $realtime: 0, $signed: 1, $unsigned: 1, $clog2: 1, $bits: 1, $rtoi: 1, $itor: 1, $realtobits: 1, $bitstoreal: 1, $random: 1, $urandom: 1, $urandom_range: 2, $dist_uniform: 3 };

function edgeHit(edge, o, n) {
  if (typeof n === 'number') return edge === 'any' && o !== n;
  if (edge === 'any') return o.a !== n.a || o.b !== n.b;
  const ob = bitState(o), nb = bitState(n);
  if (ob === nb) return false;
  return edge === 'pos' ? ob === 0 || nb === 1 : ob === 1 || nb === 0;
}
function heapPush(h, t) { let i = h.length; h.push(t); while (i > 0) { const p = (i - 1) >> 1; if (h[p] <= t) break; h[i] = h[p]; i = p; } h[i] = t; }
function heapPop(h) {
  const top = h[0], last = h.pop(), n = h.length;
  if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && h[c + 1] < h[c]) c++; if (h[c] >= last) break; h[i] = h[c]; i = c; } h[i] = last; }
  return top;
}
function instantiated(items, used) {
  for (const it of items) {
    if (it.k === 'inst') used.add(it.mod);
    else if (it.k === 'genfor') instantiated(it.body.items, used);
    else if (it.k === 'genif') { instantiated(it.then.items, used); if (it.els) instantiated(it.els.items, used); }
    else if (it.k === 'gencase') for (const c of it.items) instantiated(c.body.items, used);
    else if (it.k === 'genblock') instantiated(it.items, used);
  }
}

class Sim {
  constructor(mods, opts = {}) {
    this.mods = new Map();
    for (const m of mods) { if (this.mods.has(m.name)) throw new VError(`module '${m.name}' is defined twice`, m.line); this.mods.set(m.name, m); }
    this.out = opts.onOutput; this.outLen = 0; this.maxOut = opts.maxOutput || 4e6;
    this.maxTime = opts.maxTime || Infinity; this.maxOps = opts.maxOps || 5e7; this.maxStep = opts.maxStepOps || 1e7;
    this.cap = Math.min(this.maxOps, this.maxStep);          // ops allowed before the next check-in: the total budget, or the budget for one time step
    this.trace = opts.waves !== false; this.maxChg = opts.maxChanges || 200000; this.nchg = 0; this.sigs = [];
    this.time = 0; this.active = []; this.inactive = []; this.nbaq = []; this.postponed = []; this.future = new Map(); this.heap = [];
    this.finished = false; this.stopped = null; this.ops = 0; this.depth = 0; this.line = 0; this.cur = null; this.boot = null;
    this.cas = []; this.pushes = []; this.procs = []; this.binds = []; this.later = []; this.nets = []; this.funcs = [];
    this.seed = 0; this.tf = null; this.monitor = null; this.monOn = true; this.prec = 0; this.quiet = false;
    this.root = { parent: null, name: '', path: '', kind: 'root', names: new Map(), pdir: new Map(), gen: 0, tu: 1, tp: 1, ts: null, pre: null, live: 0 };
  }
  emit(s) {
    if (this.quiet) return;         // constant functions run during elaboration print nothing
    if ((this.outLen += s.length) > this.maxOut) throw new VError('output limit reached; the simulation was stopped', this.line);
    this.out(s);
  }
  limit() {
    if (this.ops > this.maxOps) throw new VError(`step limit reached (${this.maxOps} steps) — is a $finish missing?`, this.line);
    throw new VError(`the simulation is stuck at time ${this.time}: ${this.maxStep} steps ran without time advancing (a loop with no delay, or a combinational loop that oscillates)`, this.line);
  }

  // ── elaboration ──
  elaborate() {
    const used = new Set();
    for (const m of this.mods.values()) instantiated(m.items, used);
    const tops = [...this.mods.values()].filter(m => !used.has(m.name));
    if (!tops.length) throw new VError('there is no top-level module (every module is instantiated by another one)');
    let any = false;
    for (const m of this.mods.values()) if (m.ts) { this.prec = any ? Math.min(this.prec, m.ts.prec) : m.ts.prec; any = true; }
    this.quiet = true;
    for (const m of tops) this.elabModule(m, this.mkScope(this.root, m.name, 'module', m.line), null, 0);
    for (const f of this.binds) f();          // inout ports first: they redirect drivers
    for (const f of this.later) f();
    this.quiet = false;
  }
  mkScope(parent, name, kind, line, hidden) {
    const s = { parent, name, kind, names: new Map(), path: parent.path ? parent.path + '.' + name : name, mod: parent.mod, tu: parent.tu, tp: parent.tp, ts: parent.ts,
      pdir: new Map(), gen: 0, pre: null, live: 0, aborts: new Set(), init: null };
    if (!hidden) this.declName(parent, name, { kind: 'scope', scope: s }, line);
    return s;
  }
  declName(sc, name, ent, line) {
    if (sc.names.has(name)) throw new VError(`'${name}' is already declared`, line);
    sc.names.set(name, ent);
  }
  elabModule(def, sc, over, depth) {
    if (depth > 64) throw new VError(`module '${def.name}' instantiates itself`, def.line);
    const ts = def.ts || { unit: 0, prec: 0 };
    sc.mod = def; sc.ts = ts; sc.tu = 10 ** (ts.unit - this.prec); sc.tp = 10 ** (ts.prec - this.prec);
    sc.over = over; sc.pidx = 0;
    const own = [];
    this.elabItems(def.items, sc, own, depth);
    for (const p of def.ports) {
      const n = (def.pint && def.pint[p]) || p;
      if (!sc.pdir.has(n)) throw new VError(`port '${n}' of module '${def.name}' has no input/output declaration`, def.line);
    }
    if (over && over.named && over.map.size) throw new VError(`module '${def.name}' has no parameter '${[...over.map.keys()][0]}' that can be overridden`, over.line);
    if (over && !over.named && over.list.length > sc.pidx) throw new VError(`too many parameter overrides for module '${def.name}'`, over.line);
    this.later.push(...own);          // children were pushed first: their processes start before the parent's
  }
  elabItems(items, sc, own, depth) {
    for (const it of items) if (it.k === 'function' || it.k === 'task') {      // usable before the point of declaration
      const ent = { kind: it.k === 'function' ? 'func' : 'task', name: it.name, ast: it, scope: sc, c: null, live: 0, aborts: new Set() };
      this.declName(sc, it.name, ent, it.line);
      own.push(() => { this.line = it.line; if (ent.kind === 'func') this.ensureFunc(ent); else this.ensureTask(ent); });
    }
    for (const it of items) {
      this.line = it.line;
      switch (it.k) {
        case 'param': this.elabParam(it, sc); break;
        case 'decl': this.declare(it, sc, own); break;
        case 'genvar': for (const n of it.names) if (!sc.names.has(n)) sc.names.set(n, { kind: 'genvar', name: n }); break;
        case 'assign': this.implicit(it.lhs, sc); own.push(() => this.cContAssign(sc, it.lhs, it.rhs, it.delay, it.line)); break;
        case 'always': this.preBlocks(it.body, sc); own.push(() => this.cAlways(sc, it)); break;
        case 'initial': this.preBlocks(it.body, sc); own.push(() => this.cInitial(sc, it)); break;
        case 'gate':
          if (it.name) this.declName(sc, it.name, { kind: 'gate', name: it.name }, it.line);
          for (const t of it.terms) this.implicit(t, sc);
          own.push(() => this.cGate(sc, it));
          break;
        case 'inst': this.elabInst(sc, it, own, depth); break;
        case 'genfor': {
          const n = ++sc.gen, gname = it.body.name || this.genName(sc, n);
          if (it.body.name) this.declName(sc, gname, { kind: 'generate loop', name: gname }, it.line);
          if (!it.inline) { const g = this.lookup(it.iv, sc); if (!g || g.kind !== 'genvar') throw new VError(`'${it.iv}' is not a genvar (declare it first: genvar ${it.iv};)`, it.line); }
          const tmp = v => ({ parent: sc, names: new Map([[it.iv, this.intParam(v)]]), kind: 'gen', path: sc.path, mod: sc.mod, tu: sc.tu, tp: sc.tp });
          let v = this.cint(it.init, sc, 'generate loop start');
          for (let guard = 0; this.ctrue(it.cond, tmp(v)); guard++) {
            if (guard > 65536) throw new VError('this generate loop does not terminate', it.line);
            const gs = this.mkScope(sc, `${gname}[${v}]`, 'gen', it.line);
            gs.names.set(it.iv, this.intParam(v));
            this.elabItems(it.body.items, gs, own, depth);
            v = this.cint(it.step, tmp(v), 'generate loop step');
          }
          break;
        }
        case 'genif': { const n = ++sc.gen, b = this.ctrue(it.cond, sc) ? it.then : it.els; if (b) this.elabGenBlock(b, sc, own, depth, n); break; }
        case 'gencase': {
          const n = ++sc.gen, kx = { scope: sc, konst: true }, sel = this.cExpr(it.expr, kx);
          let pick = null;
          for (const c of it.items) {
            if (!c.exprs) { pick = pick || c.body; continue; }
            if (c.exprs.some(e => {
              const x = this.cExpr(e, kx);
              if (sel.real || x.real) return this.toReal(sel)() === this.toReal(x)();
              const W = Math.max(sel.w, x.w), S = sel.s && x.s; return CMP['==='](sel.mk(W, S)(), x.mk(W, S)()) === V1;
            })) { pick = c.body; break; }
          }
          if (pick) this.elabGenBlock(pick, sc, own, depth, n);
          break;
        }
        case 'genblock': this.elabGenBlock(it, sc, own, depth, ++sc.gen); break;
      }
    }
  }
  elabGenBlock(b, sc, own, depth, n) {
    if (b.bare) { sc.gen--; this.elabItems(b.items, sc, own, depth); return; }       // "else if": no scope of its own, same ordinal
    this.elabItems(b.items, this.mkScope(sc, b.name || this.genName(sc, n), 'gen', b.line), own, depth);
  }
  genName(sc, n) { let nm = 'genblk' + n; while (sc.names.has(nm)) nm = nm.replace('genblk', 'genblk0'); return nm; }   // IEEE 1364-2005 12.4.3
  intParam(v) { return { kind: 'param', w: 32, s: true, real: false, val: vn(32, v), msb: 31, lsb: 0 }; }
  elabParam(it, sc) {
    let src = it.expr, from = sc;
    if (!it.local && sc.kind === 'module' && sc.over) {
      const o = sc.over;
      if (o.named) { if (o.map.has(it.name)) { const e = o.map.get(it.name); o.map.delete(it.name); if (e) { src = e; from = o.scope; } } }
      else if (sc.pidx < o.list.length && o.list[sc.pidx]) { src = o.list[sc.pidx]; from = o.scope; }
      sc.pidx++;
    }
    const n = this.cExpr(src, { scope: from, konst: true });
    const p = { kind: 'param', name: it.name, w: 64, s: true, real: false, val: null, msb: 0, lsb: 0 };
    if (it.ptype === 'real' || it.ptype === 'realtime' || (n.real && !it.ptype && !it.range)) { p.real = true; p.val = this.toReal(n)(); }
    else {
      if (it.ptype === 'integer') { p.w = 32; p.s = true; }
      else if (it.ptype === 'time') { p.w = 64; p.s = false; }
      else if (it.range) { p.msb = this.cint(it.range.msb, sc, 'range bound'); p.lsb = this.cint(it.range.lsb, sc, 'range bound'); p.w = Math.abs(p.msb - p.lsb) + 1; p.s = it.signed; }
      else { p.w = n.w; p.s = it.signed || n.s; }
      if (!it.range) p.msb = p.w - 1;
      p.val = this.cRhs(n, p.w, false)();
    }
    this.declName(sc, it.name, p, it.line);
  }
  declare(it, sc, own) {
    const tf = sc.kind === 'func' || sc.kind === 'task', kind = it.kind;
    const real = kind === 'real' || kind === 'realtime', isVar = VARS.has(kind) || kind === 'event' || tf;
    if (!tf && (it.dir === 'input' || it.dir === 'inout') && VARS.has(kind)) throw new VError(`an ${it.dir} port cannot be a ${kind}; it has to be a net`, it.line);
    for (const v of it.vars) {
      const line = v.line || it.line; this.line = line;
      if (v.init && !tf && (it.dir === 'input' || it.dir === 'inout')) throw new VError(`${it.dir} port '${v.name}' cannot have an initial value`, line);
      let w = 1, msb = 0, lsb = 0, signed = it.signed, ranged = false;
      if (kind === 'integer') { w = 32; msb = 31; signed = true; ranged = true; }
      else if (kind === 'time') { w = 64; msb = 63; ranged = true; }
      else if (kind === 'event') { w = 32; msb = 31; ranged = true; }
      else if (it.range) {
        msb = this.cint(it.range.msb, sc, 'range bound'); lsb = this.cint(it.range.lsb, sc, 'range bound'); w = Math.abs(msb - lsb) + 1; ranged = true;
        if (w > MAXW) throw new VError(`'${v.name}' is too wide (${w} bits)`, line);
      }
      const ex = sc.names.get(v.name);
      if (ex && ex.kind === 'sig' && !ex.done && !v.dims.length && !ex.dims && (ex.implicit || !!it.dir !== sc.pdir.has(v.name))) {
        // the other half of a non-ANSI port declaration ("output q;" + "reg q;", in either order), or a wire that was used before its declaration
        if (it.dir) sc.pdir.set(v.name, it.dir);
        if (ranged) { ex.w = w; ex.msb = msb; ex.lsb = lsb; ex.scalar = false; }
        if (signed) ex.signed = true;
        if (real) ex.real = true;
        if (VARS.has(kind) || (isVar && !it.dir)) ex.net = false;
        if (ex.implicit) ex.implicit = false; else ex.done = true;
        this.netKind(ex, kind);
        ex.val = initVal(ex);
        if (ex.hist) ex.hist = [[0, ex.val]];
        const dir = sc.pdir.get(v.name);
        if (!tf && !ex.net && (dir === 'input' || dir === 'inout')) throw new VError(`port '${v.name}' is an ${dir}, so it cannot be a variable`, line);
        this.declInit(ex, v, it, sc, own, line);
        continue;
      }
      if (ex) throw new VError(`'${v.name}' is already declared`, line);
      const dims = v.dims.map(d => { const a = this.cint(d.msb, sc, 'array bound'), b = this.cint(d.lsb, sc, 'array bound'); return { lo: Math.min(a, b), hi: Math.max(a, b), n: Math.abs(a - b) + 1 }; });
      const sig = this.mkSig(sc, v.name, { w, msb, lsb, signed, real, net: !isVar && !real, dims, isEvent: kind === 'event', scalar: !ranged });
      this.netKind(sig, kind);
      if (it.dir) sc.pdir.set(v.name, it.dir);
      this.declInit(sig, v, it, sc, own, line);
    }
  }
  netKind(sig, kind) {
    for (const s of sig.elems || [sig]) {
      if (kind === 'tri0' || kind === 'tri1') s.pull = { a: kind === 'tri1' ? mask(s.w) : 0n, m: mask(s.w) };
      else if (kind === 'wand' || kind === 'triand') s.res = wAnd;
      else if (kind === 'wor' || kind === 'trior') s.res = wOr;
    }
  }
  declInit(sig, v, it, sc, own, line) {
    if (it.kind === 'supply0' || it.kind === 'supply1')
      own.push(() => { const d = this.addDriver(sig), c = V(sig.w, it.kind === 'supply1' ? mask(sig.w) : 0n, 0n); this.addCA(x => this.driveNet(sig, d, x), () => c, [], null, line, true); });
    if (!v.init) return;
    const ref = { k: 'id', line, path: [{ n: v.name, ix: [] }], sels: [] };
    if (sig.net) own.push(() => this.cContAssign(sc, ref, v.init, it.delay, line));
    else own.push(() => {              // "reg q = 5;" — the value must be a constant, and it is assigned at time 0
      const konst = sc.kind === 'module' || sc.kind === 'gen';
      const lv = this.cLval(ref, { scope: sc }), rhs = this.cRhs(this.cExpr(v.init, { scope: sc, konst }), lv.w, lv.real);
      this.procs.push(() => lv.store(rhs()));
    });
  }
  mkSig(sc, name, o, elem) {
    const s = { kind: 'sig', name, path: sc.path ? sc.path + '.' + name : name, w: o.w, msb: o.msb, lsb: o.lsb, signed: !!o.signed, real: !!o.real, net: !!o.net,
      isEvent: !!o.isEvent, scalar: !!o.scalar, implicit: false, val: null, pers: [], once: [], cap: 16, drivers: null, fwd: null, pull: null, res: null,
      dims: null, data: null, elems: null, ver: 0, hist: null, done: false };
    s.val = initVal(s);
    if (o.dims && o.dims.length) {
      const n = o.dims.reduce((a, d) => a * d.n, 1);
      if (n > 1 << 22) throw new VError(`array '${name}' is too large (${n} elements)`, this.line);
      s.dims = o.dims;
      if (s.net) s.elems = Array.from({ length: n }, (_, i) => this.mkSig(sc, `${name}[${o.dims.length === 1 ? o.dims[0].lo + i : i}]`, { ...o, dims: null }, true));
      else s.data = new Array(n).fill(s.val);
    } else {
      if (this.trace && !s.isEvent && sc.kind !== 'func' && sc.kind !== 'task') { s.hist = [[0, s.val]]; this.sigs.push(s); }
      this.nets.push(s);
    }
    if (!elem) sc.names.set(name, s);
    return s;
  }
  implicit(e, sc) {                   // undeclared names in net contexts become 1-bit wires (IEEE 1364-2005 §4.5)
    if (!e) return;
    switch (e.k) {
      case 'id':
        if (e.path.length === 1 && !e.path[0].ix.length && !this.lookup(e.path[0].n, sc)) {
          const name = e.path[0].n;
          if (sc.mod.nonet) throw new VError(`'${name}' is not declared (implicit wires are switched off by \`default_nettype none)`, e.line);
          this.mkSig(sc, name, { w: 1, msb: 0, lsb: 0, net: true, scalar: true }).implicit = true;
        }
        break;
      case 'un': this.implicit(e.e, sc); break;
      case 'bin': this.implicit(e.l, sc); this.implicit(e.r, sc); break;
      case 'tern': this.implicit(e.c, sc); this.implicit(e.a, sc); this.implicit(e.b, sc); break;
      case 'concat': case 'repl': for (const p of e.parts) this.implicit(p, sc); break;
    }
  }
  preBlocks(st, sc) {                 // create the scopes of named blocks up front, so they can be referenced before they appear
    if (!st) return;
    switch (st.k) {
      case 'block': case 'fork': {
        let s = sc;
        if (st.name) {
          s = this.mkScope(sc, st.name, 'block', st.line);
          (sc.pre || (sc.pre = new Map())).set(st, s);
          s.init = []; this.elabItems(st.decls, s, s.init, 0);
        }
        for (const c of st.stmts) this.preBlocks(c, s);
        break;
      }
      case 'if': this.preBlocks(st.then, sc); this.preBlocks(st.els, sc); break;
      case 'case': for (const i of st.items) this.preBlocks(i.body, sc); break;
      case 'for': case 'while': case 'repeat': case 'forever': case 'wait': case 'delay': case 'evwait': this.preBlocks(st.body, sc); break;
    }
  }
  elabInst(sc, it, own, depth) {
    const def = this.mods.get(it.mod);
    if (!def) throw new VError(`there is no module named '${it.mod}'`, it.line);
    const child = this.mkScope(sc, it.name, 'module', it.line);
    let over = null;
    if (it.params) over = { named: it.params.named, scope: sc, line: it.line, list: it.params.list.map(c => c.expr), map: new Map(it.params.list.map(c => [c.name, c.expr])) };
    const conn = new Map();
    if (it.conns.named) for (const c of it.conns.list) {
      if (!def.ports.includes(c.name)) throw new VError(`module '${def.name}' has no port named '${c.name}'`, it.line);
      if (conn.has(c.name)) throw new VError(`port '${c.name}' is connected twice`, it.line);
      conn.set(c.name, c.expr);
    } else {
      if (it.conns.list.length > def.ports.length) throw new VError(`too many connections: module '${def.name}' has ${def.ports.length} port(s)`, it.line);
      it.conns.list.forEach((c, i) => conn.set(def.ports[i], c.expr));
    }
    for (const e of conn.values()) this.implicit(e, sc);
    this.elabModule(def, child, over, depth + 1);
    const inner = p => (def.pint && def.pint[p]) || p;
    for (const p of def.ports) {
      const e = conn.get(p);
      if (e && child.pdir.get(inner(p)) === 'inout') this.binds.push(() => this.bindInout(sc, child.names.get(inner(p)), p, e, it.line));
    }
    own.push(() => {
      for (const p of def.ports) {
        const e = conn.get(p), dir = child.pdir.get(inner(p)), ps = child.names.get(inner(p));
        if (!e || dir === 'inout') continue;
        this.line = it.line;
        if (dir === 'input') {
          const cx = { scope: sc, deps: new Set() }, n = this.cExpr(e, cx), d = this.addDriver(ps);
          this.addCA(v => this.driveNet(ps, d, v), this.cRhs(n, ps.w, false), cx.deps, null, it.line, e.k === 'id' && !e.sels.length);
        } else {
          const lv = this.cNetLval(e, { scope: sc });
          this.addCA(lv.drive, this.cRhs(this.sigNode(ps, [], { scope: child }, it.line), lv.w, false), [ps], null, it.line, true);
        }
      }
    });
  }
  bindInout(sc, ps, p, e, line) {     // an inout port is a two-way window onto (part of) the outer net: its drivers act there, its value mirrors it
    const bad = () => new VError(`inout port '${p}' must be connected to a wire, or to a constant bit/part-select of one`, line);
    if (e.k !== 'id' || e.sels.length > 1) throw bad();
    const net = this.resolve({ ...e, sels: [] }, sc);
    if (net.kind !== 'sig' || !net.net || net.dims || !ps.net) throw bad();
    let lo = 0, w = net.w;
    if (e.sels.length) { const sel = this.cSel(net, e.sels[0], { scope: sc, konst: true }, line); lo = sel.lo(); w = sel.w; if (lo === null || lo < 0 || lo + w > net.w) throw bad(); }
    if (w !== ps.w) throw new VError(`inout port '${p}' is ${ps.w} bit(s) wide but is connected to ${w} bit(s)`, line);
    ps.fwd = { net, lo };
    const sim = this;
    net.pers.push({ fire() { sim.set(ps, extract(net.val, lo, w)); } });
  }

  // ── constant evaluation and names ──
  cint(ast, sc, what) {
    const n = this.cExpr(ast, { scope: sc, konst: true });
    if (n.real) return Math.round(n.mk()());
    const v = n.mk(n.w, n.s)();
    if (v.b) throw new VError(`${what || 'this constant expression'} has an unknown (x or z) value`, ast.line || this.line);
    return Number(n.s ? sbig(v) : v.a);
  }
  ctrue(ast, sc) { return this.truthOf(this.cExpr(ast, { scope: sc, konst: true }))() === 1; }
  lookup(name, sc) {                  // a plain name: inner scopes first; beyond the module boundary only tasks, functions and scopes are visible
    let crossed = false;
    for (let s = sc; s; s = s.parent) {
      const e = s.names.get(name);
      if (e && (!crossed || e.kind === 'func' || e.kind === 'task' || e.kind === 'scope')) return e;
      if (s.kind === 'module') crossed = true;
    }
    return null;
  }
  scopeOf(ent) {
    if (ent.kind === 'scope') return ent.scope;
    if (ent.kind === 'func') return this.ensureFunc(ent).scope;
    if (ent.kind === 'task' && !ent.ast.auto) return this.ensureTask(ent).inst.scope;
    return null;
  }
  resolve(ast, sc) {
    const path = ast.path;
    const key = seg => seg.ix.length ? seg.n + seg.ix.map(e => `[${this.cint(e, sc, 'scope index')}]`).join('') : seg.n;
    const k0 = key(path[0]);
    let ent = this.lookup(k0, sc);
    if (!ent && path.length > 1) for (let s = sc; s && !ent; s = s.parent) if (s.kind === 'module' && s.mod.name === k0) ent = { kind: 'scope', scope: s };
    if (!ent) throw new VError(`'${k0}' is not declared`, ast.line);
    for (let i = 1; i < path.length; i++) {
      const sub = this.scopeOf(ent);
      if (!sub) throw new VError(`'${path[i - 1].n}' is not a module instance, named block, task or function`, ast.line);
      const k = key(path[i]), e2 = sub.names.get(k);
      if (!e2) throw new VError(`'${k}' was not found in '${sub.path}'`, ast.line);
      ent = e2;
    }
    return ent;
  }
  findKind(ref, sc, kinds) {         // like resolve, but a simple name skips entities of other kinds (e.g. a function's own return variable)
    if (ref.path.length === 1 && !ref.path[0].ix.length)
      for (let s = sc; s; s = s.parent) { const e = s.names.get(ref.path[0].n); if (e && kinds.includes(e.kind)) return e; }
    return this.resolve(ref, sc);
  }

  // ── expressions ──
  // A compiled expression is {w, s, real, mk(W, S)}: w/s are its self-determined width and signedness,
  // mk builds a thunk that evaluates it in a context of width W and signedness S (IEEE 1364-2005 §5.4–5.5).
  truthOf(n) {
    if (n.real) { const t = n.mk(); return () => t() !== 0 ? 1 : 0; }
    const t = n.mk(n.w, n.s);
    return () => truth(t());
  }
  toReal(n) {
    if (n.real) return n.mk();
    const t = n.mk(n.w, n.s), s = n.s;
    return () => v2r(t(), s);
  }
  cRhs(n, w, real) {                  // n evaluated as the right-hand side of an assignment to a w-bit (or real) target
    if (real) return this.toReal(n);
    if (n.real) { const t = n.mk(); return () => r2v(t(), w); }
    const W = Math.max(w, n.w), t = n.mk(W, n.s);
    if (W === w) return t;
    const m = mask(w);
    return () => { const v = t(); return V(w, v.a & m, v.b & m); };
  }
  cIntX(ast, cx, what) {              // thunk: integer value, or null when it has x/z bits
    const n = this.cExpr(ast, cx);
    if (n.real) { if (what) throw new VError(`a real value cannot be used as ${what}`, ast.line); const t = n.mk(); return () => Math.round(t()); }
    const t = n.mk(n.w, n.s), s = n.s;
    return () => { const v = t(); return v.b ? null : Number(s ? sbig(v) : v.a); };
  }
  cExpr(ast, cx, zeroOk) {
    const line = ast.line;
    switch (ast.k) {
      case 'num': {
        if (ast.real !== undefined) { const r = ast.real; return realNode(() => r); }
        const v = V(ast.w, ast.a, ast.b), ext = ast.ext;
        return { w: v.w, s: ast.signed, real: false, mk: (W, S) => {
          let r = resize(v, W, S);
          if (ext && W > v.w) { const e = mask(W) ^ mask(v.w); r = V(W, ext === 'x' ? v.a | e : v.a, v.b | e); }   // unsized x/z fills the context
          return () => r;
        } };
      }
      case 'str': { const w = Math.max(8, 8 * ast.v.length), v = strToV(ast.v, w); return { w, s: false, real: false, mk: W => { const r = resize(v, W, false); return () => r; } }; }
      case 'id': return this.cRef(ast, cx);
      case 'un': return this.cUnary(ast, cx);
      case 'bin': return this.cBinary(ast, cx);
      case 'tern': {
        const c = this.truthOf(this.cExpr(ast.c, cx)), a = this.cExpr(ast.a, cx), b = this.cExpr(ast.b, cx);
        if (a.real || b.real) { const x = this.toReal(a), y = this.toReal(b); return realNode(() => { const t = c(); return t === 1 ? x() : t === 0 ? y() : 0; }); }
        return { w: Math.max(a.w, b.w), s: a.s && b.s, real: false, mk: (W, S) => {
          const x = a.mk(W, S), y = b.mk(W, S), m = mask(W);
          return () => {
            const t = c();
            if (t === 1) return x();
            if (t === 0) return y();
            const p = x(), q = y(), diff = ((p.a ^ q.a) | (p.b ^ q.b)) & m;    // unknown condition: equal bits survive, the rest become x
            return V(W, (p.a & ~diff) | diff, (p.b & ~diff) | diff);
          };
        } };
      }
      case 'concat': return this.cConcat(ast.parts, cx, line);
      case 'repl': {
        const cn = this.cExpr(ast.n, { scope: cx.scope, konst: true });
        if (cn.real) throw new VError('a replication count must be a whole number', line);
        const cv = cn.mk(cn.w, cn.s)();
        if (cv.b) throw new VError('this replication count has an unknown (x or z) value', line);
        const n = Number(cn.s ? sbig(cv) : cv.a), c = this.cConcat(ast.parts, cx, line);
        if (n === 0 && zeroOk) return { w: 0, s: false, real: false, mk: () => () => V(0, 0n, 0n) };
        if (n < 1 || n * c.w > MAXW) throw new VError(`a replication count of ${n} is not allowed here`, line);
        const t = c.mk(c.w, false), cw = BigInt(c.w), w = n * c.w;
        return vecNode(w, false, () => { const v = t(); let a = 0n, b = 0n; for (let i = 0; i < n; i++) { a = (a << cw) | v.a; b = (b << cw) | v.b; } return V(w, a, b); });
      }
      case 'call': return this.cCall(ast, cx);
      case 'sysfn': return this.cSysFn(ast, cx);
    }
    throw new VError('this is not a valid expression', line);
  }
  cConcat(parts, cx, line) {
    for (const p of parts) if (p.k === 'num' && p.real === undefined && !p.sized) throw new VError("a number inside { } needs a size, for example 8'd5 instead of 5", p.line || line);
    const ps = parts.map(p => this.cExpr(p, cx, true)).filter(p => p.w > 0);
    if (ps.some(p => p.real)) throw new VError('a real value cannot be used in a concatenation', line);
    if (!ps.length) throw new VError('this concatenation is empty', line);
    const ts = ps.map(p => p.mk(p.w, p.s)), ws = ps.map(p => BigInt(p.w)), w = ps.reduce((a, p) => a + p.w, 0);
    if (w > MAXW) throw new VError('this concatenation is too wide', line);
    return vecNode(w, false, () => { let a = 0n, b = 0n; for (let i = 0; i < ts.length; i++) { const v = ts[i](); a = (a << ws[i]) | v.a; b = (b << ws[i]) | v.b; } return V(w, a, b); });
  }
  cUnary(ast, cx) {
    const e = this.cExpr(ast.e, cx), op = ast.op;
    if (e.real) {
      const t = e.mk();
      if (op === '-') return realNode(() => -t());
      if (op === '+') return e;
      if (op === '!') return bitNode(() => t() === 0 ? V1 : V0);
      throw new VError(`operator '${op}' cannot be applied to a real value`, ast.line);
    }
    if (op === '+') return { w: e.w, s: e.s, real: false, mk: e.mk };
    if (op === '-') return { w: e.w, s: e.s, real: false, mk: (W, S) => { const t = e.mk(W, S), m = mask(W); return () => { const v = t(); return v.b ? vx(W) : V(W, -v.a & m, 0n); }; } };
    if (op === '~') return { w: e.w, s: e.s, real: false, mk: (W, S) => { const t = e.mk(W, S), m = mask(W); return () => { const v = t(); return V(W, (~v.a | v.b) & m, v.b); }; } };
    const t = e.mk(e.w, e.s);
    if (op === '!') return bitNode(() => { const r = truth(t()); return r === 1 ? V0 : r === 0 ? V1 : VX; });
    const f = REDUCE[op], m = mask(e.w);
    return bitNode(() => f(t(), m));
  }
  cBinary(ast, cx) {
    const l = this.cExpr(ast.l, cx), r = this.cExpr(ast.r, cx), op = ast.op, line = ast.line;
    const anyReal = l.real || r.real;
    switch (op) {
      case '+': case '-': case '*': case '/': case '%': case '&': case '|': case '^': case '~^': case '^~': {
        if (anyReal) {
          const f = RARITH[op];
          if (!f) throw new VError(`operator '${op}' cannot be applied to a real value`, line);
          const a = this.toReal(l), b = this.toReal(r);
          return realNode(() => f(a(), b()));
        }
        const f = ARITH[op];
        return { w: Math.max(l.w, r.w), s: l.s && r.s, real: false, mk: (W, S) => { const a = l.mk(W, S), b = r.mk(W, S), m = mask(W); return () => f(a(), b(), W, m, S); } };
      }
      case '**': {                     // the exponent is self-determined; the result takes its type from the base alone
        if (anyReal) { const a = this.toReal(l), b = this.toReal(r); return realNode(() => Math.pow(a(), b())); }
        const e = r.mk(r.w, r.s), es = r.s;
        return { w: l.w, s: l.s, real: false, mk: (W, S) => { const a = l.mk(W, S), m = mask(W); return () => vpow(a(), e(), W, m, S, es); } };
      }
      case '<<': case '>>': case '<<<': case '>>>': {
        if (anyReal) throw new VError('a real value cannot be shifted', line);
        const amt = r.mk(r.w, r.s), left = op[0] === '<';
        return { w: l.w, s: l.s, real: false, mk: (W, S) => {
          const a = l.mk(W, S), m = mask(W), arith = op === '>>>' && S, top = BigInt(W - 1), bw = BigInt(W);
          return () => {
            const v = a(), n = amt();
            if (n.b) return vx(W);
            const k = n.a < bw ? n.a : bw;
            if (left) return V(W, (v.a << k) & m, (v.b << k) & m);
            if (!arith) return V(W, v.a >> k, v.b >> k);
            const fill = m ^ (m >> k);
            return V(W, (v.a >> k) | ((v.a >> top) & 1n ? fill : 0n), (v.b >> k) | ((v.b >> top) & 1n ? fill : 0n));
          };
        } };
      }
      case '<': case '<=': case '>': case '>=': case '==': case '!=': case '===': case '!==': {
        if (anyReal) {
          const f = RCMP[op];
          if (!f) throw new VError(`'${op}' cannot compare real values; use ${op.slice(0, 2)}`, line);
          const a = this.toReal(l), b = this.toReal(r);
          return bitNode(() => f(a(), b()) ? V1 : V0);
        }
        const W = Math.max(l.w, r.w), S = l.s && r.s, a = l.mk(W, S), b = r.mk(W, S), f = CMP[op];
        return bitNode(() => f(a(), b(), S));
      }
      case '&&': case '||': {
        const a = this.truthOf(l), b = this.truthOf(r);
        if (op === '&&') return bitNode(() => { const x = a(); if (x === 0) return V0; const y = b(); return y === 0 ? V0 : x === 1 && y === 1 ? V1 : VX; });
        return bitNode(() => { const x = a(); if (x === 1) return V1; const y = b(); return y === 1 ? V1 : x === 0 && y === 0 ? V0 : VX; });
      }
    }
    throw new VError(`unknown operator '${op}'`, line);
  }
  cRef(ast, cx) {
    const ent = this.resolve(ast, cx.scope), line = ast.line, name = ast.path[ast.path.length - 1].n;
    if (ent.kind === 'sig') return this.sigNode(ent, ast.sels, cx, line);
    if (ent.kind === 'param') {
      if (ent.real) { if (ast.sels.length) throw new VError('bits of a real parameter cannot be selected', line); const r = ent.val; return realNode(() => r); }
      const v = ent.val;
      if (!ast.sels.length) return { w: v.w, s: ent.s, real: false, mk: (W, S) => { const r = resize(v, W, S); return () => r; } };
      return this.sigNode({ pseudo: true, name, w: v.w, msb: ent.msb, lsb: ent.lsb, signed: false, real: false, dims: null, val: v }, ast.sels, cx, line);
    }
    if (ent.kind === 'func') throw new VError(`function '${name}' has to be called with arguments: ${name}(...)`, line);
    if (ent.kind === 'genvar') throw new VError(`genvar '${name}' can only be used inside its generate loop`, line);
    throw new VError(`'${name}' is a ${ent.kind === 'scope' ? 'module instance or block' : ent.kind}, not a value`, line);
  }
  sigNode(sig, sels, cx, line) {
    if (!sig.pseudo) {
      if (cx.konst) throw new VError(`'${sig.name}' is a ${sig.net ? 'wire' : 'variable'}, but a constant is needed here (only numbers and parameters are allowed)`, line);
      if (sig.isEvent && !cx.evctl) throw new VError(`'${sig.name}' is an event: it can be waited for with @(${sig.name}) or triggered with ->${sig.name}, but it has no value`, line);
    }
    const deps = sig.pseudo ? null : cx.deps;
    let get, k = 0;
    const w = sig.w;
    if (sig.dims) {
      const nd = sig.dims.length;
      if (sels.length < nd) throw new VError(`array '${sig.name}' needs ${nd} index${nd > 1 ? 'es' : ''}`, line);
      const idx = this.cIndex(sig, sels.slice(0, nd), cx, line), X = sig.real ? 0 : vx(w);
      k = nd;
      if (sig.elems) { const el = sig.elems; if (deps) for (const e of el) deps.add(e); get = () => { const i = idx(); return i < 0 ? X : el[i].val; }; }
      else { if (deps) deps.add(sig); get = () => { const i = idx(); return i < 0 ? X : sig.data[i]; }; }
    } else { if (deps) deps.add(sig); get = () => sig.val; }
    if (sig.real) { if (sels.length > k) throw new VError('bits of a real value cannot be selected', line); return realNode(get); }
    if (sels.length === k) return vecNode(w, sig.signed, get);
    if (sels.length > k + 1) throw new VError(`'${sig.name}' has too many indexes`, line);
    const sel = this.cSel(sig, sels[k], cx, line), sw = sel.w, lo = sel.lo, X = vx(sw);
    return vecNode(sw, false, () => { const p = lo(); return p === null ? X : extract(get(), p, sw); });
  }
  cIndex(sig, sels, cx, line) {       // thunk: flat element offset, or -1 when out of range / unknown
    const ts = sels.map(s => { if (s.k !== 'idx') throw new VError(`array '${sig.name}' takes one index per dimension, not a range`, line); return this.cIntX(s.e, cx, 'an array index'); });
    const dims = sig.dims;
    if (dims.length === 1) { const { lo, hi } = dims[0], t = ts[0]; return () => { const i = t(); return i === null || i < lo || i > hi ? -1 : i - lo; }; }
    return () => {
      let f = 0;
      for (let d = 0; d < dims.length; d++) { const i = ts[d](); if (i === null || i < dims[d].lo || i > dims[d].hi) return -1; f = f * dims[d].n + i - dims[d].lo; }
      return f;
    };
  }
  cSel(sig, sel, cx, line) {          // {w, lo()} — lo is the bit offset from the LSB, or null when the index is unknown
    if (sig.scalar) throw new VError(`'${sig.name}' is a single bit, so it cannot be indexed`, line);
    const desc = sig.msb >= sig.lsb, off = i => desc ? i - sig.lsb : sig.lsb - i;
    if (sel.k === 'idx') { const t = this.cIntX(sel.e, cx, 'a bit index'); return { w: 1, lo: () => { const i = t(); return i === null ? null : off(i); } }; }
    if (sel.k === 'range') {
      const hi = off(this.cint(sel.msb, cx.scope, 'part-select bound')), lo = off(this.cint(sel.lsb, cx.scope, 'part-select bound'));
      if (hi < lo) throw new VError(`this part-select of '${sig.name}' runs against the direction it was declared with`, line);
      return { w: hi - lo + 1, lo: () => lo };
    }
    const w = this.cint(sel.width, cx.scope, 'part-select width');
    if (w < 1 || w > MAXW) throw new VError('a part-select width must be a positive constant', line);
    const t = this.cIntX(sel.base, cx, 'a part-select base'), up = sel.k === 'plus';
    return { w, lo: () => { const i = t(); if (i === null) return null; const low = up ? i : i - w + 1; return desc ? off(low) : off(low + w - 1); } };
  }
  cCall(ast, cx) {
    const ent = this.findKind(ast.target, cx.scope, ['func']), line = ast.line, sim = this;
    if (ent.kind !== 'func') throw new VError(`'${ent.name || ast.target.path[0].n}' is not a function`, line);
    const f = this.ensureFunc(ent);
    if (ast.args.length !== f.ports.length) throw new VError(`function '${ent.name}' takes ${f.ports.length} argument(s) but was given ${ast.args.length}`, line);
    const ins = f.ports.map((p, i) => this.cRhs(this.cExpr(ast.args[i], cx), p.w, p.real)), n = ins.length, ret = f.ret, locals = f.locals, auto = f.auto;
    const call = () => {
      const vals = new Array(n);
      for (let i = 0; i < n; i++) vals[i] = ins[i]();
      let saved = null;
      if (auto) {                      // automatic: fresh variables for every call, and a recursive call leaves its caller's alone
        if (f.depth > 0) saved = locals.map(s => s.val);
        for (const s of locals) s.val = initVal(s);
      }
      if (++f.depth > 3000) throw new VError(`function '${ent.name}' calls itself too deeply`, line);
      for (let i = 0; i < n; i++) sim.store(f.ports[i], vals[i]);
      ent.live++;
      try { f.body.run(); } catch (e) { if (!(e instanceof Disable) || e.target !== ent) throw e; } finally { f.depth--; ent.live--; }
      const r = ret.val;
      if (saved) for (let i = 0; i < locals.length; i++) locals[i].val = saved[i];
      return r;
    };
    return ret.real ? realNode(call) : vecNode(ret.w, ret.signed, call);
  }
  ensureFunc(ent) {
    if (ent.c) return ent.c;
    const ast = ent.ast, s = this.mkScope(ent.scope, ast.name, 'func', ast.line, true);
    const c = ent.c = { scope: s, ret: null, ports: [], locals: [], body: null, depth: 0, auto: ast.auto };
    let o = { w: 1, msb: 0, lsb: 0, signed: ast.signed, scalar: true };
    if (ast.rtype === 'integer') o = { w: 32, msb: 31, lsb: 0, signed: true };
    else if (ast.rtype === 'time') o = { w: 64, msb: 63, lsb: 0 };
    else if (ast.rtype) o = { w: 64, msb: 0, lsb: 0, real: true };
    else if (ast.range) { o.msb = this.cint(ast.range.msb, ent.scope, 'range bound'); o.lsb = this.cint(ast.range.lsb, ent.scope, 'range bound'); o.w = Math.abs(o.msb - o.lsb) + 1; o.scalar = false; }
    c.ret = this.mkSig(s, ast.name, o);
    const own = []; this.elabItems(ast.decls, s, own, 0); for (const f of own) f();
    c.ports = ast.ports.map(n => { if (s.pdir.get(n) !== 'input') throw new VError(`function '${ast.name}' can only have inputs`, ast.line); return s.names.get(n); });
    if (!c.ports.length) throw new VError(`function '${ast.name}' needs at least one input`, ast.line);
    c.locals = [...s.names.values()].filter(e => e.kind === 'sig' && !e.dims);
    this.funcs.push(c);
    this.preBlocks(ast.body, s);
    c.body = this.cStmt(ast.body, { scope: s, func: ast.name });
    if (c.body.blk) throw new VError(`function '${ast.name}' may not contain delays, event controls or calls to tasks that wait`, ast.line);
    return c;
  }
  // A task instance is one set of the task's variables plus its body compiled against them. A static task has one;
  // an automatic task takes one from a pool for every call that is in progress, so calls never share variables.
  makeTaskInst(ent) {
    const ast = ent.ast, s = this.mkScope(ent.scope, ast.name, 'task', ast.line, true);
    const own = []; this.elabItems(ast.decls, s, own, 0); for (const f of own) f();
    const inst = { scope: s, ports: ast.ports.map(n => ({ sig: s.names.get(n), dir: s.pdir.get(n) })), locals: [...s.names.values()].filter(e => e.kind === 'sig' && !e.dims), body: null };
    if (!ent.c) ent.c = { inst, pool: [], auto: ast.auto, blk: true, compiling: true };
    this.preBlocks(ast.body, s);
    inst.body = this.cStmt(ast.body, { scope: s });
    return inst;
  }
  ensureTask(ent) {
    if (ent.c) return ent.c;
    const inst = this.makeTaskInst(ent), c = ent.c;
    c.compiling = false; c.blk = inst.body.blk; c.pool.push(inst);
    return c;
  }
  cSysFn(ast, cx) {
    const name = ast.name, args = ast.args, line = ast.line, sc = cx.scope, sim = this;
    if (name in ARITY && args.length > ARITY[name]) throw new VError(`${name} takes ${ARITY[name] || 'no'} argument${ARITY[name] === 1 ? '' : 's'}, but ${args.length} were given`, line);
    if ((MATH1[name] && args.length !== 1) || (MATH2[name] && args.length !== 2)) throw new VError(`${name} takes ${MATH1[name] ? 'one argument' : 'two arguments'}`, line);
    const arg = i => { if (!args[i]) throw new VError(`${name} needs ${i + 1} argument(s)`, line); return this.cExpr(args[i], cx); };
    const int32 = f => vecNode(32, true, f);
    const seeded = f => {              // run f with the caller's seed variable, then store the updated seed back
      const seed = this.cRhs(arg(0), 32, false), lv = this.cLval(args[0], cx);
      return () => { const keep = sim.seed; sim.seed = Number(seed().a); const r = f(); lv.store(resize(vn(32, sim.seed), lv.w, true)); sim.seed = keep; return vn(32, r); };
    };
    switch (name) {
      case '$time': return vecNode(64, false, () => vn(64, Math.round(sim.time / sc.tu)));
      case '$stime': return vecNode(32, false, () => vn(32, Math.round(sim.time / sc.tu)));
      case '$realtime': return realNode(() => sim.time / sc.tu);
      case '$random': case '$urandom': return vecNode(32, name === '$random', args[0] ? seeded(() => sim.random()) : () => vn(32, sim.random()));
      case '$dist_uniform': { arg(2); const lo = this.cIntX(args[1], cx), hi = this.cIntX(args[2], cx); return int32(seeded(() => sim.distUniform(lo() || 0, hi() || 0))); }
      case '$urandom_range': {
        const hi = args[0] ? this.cIntX(args[0], cx) : () => 0xffffffff, lo = args[1] ? this.cIntX(args[1], cx) : () => 0;
        return vecNode(32, false, () => { let a = lo() || 0, b = hi() || 0; if (a > b) [a, b] = [b, a]; return vn(32, a + (sim.random() >>> 0) % (b - a + 1)); });
      }
      case '$signed': case '$unsigned': {
        const e = arg(0);
        if (e.real) throw new VError(`${name} cannot be applied to a real value`, line);
        return vecNode(e.w, name === '$signed', e.mk(e.w, e.s));
      }
      case '$clog2': {
        const e = arg(0), t = this.cRhs(e, Math.max(32, e.w), false);
        return int32(() => { const v = t(); if (v.b) return vx(32); let n = v.a, r = 0; if (n > 1n) { n -= 1n; while (n > 0n) { n >>= 1n; r++; } } return vn(32, r); });
      }
      case '$bits': { const e = arg(0), v = vn(32, e.real ? 1 : e.w); return int32(() => v); }
      case '$rtoi': { const t = this.toReal(arg(0)); return int32(() => { const r = t(); return Number.isFinite(r) ? vn(32, BigInt(Math.trunc(r))) : vx(32); }); }
      case '$itor': return realNode(this.toReal(arg(0)));
      case '$realtobits': { const t = this.toReal(arg(0)), buf = new DataView(new ArrayBuffer(8)); return vecNode(64, false, () => { buf.setFloat64(0, t()); return V(64, buf.getBigUint64(0), 0n); }); }
      case '$bitstoreal': { const t = this.cRhs(arg(0), 64, false), buf = new DataView(new ArrayBuffer(8)); return realNode(() => { buf.setBigUint64(0, t().a); return buf.getFloat64(0); }); }
      case '$test$plusargs': case '$value$plusargs': { const z = vn(32, 0); return int32(() => z); }
    }
    if (MATH1[name]) { const f = MATH1[name], t = this.toReal(arg(0)); return realNode(() => f(t())); }
    if (MATH2[name]) { const f = MATH2[name], a = this.toReal(arg(0)), b = this.toReal(arg(1)); return realNode(() => f(a(), b())); }
    throw new VError(`${name} is not a supported system function`, line);
  }
  uniform(start, end) {               // the IEEE 1364 reference generator
    let s = this.seed >>> 0;
    if (s === 0) s = 259341593;
    s = (Math.imul(69069, s) + 1) >>> 0; this.seed = s | 0;
    const d = 0.00000011920928955078125;
    let c = 1.0 + (s >>> 9) * d; c = c + c * d;
    return (end - start) * (c - 1.0) + start;
  }
  distUniform(start, end) {           // as compiled into Icarus where "long" is 32 bits
    const toInt = r => r >= 0 ? Math.floor(r) : -Math.floor(1 - r);
    if (start >= end) return start;
    let i;
    if (end !== 2147483647) { end++; i = toInt(this.uniform(start, end)); if (i < start) i = start; if (i >= end) i = end - 1; }
    else if (start !== -2147483648) { start--; i = toInt(this.uniform(start, end) + 1.0); if (i <= start) i = start + 1; if (i > end) i = end; }
    else { const r = (this.uniform(start, end) + 2147483648.0) / 4294967295.0; i = toInt(r * 4294967296.0 - 2147483648.0); }
    return i | 0;
  }
  random() { return this.distUniform(-2147483648, 2147483647); }

  // ── assignment targets ──
  store(sig, v) { if (sig.real) this.setReal(sig, v); else this.set(sig, v); }
  set(sig, v) {
    const o = sig.val;
    if (o.a === v.a && o.b === v.b) return;
    sig.val = v; this.changed(sig);
  }
  setReal(sig, r) { if (!Object.is(sig.val, r)) { sig.val = r; this.changed(sig); } }
  setElem(sig, i, v) {
    const o = sig.data[i];
    if (sig.real ? Object.is(o, v) : o.a === v.a && o.b === v.b) return;
    sig.data[i] = v; sig.ver++; this.changed(sig);
  }
  changed(sig) {
    const h = sig.hist;
    if (h) { const n = h.length - 1; if (h[n][0] === this.time) h[n][1] = sig.val; else if (this.nchg++ < this.maxChg) h.push([this.time, sig.val]); }
    const ps = sig.pers;
    for (let i = 0; i < ps.length; i++) ps[i].fire();
    if (sig.once.length) {
      const os = sig.once; sig.once = [];
      for (let i = 0; i < os.length; i++) { const w = os[i]; if (w.dead) continue; w.fire(); if (!w.dead) sig.once.push(w); }
    }
  }
  addOnce(sig, w) {
    if (sig.once.length >= sig.cap) { sig.once = sig.once.filter(x => !x.dead); sig.cap = Math.max(16, sig.once.length * 2); }
    sig.once.push(w);
  }
  addDriver(sig) {
    if (sig.fwd) return { up: this.addDriver(sig.fwd.net) };
    const d = { val: vz(sig.w), fresh: true };
    (sig.drivers || (sig.drivers = [])).push(d);
    return d;
  }
  driveNet(sig, d, v) {
    if (sig.fwd) { const f = sig.fwd; this.driveNet(f.net, d.up, insert(vz(f.net.w), f.lo, sig.w, v)); return; }
    if (!d.fresh && d.val.a === v.a && d.val.b === v.b) return;
    d.val = v; d.fresh = false;
    const ds = sig.drivers;
    let r = v;
    if (ds.length > 1) { const f = sig.res || resolve2; r = ds[0].val; for (let i = 1; i < ds.length; i++) r = f(r, ds[i].val); }
    if (sig.pull) r = pulled(r, sig.pull);
    this.set(sig, r);
  }
  addPull(sig, lo, w, one) {
    if (sig.fwd) { this.addPull(sig.fwd.net, sig.fwd.lo + lo, w, one); return; }
    const bits = (mask(w) << BigInt(lo)) & mask(sig.w), p = sig.pull || (sig.pull = { a: 0n, m: 0n });
    p.m |= bits; p.a = one ? p.a | bits : p.a & ~bits;
  }
  cLval(ast, cx) {                    // procedural target: {w, real, store(v), prep() → store with indexes captured now}
    const sim = this, line = ast.line;
    if (ast.k === 'concat') {
      const ps = ast.parts.map(p => this.cLval(p, cx)), w = ps.reduce((a, p) => a + p.w, 0);
      if (ps.some(p => p.real)) throw new VError('a real variable cannot be part of a concatenation', line);
      const split = (v, fs) => { let hi = w; for (let i = 0; i < ps.length; i++) { hi -= ps[i].w; fs[i](extract(v, hi, ps[i].w)); } };
      const stores = ps.map(p => p.store);
      return { w, real: false, store: v => split(v, stores), prep: () => { const fs = ps.map(p => p.prep()); return v => split(v, fs); } };
    }
    if (ast.k !== 'id') throw new VError('this cannot be assigned to', line);
    const sig = this.resolve(ast, cx.scope), sels = ast.sels, name = ast.path[ast.path.length - 1].n;
    if (sig.kind !== 'sig') throw new VError(`'${name}' cannot be assigned to` + (sig.kind === 'param' ? ' (it is a parameter)' : sig.kind === 'genvar' ? ' (it is a genvar)' : ''), line);
    if (sig.net) throw new VError(`'${name}' is a wire, so it cannot be assigned in a procedural block (declare it as reg, or drive it with: assign ${name} = ...;)`, line);
    if (sig.isEvent) throw new VError(`'${name}' is an event; trigger it with ->${name};`, line);
    if (sig.dims) {
      const nd = sig.dims.length;
      if (sels.length < nd) throw new VError(`array '${name}' needs ${nd} index${nd > 1 ? 'es' : ''}`, line);
      const idx = this.cIndex(sig, sels.slice(0, nd), cx, line);
      if (sels.length === nd) return { w: sig.w, real: sig.real, store: v => { const i = idx(); if (i >= 0) sim.setElem(sig, i, v); }, prep: () => { const i = idx(); return v => { if (i >= 0) sim.setElem(sig, i, v); }; } };
      if (sig.real || sels.length > nd + 1) throw new VError(`'${name}' has too many indexes`, line);
      const sel = this.cSel(sig, sels[nd], cx, line), put = (i, p, v) => { if (i >= 0 && p !== null) sim.setElem(sig, i, insert(sig.data[i], p, sel.w, v)); };
      return { w: sel.w, real: false, store: v => put(idx(), sel.lo(), v), prep: () => { const i = idx(), p = sel.lo(); return v => put(i, p, v); } };
    }
    if (!sels.length) { const st = sig.real ? v => sim.setReal(sig, v) : v => sim.set(sig, v); return { w: sig.w, real: sig.real, store: st, prep: () => st }; }
    if (sig.real || sels.length > 1) throw new VError(`'${name}' has too many indexes`, line);
    const sel = this.cSel(sig, sels[0], cx, line), put = (p, v) => { if (p !== null) sim.set(sig, insert(sig.val, p, sel.w, v)); };
    return { w: sel.w, real: false, store: v => put(sel.lo(), v), prep: () => { const p = sel.lo(); return v => put(p, v); } };
  }
  netRef(ast, cx) {                   // a net, or a constant bit/part-select of one: {sig, lo, w}
    const line = ast.line;
    if (ast.k !== 'id') throw new VError('only a wire (or a constant select of one) can be driven here', line);
    let sig = this.resolve(ast, cx.scope);
    const sels = ast.sels, name = ast.path[ast.path.length - 1].n, kx = { scope: cx.scope, konst: true };
    if (sig.kind !== 'sig') throw new VError(`'${name}' cannot be driven`, line);
    if (!sig.net) throw new VError(`'${name}' is a reg, so it cannot be driven by a continuous assignment, a gate or a module output (declare it as wire)`, line);
    let k = 0;
    if (sig.dims) {
      k = sig.dims.length;
      if (sels.length < k) throw new VError(`array '${name}' needs ${k} index${k > 1 ? 'es' : ''}`, line);
      const i = this.cIndex(sig, sels.slice(0, k), kx, line)();
      if (i < 0) throw new VError(`this index of '${name}' is outside the array`, line);
      sig = sig.elems[i];
    }
    if (sels.length === k) return { sig, lo: 0, w: sig.w };
    if (sels.length > k + 1) throw new VError(`'${name}' has too many indexes`, line);
    const sel = this.cSel(sig, sels[k], kx, line), lo = sel.lo();
    if (lo === null) throw new VError('this select has an unknown index', line);
    return { sig, lo, w: sel.w };
  }
  cNetLval(ast, cx) {                 // continuous-assignment / output-port target: {w, drive(v)}
    const sim = this;
    if (ast.k === 'concat') {
      const ps = ast.parts.map(p => this.cNetLval(p, cx)), w = ps.reduce((a, p) => a + p.w, 0);
      return { w, drive: v => { let hi = w; for (const p of ps) { hi -= p.w; p.drive(extract(v, hi, p.w)); } } };
    }
    const { sig, lo, w } = this.netRef(ast, cx), d = this.addDriver(sig);
    if (lo === 0 && w === sig.w) return { w, drive: v => sim.driveNet(sig, d, v) };
    const Z = vz(sig.w);
    return { w, drive: v => sim.driveNet(sig, d, insert(Z, lo, w, v)) };
  }

  // ── continuous assignments and gates ──
  // A plain connection (assign a = b; a port tied to a signal) follows its source at once, like one net.
  // Anything that computes is re-evaluated as its own active event, after the process that changed an operand has suspended.
  addCA(drive, rhs, deps, delay, line, direct) {
    const sim = this, ca = { drive, rhs, delay, seq: 0, pend: false, line, cur: null, next: null, run: null, fire: null };
    ca.run = () => { ca.pend = false; sim.evalCA(ca); };
    ca.fire = direct ? () => sim.evalCA(ca) : () => { if (!ca.pend) { ca.pend = true; (sim.boot || sim.active).push(ca.run); } };
    for (const s of deps) s.pers.push(ca);
    this.cas.push(ca);
  }
  evalCA(ca) {
    if (++this.ops > this.cap) { this.line = ca.line; this.limit(); }
    if (this.depth > 200) {           // a very long chain of plain connections: continue from the event queue instead of the JS stack
      if (!ca.pend) { ca.pend = true; (this.boot || this.active).push(ca.run); }
      return;
    }
    this.depth++;
    try {
      const v = ca.rhs();
      if (!ca.delay) { ca.drive(v); return; }
      // inertial delay: a value already on its way keeps its time; anything else replaces what was pending
      const same = (x, y) => x !== null && x.a === y.a && x.b === y.b;
      if (same(ca.next, v)) return;
      ca.seq++; ca.next = null;
      if (same(ca.cur, v)) return;     // back to the present value before the change arrived: the pulse is swallowed
      const id = ca.seq, d = ca.delay(v);
      if (d <= 0) { ca.cur = v; ca.drive(v); return; }
      ca.next = v;
      this.slot(this.time + d).a.push(() => { if (ca.seq === id) { ca.next = null; ca.cur = v; ca.drive(v); } });
    } finally { this.depth--; }
  }
  cContAssign(sc, lhs, rhs, delay, line) {
    this.line = line;
    const cx = { scope: sc, deps: new Set() }, lv = this.cNetLval(lhs, { scope: sc }), n = this.cExpr(rhs, cx);
    this.addCA(lv.drive, this.cRhs(n, lv.w, false), cx.deps, delay ? this.cNetDelay(delay, cx) : null, line, rhs.k === 'id' && !rhs.sels.length);
  }
  cGate(sc, it) {
    const type = it.type, line = it.line, cx = { scope: sc, deps: new Set() };
    this.line = line;
    if (type === 'pullup' || type === 'pulldown') {
      for (const t of it.terms) { const r = this.netRef(t, cx); this.addPull(r.sig, r.lo, r.w, type === 'pullup'); }
      return;
    }
    const mos = type.endsWith('mos'), tri = mos || type.includes('if'), multiOut = type === 'buf' || type === 'not';
    if (it.terms.length < 2 || (tri && it.terms.length !== 3)) throw new VError(`a '${type}' gate has the wrong number of terminals`, line);
    const nOut = multiOut ? it.terms.length - 1 : 1;
    const outs = it.terms.slice(0, nOut).map(t => { const o = this.cNetLval(t, { scope: sc }); if (o.w !== 1) throw new VError(`a gate output must be a single bit, but this one is ${o.w} bits wide`, line); return o; });
    const ins = it.terms.slice(nOut).map(t => { const n = this.cExpr(t, cx); if (n.real) throw new VError('a gate input cannot be a real value', line); const g = n.mk(n.w, n.s); return () => bitState(g()); });
    let f;
    if (tri) {                        // bufif1(out, in, enable); nmos/pmos behave as bufif1/bufif0 (strengths are not modelled)
      const en = mos ? (type.includes('nmos') ? 1 : 0) : type.endsWith('1') ? 1 : 0, neg = type.startsWith('not');
      f = () => { const c = ins[1](); if (c === 1 - en) return 2; let d = ins[0](); if (d > 1) d = 3; else if (neg) d = 1 - d; return c === en ? d : 3; };
    } else if (type === 'and' || type === 'nand') f = () => { let x = false; for (const g of ins) { const b = g(); if (b === 0) return 0; if (b > 1) x = true; } return x ? 3 : 1; };
    else if (type === 'or' || type === 'nor') f = () => { let x = false; for (const g of ins) { const b = g(); if (b === 1) return 1; if (b > 1) x = true; } return x ? 3 : 0; };
    else if (type === 'xor' || type === 'xnor') f = () => { let p = 0; for (const g of ins) { const b = g(); if (b > 1) return 3; p ^= b; } return p; };
    else f = () => { const b = ins[0](); return b > 1 ? 3 : b; };
    const inv = type === 'nand' || type === 'nor' || type === 'xnor' || type === 'not', VALS = [V0, V1, VZ, VX];
    const rhs = () => { let r = f(); if (inv && r < 2) r = 1 - r; return VALS[r]; };
    const delay = it.delay ? this.cNetDelay(it.delay, cx) : null;
    for (const o of outs) this.addCA(o.drive, rhs, cx.deps, delay, line, false);
  }

  // ── scheduler ──
  slot(t) {
    let s = this.future.get(t);
    if (!s) { s = { a: [], n: [] }; this.future.set(t, s); heapPush(this.heap, t); }
    return s;
  }
  at(t, fn) { if (t <= this.time) this.inactive.push(fn); else this.slot(t).a.push(fn); }
  spawn(genFn, onDone) { return { gen: genFn(), onDone, seq: 0, dead: false, fin: false, run: false }; }
  step(p, f) {                        // run process p until it waits again or ends
    const prev = this.cur;
    let done;
    this.cur = p; p.run = true;
    try { done = f().done; } catch (e) { if (e !== KILLED) throw e; done = true; } finally { this.cur = prev; p.run = false; }
    if (done) { p.fin = true; if (p.onDone && !p.dead) p.onDone(); }
  }
  resume(p) { if (!p.dead && !p.fin) this.step(p, () => p.gen.next()); }
  park() {                            // the current process is about to wait: returns the function that wakes it (unless it was disabled meanwhile)
    const p = this.cur, s = ++p.seq;
    return () => { if (p.seq === s) this.resume(p); };
  }
  kill(p, target) {                   // another process disabled a block or task that p is waiting inside: unwind p out of it
    if (p.dead || p.fin || p.run) return;
    p.seq++;
    this.step(p, () => p.gen.throw(new Disable(target)));
  }
  disable(target) {
    const me = this.cur;
    let self = target.live > target.aborts.size;        // also running in code that never waits: that can only be this very call stack
    for (const f of [...target.aborts]) { if (f.proc && f.proc === me) self = true; else f(); }
    if (me && me.dead) throw KILLED;                    // this process was a branch of a fork that has just been ended
    if (self) throw new Disable(target);
  }
  onEvent(ev, cb) {                   // call cb once, the next time the event control ev fires
    const items = ev.items, n = items.length, last = new Array(n);
    for (let i = 0; i < n; i++) last[i] = items[i].get();
    const w = { dead: false, fire() {
      let hit = false;
      for (let i = 0; i < n; i++) { const c = items[i].get(); if (edgeHit(items[i].edge, last[i], c)) hit = true; last[i] = c; }
      if (hit) { w.dead = true; cb(); }
    } };
    for (const s of ev.deps) this.addOnce(s, w);
  }
  waitEv(ev) { const wake = this.park(), sim = this; this.onEvent(ev, () => sim.active.push(wake)); }   // the caller yields next
  run() {
    try {
      // Time 0, in the order Icarus Verilog uses: level-sensitive always blocks start waiting, nets settle,
      // then declaration initialisers, initial blocks and the other always blocks run in source order
      // (instances before their parent). Whatever those wake runs after all of them.
      for (const f of this.funcs) for (const s of f.locals) s.val = initVal(s);           // constant-function calls during elaboration leave no trace
      const nets = this.nets.filter(s => s.net);
      for (const s of nets) { s.val = vx(s.w); if (s.hist) s.hist[0][1] = s.val; }       // every net starts unknown...
      for (const f of this.pushes) f();
      this.active = this.procs.slice();
      this.boot = [];
      for (const s of nets) if (!s.drivers && !s.fwd) this.set(s, s.pull ? pulled(vz(s.w), s.pull) : vz(s.w));   // ...an undriven one floats
      for (const ca of this.cas) this.evalCA(ca);
      for (let i = 0; i < this.boot.length; i++) this.boot[i]();
      this.boot = null;
      this.loop();
    } catch (e) {
      if (e instanceof Disable) throw new VError('disable reached a block or task that is not running in this process', this.line);
      if (e instanceof VError && !e.line && this.line) throw new VError(e.raw, this.line);
      throw e;
    }
  }
  loop() {
    for (;;) {
      try { this.drain(); } catch (e) { if (e !== FINISH) throw e; }
      const ps = this.postponed; this.postponed = [];
      for (const f of ps) f();
      if (this.monitor && this.monOn) this.monitor.check();
      if (this.finished || !this.heap.length) return;
      const t = heapPop(this.heap);
      if (t > this.maxTime) { this.stopped = `time limit (${this.maxTime})`; return; }
      const s = this.future.get(t); this.future.delete(t);
      this.time = t; this.active = s.a; this.nbaq = s.n;
      this.cap = Math.min(this.maxOps, this.ops + this.maxStep);
    }
  }
  drain() {
    for (;;) {
      const q = this.active;
      for (let i = 0; i < q.length; i++) { if (++this.ops > this.cap) this.limit(); q[i](); }
      if (this.inactive.length) { this.active = this.inactive; this.inactive = []; }
      else if (this.nbaq.length) { this.active = this.nbaq; this.nbaq = []; }
      else { this.active = []; return; }
    }
  }

  // ── processes and statements ──
  // A compiled statement is {blk, run}: run is a plain function when the statement can never wait,
  // and a generator function (driven with yield*) when it contains a delay, event control or wait.
  cInitial(sc, it) {
    const body = this.cStmt(it.body, { scope: sc });
    this.procs.push(body.blk ? () => this.resume(this.spawn(body.run)) : () => body.run());
  }
  cAlways(sc, it) {
    const b = it.body, sim = this;
    if (b.k === 'evwait') {
      const cx = { scope: sc, deps: new Set() }, inner = this.cStmt(b.body, cx), ev = this.cEvent(b.ev, sc, cx.deps);
      const start = b.ev.star || b.ev.items.every(i => i.edge === 'any') ? this.pushes : this.procs;
      if (!inner.blk) {               // the common "always @(...) stmt" needs no coroutine: a permanent watcher re-runs the body
        const items = ev.items, n = items.length, last = new Array(n);
        let busy = false, armed = false;
        const run = () => { inner.run(); busy = false; };
        const w = { fire() {
          if (!armed) return;
          let hit = false;
          for (let i = 0; i < n; i++) { const c = items[i].get(); if (edgeHit(items[i].edge, last[i], c)) hit = true; last[i] = c; }
          if (hit && !busy) { busy = true; sim.active.push(run); }
        } };
        for (const s of ev.deps) s.pers.push(w);
        start.push(() => { for (let i = 0; i < n; i++) last[i] = items[i].get(); armed = true; });
        return;
      }
      const st = this.evStmt(ev, inner);
      start.push(() => this.resume(this.spawn(function* () { for (;;) yield* st.run(); })));
      return;
    }
    const body = this.cStmt(b, { scope: sc });
    if (!body.blk) throw new VError('this always block has no delay or event control (@ or #), so simulation time could never advance', it.line);
    this.procs.push(() => this.resume(this.spawn(function* () { for (;;) { if (++sim.ops > sim.cap) sim.limit(); yield* body.run(); } })));
  }
  cEvent(ev, sc, bodyDeps) {          // → {items: [{edge, get}], deps}
    if (ev.star) return { items: [...bodyDeps].map(s => ({ edge: 'any', get: s.dims ? () => s.ver : () => s.val })), deps: bodyDeps };
    const deps = new Set(), cx = { scope: sc, deps, evctl: true };
    const items = ev.items.map(it => { const n = this.cExpr(it.expr, cx); return { edge: it.edge, get: n.real ? n.mk() : n.mk(n.w, n.s) }; });
    return { items, deps };
  }
  evStmt(ev, inner) {
    const sim = this;
    return { blk: true, run: function* () { sim.waitEv(ev); yield; if (inner.blk) yield* inner.run(); else inner.run(); } };
  }
  cNetDelay(ast, cx) {                // v => ticks: nets and gates may have separate rise, fall and turn-off delays (IEEE 1364-2005 §6.1.3)
    if (ast.k !== 'delays') { const d = this.cDelay(ast, cx); return () => d(); }
    const ds = ast.list.map(e => this.cDelay(e, cx));
    return v => {
      const rise = ds[0](), fall = ds[1](), off = ds[2] ? ds[2]() : Math.min(rise, fall);
      if (v.b && v.a === 0n && v.b === mask(v.w)) return off;             // to z
      if (v.b && v.w === 1) return Math.min(rise, fall, off);             // a single bit going to x
      return !v.a && !v.b ? fall : rise;                                  // to zero, or to anything else
    };
  }
  cDelay(ast, cx) {                   // thunk: delay in simulation ticks, rounded to the module's time precision
    if (ast.k === 'delays') ast = ast.list[0];
    const n = this.cExpr(ast, { scope: cx.scope }), tu = cx.scope.tu, tp = cx.scope.tp;
    if (n.real) { const t = n.mk(); return () => { const r = t(); return r > 0 ? Math.round(r * tu / tp) * tp : 0; }; }
    const t = n.mk(n.w, n.s);
    return () => { const v = t(); return v.b ? 0 : Number(v.a) * tu; };
  }
  catchDisable(st, target) {
    const sim = this, mine = e => e instanceof Disable && e.target === target;
    if (!st.blk) return { blk: false, run() { target.live++; try { st.run(); } catch (e) { if (!mine(e)) throw e; } finally { target.live--; } } };
    return { blk: true, run: function* () {
      const p = sim.cur, abort = () => sim.kill(p, target);
      abort.proc = p; target.live++; target.aborts.add(abort);
      try { yield* st.run(); } catch (e) { if (!mine(e)) throw e; } finally { target.live--; target.aborts.delete(abort); }
    } };
  }
  cStmt(ast, cx) {
    const sim = this, line = ast.line;
    const tick = () => { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } };
    switch (ast.k) {
      case 'null': return NOP;
      case 'block': case 'fork': {
        let c = cx, scope = null;
        if (ast.name) {
          if (!cx.scope.pre || !cx.scope.pre.has(ast)) this.preBlocks(ast, cx.scope);
          scope = cx.scope.pre.get(ast);
          if (scope.init) { const fs = scope.init; scope.init = null; for (const f of fs) f(); }
          c = { ...cx, scope };
        }
        const ss = ast.stmts.map(s => this.cStmt(s, c));
        if (ast.k === 'fork') return { blk: true, run: function* () {
          let n = ss.length;
          if (!n) return;
          const wake = sim.park(), kids = [];
          const reap = () => { for (const k of kids) if (!k.fin && !k.dead) { k.dead = true; k.seq++; if (!k.run) try { k.gen.return(); } catch (e) { if (e !== KILLED) throw e; } } };
          const abort = () => { reap(); sim.active.push(wake); };       // "disable" of a named fork: end every branch, then carry on after join
          if (scope) { scope.live++; scope.aborts.add(abort); }
          for (const s of ss) {
            const kid = sim.spawn(function* () { if (s.blk) yield* s.run(); else s.run(); }, () => { if (--n === 0) sim.active.push(wake); });
            kids.push(kid); sim.active.push(() => sim.resume(kid));
          }
          try { yield; } finally { if (scope) { scope.live--; scope.aborts.delete(abort); } reap(); }
        } };
        let st;
        if (ss.length === 1) st = ss[0];
        else if (!ss.some(s => s.blk)) { const fs = ss.map(s => s.run), n = fs.length; st = { blk: false, run() { for (let i = 0; i < n; i++) fs[i](); } }; }
        else st = { blk: true, run: function* () { for (let i = 0; i < ss.length; i++) { const s = ss[i]; if (s.blk) yield* s.run(); else s.run(); } } };
        return scope ? this.catchDisable(st, scope) : st;
      }
      case 'if': {
        const c = this.truthOf(this.cExpr(ast.cond, cx)), a = this.cStmt(ast.then, cx), b = ast.els ? this.cStmt(ast.els, cx) : NOP;
        if (!a.blk && !b.blk) { const ar = a.run, br = b.run; return { blk: false, run() { if (c() === 1) ar(); else br(); } }; }
        return { blk: true, run: function* () { const s = c() === 1 ? a : b; if (s.blk) yield* s.run(); else s.run(); } };
      }
      case 'case': {
        const sel = this.cExpr(ast.expr, cx), all = [sel];
        const items = ast.items.map(it => ({ es: it.exprs && it.exprs.map(e => { const n = this.cExpr(e, cx); all.push(n); return n; }), st: this.cStmt(it.body, cx) }));
        if (items.filter(i => !i.es).length > 1) throw new VError('a case statement can have only one default', line);
        if (all.some(n => n.real)) throw new VError('real values are not supported in case statements', line);
        const W = Math.max(...all.map(n => n.w)), S = all.every(n => n.s), selT = sel.mk(W, S), arms = [];
        let dflt = NOP;
        for (const it of items) { if (!it.es) dflt = it.st; else arms.push({ ts: it.es.map(n => n.mk(W, S)), st: it.st }); }
        const match = ast.type === 'case' ? (a, b) => a.a === b.a && a.b === b.b
          : ast.type === 'casez' ? (a, b) => { const dc = (~a.a & a.b) | (~b.a & b.b); return (((a.a ^ b.a) | (a.b ^ b.b)) & ~dc) === 0n; }
          : (a, b) => ((a.a ^ b.a) & ~(a.b | b.b)) === 0n;
        const pick = () => {
          const v = selT();
          for (let i = 0; i < arms.length; i++) { const ts = arms[i].ts; for (let j = 0; j < ts.length; j++) if (match(v, ts[j]())) return arms[i].st; }
          return dflt;
        };
        if (!items.some(i => i.st.blk)) return { blk: false, run() { pick().run(); } };
        return { blk: true, run: function* () { const s = pick(); if (s.blk) yield* s.run(); else s.run(); } };
      }
      case 'for': {
        const init = this.cStmt(ast.init, cx), cond = this.truthOf(this.cExpr(ast.cond, cx)), step = this.cStmt(ast.step, cx), body = this.cStmt(ast.body, cx);
        if (init.blk || step.blk) throw new VError('delays are not supported in the header of a for loop', line);
        const i0 = init.run, st = step.run;
        if (!body.blk) { const b = body.run; return { blk: false, run() { for (i0(); cond() === 1; st()) { tick(); b(); } } }; }
        return { blk: true, run: function* () { for (i0(); cond() === 1; st()) { tick(); yield* body.run(); } } };
      }
      case 'while': {
        const cond = this.truthOf(this.cExpr(ast.cond, cx)), body = this.cStmt(ast.body, cx);
        if (!body.blk) { const b = body.run; return { blk: false, run() { while (cond() === 1) { tick(); b(); } } }; }
        return { blk: true, run: function* () { while (cond() === 1) { tick(); yield* body.run(); } } };
      }
      case 'repeat': {
        const cnt = this.cIntX(ast.cond, cx), body = this.cStmt(ast.body, cx);
        if (!body.blk) { const b = body.run; return { blk: false, run() { for (let n = cnt() || 0; n > 0; n--) { tick(); b(); } } }; }
        return { blk: true, run: function* () { for (let n = cnt() || 0; n > 0; n--) { tick(); yield* body.run(); } } };
      }
      case 'forever': {
        const body = this.cStmt(ast.body, cx);
        if (!body.blk) { const b = body.run; return { blk: false, run() { for (;;) { tick(); b(); } } }; }
        return { blk: true, run: function* () { for (;;) { tick(); yield* body.run(); } } };
      }
      case 'delay': {
        const d = this.cDelay(ast.delay, cx), body = this.cStmt(ast.body, cx);
        return { blk: true, run: function* () { sim.at(sim.time + d(), sim.park()); yield; if (body.blk) yield* body.run(); else body.run(); } };
      }
      case 'evwait': {
        const c2 = { ...cx, deps: new Set() }, inner = this.cStmt(ast.body, c2);
        if (cx.deps) for (const s of c2.deps) cx.deps.add(s);
        return this.evStmt(this.cEvent(ast.ev, cx.scope, c2.deps), inner);
      }
      case 'wait': {
        const deps = new Set(), cond = this.truthOf(this.cExpr(ast.cond, { scope: cx.scope, deps })), body = this.cStmt(ast.body, cx);
        return { blk: true, run: function* () {
          while (cond() !== 1) {
            const wake = sim.park(), w = { dead: false, fire() { w.dead = true; sim.active.push(wake); } };
            for (const s of deps) sim.addOnce(s, w);
            yield;
          }
          if (body.blk) yield* body.run(); else body.run();
        } };
      }
      case 'assign': {
        const lv = this.cLval(ast.lhs, cx), rhs = this.cRhs(this.cExpr(ast.rhs, cx), lv.w, lv.real);
        const ev = ast.ev ? this.cEvent(ast.ev, cx.scope, new Set()) : null, rep = ast.rep ? this.cIntX(ast.rep, cx) : null;
        if (ast.nb) {
          if (cx.func) throw new VError(`function '${cx.func}' cannot contain a nonblocking assignment (<=); use = instead`, line);
          if (ev) return { blk: false, run() {          // q <= @(posedge clk) d;  — scheduled without blocking the process
            sim.line = line;
            const v = rhs(), st = lv.prep();
            let n = rep ? rep() || 0 : 1;
            const arm = () => sim.onEvent(ev, () => { if (--n > 0) arm(); else sim.nbaq.push(() => st(v)); });
            if (n > 0) arm(); else sim.nbaq.push(() => st(v));
          } };
          const d = ast.delay ? this.cDelay(ast.delay, cx) : null;
          return { blk: false, run() {
            sim.line = line;
            const v = rhs(), st = lv.prep(), t = d ? sim.time + d() : sim.time;
            if (t > sim.time) sim.slot(t).n.push(() => st(v)); else sim.nbaq.push(() => st(v));
          } };
        }
        if (ast.delay) { const d = this.cDelay(ast.delay, cx); return { blk: true, run: function* () { sim.line = line; const v = rhs(); sim.at(sim.time + d(), sim.park()); yield; lv.store(v); } }; }
        if (ev) return { blk: true, run: function* () { const v = rhs(); for (let n = rep ? rep() || 0 : 1; n > 0; n--) { sim.waitEv(ev); yield; } lv.store(v); } };
        const store = lv.store;
        return { blk: false, run() { sim.line = line; store(rhs()); } };
      }
      case 'trigger': {
        const ev = this.resolve(ast.target, cx.scope);
        if (ev.kind !== 'sig' || !ev.isEvent) throw new VError(`'${ast.target.path[0].n}' is not an event`, line);
        return { blk: false, run() { sim.set(ev, vn(32, ev.val.a + 1n)); } };
      }
      case 'disable': {
        const ent = this.findKind(ast.target, cx.scope, ['scope', 'task', 'func']);
        if (ent.kind !== 'scope' && ent.kind !== 'task' && ent.kind !== 'func') throw new VError(`'${ast.target.path[0].n}' is not a named block or a task`, line);
        const target = ent.kind === 'scope' ? ent.scope : ent;
        return { blk: false, run() { sim.line = line; if (target.live) sim.disable(target); } };          // disabling something that is not running does nothing
      }
      case 'taskcall': return this.cTaskCall(ast, cx);
      case 'syscall': return this.cSysTask(ast, cx);
    }
    throw new VError('this is not a valid statement', line);
  }
  cTaskCall(ast, cx) {
    const sim = this, line = ast.line, ent = this.findKind(ast.target, cx.scope, ['task']), name = ast.target.path[ast.target.path.length - 1].n;
    if (ent.kind !== 'task') throw new VError(ent.kind === 'func' ? `'${name}' is a function; use its result in an expression` : `'${name}' is not a task`, line);
    const t = this.ensureTask(ent), T = t.inst;
    if (ast.args.length !== T.ports.length) throw new VError(`task '${name}' takes ${T.ports.length} argument(s) but was given ${ast.args.length}`, line);
    const ins = [], outs = [];
    T.ports.forEach((p, i) => {
      const a = ast.args[i];
      if (p.dir !== 'output') ins.push({ i, rhs: this.cRhs(this.cExpr(a, cx), p.sig.w, p.sig.real) });
      if (p.dir !== 'input') outs.push({ i, lv: this.cLval(a, cx), s: p.sig.signed, real: p.sig.real });
    });
    const conv = (o, v) => o.lv.real ? (o.real ? v : v2r(v, o.s)) : o.real ? r2v(v, o.lv.w) : resize(v, o.lv.w, o.s);
    const enter = () => {
      sim.line = line;
      const vals = ins.map(x => x.rhs());
      let k = T;
      if (t.auto) { k = t.pool.pop() || sim.makeTaskInst(ent); for (const s of k.locals) s.val = initVal(s); }
      for (let n = 0; n < ins.length; n++) sim.store(k.ports[ins[n].i].sig, vals[n]);
      ent.live++;
      return k;
    };
    const leave = k => {
      ent.live--;
      const vals = outs.map(o => conv(o, k.ports[o.i].sig.val));
      if (t.auto) t.pool.push(k);
      for (let n = 0; n < outs.length; n++) outs[n].lv.store(vals[n]);
    };
    const mine = e => e instanceof Disable && e.target === ent;
    const bail = k => { ent.live--; if (t.auto) t.pool.push(k); };       // left by an exception that is not ours: no outputs are copied
    if (!t.compiling && !t.blk) return { blk: false, run() { const k = enter(); try { k.body.run(); } catch (e) { if (!mine(e)) { bail(k); throw e; } } leave(k); } };
    return { blk: true, run: function* () {
      const k = enter(), p = sim.cur, abort = () => sim.kill(p, ent);
      let ok = false;
      abort.proc = p; ent.aborts.add(abort);
      try { if (k.body.blk) yield* k.body.run(); else k.body.run(); ok = true; } catch (e) { if (!mine(e)) throw e; ok = true; } finally { ent.aborts.delete(abort); if (!ok) bail(k); }
      leave(k);
    } };
  }

  // ── system tasks ──
  cFormat(args, cx, base, single) {
    const sim = this, sc = cx.scope;
    const items = args.map((a, i) => {
      if (!a) return null;
      const n = this.cExpr(a, cx);
      return { str: a.k === 'str' ? a.v : undefined, dyn: !!single && i === 0 && a.k !== 'str' && !n.real, get: n.real ? n.mk() : n.mk(n.w, n.s), real: n.real, s: n.s,
        time: a.k === 'sysfn' && /^\$(time|stime|realtime)$/.test(a.name) };
    });
    const f = () => sim.format(items, base, sc, single);
    f.key = () => { let k = ''; for (const it of items) if (it && !it.time && it.str === undefined) { const v = it.get(); k += it.real ? v + ';' : v.a.toString(36) + '/' + v.b.toString(36) + ';'; } return k; };
    return f;
  }
  format(items, base, sc, single) {
    let out = '', i = 0;
    const re = /%([-+]*)(\d*)(?:\.(\d+))?([a-zA-Z%])/y;
    while (i < items.length) {
      const it = items[i++];
      if (!it) { out += ' '; continue; }
      let s = it.str;
      if (s === undefined) {
        if (!it.dyn) { out += it.real ? fmtG(it.get(), 6, true) : fmtVec(base, it.get(), it.s); continue; }
        s = bytesStr(it.get());       // $sformat: the format may come from a variable
      }
      for (let p = 0; p < s.length; p++) {
        if (s[p] !== '%') { out += s[p]; continue; }
        re.lastIndex = p;
        const m = re.exec(s);
        if (!m) { out += '%'; continue; }
        p += m[0].length - 1;
        const spec = m[4].toLowerCase();
        if (spec === '%') out += '%';
        else out += this.fmtArg(spec, spec === 'm' ? null : items[i++], m[1].includes('-'), m[2], m[3], sc, m[4] === 'E' || m[4] === 'G', m[1].includes('+'));
      }
      if (single) break;              // $sformat takes one format string; extra arguments are ignored
    }
    return out;
  }
  fmtArg(spec, a, left, D, P, sc, upper, plus) {
    const width = D === '' ? undefined : parseInt(D, 10), zero = D.length > 1 && D[0] === '0', prec = P === undefined ? 6 : parseInt(P, 10);
    const pad = s => width === undefined ? s : left ? s.padEnd(width) : s.padStart(width);
    if (spec === 'm') return pad(sc.path);
    if (!a) return '';
    switch (spec) {
      case 'd': case 'b': case 'o': case 'h': case 'x': {
        const base = spec === 'x' ? 'h' : spec;
        if (!a.real) return fmtVec(base, a.get(), a.s, width, zero, left);
        const r = a.get();
        if (!Number.isFinite(r)) return pad(nonFinite(r));
        return base === 'd' ? padNum(roundR(r).toString(), width, zero, left) : fmtVec(base, vn(64, roundR(r)), false, width === undefined ? 0 : width, zero, left);
      }
      case 'c': { if (a.real) return pad(''); const v = a.get(); return pad(String.fromCharCode(Number(v.a & ~v.b & 255n))); }
      case 's': {
        if (a.str !== undefined) return pad(a.str);
        if (a.real) return pad(fmtG(a.get(), 6, true));
        const v = a.get(), n = Math.ceil(v.w / 8), bits = v.a & ~v.b;
        let s = '';
        for (let i = n - 1; i >= 0; i--) { const c = Number((bits >> BigInt(8 * i)) & 255n); if (c) s += String.fromCharCode(c); else if (s) s += ' '; }
        return width === undefined ? s.padStart(n) : pad(s);
      }
      case 't': {
        const tf = this.tf || { unit: this.prec, digits: 0, suffix: '', minw: 20 }, fw = width === undefined ? tf.minw : width;
        const fit = s => left ? s.padEnd(fw) : s.padStart(fw);
        let ticks;
        if (a.real) ticks = a.get() * sc.tu;
        else { const v = a.get(); if (v.b) return fit('x'); ticks = Number(a.s ? sbig(v) : v.a) * sc.tu; }
        const sh = tf.unit - this.prec;
        return fit(fmtF(sh >= 0 ? ticks / 10 ** sh : ticks * 10 ** -sh, tf.digits) + tf.suffix);
      }
      case 'e': case 'f': case 'g': {
        const r = a.real ? a.get() : v2r(a.get(), a.s);
        let s = spec === 'f' ? fmtF(r, prec) : spec === 'e' ? fmtE(r, prec) : fmtG(r, prec, false);
        if (plus && s[0] !== '-') s = '+' + s;
        return padNum(upper ? s.toUpperCase() : s, width, zero, left);
      }
      case 'v': return pad(a.real ? '' : ['St0', 'St1', 'HiZ', 'StX'][bitState(a.get())]);     // strengths are not modelled: everything driven is strong
      case 'u': case 'z': throw new VError(`the %${spec} format (raw binary output) is not supported`, this.line);
    }
    return '';
  }
  cSysTask(ast, cx) {
    const sim = this, name = ast.name, line = ast.line, sc = cx.scope, args = ast.args;
    const m = /^\$(display|write|strobe|monitor)([bho]?)$/.exec(name);
    if (m && m[1] !== 'monitor') {
      const fmt = this.cFormat(args, cx, m[2] || 'd'), nl = m[1] === 'write' ? '' : '\n';
      if (m[1] === 'strobe') return { blk: false, run() { sim.postponed.push(() => sim.emit(fmt() + nl)); } };
      return { blk: false, run() { sim.line = line; sim.emit(fmt() + nl); } };
    }
    if (m) {                          // $monitor prints at the end of any time step in which one of its arguments changed, even if it changed back
      const deps = new Set(), fmt = this.cFormat(args, { ...cx, deps }, m[2] || 'd');
      let cur = null, dirty = false;
      const mon = { check() { if (dirty) { dirty = false; sim.emit(fmt() + '\n'); } }, force() { dirty = true; } };
      const w = { fire() { if (sim.monitor !== mon) return; const k = fmt.key(); if (k !== cur) { cur = k; dirty = true; } } };
      for (const s of deps) s.pers.push(w);
      return { blk: false, run() { sim.monitor = mon; cur = fmt.key(); dirty = true; } };
    }
    const sw = /^\$swrite([bho]?)$/.exec(name);
    if (sw || name === '$sformat') {
      if (!args[0]) throw new VError(`${name} needs a variable to write into`, line);
      const lv = this.cLval(args[0], cx), fmt = this.cFormat(args.slice(1), cx, (sw && sw[1]) || 'd', !sw);
      if (lv.real) throw new VError(`${name} cannot write into a real`, line);
      return { blk: false, run() { sim.line = line; lv.store(strToV(fmt(), lv.w)); } };
    }
    switch (name) {
      case '$finish': case '$stop': return { blk: false, run() { sim.finished = true; throw FINISH; } };
      case '$monitoron': return { blk: false, run() { sim.monOn = true; if (sim.monitor) sim.monitor.force(); } };
      case '$monitoroff': return { blk: false, run() { sim.monOn = false; } };
      case '$dumpfile': case '$dumpvars': case '$dumpon': case '$dumpoff': case '$dumpall': case '$dumplimit': case '$dumpflush': case '$fflush':
        return NOP;                    // waveforms are always recorded
      case '$timeformat': {
        const num = a => a ? this.cIntX(a, cx) : null, u = num(args[0]), dg = num(args[1]), mw = num(args[3]);
        let sfx = () => '';
        if (args[2]) { const n = this.cExpr(args[2], cx); if (n.real) throw new VError('the $timeformat suffix must be a string', line); const g = n.mk(n.w, n.s); sfx = args[2].k === 'str' ? () => args[2].v : () => bytesStr(g()); }
        const clamp = (v, lo, hi, dflt) => v === null || v === undefined ? dflt : Math.max(lo, Math.min(hi, v));
        return { blk: false, run() { sim.tf = { unit: clamp(u && u(), -15, 2, sim.prec), digits: clamp(dg && dg(), 0, 40, 0), suffix: sfx(), minw: clamp(mw && mw(), 0, 1000, 20) }; } };
      }
      case '$printtimescale': {
        let ms = sc; while (ms.kind !== 'module') ms = ms.parent;
        return { blk: false, run() { sim.emit(`Time scale of (${ms.path}) is ${tsStr(ms.ts.unit)} / ${tsStr(ms.ts.prec)}\n`); } };
      }
      case '$random': case '$urandom': case '$dist_uniform': { const t = this.cSysFn({ k: 'sysfn', line, name, args }, cx).mk(32, false); return { blk: false, run() { t(); } }; }
      case '$readmemh': case '$readmemb': throw new VError(`${name} is not supported (there is no file system here); fill the memory in an initial block instead`, line);
    }
    throw new VError(`${name} is not a supported system task`, line);
  }

  waves() {
    return { end: this.time, prec: this.prec, truncated: this.nchg >= this.maxChg,
      signals: this.sigs.map(s => ({ name: s.path, w: s.w, real: s.real, signed: s.signed, changes: s.hist.map(([t, v]) => [t, s.real ? String(v) : binStr(v)]) })) };
  }
}

function run(source, opts = {}) {
  const res = { output: '', error: null, errorLine: 0, time: 0, finished: false, stopped: null, waves: null };
  const o = { ...opts, onOutput: opts.onOutput || (s => { res.output += s; }) };
  let sim = null;
  try {
    const mods = new Parser(lex(String(source))).source();
    if (!mods.length) throw new VError('no module found — a Verilog program needs at least one "module ... endmodule"');
    sim = new Sim(mods, o);
    sim.elaborate();
    sim.run();
  } catch (e) {
    if (e instanceof RangeError) e = new VError('this is nested or recursing too deeply for the interpreter (JavaScript stack limit: about a thousand levels of recursion)', sim ? sim.line : 0);
    if (!(e instanceof VError)) throw e;
    res.error = e.message; res.errorLine = e.line;
  }
  if (sim) {
    res.time = sim.time; res.finished = sim.finished; res.stopped = sim.stopped;
    if (opts.waves !== false) res.waves = sim.waves();
  }
  return res;
}

return { run, lex, Parser, Sim, VError };
});
