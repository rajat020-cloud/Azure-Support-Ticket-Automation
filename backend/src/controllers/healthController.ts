import { Request, Response } from 'express';
import { getDatabaseStatus, isDatabaseConnected } from '../config/database';

export function getHealthStatus(_req: Request, res: Response): void {
  const dbConnected = isDatabaseConnected();
  const dbStatus = getDatabaseStatus();

  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    status: dbConnected ? 'healthy' : 'degraded',
    service: 'azure-support-ticket-automation-api',
    database: {
      connected: dbConnected,
      state: dbStatus,
    },
    timestamp: new Date().toISOString(),
  });
}
