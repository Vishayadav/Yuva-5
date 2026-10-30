const path = require('path');
const { createDatabase } = require('./db');
const { createApp } = require('./app');

const db = createDatabase(path.join(__dirname, '..', 'data', 'app.db'));
const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('Set JWT_SECRET before starting the server. See .env.example.');
  process.exit(1);
}
const app = createApp({ db, jwtSecret: secret });
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API listening on port ${port}`));
