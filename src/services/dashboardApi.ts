import type { DashboardSnapshot, RenderPoint } from '@/types/domain';
import type { UiPreferences } from '@/types/layout';
import { emptyDashboardSnapshot } from '@/data/initial/emptyDashboardSnapshot';

type AlertLevel = 'info' | 'warning' | 'fault';

interface BackendStatusResponse {
  state: string;
  fused_score: number;
  confidence: number;
  health: {
    has_fault?: boolean;
    sensor_online_count?: number;
  };
  active_radars?: string[];
}

interface SensorStatusResponse {
  running?: boolean;
  status?: string;
  state?: string;
}

interface DashboardMetricsResponse {
  fused_score?: number;
  confidence?: number;
  healthy?: boolean;
  connected?: boolean;
  active_sensors?: number;
  sensor_count?: number;
  tracked_points?: number;
  presence_detected?: boolean;
  presence_confidence?: number;
}

interface MmwavePreviewResponse {
  point_cloud?: unknown[];
  presence?: boolean | { detected?: boolean; confidence?: number } | null;
  timestamp_ms?: number;
}

interface CameraWsPayload {
  timestamp_ms?: number;
  rgb_jpeg_b64?: string;
  thermal_jpeg_b64?: string;
  frame_b64?: string;
  image_b64?: string;
}

interface WeaponWsPayload {
  state?: string;
  fused_score?: number;
  gun_detected?: boolean;
  unsafe_score?: number;
  weapon_confidence?: number;
  micro_doppler_bw?: number;
  doppler_centroid?: number;
  azimuth_static_peak?: number;
}

interface ControlResult {
  radar_id?: string;
  action?: string;
  success?: boolean;
  reason?: string | null;
  details?: string | null;
}

export interface ThermalStatusResponse {
  running?: boolean;
  status?: string;
  state?: string;
  enabled?: boolean;
  thermal_device?: string | null;
  device?: string | null;
  message?: string;
  [key: string]: unknown;
}

export interface ThermalControlResult {
  success?: boolean;
  status?: string;
  message?: string;
  detail?: string;
  [key: string]: unknown;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function resolveApiBase(): string {
  const envApiBase = import.meta.env.VITE_LAYER8_API_BASE as string | undefined;
  if (typeof window === 'undefined') return envApiBase ?? 'http://127.0.0.1:8088';

  const browserHost = window.location.hostname;
  const browserIsLocal = isLoopbackHost(browserHost);
  const localDefault = 'http://127.0.0.1:8088';
  const sameHostDefault = `${window.location.protocol}//${browserHost}:8088`;

  return envApiBase ?? (browserIsLocal ? localDefault : sameHostDefault);
}

const API_BASE = resolveApiBase();
const PREFS_ENDPOINT = `${API_BASE}/api/ui/preferences`;
const API_KEY = (import.meta.env.VITE_LAYER8_API_KEY as string | undefined)?.trim() ?? '';

function authHeaders(extra?: HeadersInit): HeadersInit {
  return API_KEY ? { ...extra, 'X-Layer8-Api-Key': API_KEY } : (extra ?? {});
}

function mediaUrl(path: string): string {
  const url = new URL(path, API_BASE);
  if (API_KEY) url.searchParams.set('token', API_KEY);
  return url.toString();
}

function wsUrl(path: string): string {
  const baseWs = API_BASE.replace(/^http/i, 'ws');
  const url = new URL(path, baseWs);
  if (API_KEY) url.searchParams.set('token', API_KEY);
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: authHeaders({ Accept: 'application/json' }) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

async function postEmpty<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

async function putJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

function toAlertLevel(level: string | undefined): AlertLevel {
  if (level === 'fault') return 'fault';
  if (level === 'warning') return 'warning';
  return 'info';
}

/**
 * Get numeric field from object with fallback keys
 * @example getNumericField(obj, 'x', 'x_m', 'pos_x')
 */
function getNumericField(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number') return val;
  }
  return null;
}

function toRenderPoints(raw: unknown[]): RenderPoint[] {
  console.log('[RENDER-POINTS] 🎯 Input:', raw.length, 'points');
  if (!Array.isArray(raw) || raw.length === 0) {
    console.log('[RENDER-POINTS] ⚠️ Empty or not array');
    return [];
  }

  const parsed = raw
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const x = getNumericField(obj, 'x', 'x_m', 'pos_x');
      const y = getNumericField(obj, 'y', 'y_m', 'pos_y');
      const z = getNumericField(obj, 'z', 'z_m', 'pos_z') ?? 0;
      if (x === null || y === null) return null;
      return { idx, x, y, z };
    })
    .filter(Boolean) as Array<{ idx: number; x: number; y: number; z: number }>;

  if (parsed.length === 0) {
    console.log('[RENDER-POINTS] ❌ No valid points after parsing');
    return [];
  }
  
  console.log('[RENDER-POINTS] ✅ Parsed:', parsed.length, 'valid points');

  const xs = parsed.map((p) => p.x);
  const ys = parsed.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;

  const result = parsed.map((p) => {
    const nx = (p.x - minX) / dx;
    const ny = (p.y - minY) / dy;
    const depthInfluence = Math.max(0, Math.min(1, 1 - Math.abs(p.z) / 6));
    const distanceMeters = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    return {
      id: p.idx,
      left: `${8 + nx * 84}%`,
      top: `${10 + (1 - ny) * 74}%`,
      size: `${2 + depthInfluence * 3}px`,
      opacity: 0.3 + depthInfluence * 0.55,
      xMeters: p.x,
      yMeters: p.y,
      zMeters: p.z,
      distanceMeters,
      color: `hsl(${200 + depthInfluence * 40}, 80%, ${50 + depthInfluence * 20}%)`,
    };
  });
  console.log('[RENDER-POINTS] 🎨 Final render points:', result.length, '- bounds x:[', minX.toFixed(2), ',', maxX.toFixed(2), '] y:[', minY.toFixed(2), ',', maxY.toFixed(2), ']');
  return result;
}

function toDashboardSnapshot(
  status: BackendStatusResponse,
  aiCameraStatus: SensorStatusResponse,
  thermalStatus: SensorStatusResponse,
  metrics: DashboardMetricsResponse,
  mmwave: MmwavePreviewResponse,
): DashboardSnapshot {
  const sensorCount = Math.max(metrics.sensor_count ?? 0, status.active_radars?.length ?? 0, 1);
  const onlineCount = Math.max(metrics.active_sensors ?? 0, status.active_radars?.length ?? 0, 0);
  const nowMs = Date.now();
  const timestampMs = mmwave.timestamp_ms ?? nowMs;
  const pointCloudRaw = Array.isArray(mmwave.point_cloud) ? mmwave.point_cloud : [];
  console.log('[SNAPSHOT-BUILD] 📊 Processing snapshot - points:', pointCloudRaw.length, 'presence:', mmwave.presence);
  const detected =
    typeof mmwave.presence === 'boolean'
      ? mmwave.presence
      : typeof mmwave.presence === 'object' && mmwave.presence !== null
        ? Boolean(mmwave.presence.detected)
        : false;
  const presenceConfidence =
    typeof mmwave.presence === 'object' && mmwave.presence !== null && typeof mmwave.presence.confidence === 'number'
      ? mmwave.presence.confidence
      : metrics.presence_confidence ?? (detected ? 0.8 : 0.0);

  const rgbRunning = aiCameraStatus.running === true || `${aiCameraStatus.status ?? aiCameraStatus.state ?? ''}`.toLowerCase().includes('run');
  const thermalRunning = thermalStatus.running === true || `${thermalStatus.status ?? thermalStatus.state ?? ''}`.toLowerCase().includes('run');

  return {
    mode: 'live',
    state: (status.state ?? 'UNKNOWN') as DashboardSnapshot['state'],
    health: {
      connected: metrics.connected ?? onlineCount > 0,
      configured: onlineCount > 0,
      streaming: onlineCount > 0,
      healthy: metrics.healthy ?? !Boolean(status.health?.has_fault),
      activeSensors: onlineCount,
      sensorCount,
      fusedScore: metrics.fused_score ?? status.fused_score ?? 0,
      confidence: metrics.confidence ?? status.confidence ?? 0,
    },
    rgb: {
      label: 'Visual Detection',
      resolution: '1080p',
      fps: 30,
      status: rgbRunning ? 'streaming' : 'paused',
      latencyMs: Math.max(0, nowMs - timestampMs),
      frameBase64: null,
      source: 'live',
      stale: !rgbRunning,
      lastFrameAtMs: timestampMs,
    },
    thermal: {
      label: 'Thermal Cam',
      resolution: '640x480',
      fps: 30,
      status: thermalRunning ? 'streaming' : 'paused',
      latencyMs: Math.max(0, nowMs - timestampMs),
      frameBase64: null,
      source: 'live',
      stale: !thermalRunning,
      lastFrameAtMs: timestampMs,
    },
    pointCloud: {
      trackedPoints: pointCloudRaw.length,
      confidence: status.confidence ?? 0,
      lastUpdateMs: Math.max(0, nowMs - timestampMs),
      updateRateHz: 0,
      source: 'live',
      stale: pointCloudRaw.length === 0,
      lastFrameAtMs: timestampMs,
      renderPoints: toRenderPoints(pointCloudRaw),
    },
    presence: {
      detected,
      confidence: presenceConfidence,
      lastTriggerIso: detected ? new Date(timestampMs).toISOString() : '',
      timeline: Array.from({ length: 30 }, () => Math.round(presenceConfidence * 100)),
    },
    alerts: [],
    weapon: {
      state: (status.state ?? 'IDLE') as DashboardSnapshot['weapon']['state'],
      fusedScore: status.fused_score ?? 0,
      gunDetected: false,
      unsafeScore: 0,
      weaponConfidence: 0,
      microDopplerBw: 0,
      dopplerCentroid: 0,
      azimuthStaticPeak: 0,
    },
  };
}

// SSE stream state
let latestMmwaveData: MmwavePreviewResponse | null = null;
let mmwaveEventSource: EventSource | null = null;

// Weapon WebSocket
let eventsSocket: WebSocket | null = null;
let latestWeaponData: WeaponWsPayload | null = null;

function initEventsSocket(): void {
  if (eventsSocket && eventsSocket.readyState === WebSocket.OPEN) return;
  const wsBase = API_BASE.replace(/^http/, 'ws');
  const url = `${wsBase}/ws/events`;
  eventsSocket = new WebSocket(url);
  eventsSocket.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.event_type === 'weapon_update' && msg.payload) {
        latestWeaponData = msg.payload as WeaponWsPayload;
      }
      if (msg.event_type === 'status_update' && msg.payload) {
        const sp = msg.payload;
        if (!latestWeaponData) latestWeaponData = {};
        latestWeaponData.state = sp.state ?? latestWeaponData.state;
        latestWeaponData.fused_score = sp.fused_score ?? latestWeaponData.fused_score;
      }
    } catch { /* ignore parse errors */ }
  };
  eventsSocket.onclose = () => {
    eventsSocket = null;
    setTimeout(() => initEventsSocket(), 3000);
  };
}

function closeEventsSocket(): void {
  if (eventsSocket) {
    eventsSocket.onclose = null;
    eventsSocket.close();
    eventsSocket = null;
  }
}

function applyWeaponUpdate(snapshot: DashboardSnapshot): DashboardSnapshot {
  const w = latestWeaponData;
  if (!w) return snapshot;
  return {
    ...snapshot,
    weapon: {
      state: (w.state ?? snapshot.weapon.state) as DashboardSnapshot['weapon']['state'],
      fusedScore: w.fused_score ?? snapshot.weapon.fusedScore,
      gunDetected: w.gun_detected ?? snapshot.weapon.gunDetected,
      unsafeScore: w.unsafe_score ?? snapshot.weapon.unsafeScore,
      weaponConfidence: w.weapon_confidence ?? snapshot.weapon.weaponConfidence,
      microDopplerBw: w.micro_doppler_bw ?? snapshot.weapon.microDopplerBw,
      dopplerCentroid: w.doppler_centroid ?? snapshot.weapon.dopplerCentroid,
      azimuthStaticPeak: w.azimuth_static_peak ?? snapshot.weapon.azimuthStaticPeak,
    },
  };
}

function initMmwaveStream(): void {
  console.log('[INIT-MMWAVE] Starting stream initialization...');
  console.log('[INIT-MMWAVE] Current API_BASE:', API_BASE);
  
  if (mmwaveEventSource) {
    console.log('[INIT-MMWAVE] EventSource already exists, skipping');
    return;
  }
  
  const mmwaveUrl = `${API_BASE}/api/mmwave/output/stream`;
  console.log('[INIT-MMWAVE] Connecting to:', mmwaveUrl);
  
  mmwaveEventSource = new EventSource(mmwaveUrl);
  console.log('[INIT-MMWAVE] EventSource created, waiting for messages...');
  
  mmwaveEventSource.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[MMWAVE-MSG] ✅ Event received - frame:', data.frame, 'points:', data.points?.length || 0, 'ts:', data.ts);
      
      // Transform stream format to expected format
      // Note: data.ts comes in seconds (Unix timestamp), convert to milliseconds
      const timestampMs = data.ts ? Math.floor(data.ts * 1000) : Date.now();
      const pointCloud = data.points || [];
      const presence = data.presence ?? (data.num_objects > 0);
      
      console.log('[MMWAVE-MSG] 📊 Transformed:', { points: pointCloud.length, presence, ts: timestampMs });
      
      latestMmwaveData = {
        point_cloud: pointCloud,
        presence,
        timestamp_ms: timestampMs,
      };
    } catch (error) {
      console.error('[MMWAVE-MSG] ❌ Failed to parse:', error, 'Raw:', event.data?.substring(0, 100));
    }
  };
  
  mmwaveEventSource.onerror = (err) => {
    console.error('[MMWAVE-ERROR] ❌ Stream error:', err);
    console.error('[MMWAVE-ERROR] EventSource readyState:', mmwaveEventSource?.readyState);
    closeMmwaveStream();
    console.log('[MMWAVE-ERROR] 🔄 Reconnecting in 3s...');
    setTimeout(() => initMmwaveStream(), 3000);
  };
}

function closeMmwaveStream(): void {
  if (mmwaveEventSource) {
    console.log('[CLOSE-MMWAVE] Closing EventSource');
    mmwaveEventSource.close();
    mmwaveEventSource = null;
  }
}

function getMmwaveData(): MmwavePreviewResponse {
  const data = latestMmwaveData || { point_cloud: [], presence: false, timestamp_ms: Date.now() };
  if (latestMmwaveData === null) {
    console.log('[GET-MMWAVE] ⚠️ No data yet, returning empty');
  } else {
    console.log('[GET-MMWAVE] ✅ Returning', (data.point_cloud as unknown[])?.length || 0, 'points');
  }
  return data;
}

function applyFreshness(snapshot: DashboardSnapshot, staleThresholdMs = 7000): DashboardSnapshot {
  const now = Date.now();
  const rgbStale = now - snapshot.rgb.lastFrameAtMs > staleThresholdMs;
  const thermalStale = now - snapshot.thermal.lastFrameAtMs > staleThresholdMs;
  const pcStale = now - snapshot.pointCloud.lastFrameAtMs > staleThresholdMs;

  return {
    ...snapshot,
    rgb: {
      ...snapshot.rgb,
      stale: rgbStale,
      status: rgbStale ? 'fault' : snapshot.rgb.status,
      latencyMs: Math.max(0, now - snapshot.rgb.lastFrameAtMs),
    },
    thermal: {
      ...snapshot.thermal,
      stale: thermalStale,
      status: thermalStale ? 'fault' : snapshot.thermal.status,
      latencyMs: Math.max(0, now - snapshot.thermal.lastFrameAtMs),
    },
    pointCloud: {
      ...snapshot.pointCloud,
      stale: pcStale,
      lastUpdateMs: Math.max(0, now - snapshot.pointCloud.lastFrameAtMs),
    },
  };
}

function toUnavailableSnapshot(reason: string): DashboardSnapshot {
  const now = Date.now();
  return {
    ...emptyDashboardSnapshot,
    rgb: { ...emptyDashboardSnapshot.rgb, lastFrameAtMs: now, latencyMs: 0 },
    thermal: { ...emptyDashboardSnapshot.thermal, lastFrameAtMs: now, latencyMs: 0 },
    pointCloud: { ...emptyDashboardSnapshot.pointCloud, lastFrameAtMs: now, lastUpdateMs: 0 },
    alerts: [
      {
        id: `backend-unreachable-${now}`,
        level: 'fault',
        timestamp: new Date(now).toLocaleTimeString(),
        message: `Backend unavailable: ${reason}`,
      },
    ],
  };
}

function parseCameraWsPayload(input: string): CameraWsPayload | null {
  try {
    const parsed = JSON.parse(input) as CameraWsPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function frameFromPayload(payload: CameraWsPayload, kind: 'webcam' | 'thermal'): string | null {
  if (kind === 'webcam') {
    return payload.rgb_jpeg_b64 ?? payload.frame_b64 ?? payload.image_b64 ?? null;
  }
  return payload.thermal_jpeg_b64 ?? payload.frame_b64 ?? payload.image_b64 ?? null;
}

function applyCameraWsFrame(snapshot: DashboardSnapshot, kind: 'webcam' | 'thermal', payload: CameraWsPayload): DashboardSnapshot {
  const frame = frameFromPayload(payload, kind);
  if (!frame) return snapshot;
  const now = Date.now();
  const ts = typeof payload.timestamp_ms === 'number' ? payload.timestamp_ms : now;

  if (kind === 'webcam') {
    return {
      ...snapshot,
      rgb: {
        ...snapshot.rgb,
        frameBase64: frame,
        status: 'streaming',
        stale: false,
        lastFrameAtMs: ts,
        latencyMs: Math.max(0, now - ts),
      },
    };
  }

  return {
    ...snapshot,
    thermal: {
      ...snapshot.thermal,
      frameBase64: frame,
      status: 'streaming',
      stale: false,
      lastFrameAtMs: ts,
      latencyMs: Math.max(0, now - ts),
    },
  };
}

export const dashboardApi = {
  apiBase: API_BASE,

  async fetchSnapshot(): Promise<DashboardSnapshot> {
    try {
      const [status, aiCameraStatus, thermalStatus, metrics] = await Promise.all([
        fetchJson<BackendStatusResponse>(`${API_BASE}/api/status`),
        fetchJson<SensorStatusResponse>(`${API_BASE}/api/ai_camera/status`),
        fetchJson<SensorStatusResponse>(`${API_BASE}/api/thermal/status`),
        fetchJson<DashboardMetricsResponse>(`${API_BASE}/api/dashboard/metrics`),
      ]);
      
      // Use latest data from SSE stream
      const mmwave = getMmwaveData();
      
      let snapshot = applyFreshness(toDashboardSnapshot(status, aiCameraStatus, thermalStatus, metrics, mmwave));
      snapshot = applyWeaponUpdate(snapshot);
      return snapshot;
    } catch (error) {
      console.error('Failed to fetch snapshot:', error);
      return toUnavailableSnapshot('backend unreachable');
    }
  },

  webcamSocketUrl(): string {
    return wsUrl('/ws/webcam');
  },

  thermalSocketUrl(): string {
    return wsUrl('/ws/thermal');
  },

  parseCameraWsPayload,

  applyWebcamWsFrame(snapshot: DashboardSnapshot, payload: CameraWsPayload): DashboardSnapshot {
    return applyCameraWsFrame(snapshot, 'webcam', payload);
  },

  applyThermalWsFrame(snapshot: DashboardSnapshot, payload: CameraWsPayload): DashboardSnapshot {
    return applyCameraWsFrame(snapshot, 'thermal', payload);
  },

  applyFreshness,

  thermalPreviewUrl(): string {
    return mediaUrl('/api/thermal/preview/live');
  },

  async fetchThermalConfig(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/thermal/config`);
  },

  async updateThermalConfig(thermal: Record<string, unknown>): Promise<Record<string, unknown>> {
    return putJson<Record<string, unknown>>(`${API_BASE}/api/thermal/config`, { thermal });
  },

  async autoConfigureThermal(): Promise<ThermalControlResult> {
    return postEmpty<ThermalControlResult>(`${API_BASE}/api/thermal/auto_configure`);
  },

  async fetchThermalStatus(): Promise<ThermalStatusResponse> {
    return fetchJson<ThermalStatusResponse>(`${API_BASE}/api/thermal/status`);
  },

  /**
   * Generic method to control thermal or ai_camera component
   * @param component 'thermal' | 'ai_camera'
   * @param action 'run' | 'stop' | 'restart'
   */
  async controlComponent<T = ThermalControlResult>(
    component: 'thermal' | 'ai_camera' | 'mmwave',
    action: 'run' | 'stop' | 'restart',
  ): Promise<T> {
    return postEmpty<T>(`${API_BASE}/api/${component}/${action}`);
  },

  // Convenience shortcuts
  async runThermal(): Promise<ThermalControlResult> {
    return this.controlComponent('thermal', 'run');
  },

  async stopThermal(): Promise<ThermalControlResult> {
    return this.controlComponent('thermal', 'stop');
  },

  async restartThermal(): Promise<ThermalControlResult> {
    return this.controlComponent('thermal', 'restart');
  },

  async runMmwave(): Promise<Record<string, unknown>> {
    return this.controlComponent('mmwave', 'run');
  },

  async stopMmwave(): Promise<Record<string, unknown>> {
    return this.controlComponent('mmwave', 'stop');
  },

  async restartMmwave(): Promise<Record<string, unknown>> {
    return this.controlComponent('mmwave', 'restart');
  },

  async fetchMmwaveStatus(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/status/mmwave`);
  },

  async fetchUiPrefs(): Promise<Partial<UiPreferences> | null> {
    try {
      return await fetchJson<Partial<UiPreferences>>(PREFS_ENDPOINT);
    } catch {
      return null;
    }
  },

  async saveUiPrefs(prefs: UiPreferences): Promise<void> {
    try {
      await postJson(PREFS_ENDPOINT, prefs as unknown as Record<string, unknown>);
    } catch {
      // Best effort only.
    }
  },

  async start(radarId = 'radar_main'): Promise<ControlResult> {
    return postEmpty<ControlResult>(`${API_BASE}/api/run/${encodeURIComponent(radarId)}`);
  },

  async stop(radarId = 'radar_main'): Promise<ControlResult> {
    return postEmpty<ControlResult>(`${API_BASE}/api/stop/${encodeURIComponent(radarId)}`);
  },

  async reconfigure(radarId = 'radar_main'): Promise<ControlResult> {
    return postEmpty<ControlResult>(`${API_BASE}/api/restart/${encodeURIComponent(radarId)}`);
  },

  async reset(radarId = 'radar_main'): Promise<ControlResult> {
    return postEmpty<ControlResult>(`${API_BASE}/api/config/reset/${encodeURIComponent(radarId)}`);
  },

  async runAll(): Promise<Record<string, unknown>> {
    return postEmpty<Record<string, unknown>>(`${API_BASE}/api/run_all`);
  },

  async stopAll(): Promise<Record<string, unknown>> {
    return postEmpty<Record<string, unknown>>(`${API_BASE}/api/stop_all`);
  },

  async restartAll(): Promise<Record<string, unknown>> {
    return postEmpty<Record<string, unknown>>(`${API_BASE}/api/restart_all`);
  },

  async fetchSystemMetrics(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/system/metrics`);
  },

  async fetchConfig(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/config`);
  },

  async updateConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return putJson<Record<string, unknown>>(`${API_BASE}/api/config`, config);
  },

  async resetConfig(): Promise<Record<string, unknown>> {
    return postEmpty<Record<string, unknown>>(`${API_BASE}/api/config/reset`);
  },

  async resetModelConfig(): Promise<Record<string, unknown>> {
    return postEmpty<Record<string, unknown>>(`${API_BASE}/api/config/reset/model`);
  },

  async fetchDashboardMetrics(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/dashboard/metrics`);
  },

  async fetchV4l2Devices(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/devices/v4l2`);
  },

  async fetchV4l2Formats(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/devices/v4l2/formats`);
  },

  async fetchSerialDevices(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/devices/serial`);
  },

  async fetchModelOptions(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/model/options`);
  },

  async fetchModelProfiles(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/model/profiles`);
  },

  async updateModelProfiles(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return putJson<Record<string, unknown>>(`${API_BASE}/api/model/profiles`, payload);
  },

  async applyModelProfile(profileName: string): Promise<Record<string, unknown>> {
    return postJson<Record<string, unknown>>(`${API_BASE}/api/model/profiles/apply`, { profile_name: profileName });
  },

  async snapshotModelProfile(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return postJson<Record<string, unknown>>(`${API_BASE}/api/model/profiles/snapshot`, payload);
  },

  async syncModelProfilesFromConfig(): Promise<Record<string, unknown>> {
    return postEmpty<Record<string, unknown>>(`${API_BASE}/api/model/profiles/sync_from_config`);
  },

  async fetchAiCameraProfiles(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/ai_camera/profiles`);
  },

  async applyAiCameraProfileByName(profileName: string): Promise<Record<string, unknown>> {
    return postJson<Record<string, unknown>>(`${API_BASE}/api/ai_camera/profiles/apply_by_name`, { profile_name: profileName });
  },

  async fetchAiCameraStatus(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/ai_camera/status`);
  },

  async fetchAiCameraConfig(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/ai_camera/config`);
  },

  async updateAiCameraConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return putJson<Record<string, unknown>>(`${API_BASE}/api/ai_camera/config`, config);
  },

  async runAiCamera(): Promise<Record<string, unknown>> {
    return this.controlComponent('ai_camera', 'run');
  },

  async stopAiCamera(): Promise<Record<string, unknown>> {
    return this.controlComponent('ai_camera', 'stop');
  },

  async restartAiCamera(): Promise<Record<string, unknown>> {
    return this.controlComponent('ai_camera', 'restart');
  },

  async fetchModuleMap(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/layer8/module_map`);
  },

  async fetchSensorCommand(sensor: string): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/command/${encodeURIComponent(sensor)}`);
  },

  async fetchSensorStatus(sensor: string): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/api/status/${encodeURIComponent(sensor)}`);
  },

  statusStreamUrl(): string {
    return mediaUrl('/api/status/stream');
  },

  sensorVideoUrl(sensor: string): string {
    return mediaUrl(`/api/preview/video/${encodeURIComponent(sensor)}`);
  },

  sensorLiveUrl(sensor: string): string {
    return mediaUrl(`/api/preview/live/${encodeURIComponent(sensor)}`);
  },

  thermalDirectLiveUrl(): string {
    return mediaUrl('/api/preview/live_direct/thermal');
  },

  webcamDirectLiveUrl(): string {
    return mediaUrl('/api/preview/live_direct/webcam');
  },

  thermalEmbedUrl(): string {
    return mediaUrl('/embed/thermal');
  },

  webcamEmbedUrl(): string {
    return mediaUrl('/embed/webcam');
  },

  async createWebrtcWebcamOffer(offer: string): Promise<Record<string, unknown>> {
    return postJson<Record<string, unknown>>(`${API_BASE}/api/webrtc/webcam/offer`, { offer });
  },

  async createWebrtcAiCameraOffer(offer: string): Promise<Record<string, unknown>> {
    return postJson<Record<string, unknown>>(`${API_BASE}/api/webrtc/ai_camera/offer`, { offer });
  },

  async createAiCameraWebrtcOffer(offer: string): Promise<Record<string, unknown>> {
    return postJson<Record<string, unknown>>(`${API_BASE}/api/ai_camera/webrtc/offer`, { offer });
  },

  aiCameraPreviewUrl(): string {
    return mediaUrl('/api/ai_camera/preview/live');
  },

  initMmwaveStream,
  closeMmwaveStream,
  getMmwaveData,

  initEventsSocket,
  closeEventsSocket,
  applyWeaponUpdate,
};
