

import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';

// Workaround for the Windows Node.js DNS resolution issue
dns.setServers(['8.8.8.8', '1.1.1.1']);

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing. Please configure it in server/.env'
    );
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `[Database] MongoDB connected successfully: ${conn.connection.host}`
    );

    return conn;
  } catch (error) {
    console.error(
      '[Database Error] MongoDB connection failed:',
      error.message
    );
    throw error;
  }
};

export const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('[Database] MongoDB disconnected.');
    }
  } catch (error) {
    console.error('[Database Error] Disconnect failed:', error.message);
    throw error;
  }
};
