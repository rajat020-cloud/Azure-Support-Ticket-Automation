import { Request, Response, NextFunction } from 'express';
import { isDatabaseConnected } from '../config/database';
import {
  hashPassword,
  signAuthToken,
  UserModel,
  verifyAuthToken,
  verifyPassword,
} from '../models/User';
import { extractReviewerKey } from '../middleware/authMiddleware';
import {
  loginUserSchema,
  registerUserSchema,
} from '../middleware/validateMiddleware';

function ensureDb(res: Response): boolean {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      error: 'DatabaseUnavailable',
      message: 'Database connection is not active.',
    });
    return false;
  }
  return true;
}

export async function registerUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validated = registerUserSchema.parse(req.body);
    if (!ensureDb(res)) return;

    const { hash, salt } = hashPassword(validated.password);
    const createdUser = await UserModel.create({
      name: validated.name,
      email: validated.email,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'reviewer',
    });

    const userObj = createdUser.toObject();
    const userId = String(userObj._id || userObj.email);
    const token = signAuthToken({
      id: userId,
      email: userObj.email,
      name: userObj.name,
      role: userObj.role,
    });

    res.status(201).json({
      message: 'Reviewer account registered successfully.',
      token,
      user: {
        id: userId,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function loginUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validated = loginUserSchema.parse(req.body);
    if (!ensureDb(res)) return;

    const existing = await UserModel.findOne({ email: validated.email }).lean();
    if (
      !existing ||
      !verifyPassword(validated.password, existing.passwordHash, existing.passwordSalt)
    ) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email address or password.',
      });
      return;
    }

    const userId = String(existing._id || existing.email);
    const token = signAuthToken({
      id: userId,
      email: existing.email,
      name: existing.name,
      role: existing.role,
    });

    res.status(200).json({
      message: 'Signed in successfully.',
      token,
      user: {
        id: userId,
        name: existing.name,
        email: existing.email,
        role: existing.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = extractReviewerKey(req);
    if (!rawToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is missing.',
      });
      return;
    }

    const payload = verifyAuthToken(rawToken);
    if (!payload) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token.',
      });
      return;
    }

    res.status(200).json({
      user: {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role,
      },
    });
  } catch (err) {
    next(err);
  }
}
