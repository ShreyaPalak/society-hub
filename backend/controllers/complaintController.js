const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { getOverdueThresholdDays, overdueSqlFragment } = require('../services/overdueService');
const { notifyComplaintStatusChange } = require('../services/emailService');

const CATEGORIES = ['Plumbing', 'Electrical', 'Elevator', 'Common Area', 'Security', 'Housekeeping', 'Other'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

// ---------------------------------------------------------------------
// Create - resident raises a new complaint. Wrapped in a transaction so
// the complaint row and its first history row ('CREATED') either both
// commit or neither does.
// ---------------------------------------------------------------------
const createComplaint = db.transaction((residentId, category, description, photoUrl) => {
  const info = db
    .prepare(
      `INSERT INTO complaints (resident_id, category, description, photo_url)
       VALUES (?, ?, ?, ?)`
    )
    .run(residentId, category, description, photoUrl);

  db.prepare(
    `INSERT INTO complaint_history (complaint_id, action_type, new_status, updated_by, note)
     VALUES (?, 'CREATED', 'OPEN', ?, 'Complaint submitted by resident.')`
  ).run(info.lastInsertRowid, residentId);

  return db.prepare('SELECT * FROM complaints WHERE id = ?').get(info.lastInsertRowid);
});

async function create(req, res) {
  const { category, description } = req.body;
  if (!category || !CATEGORIES.includes(category)) {
    throw new ApiError(400, `category must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (!description || description.trim().length < 5) {
    throw new ApiError(400, 'description is required (min 5 characters).');
  }

  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const complaint = createComplaint(req.user.id, category, description.trim(), photoUrl);
  res.status(201).json({ complaint });
}

// ---------------------------------------------------------------------
// List - residents see only their own; admins see everything with
// filters + a computed `is_overdue` flag, overdue rows sorted first.
// ---------------------------------------------------------------------
function listMine(req, res) {
  const { status, category } = req.query;
  const clauses = ['resident_id = ?'];
  const params = [req.user.id];

  if (status) {
    if (!STATUSES.includes(status)) throw new ApiError(400, 'Invalid status filter.');
    clauses.push('status = ?');
    params.push(status);
  }
  if (category) {
    if (!CATEGORIES.includes(category)) throw new ApiError(400, 'Invalid category filter.');
    clauses.push('category = ?');
    params.push(category);
  }

  const rows = db
    .prepare(
      `SELECT * FROM complaints WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`
    )
    .all(...params);

  res.json({ complaints: rows });
}

function listAll(req, res) {
  const { status, category, priority, search } = req.query;
  const threshold = getOverdueThresholdDays();
  const clauses = ['1=1'];
  const params = [threshold];

  if (status) {
    if (!STATUSES.includes(status)) throw new ApiError(400, 'Invalid status filter.');
    clauses.push('c.status = ?');
    params.push(status);
  }
  if (category) {
    if (!CATEGORIES.includes(category)) throw new ApiError(400, 'Invalid category filter.');
    clauses.push('c.category = ?');
    params.push(category);
  }
  if (priority) {
    if (!PRIORITIES.includes(priority)) throw new ApiError(400, 'Invalid priority filter.');
    clauses.push('c.priority = ?');
    params.push(priority);
  }
  if (search) {
    clauses.push('CAST(c.id AS TEXT) LIKE ?');
    params.push(`%${search.replace(/[%_]/g, '')}%`);
  }

  // Overdue rows float to the top (server-side, not a client-side sort),
  // then HIGH priority, then oldest first so nothing rots at the bottom.
  const sql = `
    SELECT c.*, u.name AS resident_name, u.apartment_no,
           ${overdueSqlFragment('c')} AS is_overdue
    FROM complaints c
    JOIN users u ON u.id = c.resident_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY is_overdue DESC,
             CASE c.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
             c.created_at ASC
  `;
  const rows = db.prepare(sql).all(...params);
  res.json({ complaints: rows.map((r) => ({ ...r, is_overdue: !!r.is_overdue })) });
}

// ---------------------------------------------------------------------
// Detail + timeline
// ---------------------------------------------------------------------
function getOne(req, res) {
  const complaint = db
    .prepare(
      `SELECT c.*, u.name AS resident_name, u.apartment_no, u.email AS resident_email
       FROM complaints c JOIN users u ON u.id = c.resident_id
       WHERE c.id = ?`
    )
    .get(req.params.id);

  if (!complaint) throw new ApiError(404, 'Complaint not found.');
  if (req.user.role === 'resident' && complaint.resident_id !== req.user.id) {
    throw new ApiError(403, 'You do not have access to this complaint.');
  }

  const history = db
    .prepare(
      `SELECT h.*, u.name AS actor_name, u.role AS actor_role
       FROM complaint_history h JOIN users u ON u.id = h.updated_by
       WHERE h.complaint_id = ?
       ORDER BY h.created_at ASC, h.id ASC`
    )
    .all(req.params.id);

  res.json({ complaint, history });
}

// ---------------------------------------------------------------------
// Admin: update status. Atomic transaction - complaints.status and the
// complaint_history insert commit together or not at all, preventing the
// "silent overwrite with no audit row" failure mode.
// ---------------------------------------------------------------------
const applyStatusChange = db.transaction((complaintId, newStatus, adminId, note) => {
  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  const previousStatus = complaint.status;

  db.prepare(`UPDATE complaints SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    newStatus,
    complaintId
  );

  db.prepare(
    `INSERT INTO complaint_history
       (complaint_id, action_type, previous_status, new_status, updated_by, note)
     VALUES (?, 'STATUS_CHANGE', ?, ?, ?, ?)`
  ).run(complaintId, previousStatus, newStatus, adminId, note || null);

  return { previousStatus, complaint: db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId) };
});

async function updateStatus(req, res) {
  const { status, note } = req.body;
  if (!STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }

  const { previousStatus, complaint } = applyStatusChange(req.params.id, status, req.user.id, note);

  const resident = db.prepare('SELECT * FROM users WHERE id = ?').get(complaint.resident_id);
  if (resident && previousStatus !== status) {
    // Fire-and-forget: response below is not blocked by mail delivery.
    notifyComplaintStatusChange(resident, complaint, previousStatus);
  }

  res.json({ complaint });
}

const applyPriorityChange = db.transaction((complaintId, newPriority, adminId) => {
  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  const previousPriority = complaint.priority;

  db.prepare(`UPDATE complaints SET priority = ?, updated_at = datetime('now') WHERE id = ?`).run(
    newPriority,
    complaintId
  );

  db.prepare(
    `INSERT INTO complaint_history
       (complaint_id, action_type, previous_priority, new_priority, updated_by)
     VALUES (?, 'PRIORITY_CHANGE', ?, ?, ?)`
  ).run(complaintId, previousPriority, newPriority, adminId);

  return db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
});

async function updatePriority(req, res) {
  const { priority } = req.body;
  if (!PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  const complaint = applyPriorityChange(req.params.id, priority, req.user.id);
  res.json({ complaint });
}

// ---------------------------------------------------------------------
// Admin: dashboard metrics (counts by status + dynamic overdue count)
// ---------------------------------------------------------------------
function metrics(req, res) {
  const threshold = getOverdueThresholdDays();
  const counts = db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM complaints GROUP BY status`
    )
    .all()
    .reduce((acc, row) => ({ ...acc, [row.status]: row.count }), {});

  const overdue = db
    .prepare(`SELECT COUNT(*) AS count FROM complaints c WHERE ${overdueSqlFragment('c')}`)
    .get(threshold).count;

  res.json({
    open: counts.OPEN || 0,
    in_progress: counts.IN_PROGRESS || 0,
    resolved: counts.RESOLVED || 0,
    overdue,
    overdue_threshold_days: threshold,
  });
}

module.exports = { create, listMine, listAll, getOne, updateStatus, updatePriority, metrics };
