const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of ['package.json', 'README.md', '.env.example']) {
  fs.copyFileSync(path.join(__dirname, '..', file), path.join(out, file));
}
for (const dir of ['src']) {
  fs.cpSync(path.join(__dirname, '..', dir), path.join(out, dir), { recursive: true });
}
console.log('Build artifact prepared in dist/');
