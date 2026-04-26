#!/usr/bin/env node

const backendUrl = (process.env.BACKEND_URL || process.env.VITE_LAYER8_API_BASE || '').replace(/\/$/, '');
const apiKey = process.env.LAYER8_API_KEY || process.env.VITE_LAYER8_API_KEY || '';

if (!backendUrl) {
  console.error('Missing BACKEND_URL or VITE_LAYER8_API_BASE.');
  process.exit(2);
}

async function check(path, authRequired = true) {
  const headers = { Accept: 'application/json' };
  if (authRequired && apiKey) headers['X-Layer8-Api-Key'] = apiKey;
  const response = await fetch(`${backendUrl}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}`);
  }
  await response.json();
  console.log(`[ok] ${path} -> ${response.status}`);
}

try {
  await check('/api/health', false);
  await check('/api/status');
  await check('/api/visual/latest');
  await check('/api/alerts/recent?limit=10');
  await check('/api/ui/preferences');
  console.log('[PASS] remote Layer 8 backend is reachable from UI environment');
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

