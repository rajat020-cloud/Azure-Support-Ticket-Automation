import mongoose from 'mongoose';
import { TicketModel } from '../models/Ticket';
import { UserModel } from '../models/User';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting';

export function getDatabaseStatus(): DatabaseStatus {
  const state = mongoose.connection.readyState;
  switch (state) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectToDatabase(uri: string): Promise<void> {
  if (!uri || uri.trim() === '') {
    throw new Error('MONGODB_URI is required to establish a database connection.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: true,
  });

  // Explicitly ensure unique indexes are built before accepting write traffic
  await Promise.all([TicketModel.init(), UserModel.init()]);
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
