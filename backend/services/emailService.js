/**
 * Notifications are dispatched "fire-and-forget" from route handlers:
 *
 *     notifyImportantNotice(notice, recipients); // NOT awaited
 *     return res.status(201).json(notice);
 *
 * This keeps the admin API response under ~200ms even if the mail
 * transport is slow or briefly unavailable. Failures are caught and
 * logged here so they never surface as an unhandled rejection or bubble
 * up into the HTTP response cycle.
 *
 * Swap `mockTransport` for a real nodemailer SMTP transport in production
 * by setting EMAIL_TRANSPORT=smtp and filling the SMTP_* env vars - the
 * calling code in the controllers never has to change.
 */

const TRANSPORT = process.env.EMAIL_TRANSPORT || 'console';

async function mockTransport({ to, subject, body }) {
  // Simulates network latency of a real transactional mail provider so the
  // "non-blocking" behaviour is meaningfully exercised in dev/demo mode.
  await new Promise((resolve) => setTimeout(resolve, 150));
  // eslint-disable-next-line no-console
  console.log(`[email:mock] -> ${to} | ${subject}\n${body}\n`);
}

async function smtpTransport({ to, subject, body }) {
  // Lazily required so the app doesn't hard-depend on nodemailer being
  // configured when running in the default console/dev mode.
  // eslint-disable-next-line global-require
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@societyhub.local',
    to,
    subject,
    text: body,
  });
}

async function send(message) {
  try {
    if (TRANSPORT === 'smtp') {
      await smtpTransport(message);
    } else {
      await mockTransport(message);
    }
  } catch (err) {
    // Never let an email failure affect the caller. Log and move on.
    // eslint-disable-next-line no-console
    console.error(`[email] failed to send to ${message.to}:`, err.message);
  }
}

/**
 * Sends an important-notice alert to every resident. Deliberately NOT
 * async/await'd by callers - each send() call is independently caught.
 */
function notifyImportantNotice(notice, residents) {
  residents.forEach((resident) => {
    send({
      to: resident.email,
      subject: `[Society Hub] Important Notice: ${notice.title}`,
      body: notice.content,
    }); // fire-and-forget, no await
  });
}

/**
 * Notifies a resident their complaint's status changed.
 */
function notifyComplaintStatusChange(resident, complaint, previousStatus) {
  const assignment = complaint.assigned_worker_name
    ? `\n\nService personnel: ${complaint.assigned_worker_name}` +
      `\nPhone: ${complaint.assigned_worker_phone || 'Not provided'}` +
      `\nScheduled visit: ${complaint.scheduled_visit_time ? new Date(complaint.scheduled_visit_time).toLocaleString() : 'Not scheduled'}`
    : '';
  send({
    to: resident.email,
    subject: `[Society Hub] Complaint #${complaint.id} updated`,
    body:
      `Your complaint "${complaint.description.slice(0, 60)}" moved from ` +
      `${previousStatus} to ${complaint.status}.${assignment}`,
  }); // fire-and-forget, no await
}

module.exports = { notifyImportantNotice, notifyComplaintStatusChange };
