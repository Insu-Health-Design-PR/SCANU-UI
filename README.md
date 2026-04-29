# SCAN-U Layer 8 UI

Standalone React/Vite frontend for the SCAN-U Layer 8 dashboard.

This repo is intended to deploy independently on Vercel while consuming the Layer 8 backend running on the Jetson Nano.

## Runtime Architecture

```text
Vercel frontend
  -> HTTPS API calls with X-Layer8-Api-Key
  -> WSS /ws/events?token=...
  -> Cloudflare Tunnel
  -> Jetson backend on http://127.0.0.1:8088
```

## Required Vercel Environment Variables

```text
VITE_LAYER8_API_BASE=https://example.trycloudflare.com
VITE_LAYER8_WS_URL=wss://example.trycloudflare.com/ws/events
VITE_LAYER8_API_KEY=change-this-key
```

`VITE_LAYER8_API_KEY` must match `LAYER8_API_KEY` on the Jetson backend.

## Backend Endpoints Expected By The UI

```text
GET  /api/status
GET  /api/health
GET  /api/alerts/recent?limit=50
GET  /api/visual/latest
GET  /api/ui/preferences
POST /api/ui/preferences
POST /api/control/reconfig
POST /api/control/reset-soft
WS   /ws/events?token=<api-key>
```

`/api/visual/latest` is the main visual payload. It must provide:

```text
rgb_jpeg_b64
thermal_jpeg_b64
point_cloud
presence
timestamp_ms
source_mode
```

## Local Development

Install dependencies:

```bash
npm ci
```

Run against local Jetson/backend on `127.0.0.1:8088`:

```bash
npm run dev
```

Run against the Jetson over Tailscale from Adrian's Mac:

```bash
cp .env.tailscale.example .env.local
npm run dev
```

This points the frontend at:

```text
http://100.92.1.128:8088
```

The thermal panel consumes the backend MJPEG stream directly from:

```text
GET /api/thermal/preview/live
```

Run against a Cloudflare Tunnel from local development:

```bash
VITE_LAYER8_API_BASE="https://example.trycloudflare.com" \
VITE_LAYER8_WS_URL="wss://example.trycloudflare.com/ws/events" \
VITE_LAYER8_API_KEY="change-this-key" \
npm run dev
```

## Validate Remote Backend

```bash
BACKEND_URL="https://example.trycloudflare.com" \
LAYER8_API_KEY="change-this-key" \
npm run check:backend
```

## Build

```bash
npm run build
```

Vercel settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

## Main UI Areas

- RGB Camera
- Thermal Camera
- Point Cloud
- Presence Sensor
- System Status
- Console Log
- Execution Controls
- View Layout modal and custom layout builder

## Security Note

The API key is demo-level protection because Vercel browser environment variables are visible in the built frontend. For production-grade protection, put Cloudflare Access, VPN/private tunnel, or an auth proxy in front of the Jetson backend.
