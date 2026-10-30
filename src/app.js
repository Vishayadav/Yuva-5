const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function createApp({ db, jwtSecret }) {
  if (!db) throw new Error('A database instance is required');
  if (!jwtSecret) throw new Error('JWT_SECRET is required');

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  function authenticate(req, res, next) {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      req.user = jwt.verify(token, jwtSecret);
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = req.body.password;
      if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'A valid email and password of at least 8 characters are required' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      try {
        const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, passwordHash);
        return res.status(201).json({ id: Number(result.lastInsertRowid), email });
      } catch (err) {
        if (String(err.code).includes('CONSTRAINT')) return res.status(409).json({ error: 'Email already registered' });
        throw err;
      }
    } catch (err) { next(err); }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = req.body.password;
      const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email);
      if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '1h' });
      return res.json({ token, token_type: 'Bearer' });
    } catch (err) { next(err); }
  });

  app.get('/api/posts', authenticate, (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || '10', 10) || 10));
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) AS count FROM posts WHERE user_id = ?').get(req.user.id).count;
    const posts = db.prepare(
      'SELECT id, user_id, title, body, created_at FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(req.user.id, limit, offset);
    res.json({ page, limit, total, data: posts });
  });

  app.post('/api/posts', authenticate, (req, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!title || !body || title.length > 120) {
      return res.status(400).json({ error: 'Title (max 120 characters) and body are required' });
    }
    const result = db.prepare('INSERT INTO posts (user_id, title, body) VALUES (?, ?, ?)')
      .run(req.user.id, title, body);
    const post = db.prepare('SELECT id, user_id, title, body, created_at FROM posts WHERE id = ?')
      .get(Number(result.lastInsertRowid));
    res.status(201).json(post);
  });

  app.patch('/api/posts/:id', authenticate, (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid post id' });
    const post = db.prepare('SELECT id, user_id, title, body FROM posts WHERE id = ?').get(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You do not own this post' });
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : post.title;
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : post.body;
    if (!title || !body || title.length > 120) return res.status(400).json({ error: 'Invalid post content' });
    db.prepare('UPDATE posts SET title = ?, body = ? WHERE id = ? AND user_id = ?')
      .run(title, body, id, req.user.id);
    res.json(db.prepare('SELECT id, user_id, title, body, created_at FROM posts WHERE id = ?').get(id));
  });

  app.delete('/api/posts/:id', authenticate, (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid post id' });
    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You do not own this post' });
    db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.status(204).end();
  });

  app.use((err, _req, res, _next) => {
    // Keep internal exception details in server logs, not API responses.
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
module.exports = { createApp };
