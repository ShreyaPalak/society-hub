const db = require('../config/db');
const ApiError = require('../utils/ApiError');

function serializeUser(user) {
  const { password_hash, ...safe } = user;
  return { ...safe, flat_number: safe.apartment_no };
}

function list(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.page_size, 10) || 20));
  const search = String(req.query.search || '').trim();
  const where = search ? 'WHERE name LIKE ? OR email LIKE ? OR apartment_no LIKE ?' : '';
  const searchTerm = `%${search.replace(/[%_]/g, '')}%`;
  const params = search ? [searchTerm, searchTerm, searchTerm] : [];
  const total = db.prepare(`SELECT COUNT(*) AS count FROM users ${where}`).get(...params).count;
  const users = db.prepare(
    `SELECT id, name, email, role, apartment_no, created_at
     FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize);

  res.json({ users: users.map(serializeUser), pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
}

const changeRole = db.transaction((targetId, actorId, role) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) throw new ApiError(404, 'User not found.');
  if (targetId === actorId && role !== 'admin') {
    throw new ApiError(400, 'Admins cannot revoke their own admin status.');
  }
  if (target.role === 'admin' && role !== 'admin') {
    const count = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;
    if (count === 1) throw new ApiError(400, 'Cannot demote the last remaining system administrator.');
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
  return db.prepare('SELECT id, name, email, role, apartment_no, created_at FROM users WHERE id = ?').get(targetId);
});

function updateRole(req, res) {
  const role = String(req.body.role || '').toLowerCase();
  if (!['resident', 'admin'].includes(role)) {
    throw new ApiError(400, 'role must be RESIDENT or ADMIN.');
  }
  const user = changeRole(Number(req.params.id), req.user.id, role);
  res.json({ user: serializeUser(user) });
}

module.exports = { list, updateRole };
