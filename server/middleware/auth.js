const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'PurCheaper-dev-secret-change-in-production';

function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function requireAuth(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (role && decoded.role !== role) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

/** Accept either partner JWT or X-API-Key header */
function requirePartner(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const db = getDb();
    const partner = db
      .prepare('SELECT id, company_name, email, plan, active FROM partners WHERE api_key = ?')
      .get(apiKey);
    if (!partner || !partner.active) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.user = { role: 'partner', id: partner.id, email: partner.email, company: partner.company_name };
    req.partner = partner;
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Partner auth required (Bearer token or X-API-Key)' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'partner') {
      return res.status(403).json({ error: 'Partner role required' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, requireAuth, requirePartner, JWT_SECRET };
