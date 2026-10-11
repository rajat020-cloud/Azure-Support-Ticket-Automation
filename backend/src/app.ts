import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { getConfig } from './config/env';
import { openApiSpec } from './config/swagger';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import ticketRoutes from './routes/ticketRoutes';
import { errorHandler } from './middleware/errorMiddleware';

export function createApp(): Express {
  const app = express();
  const config = getConfig();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  const allowedOrigins = config.frontendOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(origin) ||
          (config.nodeEnv !== 'production' && origin.startsWith('http://localhost:'))
        ) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by CORS policy'));
      },
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-reviewer-api-key'],
    })
  );

  app.use(express.json({ limit: '64kb' }));

  if (config.nodeEnv !== 'test') {
    const apiLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'TooManyRequests',
        message: 'Too many requests from this IP, please try again after a minute.',
      },
    });
    app.use('/api', apiLimiter);
  }

  // OpenAPI JSON spec & Swagger UI at /api/docs
  app.get('/api/docs.json', (_req, res) => {
    res.status(200).json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Root & /api discovery endpoints
  const apiOverviewHandler = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      service: 'Cerevyn PS04 — Azure Support Ticket Automation API',
      status: 'running',
      version: '1.0.0',
      frontendUrl: config.frontendOrigin.split(',')[0].trim() || 'http://localhost:5173',
      swaggerDocsUrl: '/api/docs',
      endpoints: {
        health: 'GET /api/health',
        tickets: 'GET /api/tickets',
        createTicket: 'POST /api/tickets',
        analyzePreview: 'POST /api/analyze',
        ticketDetail: 'GET /api/tickets/:ticketId',
        triageTicket: 'PATCH /api/tickets/:ticketId/triage',
        approveTicket: 'POST /api/tickets/:ticketId/approve',
        metrics: 'GET /api/metrics',
        evaluation: 'GET /api/evaluation',
        authRegister: 'POST /api/auth/register',
        authLogin: 'POST /api/auth/login',
        authMe: 'GET /api/auth/me',
      },
    });
  };
  app.get('/', apiOverviewHandler);
  app.get('/api', apiOverviewHandler);

  // Primary API routes
  app.use('/api', healthRoutes);
  app.use('/api', authRoutes);
  app.use('/api', ticketRoutes);

  // 404 fallback for unknown routes
  app.use((_req, res) => {
    res.status(404).json({
      error: 'NotFound',
      message: 'The requested API endpoint does not exist.',
    });
  });

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
}
