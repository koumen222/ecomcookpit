import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { requireEcomAuth } from './ecomAuth.js';

/**
 * Auth invité — Creative Center sans connexion.
 *
 * Un « invité » reçoit un JWT anonyme ({ gid, guest: true }) émis par
 * POST /api/ecom/guest/session. Le middleware ecomAuthOrGuest accepte :
 *   - un token utilisateur classique → délègue à requireEcomAuth (req.user,
 *     req.workspaceId… inchangés) ;
 *   - un token invité → req.isGuest = true, req.guestId, PAS de workspace.
 * Chaque route décide ensuite du comportement invité (quota, résultat
 * verrouillé, listes vides…).
 */

const ECOM_JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';
const GUEST_TOKEN_TTL = '30d';

export function issueGuestToken(guestId = null) {
  const gid = guestId || randomUUID();
  const token = jwt.sign({ gid, guest: true }, ECOM_JWT_SECRET, { expiresIn: GUEST_TOKEN_TTL });
  return { gid, token };
}

export function verifyGuestToken(token) {
  try {
    const decoded = jwt.verify(String(token || '').replace(/^Bearer /, ''), ECOM_JWT_SECRET);
    if (decoded?.guest === true && decoded.gid) return decoded;
    return null;
  } catch {
    return null;
  }
}

export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || req.connection?.remoteAddress || '';
}

export const ecomAuthOrGuest = async (req, res, next) => {
  const authHeader = req.header('Authorization') || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  token = token.replace(/^ecom:/, '').replace(/^perm:/, '');

  if (token) {
    try {
      const decoded = jwt.verify(token, ECOM_JWT_SECRET);
      if (decoded?.guest === true && decoded.gid) {
        req.isGuest = true;
        req.guestId = decoded.gid;
        req.workspaceId = null;
        return next();
      }
    } catch {
      // Pas un token invité valide → laisser requireEcomAuth trancher
    }
  }

  return requireEcomAuth(req, res, next);
};
