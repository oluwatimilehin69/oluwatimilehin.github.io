const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'academy.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    user_id TEXT NOT NULL,
    course_slug TEXT NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    amount INTEGER,
    reference TEXT,
    purchased_at TEXT,
    PRIMARY KEY (user_id, course_slug)
  );

  CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id TEXT NOT NULL,
    course_slug TEXT NOT NULL,
    lesson_key TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, course_slug, lesson_key)
  );

  CREATE TABLE IF NOT EXISTS payment_references (
    reference TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_slug TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
`);

// ---------- users ----------
function createUser({ id, name, email, passwordHash }) {
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, email, passwordHash, new Date().toISOString());
}
function getUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
}
function getUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

// ---------- enrollments ----------
function getEnrollments(userId) {
  return db.prepare(`SELECT * FROM enrollments WHERE user_id = ?`).all(userId);
}
function getEnrollment(userId, courseSlug) {
  return db.prepare(`SELECT * FROM enrollments WHERE user_id = ? AND course_slug = ?`).get(userId, courseSlug);
}
function markEnrollmentPaid({ userId, courseSlug, amount, reference }) {
  db.prepare(`
    INSERT INTO enrollments (user_id, course_slug, paid, amount, reference, purchased_at)
    VALUES (?, ?, 1, ?, ?, ?)
    ON CONFLICT(user_id, course_slug) DO UPDATE SET
      paid = 1, amount = excluded.amount, reference = excluded.reference, purchased_at = excluded.purchased_at
  `).run(userId, courseSlug, amount, reference, new Date().toISOString());
}

// ---------- lesson progress ----------
function getCompletedLessons(userId, courseSlug) {
  return db.prepare(
    `SELECT lesson_key FROM lesson_progress WHERE user_id = ? AND course_slug = ?`
  ).all(userId, courseSlug).map(r => r.lesson_key);
}
function toggleLesson(userId, courseSlug, lessonKey) {
  const existing = db.prepare(
    `SELECT 1 FROM lesson_progress WHERE user_id = ? AND course_slug = ? AND lesson_key = ?`
  ).get(userId, courseSlug, lessonKey);
  if (existing) {
    db.prepare(
      `DELETE FROM lesson_progress WHERE user_id = ? AND course_slug = ? AND lesson_key = ?`
    ).run(userId, courseSlug, lessonKey);
  } else {
    db.prepare(
      `INSERT INTO lesson_progress (user_id, course_slug, lesson_key, completed_at) VALUES (?, ?, ?, ?)`
    ).run(userId, courseSlug, lessonKey, new Date().toISOString());
  }
  return getCompletedLessons(userId, courseSlug);
}

// ---------- payment references ----------
function createPaymentReference({ reference, userId, courseSlug, amount }) {
  db.prepare(`
    INSERT INTO payment_references (reference, user_id, course_slug, amount, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(reference, userId, courseSlug, amount, new Date().toISOString());
}
function getPaymentReference(reference) {
  return db.prepare(`SELECT * FROM payment_references WHERE reference = ?`).get(reference);
}
function markPaymentStatus(reference, status) {
  db.prepare(`UPDATE payment_references SET status = ? WHERE reference = ?`).run(status, reference);
}

// ---------- assembled view for the frontend ----------
function getFullEnrollmentsMap(userId) {
  const rows = getEnrollments(userId);
  const map = {};
  rows.forEach(row => {
    map[row.course_slug] = {
      paid: !!row.paid,
      amount: row.amount,
      purchasedAt: row.purchased_at,
      completedLessons: getCompletedLessons(userId, row.course_slug)
    };
  });
  return map;
}

module.exports = {
  db,
  createUser, getUserByEmail, getUserById,
  getEnrollments, getEnrollment, markEnrollmentPaid,
  getCompletedLessons, toggleLesson,
  createPaymentReference, getPaymentReference, markPaymentStatus,
  getFullEnrollmentsMap
};
