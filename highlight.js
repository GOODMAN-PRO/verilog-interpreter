// Syntax colouring and word lists for the page's editor. Text in, HTML out: no DOM, so `node highlight.js` can check it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Highlight = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const words = s => s.split(' ');
const KEYWORDS = words('always assign automatic begin case casex casez default disable else end endcase endfunction endgenerate endmodule endtask for forever fork function generate if initial join module negedge posedge repeat task wait while');
const TYPES = words('event genvar inout input integer localparam output parameter real realtime reg signed supply0 supply1 time tri tri0 tri1 triand trior wand wire wor');
const GATES = words('and buf bufif0 bufif1 nand nor not notif0 notif1 or pulldown pullup xnor xor');
const SWITCHES = words('cmos nmos pmos rcmos rnmos rpmos rtran rtranif0 rtranif1 tran tranif0 tranif1');
// coloured but never suggested: the interpreter rejects most of these
const RARE = words('deassign defparam endprimitive endspecify endtable force macromodule primitive release specify table trireg');
const SYSTEM = words('$display $write $monitor $strobe $finish $stop $time $realtime $stime $random $urandom $urandom_range $signed $unsigned $clog2 $bits ' +      // the common ones first
  '$timeformat $printtimescale $monitoron $monitoroff $sformat $swrite $dumpfile $dumpvars $rtoi $itor $realtobits $bitstoreal $dist_uniform $test$plusargs $value$plusargs ' +
  '$displayb $displayh $displayo $writeb $writeh $writeo $monitorb $monitorh $monitoro $strobeb $strobeh $strobeo ' +
  '$sqrt $pow $ln $log10 $exp $floor $ceil $sin $cos $tan $asin $acos $atan $atan2 $hypot $sinh $cosh $tanh $asinh $acosh $atanh');
const DIRECTIVES = words('`define `undef `ifdef `ifndef `elsif `else `endif `timescale `default_nettype `resetall');

// what the editor offers while typing: [word, kind]
const WORDS = [].concat(KEYWORDS.map(w => [w, 'keyword']), TYPES.map(w => [w, 'type']), GATES.map(w => [w, 'gate']),
  SYSTEM.map(w => [w, 'system']), DIRECTIVES.map(w => [w, 'directive']));

const CLASS = new Map();            // reserved word -> colour class
for (const w of KEYWORDS.concat(GATES, SWITCHES, RARE)) CLASS.set(w, 'k');
for (const w of TYPES) CLASS.set(w, 't');
const GATE = new Set(GATES.concat(SWITCHES));
const NO_NAME = new Set(words('`ifdef `ifndef `elsif `undef `default_nettype'));      // the word after these is not a name of the design

// 1 comment, 2 string (3 its closing quote), 4 directive or macro, 5 system task, 6 number, 7 word, 8 white space, 9 anything else
const TOKEN = /(\/\/.*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*("?))|(`\w+)|(\$[\w$]+)|((?:\d[\d_]*[ \t]*)?'[sS]?[bBoOdDhH][ \t]*[0-9a-fA-FxXzZ?][0-9a-fA-FxXzZ?_]*|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d[\d_]*)?)|([A-Za-z_][\w$]*)|(\s+)|([\s\S])/g;
const PAREN_NEXT = /\s*\(/y;
const esc = s => s.replace(/[&<]/g, c => c === '&' ? '&amp;' : '&lt;');

// Colour classes: c comment, q string, d directive, s system task, n number, k keyword, t type, f function or task, m module.
// Returns { html, toks, names }: toks lists comments and strings as [start, end, open] (open: more typing at `end` is still
// inside it); names holds the identifiers of the text (macros with their backtick).
// ponytail: names are classified from the two tokens before them and the one after, not by parsing. "a b (" is read as
// module + instance, "x (" as a call. Wrong guesses only mis-colour a word; use the real parser if that ever matters.
function highlight(text) {
  const out = [], toks = [], names = new Set(), parens = [];
  let m, p1 = '', p2 = '', lastId = null, lastEnd = -1, lastDir = '', lastDirAt = 0, def = '', macro = false, sq = 0, hashed = false, closed = false, inst = false;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    const t = m[0], at = m.index;
    if (m[8] !== undefined) { out.push([t, '']); continue; }
    if (m[1] !== undefined) { out.push([t, 'c']); toks.push([at, at + t.length, t[1] === '/' || t.length < 4 || !t.endsWith('*/')]); continue; }
    const wasClosed = closed, wasMacro = macro;
    closed = macro = false;
    let c = '', kind = t;
    if (m[2] !== undefined) { c = 'q'; kind = 'str'; toks.push([at, at + t.length, !m[3]]); }
    else if (m[4] !== undefined) { c = 'd'; kind = 'dir'; macro = t === '`define'; lastDir = t; lastDirAt = at; }
    else if (m[5] !== undefined) { c = 's'; kind = 'sys'; }
    else if (m[6] !== undefined) { c = 'n'; kind = 'num'; }
    else if (m[7] !== undefined) {
      const reserved = CLASS.get(t);
      if (wasMacro) { c = 'd'; kind = 'dir'; names.add('`' + t); }                    // `define NAME
      else if (reserved) {
        c = reserved;
        if (t === 'function' || t === 'task') def = 'f'; else if (t === 'module' || t === 'macromodule' || t === 'primitive') def = 'm';
      } else if (p1 === 'dir' && NO_NAME.has(lastDir)) { kind = 'dir'; lastDir = ''; }  // `ifdef SIM: SIM is not a name of the design
      else {
        kind = 'id';
        // not a time unit: the ns of 1ns anywhere, or of "1 ns" on a `timescale line
        if (!(p1 === 'num' && (at === lastEnd || (lastDir === '`timescale' && !text.slice(lastDirAt, at).includes('\n'))))) names.add(t);
        PAREN_NEXT.lastIndex = TOKEN.lastIndex;
        if (def && !sq) { c = def; def = ''; }                                         // the name being defined
        else if (p1 === ':' && (p2 === 'begin' || p2 === 'fork')) kind = 'label';      // begin : name
        else if (p1 !== '.' && PAREN_NEXT.test(text)) {
          if (wasClosed || GATE.has(p1) || (hashed && p2 === '#') || (inst && p1 === ',' && !parens.length)) inst = true;     // counter #(8) u1 (…)   and g1 (…)   and #1 g1 (…)   …, u2 (…)
          else if (p1 === 'id' && p2 !== '#' && p2 !== '@') { lastId[1] = 'm'; inst = true; }                                // counter u1 (…): the word before is the module
          else c = 'f';                                                                // a call
        }
      }
    } else if (t === '[') sq++;
    else if (t === ']') sq = Math.max(0, sq - 1);
    else if (t === '#') { hashed = p1 === 'id' || GATE.has(p1); if (p1 === 'id') lastId[1] = 'm'; }   // counter #(…) u1 (…)
    else if (t === '(') parens.push(p1 === '#' && hashed);
    else if (t === ')') closed = !!parens.pop();
    else if (t === ';') { def = ''; sq = 0; inst = false; }
    const piece = [t, c];
    out.push(piece);
    if (kind === 'id') lastId = piece;
    p2 = p1; p1 = kind; lastEnd = at + t.length;
  }
  let html = '';
  for (const [t, c] of out) html += c ? '<span class="' + c + '">' + esc(t) + '</span>' : esc(t);
  return { html: guides(html), toks, names };
}

// Indent guides. Every line that is indented gets an empty <i> in front, as wide as its indentation rounded up to a whole
// level (two columns); the page draws a vertical line in it at every level. A blank line has no indentation of its own,
// so it takes the deeper of the lines around it and the guides run on through it. The <i> holds no text, so the text of
// the result is still exactly the text that came in.
function guides(html) {
  const lines = html.split('\n'), own = [], blank = [], above = [];
  let last = 0;
  lines.forEach((l, i) => {
    const ws = /^[ \t]*/.exec(l)[0];
    let w = 0;
    for (const ch of ws) w += ch === '\t' ? 2 - w % 2 : 1;       // a tab runs to the next even column
    own[i] = w; blank[i] = ws.length === l.length; above[i] = last;
    if (!blank[i]) last = w;
  });
  last = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const n = Math.ceil((blank[i] ? Math.max(own[i], above[i], last) : own[i]) / 2);
    if (!blank[i]) last = own[i];
    if (n) lines[i] = '<i style="width:' + 2 * n + 'ch"></i>' + lines[i];
  }
  return lines.join('\n');
}

if (typeof module === 'object' && typeof require === 'function' && require.main === module) {       // node highlight.js
  const assert = require('assert'), fs = require('fs'), path = require('path');
  const cls = (src, word) => { const m = new RegExp('<span class="(\\w)">' + word.replace(/[$`]/g, '\\$&') + '</span>').exec(highlight(src).html); return m ? m[1] : ''; };
  const plain = html => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const inst = 'module top; counter #(.W(8)) u1 (.clk(clk)); adder u2 (a, b), u3 (c, d); and g1 (y, a, b); and #(2, 3) g2 (y, a, b); and #1 g3 (y, a, b), g4 (y, a, b); endmodule';
  assert.deepStrictEqual(['module', 'top', 'counter', 'u1', 'clk', 'adder', 'u2', 'u3', 'and', 'g1', 'g2', 'g3', 'g4'].map(w => cls(inst, w)), ['k', 'm', 'm', '', '', 'm', '', '', 'k', '', '', '', '']);
  const fn = 'function automatic [W-1:0] add(input [7:0] a); add = a; endfunction task show; endtask initial begin : blk show(1); x = add(2) + $clog2(8); #D show(3); @ev show(4); if (x) #(D) show(5); end';
  assert.deepStrictEqual(['function', 'W', 'add', 'input', 'show', 'blk', '$clog2', 'D', 'ev'].map(w => cls(fn, w)), ['k', '', 'f', 't', 'f', '', 's', '', '']);
  assert.strictEqual((highlight(fn).html.match(/<span class="f">show<\/span>/g) || []).length, 5);
  assert.deepStrictEqual(["8'hFF", "'b1", "4 'sd3", '1.5e-3', '1_000'].map(n => cls('x = ' + n + ';', n)), ['n', 'n', 'n', 'n', 'n']);
  assert.strictEqual(highlight('// if (a) "b"\nx').html, '<span class="c">// if (a) "b"</span>\nx');
  assert.strictEqual(highlight('$display("a // b < c");').html, '<span class="s">$display</span>(<span class="q">"a // b &lt; c"</span>);');
  assert.deepStrictEqual(highlight('"ab" "cd\n/* x */ /* y').toks, [[0, 4, false], [5, 8, true], [9, 16, false], [17, 21, true]]);
  const mac = highlight('`define WIDTH 8\nwire [`WIDTH-1:0] bus;');
  assert.ok(mac.names.has('`WIDTH') && mac.names.has('bus') && !mac.names.has('wire'));
  assert.deepStrictEqual([...highlight('`timescale 1ns/1ps\n`default_nettype none\n`ifdef SIM\nmodule t; endmodule').names], ['t']);
  assert.deepStrictEqual([...highlight('`timescale 1 ns / 1 ps\nmodule t; initial #10 ns = 1; endmodule').names], ['t', 'ns']);
  assert.deepStrictEqual(['DEBUG', 'check'].map(w => cls('`ifdef DEBUG\n  check(x);\n`endif', w)), ['', 'f']);
  // indent guides: one level per two columns, carried through the blank line inside the block, none at the left margin
  assert.deepStrictEqual(highlight('a\n  b\n\n    c\n\t\td\ne\n\n').html.split('\n').map(l => (/^<i style="width:(\d+)ch">/.exec(l) || [0, 0])[1] / 2), [0, 1, 2, 2, 2, 0, 0, 0]);
  // the coloured text must be exactly the typed text: it is drawn underneath the transparent <textarea>
  const dir = path.join(__dirname, 'tests', 'cases');
  const sources = fs.readdirSync(dir).filter(f => f.endsWith('.v')).map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
  sources.push(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), 'a && b <= c; /* open', '"\\', "'", '`', '$', '');
  for (const s of sources) assert.strictEqual(plain(highlight(s).html), s);
  console.log('highlight.js: ok (' + sources.length + ' texts round-trip)');
}

return { highlight, WORDS };
});
