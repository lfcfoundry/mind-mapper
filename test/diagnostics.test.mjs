import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiagnostics } from '../src/js/browser/diagnostics.js';

test('speed report summarizes timings and lists context', () => {
  let t = 0; const d = createDiagnostics(() => t);
  for (let i = 1; i <= 10; i++) d.record('draw', i);
  t = 5; d.markFirstDraw(); d.addLongTask(80);
  const text = d.speedReport({ Browser: 'X' });
  assert.match(text, /Browser: X/); assert.match(text, /draw: n=10 median 6\.00 ms, p95 10\.00 ms, max 10\.00 ms/);
  assert.match(text, /First draw after start: 5\.0 ms/); assert.match(text, /over 50 ms \(browser report\): n=1/);
});
test('time() records and returns the result', () => {
  let t = 0; const d = createDiagnostics(() => t);
  assert.equal(d.time('x', () => { t += 3; return 42; }), 42);
  assert.match(d.speedReport({}), /x: n=1 median 3\.00/);
});
test('error log keeps the newest 200 and trims long text', () => {
  const d = createDiagnostics();
  for (let i = 0; i < 250; i++) d.logError('error', 'm' + i, 'x'.repeat(5000));
  assert.equal(d.errorCount, 200); const text = d.errorLog({});
  assert.match(text, /200 error\(s\)/); assert.ok(!text.includes('m49:')); assert.ok(text.includes('m249'));
  assert.equal(createDiagnostics().errorLog({}).includes('No errors recorded.'), true);
});
