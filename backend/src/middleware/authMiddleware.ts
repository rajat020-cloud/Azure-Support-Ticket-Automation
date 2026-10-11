import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config/env';
import { AuthTokenPayload, verifyAuthToken } from '../models/User';

export interface AuthenticatedRequest extends Request {
  reviewerUser?: AuthTokenPayload;
}

export function extractReviewerKey(req: Request): string | null {
  const headerKey = req.header('x-reviewer-api-key');
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim();
  }

  const authHeader = req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken.length > 0) {
      return bearerToken;
    }
  }

  return null;
}

export function safeCompareSecrets(provided: string, expected: string): boolean {
  if (!expected || expected.length === 0) {
    return false;
  }
  const providedHash = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const expectedHash = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

export function requireReviewerAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const config = getConfig();
  const providedCredential = extractReviewerKey(req);

  if (!providedCredential) {
    res.status(401).json({
      error: 'Unauthorized',
      message:
        'Reviewer authorization required. Sign in with a Reviewer account (Bearer token) or provide a valid x-reviewer-api-key header.',
    });
    return;
  }

  // 1. Check if credential is a valid signed JWT session token from /api/auth/login or /api/auth/register
  const jwtPayload = verifyAuthToken(providedCredential);
  if (jwtPayload) {
    req.reviewerUser = jwtPayload;
    next();
    return;
  }

  // 2. Otherwise check against server-side REVIEWER_API_KEY
  if (!config.reviewerApiKey) {
    res.status(503).json({
      error: 'ConfigurationError',
      message: 'Reviewer authorization is not configured on the server.',
    });
    return;
  }

  if (!safeCompareSecrets(providedCredential, config.reviewerApiKey)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid reviewer authorization key or expired session token.',
    });
    return;
  }

  next();
}
