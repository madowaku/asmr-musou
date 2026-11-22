import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
for (const file of ['tools/lab-audio/render.cjs', 'tests/lab-audio/node.mjs', 'tests/lab-audio/browser.mjs']) {
  const result = spawnSync(process.execPath, [file], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('PASS: R2 audio render + Node + Chrome suite.');
