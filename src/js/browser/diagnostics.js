// Local-only diagnostics: a speed report and an error log. Nothing is sent anywhere.
const MAX_SAMPLES = 400, MAX_ERRORS = 200;

export function createDiagnostics(clock = () => performance.now()) {
  const samples = new Map(), errors = [], longTasks = [];
  const started = clock();
  let firstDraw = null;
  function time(name, fn) {
    const t = clock(); const result = fn(); record(name, clock() - t); return result;
  }
  function record(name, ms) {
    let list = samples.get(name); if (!list) samples.set(name, list = []);
    if (list.length >= MAX_SAMPLES) list.shift(); list.push(ms);
  }
  function logError(kind, message, detail = '') {
    if (errors.length >= MAX_ERRORS) errors.shift();
    errors.push({ at: new Date().toISOString(), kind, message: String(message).slice(0, 500), detail: String(detail).slice(0, 1500) });
  }
  function summarize(list) {
    const sorted = [...list].sort((a, b) => a - b), n = sorted.length;
    const at = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
    return { count: n, median: at(.5), p95: at(.95), max: sorted[n - 1] };
  }
  return {
    time, record, logError,
    markFirstDraw() { if (firstDraw === null) firstDraw = clock() - started; },
    addLongTask(ms) { if (longTasks.length < MAX_SAMPLES) longTasks.push(ms); },
    get errorCount() { return errors.length; },
    speedReport(context) {
      const lines = ['Mind Mapper speed report (local file, nothing was sent anywhere)', `Created: ${new Date().toISOString()}`];
      for (const [k, v] of Object.entries(context)) lines.push(`${k}: ${v}`);
      lines.push(`First draw after start: ${firstDraw === null ? 'not yet' : firstDraw.toFixed(1) + ' ms'}`);
      const fmt = (x) => x.toFixed(2);
      for (const [name, list] of samples) { const s = summarize(list); lines.push(`${name}: n=${s.count} median ${fmt(s.median)} ms, p95 ${fmt(s.p95)} ms, max ${fmt(s.max)} ms`); }
      if (longTasks.length) { const s = summarize(longTasks); lines.push(`Main-thread tasks over 50 ms (browser report): n=${s.count}, max ${fmt(s.max)} ms`); }
      else lines.push('Main-thread tasks over 50 ms: none seen (or not reported by this browser)');
      return lines.join('\n') + '\n';
    },
    errorLog(context) {
      const lines = ['Mind Mapper error log (local file, nothing was sent anywhere)', `Created: ${new Date().toISOString()}`];
      for (const [k, v] of Object.entries(context)) lines.push(`${k}: ${v}`);
      lines.push(errors.length ? `${errors.length} error(s):` : 'No errors recorded.');
      for (const e of errors) lines.push(`[${e.at}] ${e.kind}: ${e.message}${e.detail ? '\n' + e.detail : ''}`);
      return lines.join('\n') + '\n';
    },
  };
}
