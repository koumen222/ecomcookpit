import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

let loadedEnv = null;

function resolveEnvPath() {
  const explicitPath = process.env.BACKEND_ENV_FILE || process.env.DOTENV_CONFIG_PATH;
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(BACKEND_DIR, explicitPath);
  }

  const appEnv = String(process.env.APP_ENV || '').trim().toLowerCase();

  if (appEnv === 'staging' || appEnv === 'sandbox') {
    return path.resolve(BACKEND_DIR, '.env.staging');
  }

  if (appEnv === 'production') {
    const productionPath = path.resolve(BACKEND_DIR, '.env.production');
    return fs.existsSync(productionPath) ? productionPath : path.resolve(BACKEND_DIR, '.env');
  }

  return path.resolve(BACKEND_DIR, '.env');
}

export function loadBackendEnv() {
  if (loadedEnv) return loadedEnv;

  const envPath = resolveEnvPath();
  const exists = fs.existsSync(envPath);

  if (exists) {
    dotenv.config({ path: envPath });
  }

  loadedEnv = {
    appEnv: process.env.APP_ENV || process.env.NODE_ENV || 'development',
    envPath,
    loadedFromFile: exists,
  };

  const relativePath = path.relative(BACKEND_DIR, envPath) || '.env';
  console.log(`[env] APP_ENV=${loadedEnv.appEnv} envFile=${exists ? relativePath : 'process.env only'}`);

  return loadedEnv;
}

loadBackendEnv();
