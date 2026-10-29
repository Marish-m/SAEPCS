import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly locate server/.env relative to this file (../../.env)
const serverDir = path.resolve(__dirname, '../../');
const envPath = path.resolve(serverDir, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fallback to current working directory
  dotenv.config();
}

export const isEnvLoaded = true;

