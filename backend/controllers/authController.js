const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

// Public self-registration is intentionally residents-only. Admin accounts
// are provisioned out-of-band (seed.js) so nobody can curl their way into
// an admin role via this endpoint.
async function register(req, res) {
  const { name, email, password, apartment_no } = req.body;

  if (!name || !email || !password || !apartment_no) {
    throw new ApiError(400, 'name, email, password and apartment_no are all required.');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, apartment_no)
       VALUES (?, ?, ?, 'resident', ?)`
    )
    .run(name, email.toLowerCase(), password_hash, apartment_no);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token, user: sanitizeUser(user) });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required.');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  // Deliberately generic message: don't reveal whether the email exists.
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
}

function me(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) throw new ApiError(404, 'User no longer exists.');
  res.json({ user: sanitizeUser(user) });
}

module.exports = { register, login, me };
