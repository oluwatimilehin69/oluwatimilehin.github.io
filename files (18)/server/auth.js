const jwt = require('jsonwebtoken');

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set in the environment.');
  return secret;
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret());
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired — please sign in again.' });
  }
}

module.exports = { signToken, requireAuth };
