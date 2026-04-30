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
  if (!Array.isArray(raw) || raw.length === 0) return [];

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

  if (parsed.length === 0) return [];

  const xs = parsed.map((p) => p.x);
  const ys = parsed.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;

  return parsed.map((p) => {
    const nx = (p.x - minX) / dx;
    const ny = (p.y - minY) / dy;
    const depthInfluence = Math.max(0, Math.min(1, 1 - Math.abs(p.z) / 6));
    return {
      id: p.idx,
      left: `${8 + nx * 84}%`,
      top: `${10 + (1 - ny) * 74}%`,
      size: `${2 + depthInfluence * 3}px`,
      opacity: 0.3 + depthInfluence * 0.55,
    };
  });
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
  };
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
      const [status, aiCameraStatus, thermalStatus, metrics, mmwave] = await Promise.all([
        fetchJson<BackendStatusResponse>(`${API_BASE}/api/status`),
        fetchJson<SensorStatusResponse>(`${API_BASE}/api/ai_camera/status`),
        fetchJson<SensorStatusResponse>(`${API_BASE}/api/thermal/status`),
        fetchJson<DashboardMetricsResponse>(`${API_BASE}/api/dashboard/metrics`),
        fetchJson<MmwavePreviewResponse>(`${API_BASE}/api/preview/output/mmwave`),
      ]);
      return applyFreshness(toDashboardSnapshot(status, aiCameraStatus, thermalStatus, metrics, mmwave));
    } catch {
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
    component: 'thermal' | 'ai_camera',
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
};
