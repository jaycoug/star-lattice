// Minimal test runner: test files register tests with test(); run() runs them all and reports
// { name, error } per test. No browser APIs, so the same files run anywhere ES modules do.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function run() {
  return tests.map(({ name, fn }) => {
    try {
      fn();
      return { name, error: null };
    } catch (e) {
      return { name, error: e.message };
    }
  });
}

export function assertEqual(actual, expected, msg = '') {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}expected ${e}, got ${a}`);
}

export function assertClose(actual, expected, msg = '', eps = 1e-9) {
  if (!(Math.abs(actual - expected) <= eps)) throw new Error(`${msg ? msg + ': ' : ''}expected ${expected} ± ${eps}, got ${actual}`);
}

/** Both coordinates of two [x, y] points within eps. */
export function assertSamePoint(actual, expected, msg = '') {
  assertClose(actual[0], expected[0], msg + ' (x)');
  assertClose(actual[1], expected[1], msg + ' (y)');
}

export const dist = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
