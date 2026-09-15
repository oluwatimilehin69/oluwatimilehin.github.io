/* =====================================================================
   SI ACADEMY — frontend API client
   ---------------------------------------------------------------------
   Talks to the backend in /server. Accounts, purchases, and lesson
   progress are real now — this file just calls the API and keeps the
   session token. See server/README.md for how to run the backend.
   ===================================================================== */

// Point this at wherever the backend from /server ends up running.
const API_BASE = 'http://localhost:4000/api';

const ACADEMY_TOKEN_KEY = 'si_academy_token';

function academyGetToken(){
  return localStorage.getItem(ACADEMY_TOKEN_KEY);
}
function academySetToken(token){
  localStorage.setItem(ACADEMY_TOKEN_KEY, token);
}
function academyClearToken(){
  localStorage.removeItem(ACADEMY_TOKEN_KEY);
}

async function academyApiFetch(path, options = {}){
  const token = academyGetToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {},
    token ? { Authorization: 'Bearer ' + token } : {}
  );
  let res;
  try {
    res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  } catch (err) {
    throw new Error('Could not reach the Academy server. Is the backend running?');
  }
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    throw new Error((data && data.error) || 'Something went wrong. Please try again.');
  }
  return data;
}

// ---------- courses (public) ----------
async function academyFetchCourses(){
  return academyApiFetch('/courses');
}
function academyCourseTotalLessons(course){
  return course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
}
function academyCourseProgress(enrollment, course){
  if (!enrollment || !enrollment.paid) return 0;
  const total = academyCourseTotalLessons(course);
  return total === 0 ? 0 : Math.round((enrollment.completedLessons.length / total) * 100);
}
function academyFormatNaira(amount){
  return '\u20a6' + Number(amount).toLocaleString('en-NG');
}

// ---------- auth ----------
async function academyGetMe(){
  if (!academyGetToken()) return null;
  try {
    return await academyApiFetch('/me');
  } catch {
    academyClearToken(); // token missing/expired/invalid
    return null;
  }
}
async function academyRegister(name, email, password){
  try {
    const data = await academyApiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    academySetToken(data.token);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
async function academyLogin(email, password){
  try {
    const data = await academyApiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    academySetToken(data.token);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
function academySignOut(){
  academyClearToken();
  window.location.href = 'academy.html';
}

// ---------- purchase & progress ----------
async function academyStartCheckout(courseSlug){
  try {
    const data = await academyApiFetch(`/courses/${courseSlug}/checkout`, { method: 'POST' });
    window.location.href = data.authorization_url; // hand off to Paystack's hosted checkout
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
async function academyVerifyPayment(reference){
  try {
    await academyApiFetch(`/payments/verify/${encodeURIComponent(reference)}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
async function academyToggleLesson(courseSlug, lessonKey){
  return academyApiFetch(`/courses/${courseSlug}/lessons/toggle`, {
    method: 'POST',
    body: JSON.stringify({ lessonKey })
  });
}
