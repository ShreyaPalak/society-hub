require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

function upsertUser({ name, email, password, role, apartment_no }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, apartment_no) VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, email, hash, role, apartment_no || null);
  return info.lastInsertRowid;
}

function main() {
  console.log('Seeding database...');

  const adminId = upsertUser({
    name: 'Priya Sharma',
    email: 'admin@societyhub.local',
    password: 'Admin@12345',
    role: 'admin',
  });

  const jane = upsertUser({
    name: 'Jane Doe',
    email: 'jane@societyhub.local',
    password: 'Resident@123',
    role: 'resident',
    apartment_no: 'A-302',
  });

  const raj = upsertUser({
    name: 'Raj Mehta',
    email: 'raj@societyhub.local',
    password: 'Resident@123',
    role: 'resident',
    apartment_no: 'B-104',
  });

  const complaintCount = db.prepare('SELECT COUNT(*) AS c FROM complaints').get().c;
  if (complaintCount === 0) {
    const createComplaint = db.transaction((residentId, category, description, priority, status, daysAgo) => {
      const info = db
        .prepare(
          `INSERT INTO complaints (resident_id, category, description, priority, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'OPEN', datetime('now', ?), datetime('now', ?))`
        )
        .run(residentId, category, description, priority, `-${daysAgo} days`, `-${daysAgo} days`);
      const id = info.lastInsertRowid;
      db.prepare(
        `INSERT INTO complaint_history (complaint_id, action_type, new_status, updated_by, note, created_at)
         VALUES (?, 'CREATED', 'OPEN', ?, 'Complaint submitted by resident.', datetime('now', ?))`
      ).run(id, residentId, `-${daysAgo} days`);

      if (status !== 'OPEN') {
        db.prepare(`UPDATE complaints SET status = ? WHERE id = ?`).run(status, id);
        db.prepare(
          `INSERT INTO complaint_history
             (complaint_id, action_type, previous_status, new_status, updated_by, note)
           VALUES (?, 'STATUS_CHANGE', 'OPEN', ?, ?, ?)`
        ).run(
          id,
          status,
          adminId,
          status === 'IN_PROGRESS'
            ? 'Assigned plumber (Vendor ID: #V-44). Inspection scheduled.'
            : 'Faulty pipe coupling replaced and pressure tested.'
        );
      }
      return id;
    });

    createComplaint(jane, 'Plumbing', 'Water leaking from master bathroom ceiling panel.', 'HIGH', 'IN_PROGRESS', 6);
    createComplaint(raj, 'Elevator', 'Elevator B making a grinding noise on floors 3-5.', 'HIGH', 'OPEN', 5); // will show as overdue
    createComplaint(jane, 'Electrical', 'Main gate intercom not working.', 'LOW', 'RESOLVED', 10);
    createComplaint(raj, 'Common Area', 'Garden bench near block B is broken.', 'MEDIUM', 'OPEN', 1);

    console.log('Seeded 4 sample complaints with history.');
  }

  const noticeCount = db.prepare('SELECT COUNT(*) AS c FROM notices').get().c;
  if (noticeCount === 0) {
    db.prepare(
      `INSERT INTO notices (title, content, is_important, created_by) VALUES (?, ?, 1, ?)`
    ).run('Elevator B Maintenance Scheduled', 'Elevator B will be under maintenance Oct 24, 10 AM - 2 PM. Please use Elevator A during this window.', adminId);
    db.prepare(
      `INSERT INTO notices (title, content, is_important, created_by) VALUES (?, ?, 0, ?)`
    ).run('Diwali Cleaning Drive', 'Common area cleaning drive this Saturday 9 AM. Volunteers welcome!', adminId);
    console.log('Seeded 2 sample notices.');
  }

  console.log('\nDemo accounts:');
  console.log('  Admin:    admin@societyhub.local / Admin@12345');
  console.log('  Resident: jane@societyhub.local  / Resident@123');
  console.log('  Resident: raj@societyhub.local   / Resident@123');
  console.log('\nDone.');
}

main();
