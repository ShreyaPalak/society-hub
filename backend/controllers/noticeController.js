const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { notifyImportantNotice } = require('../services/emailService');

async function create(req, res) {
  const { title, content, is_important } = req.body;
  if (!title || !title.trim()) throw new ApiError(400, 'title is required.');
  if (!content || !content.trim()) throw new ApiError(400, 'content is required.');

  const important = is_important === true || is_important === 'true' || is_important === 1 ? 1 : 0;

  const info = db
    .prepare(
      `INSERT INTO notices (title, content, is_important, created_by) VALUES (?, ?, ?, ?)`
    )
    .run(title.trim(), content.trim(), important, req.user.id);

  const notice = db.prepare('SELECT * FROM notices WHERE id = ?').get(info.lastInsertRowid);

  // Respond to the admin immediately; email fanout happens in the
  // background and never delays this HTTP response.
  res.status(201).json({ notice });

  if (important) {
    const residents = db.prepare(`SELECT email FROM users WHERE role = 'resident'`).all();
    notifyImportantNotice(notice, residents); // not awaited
  }
}

function list(req, res) {
  const notices = db
    .prepare(
      `SELECT n.*, u.name AS author_name
       FROM notices n JOIN users u ON u.id = n.created_by
       ORDER BY n.is_important DESC, n.created_at DESC`
    )
    .all();
  res.json({ notices: notices.map((n) => ({ ...n, is_important: !!n.is_important })) });
}

module.exports = { create, list };
