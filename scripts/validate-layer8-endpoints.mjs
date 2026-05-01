#!/usr/bin/env node

const DEFAULT_BASE = 'http://100.92.1.128:8088';
const DEFAULT_WS = 'ws://100.92.1.128:8088/ws/events';

const args = new Set(process.argv.slice(2));
const includeControl = args.has('--control') || process.env.LAYER8_INCLUDE_CONTROL === '1';
const includeWebrtcSmoke = args.has('--webrtc-smoke') || process.env.LAYER8_WEBRTC_SMOKE === '1';

const apiBase = stripTrailingSlash(
  process.env.LAYER8_API_BASE || process.env.BACKEND_URL || process.env.VITE_LAYER8_API_BASE || DEFAULT_BASE,
);
const wsEventsUrl = process.env.LAYER8_WS_URL || process.env.VITE_LAYER8_WS_URL || DEFAULT_WS;
const apiKey = process.env.LAYER8_API_KEY || process.env.VITE_LAYER8_API_KEY || '';
const timeoutMs = Number(process.env.LAYER8_ENDPOINT_TIMEOUT_MS || 5000);

const results = [];

function stripTrailingSlash(value) {
  return value.replace(/\/$/, '');
}

function authHeaders(extra = {}) {
  return apiKey ? { ...extra, 'X-Layer8-Api-Key': apiKey } : extra;
}

function withToken(path) {
  const url = new URL(path, apiBase);
  if (apiKey) url.searchParams.set('token', apiKey);
  return url.toString();
}

function toWsUrl(path) {
  const url = new URL(path, apiBase.replace(/^http/i, 'ws'));
  if (apiKey) url.searchParams.set('token', apiKey);
  return url.toString();
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function record(status, label, detail = '') {
  results.push({ status, label, detail });
  const suffix = detail ? ` ${detail}` : '';
  console.log(`[${status}] ${label}${suffix}`);
}

async function requestEndpoint({ method = 'GET', path, body, kind = 'json', label = path, expected = [200] }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers =
      kind === 'json'
        ? authHeaders({ Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) })
        : authHeaders({ Accept: '*/*' });

    const response = await fetch(withToken(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const ok = expected.includes(response.status) || (response.status >= 200 && response.status < 300 && expected.includes(200));
    if (!ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
    }

    if (kind === 'json') {
      await response.json();
    } else {
      await response.body?.cancel();
    }

    record('ok', `${method} ${label}`, `-> ${response.status}`);
  } finally {
    clearTimeout(timer);
  }
}

async function checkEndpoint(endpoint) {
  try {
    await requestEndpoint(endpoint);
  } catch (error) {
    record('fail', `${endpoint.method ?? 'GET'} ${endpoint.label ?? endpoint.path}`, formatError(error));
  }
}

async function checkWebSocket(label, url) {
  if (typeof WebSocket !== 'function') {
    record('skip', label, 'WebSocket is not available in this Node runtime');
    return;
  }

  await new Promise((resolve) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      record('fail', label, `timeout after ${timeoutMs}ms`);
      resolve();
    }, timeoutMs);

    socket.addEventListener('open', () => {
      clearTimeout(timer);
      socket.close();
      record('ok', label, 'connected');
      resolve();
    });

    socket.addEventListener('error', () => {
      clearTimeout(timer);
      record('fail', label, 'connection error');
      resolve();
    });
  });
}

const safeJsonEndpoints = [
  { path: '/api/status', label: '/api/status' },
  { path: '/api/status/thermal', label: '/api/status/thermal' },
  { path: '/api/status/webcam', label: '/api/status/webcam' },
  { path: '/api/status/mmwave', label: '/api/status/mmwave' },
  { path: '/api/thermal/status', label: '/api/thermal/status' },
  { path: '/api/thermal/config', label: '/api/thermal/config' },
  { path: '/api/ai_camera/status', label: '/api/ai_camera/status' },
  { path: '/api/ai_camera/config', label: '/api/ai_camera/config' },
  { path: '/api/ai_camera/profiles', label: '/api/ai_camera/profiles' },
  { path: '/api/model/profiles', label: '/api/model/profiles' },
  { path: '/api/dashboard/metrics', label: '/api/dashboard/metrics' },
  { path: '/api/preview/output/mmwave', label: '/api/preview/output/mmwave' },
  { path: '/api/config', label: '/api/config' },
  { path: '/api/devices/v4l2', label: '/api/devices/v4l2' },
  { path: '/api/devices/v4l2/formats?index=0', label: '/api/devices/v4l2/formats?index=0' },
  { path: '/api/devices/serial', label: '/api/devices/serial' },
  { path: '/api/command/thermal', label: '/api/command/thermal' },
];

const streamEndpoints = [
  { path: '/api/ai_camera/preview/live', label: '/api/ai_camera/preview/live', kind: 'stream' },
  { path: '/api/thermal/preview/live', label: '/api/thermal/preview/live', kind: 'stream' },
  { path: '/api/preview/live_direct/thermal', label: '/api/preview/live_direct/thermal', kind: 'stream' },
];

const controlEndpoints = [
  { method: 'POST', path: '/api/ai_camera/run', label: '/api/ai_camera/run' },
  { method: 'POST', path: '/api/ai_camera/stop', label: '/api/ai_camera/stop' },
  { method: 'POST', path: '/api/ai_camera/restart', label: '/api/ai_camera/restart' },
  { method: 'POST', path: '/api/thermal/run', label: '/api/thermal/run' },
  { method: 'POST', path: '/api/thermal/stop', label: '/api/thermal/stop' },
  { method: 'POST', path: '/api/thermal/restart', label: '/api/thermal/restart' },
  { method: 'POST', path: '/api/thermal/auto_configure', label: '/api/thermal/auto_configure' },
  { method: 'POST', path: '/api/run/thermal', label: '/api/run/thermal' },
  { method: 'POST', path: '/api/stop/thermal', label: '/api/stop/thermal' },
  { method: 'POST', path: '/api/restart/thermal', label: '/api/restart/thermal' },
  { method: 'POST', path: '/api/run/webcam', label: '/api/run/webcam' },
  { method: 'POST', path: '/api/stop/webcam', label: '/api/stop/webcam' },
  { method: 'POST', path: '/api/restart/webcam', label: '/api/restart/webcam' },
  { method: 'POST', path: '/api/run/mmwave', label: '/api/run/mmwave' },
  { method: 'POST', path: '/api/stop/mmwave', label: '/api/stop/mmwave' },
  { method: 'POST', path: '/api/restart/mmwave', label: '/api/restart/mmwave' },
  { method: 'POST', path: '/api/run_all', label: '/api/run_all' },
  { method: 'POST', path: '/api/stop_all', label: '/api/stop_all' },
  { method: 'POST', path: '/api/restart_all', label: '/api/restart_all' },
];

const webrtcSmokeEndpoints = [
  {
    method: 'POST',
    path: '/api/ai_camera/webrtc/offer',
    label: '/api/ai_camera/webrtc/offer',
    body: { sdp: 'v=0\r\n', type: 'offer' },
    expected: [200, 400, 422],
  },
  {
    method: 'POST',
    path: '/api/webrtc/ai_camera/offer',
    label: '/api/webrtc/ai_camera/offer',
    body: { sdp: 'v=0\r\n', type: 'offer' },
    expected: [200, 400, 422],
  },
  {
    method: 'POST',
    path: '/api/webrtc/webcam/offer',
    label: '/api/webrtc/webcam/offer',
    body: { sdp: 'v=0\r\n', type: 'offer' },
    expected: [200, 400, 422],
  },
];

console.log(`Layer8 endpoint validation`);
console.log(`API: ${apiBase}`);
console.log(`WS events: ${wsEventsUrl}`);
console.log(`Control POSTs: ${includeControl ? 'enabled' : 'disabled'}`);
console.log(`WebRTC smoke: ${includeWebrtcSmoke ? 'enabled' : 'disabled'}`);
console.log('');

for (const endpoint of safeJsonEndpoints) {
  await checkEndpoint(endpoint);
}

for (const endpoint of streamEndpoints) {
  await checkEndpoint(endpoint);
}

await checkWebSocket('/ws/events', wsEventsUrl);
await checkWebSocket('/ws/thermal', toWsUrl('/ws/thermal'));

if (includeWebrtcSmoke) {
  for (const endpoint of webrtcSmokeEndpoints) {
    await checkEndpoint(endpoint);
  }
} else {
  for (const endpoint of webrtcSmokeEndpoints) {
    record('skip', `POST ${endpoint.label}`, 'enable with --webrtc-smoke');
  }
}

if (includeControl) {
  for (const endpoint of controlEndpoints) {
    await checkEndpoint(endpoint);
  }
} else {
  for (const endpoint of controlEndpoints) {
    record('skip', `POST ${endpoint.label}`, 'enable with --control');
  }
}

const failed = results.filter((item) => item.status === 'fail').length;
const skipped = results.filter((item) => item.status === 'skip').length;
const passed = results.filter((item) => item.status === 'ok').length;

console.log('');
console.log(`Summary: ${passed} ok, ${failed} failed, ${skipped} skipped`);

if (failed > 0) {
  process.exit(1);
}
