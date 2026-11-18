// Runs the simulation off the main thread so the page stays responsive and Stop can terminate it.
importScripts('verilog.js');

onmessage = e => {
  const { source, opts } = e.data, t0 = performance.now();
  let buf = '', last = 0;
  const flush = () => { if (buf) { postMessage({ type: 'out', text: buf }); buf = ''; } last = Date.now(); };
  let res;
  try {
    res = Verilog.run(source, { ...opts, onOutput: s => { buf += s; if (buf.length > 8192 || Date.now() - last > 80) flush(); } });
  } catch (err) {
    flush();
    postMessage({ type: 'done', error: 'internal error: ' + (err && err.message ? err.message : err), errorLine: 0, ms: performance.now() - t0 });
    return;
  }
  flush();
  postMessage({ type: 'done', error: res.error, errorLine: res.errorLine, time: res.time, finished: res.finished, stopped: res.stopped, waves: res.waves, ms: performance.now() - t0 });
};
