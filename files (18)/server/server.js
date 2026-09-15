require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const db = require('./db');
const { COURSES, findCourse, totalLessons } = require('./courses-data');
const { signToken, requireAuth } = require('./auth');
const paystack = require('./paystack');

const app = express();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5500';
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: CLIENT_URL }));
// Capture the raw body on every request (needed to verify the Paystack
// webhook signature) while still parsing JSON normally everywhere else.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ============================================================
// Health check
// ============================================================
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ============================================================
// Courses (public)
// ============================================================
app.get('/api/courses', (_req, res) => {
  res.json(COURSES);
});
app.get('/api/courses/:slug', (req, res) => {
  const course = findCourse(req.params.slug);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  res.json(course);
});

// ============================================================
// Auth
// ============================================================
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password of at least 6 characters are required.' });
  }
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists. Try signing in instead.' });
  }
  const id = 'u_' + crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  db.createUser({ id, name: name.trim(), email: email.trim(), passwordHash });
  const token = signToken(id);
  res.status(201).json({ token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = db.getUserByEmail((email || '').trim());
  if (!user) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const match = await bcrypt.compare(password || '', user.password_hash);
  if (!match) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const token = signToken(user.id);
  res.json({ token });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    joined: user.created_at,
    enrollments: db.getFullEnrollmentsMap(user.id)
  });
});

// ============================================================
// Checkout — initialize a Paystack transaction
// ============================================================
app.post('/api/courses/:slug/checkout', requireAuth, async (req, res) => {
  const course = findCourse(req.params.slug);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const existing = db.getEnrollment(req.userId, course.slug);
  if (existing && existing.paid) {
    return res.status(400).json({ error: 'You already own this course.' });
  }

  const user = db.getUserById(req.userId);
  const amountKobo = course.price * 100; // Paystack wants the subunit
  const reference = `sia_${course.slug}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    const tx = await paystack.initializeTransaction({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${CLIENT_URL}/academy-payment-callback.html?course=${course.slug}`,
      metadata: { userId: user.id, courseSlug: course.slug }
    });
    db.createPaymentReference({ reference, userId: user.id, courseSlug: course.slug, amount: amountKobo });
    res.json({ authorization_url: tx.authorization_url, reference });
  } catch (err) {
    console.error('Paystack initialize failed:', err.message);
    res.status(502).json({ error: 'Could not start the payment. Please try again shortly.' });
  }
});

// ============================================================
// Verify — called by the callback page right after Paystack redirects back.
// This gives the customer immediate feedback; the webhook below is the
// authoritative confirmation and will also grant access if this step is
// missed (e.g. the browser was closed before the redirect completed).
// ============================================================
app.get('/api/payments/verify/:reference', requireAuth, async (req, res) => {
  const { reference } = req.params;
  const record = db.getPaymentReference(reference);
  if (!record || record.user_id !== req.userId) {
    return res.status(404).json({ error: 'Payment reference not found.' });
  }

  if (record.status === 'success') {
    return res.json({ ok: true, alreadyProcessed: true });
  }

  try {
    const tx = await paystack.verifyTransaction(reference);
    if (tx.status === 'success' && tx.amount === record.amount) {
      db.markPaymentStatus(reference, 'success');
      db.markEnrollmentPaid({
        userId: record.user_id,
        courseSlug: record.course_slug,
        amount: record.amount,
        reference
      });
      return res.json({ ok: true });
    }
    db.markPaymentStatus(reference, 'failed');
    return res.status(402).json({ ok: false, error: 'Payment was not successful.' });
  } catch (err) {
    console.error('Paystack verify failed:', err.message);
    res.status(502).json({ error: 'Could not verify the payment right now. Please try again.' });
  }
});

// ============================================================
// Webhook — the authoritative source of truth for payment success.
// Configure this URL in the Paystack dashboard under
// Settings > API Keys & Webhooks, subscribed to charge.success.
// ============================================================
app.post('/api/webhooks/paystack', (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  if (!paystack.isValidWebhookSignature(req.rawBody, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // Acknowledge immediately — Paystack expects a fast 200 and retries
  // on timeout, so any slower follow-up work should not block this.
  res.sendStatus(200);

  const event = req.body;
  if (event.event !== 'charge.success') return;

  const { reference, amount, status } = event.data;
  const record = db.getPaymentReference(reference);
  if (!record) return; // unknown reference — nothing to reconcile
  if (record.status === 'success') return; // already processed, avoid double-credit

  if (status === 'success' && amount === record.amount) {
    db.markPaymentStatus(reference, 'success');
    db.markEnrollmentPaid({
      userId: record.user_id,
      courseSlug: record.course_slug,
      amount: record.amount,
      reference
    });
  } else {
    db.markPaymentStatus(reference, 'failed');
  }
});

// ============================================================
// Lesson progress (paid students only)
// ============================================================
app.post('/api/courses/:slug/lessons/toggle', requireAuth, (req, res) => {
  const course = findCourse(req.params.slug);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const enrollment = db.getEnrollment(req.userId, course.slug);
  if (!enrollment || !enrollment.paid) {
    return res.status(403).json({ error: 'Purchase this course to track lesson progress.' });
  }

  const { lessonKey } = req.body || {};
  const validKeys = new Set();
  course.modules.forEach((m, mi) => m.lessons.forEach((_, li) => validKeys.add(`${mi}-${li}`)));
  if (!validKeys.has(lessonKey)) {
    return res.status(400).json({ error: 'Unknown lesson.' });
  }

  const completedLessons = db.toggleLesson(req.userId, course.slug, lessonKey);
  res.json({ completedLessons, total: totalLessons(course) });
});

app.listen(PORT, () => {
  console.log(`SI Academy server running on http://localhost:${PORT}`);
  console.log(`Allowing requests from CLIENT_URL: ${CLIENT_URL}`);
});
