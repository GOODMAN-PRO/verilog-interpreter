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
const roundR = r => Number.isFinite(r) ? BigInt(Math.sign(r) * Math.round(Math.abs(r)) || 0) : 0n;  // half away from zero
const r2v = (r, w) => vn(w, roundR(r));
const v2r = (v, s) => v.b ? 0 : Number(s ? sbig(v) : v.a);

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
function strToV(s, w) {
  let a = 0n;
  for (let i = 0; i < s.length; i++) a = (a << 8n) | BigInt(s.charCodeAt(i) & 255);
  return V(w, a & mask(w), 0n);
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
const eqv = (a, b) => (!a.b && !b.b) ? (a.a === b.a ? V1 : V0) : ((a.a ^ b.a) & ~a.b & ~b.b) ? V0 : VX;
const rel = f => (a, b, S) => (a.b || b.b) ? VX : (S ? f(sbig(a), sbig(b)) : f(a.a, b.a)) ? V1 : V0;
const CMP = {
  '==': eqv,
  '!=': (a, b) => { const r = eqv(a, b); return r === V1 ? V0 : r === V0 ? V1 : VX; },
  '===': (a, b) => a.a === b.a && a.b === b.b ? V1 : V0,
  '!==': (a, b) => a.a === b.a && a.b === b.b ? V0 : V1,
  '<': rel((x, y) => x < y), '<=': rel((x, y) => x <= y), '>': rel((x, y) => x > y), '>=': rel((x, y) => x >= y),
};
const RCMP = {
  '==': (x, y) => x === y, '!=': (x, y) => x !== y, '===': (x, y) => x === y, '!==': (x, y) => x !== y,
  '<': (x, y) => x < y, '<=': (x, y) => x <= y, '>': (x, y) => x > y, '>=': (x, y) => x >= y,
};
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
  if (width === undefined) width = nat;
  return left ? s.padEnd(width) : s.padStart(width, zero && base === 'd' ? '0' : ' ');
}
const nonFinite = r => Number.isNaN(r) ? 'nan' : r > 0 ? 'inf' : '-inf';
const fmtF = (r, p) => Number.isFinite(r) ? r.toFixed(p) : nonFinite(r);
const fmtE = (r, p) => Number.isFinite(r) ? r.toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2') : nonFinite(r);
function fmtG(r, p, alt) {              // C printf %g (alt = the '#' flag: keep trailing zeros)
  if (!Number.isFinite(r)) return nonFinite(r);
  if (p === 0) p = 1;
  if (r === 0) return alt ? (0).toFixed(p - 1) : '0';
  const x = +r.toExponential(p - 1).split('e')[1];
  if (x < -4 || x >= p) { const s = fmtE(r, p - 1); return alt ? s : s.replace(/\.?0+e/, 'e'); }
  const s = r.toFixed(p - 1 - x);
  return alt || !s.includes('.') ? s : s.replace(/\.?0+$/, '');
}
function binStr(v) {
  const a = v.a.toString(2).padStart(v.w, '0'), b = v.b.toString(2).padStart(v.w, '0');
  if (!v.b) return a;
  let s = '';
  for (let i = 0; i < v.w; i++) s += b[i] === '0' ? a[i] : a[i] === '1' ? 'x' : 'z';
  return s;
}

// ───────────────────────────── lexer + preprocessor ─────────────────────────────
const NETS = new Set(['wire', 'tri', 'wand', 'wor', 'tri0', 'tri1', 'supply0', 'supply1']);
const VARS = new Set(['reg', 'integer', 'time', 'real', 'realtime']);
const GATES = new Set(['and', 'nand', 'or', 'nor', 'xor', 'xnor', 'buf', 'not', 'bufif0', 'bufif1', 'notif0', 'notif1']);
const KW = new Set(('module macromodule endmodule input output inout signed parameter localparam assign always initial begin end fork join ' +
  'if else case casez casex endcase default for while repeat forever wait function endfunction task endtask automatic generate endgenerate ' +
  'genvar posedge negedge event disable deassign force release defparam specify endspecify').split(' ').concat([...NETS], [...VARS], [...GATES]));
const OPS = ['<<<', '>>>', '===', '!==', '==', '!=', '<=', '>=', '&&', '||', '**', '<<', '>>', '~&', '~|', '~^', '^~', '->', '+:', '-:'];
const TS_EXP = { s: 0, ms: -3, us: -6, ns: -9, ps: -12, fs: -15 };

function lex(src) {
  const toks = [], defs = new Map(), conds = [];
  let i = 0, line = 1, ts = null, expansions = 0;
  const err = m => { throw new VError(m, line); };
  const skipping = () => conds.length > 0 && !conds[conds.length - 1].on;
  const push = (t, v) => { const k = { t, v, line }; if (v === 'module' || v === 'macromodule') k.ts = ts; toks.push(k); return k; };
  const skipWs = () => { while (src[i] === ' ' || src[i] === '\t') i++; };
  const ident = () => { const m = /[A-Za-z_][\w$]*/y; m.lastIndex = i; const r = m.exec(src); if (!r) err('identifier expected'); i = m.lastIndex; return r[0]; };
  const restOfLine = () => { let j = src.indexOf('\n', i); if (j < 0) j = src.length; const s = src.slice(i, j); i = j; return s; };

  function defineBody() {
    let out = '';
    for (;;) {
      let s = restOfLine();
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
      if (c === undefined || c === '\n') err('unterminated string');
      if (c === '"') return s;
      if (c !== '\\') { s += c; continue; }
      const e = src[i++];
      if (e === 'n') s += '\n';
      else if (e === 't') s += '\t';
      else if (e >= '0' && e <= '7') { let o = e; while (o.length < 3 && src[i] >= '0' && src[i] <= '7') o += src[i++]; s += String.fromCharCode(parseInt(o, 8) & 255); }
      else s += e;
    }
  }
  function directive() {
    i++;
    const name = ident();
    if (name === 'ifdef' || name === 'ifndef') {
      skipWs(); const n = ident(), parentOn = !skipping(), c = defs.has(n) === (name === 'ifdef');
      conds.push({ on: parentOn && c, done: !parentOn || c }); return;
    }
    if (name === 'elsif' || name === 'else' || name === 'endif') {
      const top = conds[conds.length - 1];
      if (!top) err('`' + name + ' without `ifdef');
      if (name === 'endif') conds.pop();
      else if (name === 'else') { top.on = !top.done; top.done = true; }
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
        if (!m) err('bad `timescale (expected e.g. `timescale 1ns/1ps)');
        ts = { unit: m[1].length - 1 + TS_EXP[m[2]], prec: m[3].length - 1 + TS_EXP[m[4]] };
        if (ts.prec > ts.unit) err('`timescale precision is larger than the time unit');
        return;
      }
      case 'include': err('`include is not supported (this interpreter runs a single file)');
      case 'default_nettype': case 'line': case 'pragma': case 'begin_keywords': case 'unconnected_drive': restOfLine(); return;
      case 'resetall': case 'celldefine': case 'endcelldefine': case 'nounconnected_drive': case 'end_keywords': return;
    }
    const d = defs.get(name);
    if (!d) err('undefined macro `' + name);
    if (++expansions > 100000) err('macro expansion limit reached (recursive `define?)');
    let body = d.body;
    if (d.args) {
      skipWs(); if (src[i] !== '(') err('macro `' + name + ' needs arguments'); i++;
      const actual = []; let depth = 0, cur = '';
      for (;; i++) {
        const c = src[i];
        if (c === undefined) err('unterminated macro arguments');
        if (c === '\n') line++;
        if (c === '"') { const st = i; str(); cur += src.slice(st, i); i--; continue; }
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
    const base = src[i++].toLowerCase();
    while (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r') { if (src[i] === '\n') line++; i++; }
    const m = /[0-9a-fA-FxXzZ?_]+/y; m.lastIndex = i;
    const r = m.exec(src); if (!r) err('malformed number');
    i = m.lastIndex;
    const digs = r[0].replace(/_/g, '').toLowerCase();
    if (!digs) err('malformed number');
    let a = 0n, b = 0n, nb, ext = null;
    if (base === 'd') {
      if (/^[xz?]$/.test(digs)) { ext = digs === 'x' ? 'x' : 'z'; nb = 1; b = 1n; if (ext === 'x') a = 1n; }
      else if (/^\d+$/.test(digs)) { a = BigInt(digs); nb = a.toString(2).length; }
      else err('malformed decimal number');
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
    else if (w < 1 || w > MAXW) err('bad number size');
    if (nb < w && ext) { const fill = mask(w) ^ mask(nb); b |= fill; if (ext === 'x') a |= fill; }
    const m2 = mask(w);
    push('num', null); Object.assign(toks[toks.length - 1], { w, signed, a: a & m2, b: b & m2, ext: size === null ? ext : null });
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
    Object.assign(push('num', null), { w, signed: true, a: n, b: 0n, ext: null });
  }

  for (;;) {
    const c = src[i];
    if (c === undefined) break;
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2); if (j < 0) err('unterminated /* comment');
      for (let k = i; k < j; k++) if (src[k] === '\n') line++;
      i = j + 2; continue;
    }
    if (c === '`') { directive(); continue; }
    if (c === '"') { const s = str(); if (!skipping()) push('str', s); continue; }
    if (skipping()) { i++; continue; }
    if (c >= '0' && c <= '9') { number(); continue; }
    if (c === "'" && /[sSbBoOdDhH]/.test(src[i + 1] || '')) { based(null); continue; }
    if (/[A-Za-z_]/.test(c)) { const id = ident(); push(KW.has(id) ? 'kw' : 'id', id); continue; }
    if (c === '$') { const m = /\$[\w$]+/y; m.lastIndex = i; const r = m.exec(src); if (!r) err("unexpected '$'"); i = m.lastIndex; push('sys', r[0]); continue; }
    if (c === '\\') { const m = /\\(\S+)/y; m.lastIndex = i; const r = m.exec(src); if (!r) err("unexpected '\\'"); i = m.lastIndex; push('id', r[1]); continue; }
    if (c === '(' && src[i + 1] === '*') {            // (* attribute *) — but not the "(*)" of "@(*)"
      let j = i + 2; while (src[j] === ' ' || src[j] === '\t') j++;
      if (src[j] !== ')') {
        const e = src.indexOf('*)', i + 2); if (e < 0) err('unterminated (* attribute');
        for (let k = i; k < e; k++) if (src[k] === '\n') line++;
        i = e + 2; continue;
      }
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (op) { push('op', op); i += op.length; continue; }
    if ('+-*/%!~&|^<>=?:;,.()[]{}#@'.includes(c)) { push('op', c); i++; continue; }
    err(`unexpected character '${c}'`);
  }
  if (conds.length) err('missing `endif');
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
  show() { const k = this.tok; return k.t === 'num' ? 'number' : k.t === 'str' ? 'string' : k.v; }
  at(v) { const k = this.t[this.p]; return (k.t === 'op' || k.t === 'kw') && k.v === v; }
  atKw(set) { const k = this.t[this.p]; return k.t === 'kw' && set.has(k.v); }
  eat(v) { if (this.at(v)) { this.p++; return true; } return false; }
  need(v) { if (!this.eat(v)) this.err(`expected '${v}' but found '${this.show()}'`); }
  id() { const k = this.tok; if (k.t !== 'id') this.err(`expected a name but found '${this.show()}'`); this.p++; return k.v; }
  eof(what) { if (this.tok.t === 'eof') this.err(`missing '${what}'`); }

  source() {
    const mods = [];
    while (this.tok.t !== 'eof') {
      if (this.at('module') || this.at('macromodule')) mods.push(this.module());
      else this.err(`expected 'module' but found '${this.show()}'`);
    }
    return mods;
  }
  module() {
    const k = this.tok; this.p++;
    const m = { name: this.id(), line: k.line, ts: k.ts, ports: [], items: [] };
    if (this.eat('#')) {
      this.need('(');
      let head = { signed: false, range: null, ptype: null };
      do {
        if (this.eat('parameter') || this.at('signed') || this.at('[') || this.atKw(PTYPES)) head = this.paramHead();
        m.items.push(this.paramOne(head, false));
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
        } else do m.ports.push(this.id()); while (this.eat(','));
      }
      this.need(')');
    }
    this.need(';');
    while (!this.at('endmodule')) { this.eof('endmodule'); m.items.push(...this.item()); }
    this.p++;
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
        if (this.at('#')) h.delay = this.delayVal();
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
          this.p++;
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
    }
    if (this.eat(';')) return [];
    if (k.t === 'id') return this.instances();
    this.err(`unexpected '${this.show()}' in module body`);
  }
  genItem() {
    const line = this.tok.line;
    if (this.eat('for')) {
      this.need('('); this.eat('genvar');
      const iv = this.id(); this.need('='); const init = this.expr(); this.need(';');
      const cond = this.expr(); this.need(';');
      const sv = this.id(); this.need('='); const step = this.expr(); this.need(')');
      if (sv !== iv) this.err('generate loop must step its own genvar');
      return { k: 'genfor', line, iv, init, cond, step, body: this.genBlock() };
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
    const line = this.tok.line;
    if (!this.eat('begin')) return { k: 'genblock', line, name: null, items: this.item() };
    const name = this.eat(':') ? this.id() : null, items = [];
    while (!this.eat('end')) { this.eof('end'); items.push(...this.item()); }
    if (this.eat(':')) this.id();
    return { k: 'genblock', line, name, items };
  }
  gates() {
    const type = this.tok.v; this.p++;
    const delay = this.at('#') ? this.delayVal() : null, out = [];
    do {
      const line = this.tok.line, name = this.tok.t === 'id' ? this.id() : null;
      this.need('('); const terms = []; do terms.push(this.expr()); while (this.eat(',')); this.need(')');
      out.push({ k: 'gate', line, type, name, terms, delay });
    } while (this.eat(','));
    this.need(';'); return out;
  }
  instances() {
    const mod = this.id();
    let params = null;
    if (this.eat('#')) { this.need('('); params = this.connList(); this.need(')'); }
    const out = [];
    do {
      const line = this.tok.line, name = this.id();
      if (this.at('[')) this.err('arrays of instances are not supported');
      this.need('('); const conns = this.connList(); this.need(')');
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
    if (named && list.some(c => c.name === null)) this.err('cannot mix named and positional connections');
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
          if (this.atKw(DIRS)) { const d = this.tok.v; this.p++; h = this.declHead(d); } else if (!h) this.err('port direction expected');
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
        while (this.atKw(VARS) || this.at('event') || this.at('parameter') || this.at('localparam')) decls.push(...this.item());
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
      if (ref.sels.length) this.err(`expected '=' or '<=' but found '${this.show()}'`);
      const args = this.callArgs(false);
      if (!this.at(';')) this.err(`expected '=', '<=' or ';' after '${ref.path[ref.path.length - 1].n}' but found '${this.show()}'`);
      this.p++;
      return { k: 'taskcall', line, target: ref, args };
    }
    if (this.at('{')) return this.assignTail(this.lvalue(), line, true);
    this.err(`unexpected '${this.show()}'`);
  }
  assignTail(lhs, line, semi) {
    if (!this.at('=') && !this.at('<=')) this.err(`expected '=' or '<=' but found '${this.show()}'`);
    const nb = this.at('<='); this.p++;
    let delay = null, ev = null, rep = null;
    if (this.at('#')) delay = this.delayVal();
    else if (this.at('@')) ev = this.eventCtl();
    else if (this.at('repeat')) { this.p++; this.need('('); rep = this.expr(); this.need(')'); ev = this.eventCtl(); }
    const rhs = this.expr();
    if (semi) this.need(';');
    return { k: 'assign', line, lhs, rhs, nb, delay, ev, rep };
  }
  assignment() { const line = this.tok.line, lhs = this.lvalue(); if (!this.at('=')) this.err(`expected '=' but found '${this.show()}'`); return this.assignTail(lhs, line, false); }
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
    this.need('('); const list = [this.expr()]; while (this.eat(',')) list.push(this.expr()); this.need(')');
    return list.length === 1 ? list[0] : { k: 'delays', line: k.line, list };      // (rise, fall[, turn-off])
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
      if (this.eat('.')) { path.push({ n, ix: sels.map(s => { if (s.k !== 'idx') this.err('bad hierarchical name'); return s.e; }) }); continue; }
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
    this.err(`unexpected '${this.show()}' in expression`);
  }
}
const numNode = k => ({ k: 'num', line: k.line, w: k.w, signed: k.signed, a: k.a, b: k.b, ext: k.ext, real: k.real });

// ───────────────────────────── simulator ─────────────────────────────
const FINISH = { finish: true };
class Disable { constructor(target) { this.target = target; } }
const NOP = { blk: false, run() {} };
const realNode = f => ({ w: 64, s: true, real: true, mk: () => f });
const vecNode = (w, s, f) => ({ w, s, real: false, mk: (W, S) => W === w ? f : () => resize(f(), W, S) });
const bitNode = f => vecNode(1, false, f);
const MATH1 = { $ln: Math.log, $log10: Math.log10, $exp: Math.exp, $sqrt: Math.sqrt, $floor: Math.floor, $ceil: Math.ceil, $sin: Math.sin, $cos: Math.cos, $tan: Math.tan,
  $asin: Math.asin, $acos: Math.acos, $atan: Math.atan, $sinh: Math.sinh, $cosh: Math.cosh, $tanh: Math.tanh, $asinh: Math.asinh, $acosh: Math.acosh, $atanh: Math.atanh };
const MATH2 = { $pow: Math.pow, $atan2: Math.atan2, $hypot: Math.hypot };

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
    this.cap = Math.min(this.maxOps, this.maxStep);          // ops allowed before the next check-in: total budget, or budget for one time step
    this.trace = opts.waves !== false; this.maxChg = opts.maxChanges || 200000; this.nchg = 0; this.sigs = [];
    this.time = 0; this.active = []; this.inactive = []; this.nbaq = []; this.postponed = []; this.future = new Map(); this.heap = [];
    this.finished = false; this.stopped = null; this.ops = 0; this.depth = 0; this.line = 0; this.cur = null;
    this.cas = []; this.pushes = []; this.procs = []; this.later = []; this.nets = [];
    this.seed = 0; this.tf = null; this.monitor = null; this.monOn = true; this.anon = 0; this.prec = 0;
    this.root = { parent: null, name: '', path: '', kind: 'root', names: new Map(), pdir: new Map(), gen: 0, tu: 1, tp: 1 };
  }
  emit(s) {
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
    for (const m of tops) this.elabModule(m, this.mkScope(this.root, m.name, 'module', m.line), null, null, 0);
    for (const f of this.later) f();
  }
  mkScope(parent, name, kind, line, hidden) {
    const s = { parent, name, kind, names: new Map(), path: parent.path ? parent.path + '.' + name : name, mod: parent.mod, tu: parent.tu, tp: parent.tp, pdir: new Map(), gen: 0 };
    if (!hidden) {
      if (parent.names.has(name)) throw new VError(`'${name}' is already declared`, line);
      parent.names.set(name, { kind: 'scope', scope: s });
    }
    return s;
  }
  elabModule(def, sc, over, alias, depth) {
    if (depth > 64) throw new VError(`module '${def.name}' instantiates itself`, def.line);
    const ts = def.ts || { unit: 0, prec: 0 };
    sc.mod = def; sc.tu = 10 ** (ts.unit - this.prec); sc.tp = 10 ** (ts.prec - this.prec);
    sc.over = over; sc.alias = alias; sc.pidx = 0;
    const own = [];
    this.elabItems(def.items, sc, own, depth);
    for (const p of def.ports) if (!sc.pdir.has(p)) throw new VError(`port '${p}' of module '${def.name}' has no input/output declaration`, def.line);
    if (over && over.named && over.map.size) throw new VError(`module '${def.name}' has no parameter '${[...over.map.keys()][0]}'`, over.line);
    if (over && !over.named && over.list.length > sc.pidx) throw new VError(`too many parameter overrides for module '${def.name}'`, over.line);
    this.later.push(...own);          // children were pushed first: their processes start before the parent's
  }
  elabItems(items, sc, own, depth) {
    for (const it of items) {
      this.line = it.line;
      switch (it.k) {
        case 'param': this.elabParam(it, sc); break;
        case 'decl': this.declare(it, sc, own); break;
        case 'genvar': for (const n of it.names) if (!sc.names.has(n)) sc.names.set(n, { kind: 'genvar', name: n }); break;
        case 'function': case 'task':
          if (sc.names.has(it.name)) throw new VError(`'${it.name}' is already declared`, it.line);
          sc.names.set(it.name, { kind: it.k === 'function' ? 'func' : 'task', name: it.name, ast: it, scope: sc, c: null });
          break;
        case 'assign': own.push(() => this.cContAssign(sc, it.lhs, it.rhs, it.delay, it.line)); break;
        case 'always': own.push(() => this.cAlways(sc, it)); break;
        case 'initial': own.push(() => this.cInitial(sc, it)); break;
        case 'gate': own.push(() => this.cGate(sc, it)); break;
        case 'inst': this.elabInst(sc, it, own, depth); break;
        case 'genfor': {
          const gname = it.body.name || `genblk${++sc.gen}`;
          const tmp = v => ({ parent: sc, names: new Map([[it.iv, this.intParam(v)]]), kind: 'gen', path: sc.path, tu: sc.tu, tp: sc.tp });
          let v = this.cint(it.init, sc, 'generate loop start');
          for (let guard = 0; this.ctrue(it.cond, tmp(v)); guard++) {
            if (guard > 65536) throw new VError('generate loop does not terminate', it.line);
            const gs = this.mkScope(sc, `${gname}[${v}]`, 'gen', it.line);
            gs.names.set(it.iv, this.intParam(v));
            this.elabItems(it.body.items, gs, own, depth);
            v = this.cint(it.step, tmp(v), 'generate loop step');
          }
          break;
        }
        case 'genif': { const n = ++sc.gen, b = this.ctrue(it.cond, sc) ? it.then : it.els; if (b) this.elabGenBlock(b, sc, own, depth, n); break; }
        case 'gencase': {
          const n = ++sc.gen, sel = this.cExpr(it.expr, { scope: sc });
          let pick = null;
          for (const c of it.items) {
            if (!c.exprs) { pick = pick || c.body; continue; }
            if (c.exprs.some(e => { const x = this.cExpr(e, { scope: sc }), W = Math.max(sel.w, x.w), S = sel.s && x.s; return CMP['==='](sel.mk(W, S)(), x.mk(W, S)()) === V1; })) { pick = c.body; break; }
          }
          if (pick) this.elabGenBlock(pick, sc, own, depth, n);
          break;
        }
        case 'genblock': this.elabGenBlock(it, sc, own, depth, ++sc.gen); break;
      }
    }
  }
  elabGenBlock(b, sc, own, depth, n) {
    this.elabItems(b.items, this.mkScope(sc, b.name || `genblk${n}`, 'gen', b.line), own, depth);
  }
  intParam(v) { return { kind: 'param', w: 32, s: true, real: false, val: vn(32, v) }; }
  elabParam(it, sc) {
    if (sc.names.has(it.name)) throw new VError(`'${it.name}' is already declared`, it.line);
    let src = it.expr, from = sc;
    if (!it.local && sc.kind === 'module' && sc.over) {
      const o = sc.over;
      if (o.named) { if (o.map.has(it.name)) { const e = o.map.get(it.name); o.map.delete(it.name); if (e) { src = e; from = o.scope; } } }
      else if (sc.pidx < o.list.length && o.list[sc.pidx]) { src = o.list[sc.pidx]; from = o.scope; }
      sc.pidx++;
    }
    const n = this.cExpr(src, { scope: from });
    const p = { kind: 'param', name: it.name, w: 64, s: true, real: false, val: null };
    if (it.ptype === 'real' || it.ptype === 'realtime' || (n.real && !it.ptype && !it.range)) { p.real = true; p.val = this.toReal(n)(); }
    else {
      if (it.ptype === 'integer') { p.w = 32; p.s = true; }
      else if (it.ptype === 'time') { p.w = 64; p.s = false; }
      else if (it.range) { p.w = Math.abs(this.cint(it.range.msb, sc) - this.cint(it.range.lsb, sc)) + 1; p.s = it.signed; }
      else { p.w = n.w; p.s = it.signed || n.s; }
      p.val = this.cRhs(n, p.w, false)();
    }
    sc.names.set(it.name, p);
  }
  declare(it, sc, own) {
    const tf = sc.kind === 'func' || sc.kind === 'task', kind = it.kind;
    const real = kind === 'real' || kind === 'realtime', isVar = VARS.has(kind) || kind === 'event' || tf;
    for (const v of it.vars) {
      const line = v.line || it.line; this.line = line;
      let w = 1, msb = 0, lsb = 0, signed = it.signed, ranged = false;
      if (kind === 'integer') { w = 32; msb = 31; signed = true; ranged = true; }
      else if (kind === 'time') { w = 64; msb = 63; ranged = true; }
      else if (kind === 'event') { w = 32; msb = 31; }
      else if (it.range) {
        msb = this.cint(it.range.msb, sc, 'range bound'); lsb = this.cint(it.range.lsb, sc, 'range bound'); w = Math.abs(msb - lsb) + 1; ranged = true;
        if (w > MAXW) throw new VError(`'${v.name}' is too wide (${w} bits)`, line);
      }
      const ex = sc.names.get(v.name);
      if (ex && sc.aliased && sc.aliased.has(v.name) && !it.dir) continue;
      if (ex && ex.kind === 'sig' && !ex.done && !v.dims.length && !ex.dims && (!!it.dir !== sc.pdir.has(v.name))) {
        // the other half of a non-ANSI port declaration ("output q;" + "reg q;", in either order)
        if (it.dir) sc.pdir.set(v.name, it.dir);
        if (ranged) { ex.w = w; ex.msb = msb; ex.lsb = lsb; }
        if (signed) ex.signed = true;
        if (real) ex.real = true;
        if (isVar && !it.dir || VARS.has(kind)) ex.net = false;
        ex.val = ex.real ? 0 : ex.net ? vz(ex.w) : vx(ex.w); ex.done = true;
        if (ex.hist) ex.hist = [[0, ex.val]];
        this.declInit(ex, v, it, sc, own, line);
        continue;
      }
      if (ex) throw new VError(`'${v.name}' is already declared`, line);
      if (it.dir === 'inout' && sc.alias && sc.alias.has(v.name)) {
        const a = sc.alias.get(v.name);
        if (a.w !== w) throw new VError(`inout port '${v.name}' is ${w} bit(s) wide but is connected to a ${a.w}-bit net`, line);
        sc.names.set(v.name, a); sc.pdir.set(v.name, 'inout'); (sc.aliased || (sc.aliased = new Set())).add(v.name);
        continue;
      }
      const dims = v.dims.map(d => { const a = this.cint(d.msb, sc, 'array bound'), b = this.cint(d.lsb, sc, 'array bound'); return { lo: Math.min(a, b), hi: Math.max(a, b), n: Math.abs(a - b) + 1 }; });
      const sig = this.mkSig(sc, v.name, { w, msb, lsb, signed, real, net: !isVar && !real, dims, isEvent: kind === 'event' });
      if (it.dir) sc.pdir.set(v.name, it.dir);
      this.declInit(sig, v, it, sc, own, line);
    }
  }
  declInit(sig, v, it, sc, own, line) {
    if (it.kind === 'supply0' || it.kind === 'supply1')
      own.push(() => { const d = this.addDriver(sig), c = V(sig.w, it.kind === 'supply1' ? mask(sig.w) : 0n, 0n); this.addCA(v => this.driveNet(sig, d, v), () => c, [], null, line); });
    if (!v.init) return;
    const ref = { k: 'id', line, path: [{ n: v.name, ix: [] }], sels: [] };
    if (sig.net) own.push(() => this.cContAssign(sc, ref, v.init, it.delay, line));
    else own.push(() => {
      const cx = { scope: sc }, lv = this.cLval(ref, cx), rhs = this.cRhs(this.cExpr(v.init, cx), lv.w, lv.real);
      this.procs.push(() => lv.store(rhs()));
    });
  }
  mkSig(sc, name, o, elem) {
    const s = { kind: 'sig', name, path: sc.path ? sc.path + '.' + name : name, w: o.w, msb: o.msb, lsb: o.lsb, signed: !!o.signed, real: !!o.real, net: !!o.net,
      isEvent: !!o.isEvent, val: null, pers: [], once: [], cap: 16, drivers: null, dims: null, data: null, elems: null, ver: 0, hist: null, done: false };
    s.val = s.real ? 0 : s.isEvent ? V(32, 0n, 0n) : s.net ? vz(s.w) : vx(s.w);
    if (o.dims && o.dims.length) {
      const n = o.dims.reduce((a, d) => a * d.n, 1);
      if (n > 1 << 22) throw new VError(`array '${name}' is too large (${n} elements)`, this.line);
      s.dims = o.dims;
      if (s.net) s.elems = Array.from({ length: n }, (_, i) => this.mkSig(sc, `${name}[${o.dims.length === 1 ? o.dims[0].lo + i : i}]`, { ...o, dims: null }, true));
      else s.data = new Array(n).fill(s.val);
    } else if (this.trace && !s.isEvent && sc.kind !== 'func' && sc.kind !== 'task') { s.hist = [[0, s.val]]; this.sigs.push(s); }
    if (s.net && !s.dims) this.nets.push(s);
    if (!elem) sc.names.set(name, s);
    return s;
  }
  elabInst(sc, it, own, depth) {
    const def = this.mods.get(it.mod);
    if (!def) throw new VError(`unknown module '${it.mod}'`, it.line);
    const child = this.mkScope(sc, it.name, 'module', it.line);
    let over = null;
    if (it.params) over = { named: it.params.named, scope: sc, line: it.line, list: it.params.list.map(c => c.expr), map: new Map(it.params.list.map(c => [c.name, c.expr])) };
    const conn = new Map();
    if (it.conns.named) for (const c of it.conns.list) {
      if (!def.ports.includes(c.name)) throw new VError(`module '${def.name}' has no port '${c.name}'`, it.line);
      if (conn.has(c.name)) throw new VError(`port '${c.name}' is connected twice`, it.line);
      conn.set(c.name, c.expr);
    } else {
      if (it.conns.list.length > def.ports.length) throw new VError(`too many port connections for module '${def.name}' (it has ${def.ports.length} port(s))`, it.line);
      it.conns.list.forEach((c, i) => conn.set(def.ports[i], c.expr));
    }
    if (!def.dirs) { def.dirs = new Map(); for (const d of def.items) if (d.k === 'decl' && d.dir) for (const v of d.vars) def.dirs.set(v.name, d.dir); }
    const alias = new Map();
    for (const [p, e] of conn) if (e && def.dirs.get(p) === 'inout') {
      const ent = e.k === 'id' && !e.sels.length ? this.resolve(e, sc, true) : null;
      if (!ent || ent.kind !== 'sig' || !ent.net || ent.dims) throw new VError(`inout port '${p}' must be connected to a plain wire`, it.line);
      alias.set(p, ent);
    }
    this.elabModule(def, child, over, alias, depth + 1);
    own.push(() => {
      for (const p of def.ports) {
        const e = conn.get(p), dir = child.pdir.get(p), ps = child.names.get(p);
        if (!e || dir === 'inout') continue;
        this.line = it.line;
        if (dir === 'input') {
          if (!ps.net) throw new VError(`input port '${p}' of module '${def.name}' cannot be a reg`, it.line);
          const cx = { scope: sc, deps: new Set(), implicit: true }, n = this.cExpr(e, cx), d = this.addDriver(ps);
          this.addCA(v => this.driveNet(ps, d, v), this.cRhs(n, ps.w, false), cx.deps, null, it.line);
        } else {
          const lv = this.cNetLval(e, { scope: sc, implicit: true });
          this.addCA(lv.drive, this.cRhs(this.sigNode(ps, [], { scope: child }, it.line), lv.w, false), [ps], null, it.line);
        }
      }
    });
  }

  // ── constant evaluation ──
  cint(ast, sc, what) {
    const n = this.cExpr(ast, { scope: sc });
    if (n.real) return Math.round(n.mk()());
    const v = n.mk(n.w, n.s)();
    if (v.b) throw new VError(`${what || 'constant expression'} is not a known constant`, ast.line || this.line);
    return Number(n.s ? sbig(v) : v.a);
  }
  ctrue(ast, sc) { return this.truthOf(this.cExpr(ast, { scope: sc }))() === 1; }

  // ── name resolution ──
  resolve(ast, sc, implicit) {
    const path = ast.path;
    const key = seg => seg.ix.length ? seg.n + seg.ix.map(e => `[${this.cint(e, sc, 'scope index')}]`).join('') : seg.n;
    const k0 = key(path[0]);
    let ent = null;
    for (let s = sc; s && !ent; s = s.parent) ent = s.names.get(k0);
    if (!ent && path.length > 1) for (let s = sc; s && !ent; s = s.parent) if (s.kind === 'module' && s.mod.name === k0) ent = { kind: 'scope', scope: s };
    if (!ent) {
      if (!implicit || path.length > 1 || path[0].ix.length) throw new VError(`'${k0}' is not declared`, ast.line);
      let ms = sc; while (ms.kind !== 'module' && ms.kind !== 'gen') ms = ms.parent;
      return this.mkSig(ms, k0, { w: 1, msb: 0, lsb: 0, net: true });     // implicit 1-bit wire
    }
    for (let i = 1; i < path.length; i++) {
      if (ent.kind !== 'scope') throw new VError(`'${path[i - 1].n}' is not a module instance or named block`, ast.line);
      const k = key(path[i]), e2 = ent.scope.names.get(k);
      if (!e2) throw new VError(`'${k}' was not found in '${ent.scope.path}'`, ast.line);
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
  cIntX(ast, cx) {                    // thunk: integer value, or null when it has x/z bits
    const n = this.cExpr(ast, cx);
    if (n.real) { const t = n.mk(); return () => Math.round(t()); }
    const t = n.mk(n.w, n.s), s = n.s;
    return () => { const v = t(); return v.b ? null : Number(s ? sbig(v) : v.a); };
  }
  cExpr(ast, cx) {
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
        if (a.real || b.real) { const x = this.toReal(a), y = this.toReal(b); return realNode(() => c() === 1 ? x() : y()); }
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
        const n = this.cint(ast.n, cx.scope, 'replication count'), c = this.cConcat(ast.parts, cx, line);
        if (n < 1 || n * c.w > MAXW) throw new VError(`bad replication count ${n}`, line);
        const t = c.mk(c.w, false), cw = BigInt(c.w), w = n * c.w;
        return vecNode(w, false, () => { const v = t(); let a = 0n, b = 0n; for (let i = 0; i < n; i++) { a = (a << cw) | v.a; b = (b << cw) | v.b; } return V(w, a, b); });
      }
      case 'call': return this.cCall(ast, cx);
      case 'sysfn': return this.cSysFn(ast, cx);
    }
    throw new VError('invalid expression', line);
  }
  cConcat(parts, cx, line) {
    const ps = parts.map(p => this.cExpr(p, cx));
    if (ps.some(p => p.real)) throw new VError('a real value cannot be used in a concatenation', line);
    const ts = ps.map(p => p.mk(p.w, p.s)), ws = ps.map(p => BigInt(p.w)), w = ps.reduce((a, p) => a + p.w, 0);
    if (w > MAXW) throw new VError('concatenation is too wide', line);
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
      case '**': {
        if (anyReal) { const a = this.toReal(l), b = this.toReal(r); return realNode(() => Math.pow(a(), b())); }
        const e = r.mk(r.w, r.s), es = r.s;
        return { w: l.w, s: l.s && r.s, real: false, mk: (W, S) => { const a = l.mk(W, S), m = mask(W), bs = l.s && S; return () => vpow(a(), e(), W, m, bs, es); } };
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
        if (anyReal) { const a = this.toReal(l), b = this.toReal(r), f = RCMP[op]; return bitNode(() => f(a(), b()) ? V1 : V0); }
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
    const ent = this.resolve(ast, cx.scope, cx.implicit), line = ast.line, name = ast.path[ast.path.length - 1].n;
    if (ent.kind === 'sig') return this.sigNode(ent, ast.sels, cx, line);
    if (ent.kind === 'param') {
      if (ent.real) { if (ast.sels.length) throw new VError('cannot select bits of a real parameter', line); const r = ent.val; return realNode(() => r); }
      const v = ent.val;
      if (!ast.sels.length) return { w: v.w, s: ent.s, real: false, mk: (W, S) => { const r = resize(v, W, S); return () => r; } };
      return this.sigNode({ name, w: v.w, msb: v.w - 1, lsb: 0, signed: false, real: false, dims: null, val: v }, ast.sels, { scope: cx.scope }, line);
    }
    if (ent.kind === 'func') throw new VError(`function '${name}' must be called with arguments`, line);
    if (ent.kind === 'genvar') throw new VError(`genvar '${name}' can only be used inside its generate loop`, line);
    throw new VError(`'${name}' cannot be used as a value`, line);
  }
  sigNode(sig, sels, cx, line) {
    let get, k = 0;
    const w = sig.w;
    if (sig.dims) {
      const nd = sig.dims.length;
      if (sels.length < nd) throw new VError(`array '${sig.name}' needs ${nd} index${nd > 1 ? 'es' : ''}`, line);
      const idx = this.cIndex(sig, sels.slice(0, nd), cx, line), X = sig.real ? 0 : vx(w);
      k = nd;
      if (sig.elems) { const el = sig.elems; if (cx.deps) for (const e of el) cx.deps.add(e); get = () => { const i = idx(); return i < 0 ? X : el[i].val; }; }
      else { if (cx.deps) cx.deps.add(sig); get = () => { const i = idx(); return i < 0 ? X : sig.data[i]; }; }
    } else { if (cx.deps) cx.deps.add(sig); get = () => sig.val; }
    if (sig.real) { if (sels.length > k) throw new VError('cannot select bits of a real value', line); return realNode(get); }
    if (sels.length === k) return vecNode(w, sig.signed, get);
    if (sels.length > k + 1) throw new VError(`too many indexes on '${sig.name}'`, line);
    const sel = this.cSel(sig, sels[k], cx, line), sw = sel.w, lo = sel.lo, X = vx(sw);
    return vecNode(sw, false, () => { const p = lo(); return p === null ? X : extract(get(), p, sw); });
  }
  cIndex(sig, sels, cx, line) {       // thunk: flat element offset, or -1 when out of range / unknown
    const ts = sels.map(s => { if (s.k !== 'idx') throw new VError(`array '${sig.name}' must be indexed with a single index`, line); return this.cIntX(s.e, cx); });
    const dims = sig.dims;
    if (dims.length === 1) { const { lo, hi } = dims[0], t = ts[0]; return () => { const i = t(); return i === null || i < lo || i > hi ? -1 : i - lo; }; }
    return () => {
      let f = 0;
      for (let d = 0; d < dims.length; d++) { const i = ts[d](); if (i === null || i < dims[d].lo || i > dims[d].hi) return -1; f = f * dims[d].n + i - dims[d].lo; }
      return f;
    };
  }
  cSel(sig, sel, cx, line) {          // {w, lo()} — lo is the bit offset from the LSB, or null when the index is unknown
    const desc = sig.msb >= sig.lsb, off = i => desc ? i - sig.lsb : sig.lsb - i;
    if (sel.k === 'idx') { const t = this.cIntX(sel.e, cx); return { w: 1, lo: () => { const i = t(); return i === null ? null : off(i); } }; }
    if (sel.k === 'range') {
      const hi = off(this.cint(sel.msb, cx.scope, 'part-select bound')), lo = off(this.cint(sel.lsb, cx.scope, 'part-select bound'));
      if (hi < lo) throw new VError(`part-select of '${sig.name}' runs against its declared direction`, line);
      return { w: hi - lo + 1, lo: () => lo };
    }
    const w = this.cint(sel.width, cx.scope, 'part-select width');
    if (w < 1 || w > MAXW) throw new VError('part-select width must be a positive constant', line);
    const t = this.cIntX(sel.base, cx), up = sel.k === 'plus';
    return { w, lo: () => { const i = t(); if (i === null) return null; const low = up ? i : i - w + 1; return desc ? off(low) : off(low + w - 1); } };
  }
  cCall(ast, cx) {
    const ent = this.findKind(ast.target, cx.scope, ['func']), line = ast.line, sim = this;
    if (ent.kind !== 'func') throw new VError(`'${ent.name || ast.target.path[0].n}' is not a function`, line);
    const f = this.ensureFunc(ent);
    if (ast.args.length !== f.ports.length) throw new VError(`function '${ent.name}' expects ${f.ports.length} argument(s) but got ${ast.args.length}`, line);
    const ins = f.ports.map((p, i) => this.cRhs(this.cExpr(ast.args[i], cx), p.w, p.real)), n = ins.length, ret = f.ret;
    const call = () => {
      const vals = new Array(n);
      for (let i = 0; i < n; i++) vals[i] = ins[i]();
      const saved = f.depth > 0 ? f.locals.map(s => s.val) : null;      // recursion: keep the caller's frame
      if (++f.depth > 3000) throw new VError(`function '${ent.name}' recurses too deeply`, line);
      for (let i = 0; i < n; i++) sim.store(f.ports[i], vals[i]);
      try { f.body.run(); } catch (e) { if (!(e instanceof Disable) || e.target !== ent) throw e; } finally { f.depth--; }
      const r = ret.val;
      if (saved) f.locals.forEach((s, i) => { s.val = saved[i]; });
      return r;
    };
    return ret.real ? realNode(call) : vecNode(ret.w, ret.signed, call);
  }
  ensureFunc(ent) {
    if (ent.c) return ent.c;
    const ast = ent.ast, s = this.mkScope(ent.scope, ast.name, 'func', ast.line, true);
    const c = ent.c = { ret: null, ports: [], locals: [], body: null, depth: 0 };
    let o = { w: 1, msb: 0, lsb: 0, signed: ast.signed };
    if (ast.rtype === 'integer') o = { w: 32, msb: 31, lsb: 0, signed: true };
    else if (ast.rtype === 'time') o = { w: 64, msb: 63, lsb: 0 };
    else if (ast.rtype) o = { w: 64, msb: 0, lsb: 0, real: true };
    else if (ast.range) { o.msb = this.cint(ast.range.msb, ent.scope); o.lsb = this.cint(ast.range.lsb, ent.scope); o.w = Math.abs(o.msb - o.lsb) + 1; }
    c.ret = this.mkSig(s, ast.name, o);
    const own = []; this.elabItems(ast.decls, s, own, 0); for (const f of own) f();
    c.ports = ast.ports.map(n => { if (s.pdir.get(n) !== 'input') throw new VError(`function '${ast.name}' may only have input ports`, ast.line); return s.names.get(n); });
    if (!c.ports.length) throw new VError(`function '${ast.name}' needs at least one input`, ast.line);
    c.locals = [...s.names.values()].filter(e => e.kind === 'sig' && !e.dims);
    c.body = this.cStmt(ast.body, { scope: s });
    if (c.body.blk) throw new VError(`function '${ast.name}' may not contain delays, event controls or blocking task calls`, ast.line);
    return c;
  }
  ensureTask(ent) {
    if (ent.c) return ent.c;
    const ast = ent.ast, s = this.mkScope(ent.scope, ast.name, 'task', ast.line, true);
    const c = ent.c = { ports: [], body: null, compiling: true };
    const own = []; this.elabItems(ast.decls, s, own, 0); for (const f of own) f();
    c.ports = ast.ports.map(n => ({ sig: s.names.get(n), dir: s.pdir.get(n) }));
    c.body = this.cStmt(ast.body, { scope: s });
    c.compiling = false;
    return c;
  }
  cSysFn(ast, cx) {
    const name = ast.name, args = ast.args, line = ast.line, sc = cx.scope, sim = this;
    const arg = i => { if (!args[i]) throw new VError(`${name} needs ${i + 1} argument(s)`, line); return this.cExpr(args[i], cx); };
    const int32 = f => vecNode(32, true, f);
    switch (name) {
      case '$time': return vecNode(64, false, () => vn(64, Math.round(sim.time / sc.tu)));
      case '$stime': return vecNode(32, false, () => vn(32, Math.round(sim.time / sc.tu)));
      case '$realtime': return realNode(() => sim.time / sc.tu);
      case '$random': case '$urandom': {
        if (!args[0]) return vecNode(32, name === '$random', () => vn(32, sim.random()));
        const seed = this.cRhs(arg(0), 32, false), lv = this.cLval(args[0], cx);     // $random(seed) uses and updates the caller's seed
        return vecNode(32, name === '$random', () => { const keep = sim.seed; sim.seed = Number(seed().a); const r = sim.random(); lv.store(resize(vn(32, sim.seed), lv.w, false)); sim.seed = keep; return vn(32, r); });
      }
      case '$urandom_range': {
        const hi = this.cIntX(args[0] || { k: 'num', line, w: 32, signed: false, a: 0xffffffffn, b: 0n }, cx), lo = args[1] ? this.cIntX(args[1], cx) : () => 0;
        return vecNode(32, false, () => { let a = lo() || 0, b = hi() || 0; if (a > b) [a, b] = [b, a]; return vn(32, a + (sim.random() >>> 0) % (b - a + 1)); });
      }
      case '$signed': case '$unsigned': {
        const e = arg(0);
        if (e.real) throw new VError(`${name} cannot be applied to a real value`, line);
        return vecNode(e.w, name === '$signed', e.mk(e.w, e.s));
      }
      case '$clog2': {
        const t = this.cRhs(arg(0), Math.max(32, arg(0).w), false);
        return int32(() => { const v = t(); if (v.b) return vx(32); let n = v.a, r = 0; if (n > 1n) { n -= 1n; while (n > 0n) { n >>= 1n; r++; } } return vn(32, r); });
      }
      case '$bits': { const e = arg(0), v = vn(32, e.real ? 1 : e.w); return int32(() => v); }
      case '$rtoi': { const t = this.toReal(arg(0)); return int32(() => { const r = t(); return vn(32, Number.isFinite(r) ? BigInt(Math.trunc(r)) : 0n); }); }
      case '$itor': return realNode(this.toReal(arg(0)));
      case '$realtobits': { const t = this.toReal(arg(0)), buf = new DataView(new ArrayBuffer(8)); return vecNode(64, false, () => { buf.setFloat64(0, t()); return V(64, buf.getBigUint64(0), 0n); }); }
      case '$bitstoreal': { const t = this.cRhs(arg(0), 64, false), buf = new DataView(new ArrayBuffer(8)); return realNode(() => { buf.setBigUint64(0, t().a); return buf.getFloat64(0); }); }
      case '$test$plusargs': case '$value$plusargs': { const z = vn(32, 0); return int32(() => z); }
    }
    if (MATH1[name]) { const f = MATH1[name], t = this.toReal(arg(0)); return realNode(() => f(t())); }
    if (MATH2[name]) { const f = MATH2[name], a = this.toReal(arg(0)), b = this.toReal(arg(1)); return realNode(() => f(a(), b())); }
    throw new VError(`unsupported system function ${name}`, line);
  }
  random() {                          // the IEEE 1364 reference generator, as built into Icarus on 32-bit-long platforms
    let s = this.seed >>> 0;
    if (s === 0) s = 259341593;
    s = (Math.imul(69069, s) + 1) >>> 0; this.seed = s;
    const d = 0.00000011920928955078125;
    let c = 1.0 + (s >>> 9) * d; c = c + c * d;
    c = 4294967295.0 * (c - 1.0) - 2147483648.0;
    let r = (c + 2147483648.0) / 4294967295.0; r = r * 4294967296.0 - 2147483648.0;
    return (r >= 0 ? Math.floor(r) : -Math.floor(1 - r)) | 0;
  }

  // ── assignment targets ──
  store(sig, v) { if (sig.real) this.setReal(sig, v); else this.set(sig, v); }
  set(sig, v) {
    const o = sig.val;
    if (o.a === v.a && o.b === v.b) return;
    sig.val = v; this.changed(sig);
  }
  setReal(sig, r) { if (sig.val !== r) { sig.val = r; this.changed(sig); } }
  setElem(sig, i, v) {
    const o = sig.data[i];
    if (sig.real ? o === v : o.a === v.a && o.b === v.b) return;
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
    const d = { val: vz(sig.w) }; (sig.drivers || (sig.drivers = [])).push(d); return d;
  }
  driveNet(sig, d, v) {
    d.val = v;
    const ds = sig.drivers;
    let r = v;
    if (ds.length > 1) { r = ds[0].val; for (let i = 1; i < ds.length; i++) r = resolve2(r, ds[i].val); }
    this.set(sig, r);
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
    if (sig.kind !== 'sig') throw new VError(`cannot assign to '${name}'${sig.kind === 'param' ? ' (it is a parameter)' : ''}`, line);
    if (sig.net) throw new VError(`cannot assign to wire '${name}' in a procedural block (declare it as reg, or use a continuous assign)`, line);
    if (sig.isEvent) throw new VError(`cannot assign to event '${name}'`, line);
    if (sig.dims) {
      const nd = sig.dims.length;
      if (sels.length < nd) throw new VError(`array '${name}' needs ${nd} index${nd > 1 ? 'es' : ''}`, line);
      const idx = this.cIndex(sig, sels.slice(0, nd), cx, line);
      if (sels.length === nd) return { w: sig.w, real: sig.real, store: v => { const i = idx(); if (i >= 0) sim.setElem(sig, i, v); }, prep: () => { const i = idx(); return v => { if (i >= 0) sim.setElem(sig, i, v); }; } };
      if (sig.real || sels.length > nd + 1) throw new VError(`too many indexes on '${name}'`, line);
      const sel = this.cSel(sig, sels[nd], cx, line), put = (i, p, v) => { if (i >= 0 && p !== null) sim.setElem(sig, i, insert(sig.data[i], p, sel.w, v)); };
      return { w: sel.w, real: false, store: v => put(idx(), sel.lo(), v), prep: () => { const i = idx(), p = sel.lo(); return v => put(i, p, v); } };
    }
    if (!sels.length) { const st = sig.real ? v => sim.setReal(sig, v) : v => sim.set(sig, v); return { w: sig.w, real: sig.real, store: st, prep: () => st }; }
    if (sig.real || sels.length > 1) throw new VError(`too many indexes on '${name}'`, line);
    const sel = this.cSel(sig, sels[0], cx, line), put = (p, v) => { if (p !== null) sim.set(sig, insert(sig.val, p, sel.w, v)); };
    return { w: sel.w, real: false, store: v => put(sel.lo(), v), prep: () => { const p = sel.lo(); return v => put(p, v); } };
  }
  cNetLval(ast, cx) {                 // continuous-assignment / output-port target: {w, drive(v)}
    const sim = this, line = ast.line;
    if (ast.k === 'concat') {
      const ps = ast.parts.map(p => this.cNetLval(p, cx)), w = ps.reduce((a, p) => a + p.w, 0);
      return { w, drive: v => { let hi = w; for (const p of ps) { hi -= p.w; p.drive(extract(v, hi, p.w)); } } };
    }
    if (ast.k !== 'id') throw new VError('a continuous assignment or output port must drive a net', line);
    let sig = this.resolve(ast, cx.scope, cx.implicit);
    const sels = ast.sels, name = ast.path[ast.path.length - 1].n;
    if (sig.kind !== 'sig') throw new VError(`'${name}' cannot be driven`, line);
    if (!sig.net) throw new VError(`'${name}' is a reg, so it cannot be driven by a continuous assignment or an output port (declare it as wire)`, line);
    let k = 0;
    if (sig.dims) {
      k = sig.dims.length;
      if (sels.length < k) throw new VError(`array '${name}' needs ${k} index${k > 1 ? 'es' : ''}`, line);
      const i = this.cIndex(sig, sels.slice(0, k), cx, line)();
      if (i < 0) throw new VError(`index of '${name}' is out of range or not constant`, line);
      sig = sig.elems[i];
    }
    const net = sig, d = this.addDriver(net);
    if (sels.length === k) return { w: net.w, drive: v => sim.driveNet(net, d, v) };
    if (sels.length > k + 1) throw new VError(`too many indexes on '${name}'`, line);
    const sel = this.cSel(net, sels[k], cx, line), lo = sel.lo(), Z = vz(net.w);
    if (lo === null) throw new VError('a select in a continuous-assignment target must be constant', line);
    return { w: sel.w, drive: v => sim.driveNet(net, d, insert(Z, lo, sel.w, v)) };
  }

  // ── continuous assignments and gates ──
  addCA(drive, rhs, deps, delay, line) {
    const ca = { drive, rhs, delay, seq: 0, pend: false, line, fire: () => this.evalCA(ca) };
    for (const s of deps) s.pers.push(ca);
    this.cas.push(ca);
  }
  evalCA(ca) {
    if (++this.ops > this.cap) { this.line = ca.line; this.limit(); }
    if (this.depth > 200) {           // very deep or looping combinational path: continue from the event queue instead of the JS stack
      if (!ca.pend) { ca.pend = true; this.active.push(() => { ca.pend = false; this.evalCA(ca); }); }
      return;
    }
    this.depth++;
    try {
      const v = ca.rhs();
      if (ca.delay) {                 // inertial delay: a newer evaluation cancels a pending one
        const id = ++ca.seq, d = ca.delay(v);
        if (d > 0) { this.slot(this.time + d).a.push(() => { if (ca.seq === id) ca.drive(v); }); return; }
      }
      ca.drive(v);
    } finally { this.depth--; }
  }
  cContAssign(sc, lhs, rhs, delay, line) {
    this.line = line;
    const cx = { scope: sc, deps: new Set(), implicit: true };
    const lv = this.cNetLval(lhs, { scope: sc, implicit: true }), n = this.cExpr(rhs, cx);
    this.addCA(lv.drive, this.cRhs(n, lv.w, false), cx.deps, delay ? this.cNetDelay(delay, cx) : null, line);
  }
  cGate(sc, it) {
    const type = it.type, line = it.line, cx = { scope: sc, deps: new Set(), implicit: true };
    const multiOut = type === 'buf' || type === 'not', tri = type.includes('if');
    if (it.terms.length < 2 || (tri && it.terms.length !== 3)) throw new VError(`wrong number of terminals for '${type}' gate`, line);
    const nOut = multiOut ? it.terms.length - 1 : 1;
    const outs = it.terms.slice(0, nOut).map(t => this.cNetLval(t, { scope: sc, implicit: true }));
    const ins = it.terms.slice(nOut).map(t => { const n = this.cExpr(t, cx); if (n.real) throw new VError('gate inputs cannot be real', line); const g = n.mk(n.w, n.s); return () => bitState(g()); });
    let f;
    if (tri) {
      const en = type.endsWith('1') ? 1 : 0, neg = type.startsWith('not');
      f = () => { const c = ins[1](); if (c === 1 - en) return 2; let d = ins[0](); if (d > 1) d = 3; else if (neg) d = 1 - d; return c === en ? d : 3; };
    } else if (type === 'and' || type === 'nand') f = () => { let x = false; for (const g of ins) { const b = g(); if (b === 0) return 0; if (b > 1) x = true; } return x ? 3 : 1; };
    else if (type === 'or' || type === 'nor') f = () => { let x = false; for (const g of ins) { const b = g(); if (b === 1) return 1; if (b > 1) x = true; } return x ? 3 : 0; };
    else if (type === 'xor' || type === 'xnor') f = () => { let p = 0; for (const g of ins) { const b = g(); if (b > 1) return 3; p ^= b; } return p; };
    else f = () => { const b = ins[0](); return b > 1 ? 3 : b; };
    const inv = type === 'nand' || type === 'nor' || type === 'xnor' || type === 'not', VALS = [V0, V1, VZ, VX];
    const rhs = () => { let r = f(); if (inv && r < 2) r = 1 - r; return VALS[r]; };
    const delay = it.delay ? this.cNetDelay(it.delay, cx) : null;
    for (const o of outs) this.addCA(o.w === 1 ? o.drive : v => o.drive(resize(v, o.w, false)), rhs, cx.deps, delay, line);
  }

  // ── scheduler ──
  slot(t) {
    let s = this.future.get(t);
    if (!s) { s = { a: [], n: [] }; this.future.set(t, s); heapPush(this.heap, t); }
    return s;
  }
  at(t, fn) { if (t <= this.time) this.inactive.push(fn); else this.slot(t).a.push(fn); }
  spawn(genFn, onDone) { return { gen: genFn(), onDone }; }
  resume(p) {
    this.cur = p;
    if (p.gen.next().done && p.onDone) p.onDone();
  }
  waitEv(ev) {                        // park the current process on an event control; the caller yields next
    const p = this.cur, items = ev.items, n = items.length, last = new Array(n), sim = this;
    for (let i = 0; i < n; i++) last[i] = items[i].get();
    const w = { dead: false, fire() {
      let hit = false;
      for (let i = 0; i < n; i++) { const c = items[i].get(); if (edgeHit(items[i].edge, last[i], c)) hit = true; last[i] = c; }
      if (hit) { w.dead = true; sim.active.push(() => sim.resume(p)); }
    } };
    for (const s of ev.deps) this.addOnce(s, w);
  }
  run() {
    try {
      // Time 0, in the order Icarus Verilog uses: level-sensitive always blocks start waiting, nets settle,
      // then declaration initialisers, initial blocks and the other always blocks run in source order
      // (instances before their parent). Whatever those wake runs after all of them.
      for (const s of this.nets) { s.val = vx(s.w); if (s.hist) s.hist[0][1] = s.val; }       // every net starts unknown...
      for (const f of this.pushes) f();
      this.active = this.procs.slice();
      for (const s of this.nets) if (!s.drivers) this.set(s, vz(s.w));                       // ...an undriven one floats to z
      for (const ca of this.cas) this.evalCA(ca);
      this.loop();
    } catch (e) {
      if (e instanceof Disable) throw new VError('disable: the target is not an enclosing block or task of this process', this.line);
      if (e instanceof VError && !e.line && this.line) throw new VError(e.raw, this.line);
      throw e;
    }
  }
  loop() {
    for (;;) {
      try { this.drain(); } catch (e) { if (e !== FINISH) throw e; }
      const ps = this.postponed; this.postponed = [];
      for (const f of ps) f();
      if (this.monitor && this.monOn) this.monitor();
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
    if (!body.blk) throw new VError('this always block has no delay or event control, so it would never let time advance', it.line);
    this.procs.push(() => this.resume(this.spawn(function* () { for (;;) { if (++sim.ops > sim.cap) sim.limit(); yield* body.run(); } })));
  }
  cEvent(ev, sc, bodyDeps) {          // → {items: [{edge, get}], deps}
    if (ev.star) return { items: [...bodyDeps].map(s => ({ edge: 'any', get: s.dims ? () => s.ver : () => s.val })), deps: bodyDeps };
    const deps = new Set(), cx = { scope: sc, deps };
    const items = ev.items.map(it => { const n = this.cExpr(it.expr, cx); return { edge: it.edge, get: n.real ? n.mk() : n.mk(n.w, n.s) }; });
    return { items, deps };
  }
  evStmt(ev, inner) {
    const sim = this;
    return { blk: true, run: function* () { sim.waitEv(ev); yield; if (inner.blk) yield* inner.run(); else inner.run(); } };
  }
  cNetDelay(ast, cx) {                // v => ticks: nets and gates may have separate rise, fall and turn-off delays
    if (ast.k !== 'delays') { const d = this.cDelay(ast, cx); return () => d(); }
    const ds = ast.list.map(e => this.cDelay(e, cx));
    return v => {
      const rise = ds[0](), fall = ds[1](), off = ds[2] ? ds[2]() : Math.min(rise, fall);
      if (v.b) return v.a === 0n && v.b === mask(v.w) ? off : Math.min(rise, fall, off);
      return v.a === 0n ? fall : rise;
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
    const mine = e => e instanceof Disable && e.target === target;
    if (!st.blk) return { blk: false, run() { try { st.run(); } catch (e) { if (!mine(e)) throw e; } } };
    return { blk: true, run: function* () { try { yield* st.run(); } catch (e) { if (!mine(e)) throw e; } } };
  }
  cStmt(ast, cx) {
    const sim = this, line = ast.line;
    switch (ast.k) {
      case 'null': return NOP;
      case 'block': case 'fork': {
        let c = cx, scope = null;
        if (ast.name || ast.decls.length) {
          scope = this.mkScope(cx.scope, ast.name || `$unnamed${++this.anon}`, 'block', line);
          const own = []; this.elabItems(ast.decls, scope, own, 0); for (const f of own) f();
          c = { ...cx, scope };
        }
        const ss = ast.stmts.map(s => this.cStmt(s, c));
        if (ast.k === 'fork') return { blk: true, run: function* () {
          let n = ss.length, waiting = false;
          if (!n) return;
          const p = sim.cur;
          for (const s of ss) {
            const child = sim.spawn(function* () { if (s.blk) yield* s.run(); else s.run(); }, () => { if (--n === 0 && waiting) sim.active.push(() => sim.resume(p)); });
            sim.active.push(() => sim.resume(child));
          }
          waiting = true; yield;
        } };
        let st;
        if (ss.length === 1) st = ss[0];
        else if (!ss.some(s => s.blk)) { const fs = ss.map(s => s.run), n = fs.length; st = { blk: false, run() { for (let i = 0; i < n; i++) fs[i](); } }; }
        else st = { blk: true, run: function* () { for (let i = 0; i < ss.length; i++) { const s = ss[i]; if (s.blk) yield* s.run(); else s.run(); } } };
        return ast.name ? this.catchDisable(st, scope) : st;
      }
      case 'if': {
        const c = this.truthOf(this.cExpr(ast.cond, cx)), a = this.cStmt(ast.then, cx), b = ast.els ? this.cStmt(ast.els, cx) : NOP;
        if (!a.blk && !b.blk) { const ar = a.run, br = b.run; return { blk: false, run() { if (c() === 1) ar(); else br(); } }; }
        return { blk: true, run: function* () { const s = c() === 1 ? a : b; if (s.blk) yield* s.run(); else s.run(); } };
      }
      case 'case': {
        const sel = this.cExpr(ast.expr, cx), all = [sel];
        const items = ast.items.map(it => ({ es: it.exprs && it.exprs.map(e => { const n = this.cExpr(e, cx); all.push(n); return n; }), st: this.cStmt(it.body, cx) }));
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
        if (init.blk || step.blk) throw new VError('delays are not supported in a for-loop header', line);
        const i0 = init.run, st = step.run;
        if (!body.blk) { const b = body.run; return { blk: false, run() { for (i0(); cond() === 1; st()) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } b(); } } }; }
        return { blk: true, run: function* () { for (i0(); cond() === 1; st()) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } yield* body.run(); } } };
      }
      case 'while': {
        const cond = this.truthOf(this.cExpr(ast.cond, cx)), body = this.cStmt(ast.body, cx);
        if (!body.blk) { const b = body.run; return { blk: false, run() { while (cond() === 1) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } b(); } } }; }
        return { blk: true, run: function* () { while (cond() === 1) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } yield* body.run(); } } };
      }
      case 'repeat': {
        const cnt = this.cIntX(ast.cond, cx), body = this.cStmt(ast.body, cx);
        if (!body.blk) { const b = body.run; return { blk: false, run() { for (let n = cnt() || 0; n > 0; n--) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } b(); } } }; }
        return { blk: true, run: function* () { for (let n = cnt() || 0; n > 0; n--) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } yield* body.run(); } } };
      }
      case 'forever': {
        const body = this.cStmt(ast.body, cx);
        if (!body.blk) { const b = body.run; return { blk: false, run() { for (;;) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } b(); } } }; }
        return { blk: true, run: function* () { for (;;) { if (++sim.ops > sim.cap) { sim.line = line; sim.limit(); } yield* body.run(); } } };
      }
      case 'delay': {
        const d = this.cDelay(ast.delay, cx), body = this.cStmt(ast.body, cx);
        return { blk: true, run: function* () { const p = sim.cur; sim.at(sim.time + d(), () => sim.resume(p)); yield; if (body.blk) yield* body.run(); else body.run(); } };
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
            const p = sim.cur, w = { dead: false, fire() { w.dead = true; sim.active.push(() => sim.resume(p)); } };
            for (const s of deps) sim.addOnce(s, w);
            yield;
          }
          if (body.blk) yield* body.run(); else body.run();
        } };
      }
      case 'assign': {
        const lv = this.cLval(ast.lhs, cx), rhs = this.cRhs(this.cExpr(ast.rhs, cx), lv.w, lv.real);
        if (ast.nb) {
          if (ast.ev) throw new VError('an event control inside a nonblocking assignment is not supported', line);
          const d = ast.delay ? this.cDelay(ast.delay, cx) : null;
          return { blk: false, run() {
            sim.line = line;
            const v = rhs(), st = lv.prep(), t = d ? sim.time + d() : sim.time;
            if (t > sim.time) sim.slot(t).n.push(() => st(v)); else sim.nbaq.push(() => st(v));
          } };
        }
        if (ast.delay) { const d = this.cDelay(ast.delay, cx); return { blk: true, run: function* () { sim.line = line; const v = rhs(), p = sim.cur; sim.at(sim.time + d(), () => sim.resume(p)); yield; lv.store(v); } }; }
        if (ast.ev) {
          const ev = this.cEvent(ast.ev, cx.scope, new Set()), rep = ast.rep ? this.cIntX(ast.rep, cx) : null;
          return { blk: true, run: function* () { const v = rhs(); for (let n = rep ? rep() || 0 : 1; n > 0; n--) { sim.waitEv(ev); yield; } lv.store(v); } };
        }
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
        if (ent.kind !== 'scope' && ent.kind !== 'task' && ent.kind !== 'func') throw new VError(`'${ast.target.path[0].n}' is not a named block or task`, line);
        const target = ent.kind === 'scope' ? ent.scope : ent;
        return { blk: false, run() { sim.line = line; throw new Disable(target); } };
      }
      case 'taskcall': return this.cTaskCall(ast, cx);
      case 'syscall': return this.cSysTask(ast, cx);
    }
    throw new VError('invalid statement', line);
  }
  cTaskCall(ast, cx) {
    const sim = this, line = ast.line, ent = this.findKind(ast.target, cx.scope, ['task']), name = ast.target.path[ast.target.path.length - 1].n;
    if (ent.kind !== 'task') throw new VError(`'${name}' is not a task`, line);
    const t = this.ensureTask(ent);
    if (ast.args.length !== t.ports.length) throw new VError(`task '${name}' expects ${t.ports.length} argument(s) but got ${ast.args.length}`, line);
    const ins = [], outs = [];
    t.ports.forEach((p, i) => {
      const a = ast.args[i];
      if (p.dir !== 'output') ins.push({ sig: p.sig, rhs: this.cRhs(this.cExpr(a, cx), p.sig.w, p.sig.real) });
      if (p.dir !== 'input') { const lv = this.cLval(a, cx); outs.push({ lv, get: this.cRhs(this.sigNode(p.sig, [], { scope: cx.scope }, line), lv.w, lv.real) }); }
    });
    const enter = () => { sim.line = line; const vals = ins.map(i => i.rhs()); ins.forEach((i, k) => sim.store(i.sig, vals[k])); };
    const leave = () => { for (const o of outs) o.lv.store(o.get()); };
    // ponytail: task storage is static (shared between concurrent calls), as for non-automatic tasks in the standard
    if (!t.compiling && !t.body.blk) return { blk: false, run() { enter(); try { t.body.run(); } catch (e) { if (!(e instanceof Disable) || e.target !== ent) throw e; } leave(); } };
    return { blk: true, run: function* () {
      enter();
      try { if (t.body.blk) yield* t.body.run(); else t.body.run(); } catch (e) { if (!(e instanceof Disable) || e.target !== ent) throw e; }
      leave();
    } };
  }

  // ── system tasks ──
  cFormat(args, cx, base) {
    const sim = this, sc = cx.scope;
    const items = args.map(a => {
      if (!a) return null;
      const n = this.cExpr(a, cx);
      return { str: a.k === 'str' ? a.v : undefined, get: n.real ? n.mk() : n.mk(n.w, n.s), real: n.real, s: n.s, time: a.k === 'sysfn' && /^\$(time|stime|realtime)$/.test(a.name) };
    });
    const f = () => sim.format(items, base, sc);
    f.key = () => { let k = ''; for (const it of items) if (it && !it.time && it.str === undefined) { const v = it.get(); k += it.real ? v + ';' : v.a.toString(36) + '/' + v.b.toString(36) + ';'; } return k; };
    return f;
  }
  format(items, base, sc) {
    let out = '', i = 0;
    const re = /%(-?)(\d*)(?:\.(\d+))?([a-zA-Z%])/y;
    while (i < items.length) {
      const it = items[i++];
      if (!it) { out += ' '; continue; }
      if (it.str === undefined) { out += it.real ? fmtG(it.get(), 6, true) : fmtVec(base, it.get(), it.s); continue; }
      const s = it.str;
      for (let p = 0; p < s.length; p++) {
        if (s[p] !== '%') { out += s[p]; continue; }
        re.lastIndex = p;
        const m = re.exec(s);
        if (!m) { out += '%'; continue; }
        p += m[0].length - 1;
        const spec = m[4].toLowerCase();
        if (spec === '%') out += '%';
        else if (spec === 'm') out += sc.path;
        else out += this.fmtArg(spec, items[i++], m[1] === '-', m[2], m[3], sc);
      }
    }
    return out;
  }
  fmtArg(spec, a, left, D, P, sc) {
    if (!a) return '';
    const width = D === '' ? undefined : parseInt(D, 10), zero = D.length > 1 && D[0] === '0', prec = P === undefined ? 6 : parseInt(P, 10);
    const pad = s => width === undefined ? s : left ? s.padEnd(width) : s.padStart(width, zero ? '0' : ' ');
    switch (spec) {
      case 'd': case 'b': case 'o': case 'h': case 'x':
        if (a.real) { const r = a.get(); return pad(Number.isFinite(r) ? roundR(r).toString() : nonFinite(r)); }
        return fmtVec(spec === 'x' ? 'h' : spec, a.get(), a.s, width, zero, left);
      case 'c': return a.real ? '' : String.fromCharCode(Number(a.get().a & 255n));
      case 's': {
        if (a.str !== undefined) return pad(a.str);
        if (a.real) return pad(fmtG(a.get(), 6, true));
        const v = a.get(), n = Math.ceil(v.w / 8);
        let s = '';
        for (let i = n - 1; i >= 0; i--) { const c = Number((v.a >> BigInt(8 * i)) & 255n); if (c || s) s += String.fromCharCode(c); }
        return width === undefined ? s.padStart(n) : pad(s);
      }
      case 't': {
        const tf = this.tf || { unit: this.prec, digits: 0, suffix: '', minw: 20 };
        let ticks;
        if (a.real) ticks = a.get() * sc.tu; else { const v = a.get(); if (v.b) return 'x'.padStart(width === undefined ? tf.minw : width); ticks = Number(v.a) * sc.tu; }
        const sh = tf.unit - this.prec, val = sh >= 0 ? ticks / 10 ** sh : ticks * 10 ** -sh;
        return (val.toFixed(tf.digits) + tf.suffix).padStart(width === undefined ? tf.minw : width);
      }
      case 'e': case 'f': case 'g': {
        const r = a.real ? a.get() : v2r(a.get(), a.s);
        return pad(spec === 'f' ? fmtF(r, prec) : spec === 'e' ? fmtE(r, prec) : fmtG(r, prec, false));
      }
    }
    return a.real ? fmtG(a.get(), 6, true) : fmtVec('b', a.get(), a.s);
  }
  cSysTask(ast, cx) {
    const sim = this, name = ast.name, line = ast.line, sc = cx.scope, args = ast.args;
    const m = /^\$(display|write|strobe|monitor)([bho]?)$/.exec(name);
    if (m) {
      const fmt = this.cFormat(args, cx, m[2] || 'd'), nl = m[1] === 'write' ? '' : '\n';
      if (m[1] === 'display' || m[1] === 'write') return { blk: false, run() { sim.line = line; sim.emit(fmt() + nl); } };
      if (m[1] === 'strobe') return { blk: false, run() { sim.postponed.push(() => sim.emit(fmt() + nl)); } };
      return { blk: false, run() { let last = null; sim.monitor = () => { const k = fmt.key(); if (k !== last) { last = k; sim.emit(fmt() + '\n'); } }; } };
    }
    switch (name) {
      case '$finish': case '$stop': return { blk: false, run() { sim.finished = true; throw FINISH; } };
      case '$monitoron': return { blk: false, run() { sim.monOn = true; } };
      case '$monitoroff': return { blk: false, run() { sim.monOn = false; } };
      case '$dumpfile': case '$dumpvars': case '$dumpon': case '$dumpoff': case '$dumpall': case '$dumplimit': case '$dumpflush': case '$fflush':
        return NOP;                    // waveforms are always recorded
      case '$timeformat': {
        const tf = { unit: args[0] ? this.cint(args[0], sc) : this.prec, digits: args[1] ? this.cint(args[1], sc) : 0, suffix: args[2] && args[2].k === 'str' ? args[2].v : '', minw: args[3] ? this.cint(args[3], sc) : 20 };
        return { blk: false, run() { sim.tf = tf; } };
      }
      case '$sformat': case '$swrite': {
        if (!args[0]) throw new VError(`${name} needs a target variable`, line);
        const lv = this.cLval(args[0], cx), fmt = this.cFormat(args.slice(1), cx, 'd');
        if (lv.real) throw new VError(`${name} cannot write to a real`, line);
        return { blk: false, run() { lv.store(strToV(fmt(), lv.w)); } };
      }
      case '$random': case '$urandom': { const t = this.cExpr({ k: 'sysfn', line, name, args }, cx).mk(32, false); return { blk: false, run() { t(); } }; }
      case '$readmemh': case '$readmemb': throw new VError(`${name} is not supported (there is no file system here); initialise the memory in an initial block`, line);
    }
    throw new VError(`unsupported system task ${name}`, line);
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
    if (e instanceof RangeError) e = new VError('internal limit exceeded (' + e.message + ') — recursion too deep or a vector too wide', sim ? sim.line : 0);
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
