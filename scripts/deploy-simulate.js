const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(path.join(dist, 'src', 'server.js'))) {
  console.error('Build artifact not found. Run npm run build first.');
  process.exit(1);
}
const marker = {
  status: 'SIMULATED_DEPLOYMENT_READY',
  createdAt: new Date().toISOString(),
  artifact: 'dist/',
  note: 'No remote server or production credentials are used.'
};
fs.writeFileSync(path.join(dist, 'deployment-manifest.json'), JSON.stringify(marker, null, 2));
console.log(JSON.stringify(marker, null, 2));
