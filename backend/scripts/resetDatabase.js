const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');

// Load .env from backend/.env first, fallback to cwd/.env
const backendEnv = path.join(__dirname, '../.env');
const rootEnv = path.resolve(process.cwd(), '.env');
if (fs.existsSync(backendEnv)) {
  require('dotenv').config({ path: backendEnv });
} else {
  require('dotenv').config({ path: rootEnv });
}

function getBoolArg(name) {
  return process.argv.includes(name);
}

function runNodeScript(scriptRelativePath, label) {
  const abs = path.join(__dirname, '..', scriptRelativePath);
  const res = spawnSync(process.execPath, [abs], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env
  });
  if (res.status !== 0) {
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
}

async function resetSchema() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD != null ? String(process.env.POSTGRES_PASSWORD) : '',
    max: 2
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    const client = await pool.connect();
    client.release();
    console.log('✅ Connected');

    console.log('🧹 Dropping and recreating public schema...');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await pool.query('CREATE SCHEMA public;');
    await pool.query('GRANT ALL ON SCHEMA public TO PUBLIC;');
    await pool.query('GRANT ALL ON SCHEMA public TO CURRENT_USER;');
    console.log('✅ Schema reset complete');
  } finally {
    await pool.end();
  }
}

async function main() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const force = process.env.FORCE_RESET_DB === 'true' || getBoolArg('--force');
  const withSeed = getBoolArg('--seed');

  if (nodeEnv === 'production' && !force) {
    console.error('❌ Refusing to reset DB in production. Use FORCE_RESET_DB=true or --force if intentional.');
    process.exit(1);
  }

  if (!process.env.POSTGRES_HOST || !process.env.POSTGRES_DB || !process.env.POSTGRES_USER) {
    console.error('❌ Missing POSTGRES_HOST / POSTGRES_DB / POSTGRES_USER in environment.');
    process.exit(1);
  }

  try {
    console.log('='.repeat(60));
    console.log('⚠️  DATABASE RESET STARTED');
    console.log('='.repeat(60));

    await resetSchema();

    console.log('📦 Running migrations...');
    runNodeScript('migrations/postgres/migrate.js', 'Migrations');
    console.log('✅ Migrations completed');

    if (withSeed) {
      console.log('🌱 Running seeds (--seed enabled)...');
      runNodeScript('scripts/seedAdmin.js', 'seedAdmin');
      runNodeScript('scripts/seedData.js', 'seedData');
      runNodeScript('scripts/seedAccounting.js', 'seedAccounting');
      runNodeScript('scripts/seedProductStock.js', 'seedProductStock');
      console.log('✅ Seed scripts completed');
    } else {
      console.log('ℹ️  Seeds skipped. Use --seed to include seed scripts.');
    }

    console.log('='.repeat(60));
    console.log('🎉 DATABASE RESET COMPLETE');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Database reset failed:', error.message || error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
