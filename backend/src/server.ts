import { createApp } from './app';
import { connectToDatabase } from './config/database';
import { getConfig } from './config/env';

async function startServer(): Promise<void> {
  const config = getConfig();

  if (!config.mongodbUri) {
    console.error(
      '[FATAL] MONGODB_URI environment variable is missing. Refusing to start without a configured MongoDB connection string.'
    );
    process.exit(1);
  }

  if (config.nodeEnv === 'production' && !config.reviewerApiKey) {
    console.error(
      '[FATAL] REVIEWER_API_KEY environment variable is required when running in production.'
    );
    process.exit(1);
  }

  try {
    await connectToDatabase(config.mongodbUri);
    console.log('[DB] Connected to MongoDB and verified collection indexes.');
  } catch (err) {
    const safeMessage = err instanceof Error ? err.message.replace(/mongodb(\+srv)?:\/\/[^\s@]+@/gi, 'mongodb://<redacted>@') : 'Unknown connection error';
    console.error(`[DB] Initial MongoDB connection failed: ${safeMessage}`);
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `[SERVER] Azure Support Ticket Automation API listening on http://0.0.0.0:${config.port} (env: ${config.nodeEnv})`
    );
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();
