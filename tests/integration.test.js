const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createDatabase } = require('../src/db');
const { createApp } = require('../src/app');

const SECRET = 'integration-test-secret-do-not-use-in-production';
let db, app;

test.beforeEach(() => {
  db = createDatabase(':memory:');
  app = createApp({ db, jwtSecret: SECRET });
});
test.afterEach(() => db.close());

async function registerAndLogin(email = 'sam@example.com') {
  const registration = await request(app).post('/api/auth/register')
    .send({ email, password: 'StrongPass123' });
  assert.equal(registration.status, 201);
  const login = await request(app).post('/api/auth/login')
    .send({ email, password: 'StrongPass123' });
  assert.equal(login.status, 200);
  return login.body.token;
}

test('health endpoint responds successfully', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('registration validates input and stores a password hash', async () => {
  const bad = await request(app).post('/api/auth/register').send({ email: 'bad', password: '123' });
  assert.equal(bad.status, 400);
  const good = await request(app).post('/api/auth/register')
    .send({ email: 'SAM@example.com', password: 'StrongPass123' });
  assert.equal(good.status, 201);
  const user = db.prepare('SELECT email, password_hash FROM users WHERE id = ?').get(good.body.id);
  assert.equal(user.email, 'sam@example.com');
  assert.notEqual(user.password_hash, 'StrongPass123');
  assert.equal(await bcrypt.compare('StrongPass123', user.password_hash), true);
});

test('duplicate registration returns conflict', async () => {
  await registerAndLogin();
  const res = await request(app).post('/api/auth/register')
    .send({ email: 'sam@example.com', password: 'StrongPass123' });
  assert.equal(res.status, 409);
});

test('login rejects an incorrect password', async () => {
  await request(app).post('/api/auth/register').send({ email: 'sam@example.com', password: 'StrongPass123' });
  const res = await request(app).post('/api/auth/login')
    .send({ email: 'sam@example.com', password: 'WrongPass123' });
  assert.equal(res.status, 401);
});

test('protected route rejects missing and malformed bearer tokens', async () => {
  assert.equal((await request(app).get('/api/posts')).status, 401);
  assert.equal((await request(app).get('/api/posts').set('Authorization', 'Bearer not-a-token')).status, 401);
});

test('authenticated user can create, list, update and delete own post', async () => {
  const token = await registerAndLogin();
  const created = await request(app).post('/api/posts').set('Authorization', `Bearer ${token}`)
    .send({ title: 'Integration testing', body: 'Test all modules together.' });
  assert.equal(created.status, 201);
  const id = created.body.id;

  const listed = await request(app).get('/api/posts').set('Authorization', `Bearer ${token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.total, 1);
  assert.equal(listed.body.data[0].id, id);

  const updated = await request(app).patch(`/api/posts/${id}`).set('Authorization', `Bearer ${token}`)
    .send({ title: 'Updated title' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'Updated title');

  const deleted = await request(app).delete(`/api/posts/${id}`).set('Authorization', `Bearer ${token}`);
  assert.equal(deleted.status, 204);
  const afterDelete = await request(app).get('/api/posts').set('Authorization', `Bearer ${token}`);
  assert.equal(afterDelete.body.total, 0);
});

test('one user cannot read or modify another user posts through their collection', async () => {
  const tokenA = await registerAndLogin('a@example.com');
  const created = await request(app).post('/api/posts').set('Authorization', `Bearer ${tokenA}`)
    .send({ title: 'Private post', body: 'Owned by A.' });
  const tokenB = await registerAndLogin('b@example.com');

  const listB = await request(app).get('/api/posts').set('Authorization', `Bearer ${tokenB}`);
  assert.equal(listB.body.total, 0);

  const updateB = await request(app).patch(`/api/posts/${created.body.id}`)
    .set('Authorization', `Bearer ${tokenB}`).send({ title: 'Attempted change' });
  assert.equal(updateB.status, 403);

  const deleteB = await request(app).delete(`/api/posts/${created.body.id}`)
    .set('Authorization', `Bearer ${tokenB}`);
  assert.equal(deleteB.status, 403);
});

test('post validation and missing-resource errors are handled', async () => {
  const token = await registerAndLogin();
  const invalid = await request(app).post('/api/posts').set('Authorization', `Bearer ${token}`)
    .send({ title: '', body: '' });
  assert.equal(invalid.status, 400);
  const missing = await request(app).patch('/api/posts/99999')
    .set('Authorization', `Bearer ${token}`).send({ title: 'No post' });
  assert.equal(missing.status, 404);
});

test('pagination is bounded and returns requested page metadata', async () => {
  const token = await registerAndLogin();
  for (let i = 1; i <= 3; i++) {
    await request(app).post('/api/posts').set('Authorization', `Bearer ${token}`)
      .send({ title: `Post ${i}`, body: 'Body' });
  }
  const res = await request(app).get('/api/posts?page=2&limit=1')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.limit, 1);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.data.length, 1);
});

test('SQL-like input is treated as data and does not expose other users', async () => {
  const token = await registerAndLogin();
  const res = await request(app).get('/api/posts?page=1%20OR%201=1&limit=10')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
});
