import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  frontendOrigin: string;
  reviewerApiKey: string;
  confidenceThreshold: number;
}

function parseConfidenceThreshold(raw: string | undefined): number {
  const fallback = 0.45;
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed >= 1) {
    return fallback;
  }
  return parsed;
}

function parsePort(raw: string | undefined): number {
  const fallback = 5000;
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

export function getConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parsePort(process.env.PORT);
  const mongodbUri = process.env.MONGODB_URI || '';
  const frontendOrigin = process.env.FRONTEND_ORIGIN || '*';
  const reviewerApiKey =
    process.env.REVIEWER_API_KEY ||
    (nodeEnv === 'production' ? '' : 'dev-reviewer-secret-key-2025');
  const confidenceThreshold = parseConfidenceThreshold(process.env.CONFIDENCE_THRESHOLD);

  return {
    nodeEnv,
    port,
    mongodbUri,
    frontendOrigin,
    reviewerApiKey,
    confidenceThreshold,
  };
}
