import jwt from 'jsonwebtoken';
import config from '../config';

export function signAccessToken(payload) {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenExpiresIn });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenExpiresIn });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}
