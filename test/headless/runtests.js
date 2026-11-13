import System from './node-gi.js';
const { run } = await import(`file://${System.programArgs[0]}/test/all.js`);
const res = run();
for (const r of res) print((r.error ? 'FAIL ' : 'ok   ') + r.name + (r.error ? '\n     ' + r.error : ''));
print(`${res.filter(r => !r.error).length}/${res.length} passed`);
