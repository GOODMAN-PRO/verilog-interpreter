// node test.js            run every tests/cases/*.v and compare with its Icarus-generated .expected
// node test.js file.v     run one file and print its output
const fs = require('fs'), path = require('path'), Verilog = require('./verilog.js');

const one = process.argv[2];
if (one) {
  const r = Verilog.run(fs.readFileSync(one, 'utf8'), { waves: false });
  process.stdout.write(r.output);
  if (r.error) { console.error('ERROR: ' + r.error); process.exit(1); }
  process.exit(0);
}

const dir = path.join(__dirname, 'tests', 'cases');
let failed = 0, total = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.v')).sort()) {
  total++;
  const want = fs.readFileSync(path.join(dir, f.replace(/\.v$/, '.expected')), 'utf8').replace(/\r/g, '');
  let got;
  try {
    const r = Verilog.run(fs.readFileSync(path.join(dir, f), 'utf8'), { waves: false });
    got = r.output + (r.error ? `ERROR: ${r.error}\n` : '');
  } catch (e) { got = 'CRASH: ' + e.stack + '\n'; }
  if (got === want) continue;
  failed++;
  const g = got.split('\n'), w = want.split('\n'), i = g.findIndex((l, k) => l !== w[k]);
  console.log(`FAIL ${f}  (first difference at output line ${i + 1})\n  want: ${JSON.stringify(w[i])}\n  got:  ${JSON.stringify(g[i])}`);
}
console.log(`${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
