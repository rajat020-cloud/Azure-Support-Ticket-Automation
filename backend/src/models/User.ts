import crypto from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';
import { getConfig } from '../config/env';

export const USER_ROLES = ['reviewer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'reviewer',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UserSchema.index({ email: 1 }, { unique: true });

export const UserModel: mongoose.Model<IUserDocument> =
  (mongoose.models.User as mongoose.Model<IUserDocument>) ||
  mongoose.model<IUserDocument>('User', UserSchema);

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 10000, 64, 'sha512')
    .toString('hex');
  return { hash, salt: usedSalt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  exp: number;
}

function getSigningSecret(): string {
  const cfg = getConfig();
  return cfg.reviewerApiKey || 'default-jwt-signing-secret-ps04';
}

export function signAuthToken(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, encodedPayload, signature] = parts;
    const data = `${header}.${encodedPayload}`;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(data)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as AuthTokenPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
