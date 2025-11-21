import jwt from 'jsonwebtoken';

export function extractTokenFromHeader(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  return null;
}

export function verifyAccessToken(token) {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_SECRET not set');
  }
  // jwt.verify throws on invalid/expired token
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

// optional helper to sign token (used by auth controller)
export function signAccessToken(payload, opts = { expiresIn: '1h' }) {
  if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET not set');
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, opts);
}

export function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return signAccessToken(payload, { expiresIn: '1h' });
}

export function signRefreshToken(payload, opts = { expiresIn: '7d' }) {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET not set');
  }
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, opts);
}

export function verifyRefreshToken(token) {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET not set');
  }
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

export function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
  };
  return signRefreshToken(payload, { expiresIn: '7d' });
}