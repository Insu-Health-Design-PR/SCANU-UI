import { useEffect, useMemo, useState } from 'react';
import { ViewLayoutButton } from '@/components/view-layout/ViewLayoutButton';
import { dashboardApi } from '@/services/dashboardApi';
import { useDashboardStore } from '@/store/dashboardStore';

interface ApiRunRecord {
  id: string;
  label: string;
  status: 'ok' | 'fail';
  at: number;
}

export function TopBar() {
  const snapshot = useDashboardStore((state) => state.snapshot);
  const tempScenes = useDashboardStore((state) => state.tempScenes);
  const applyQuickMode = useDashboardStore((state) => state.applyQuickMode);
  const createTempScene = useDashboardStore((state) => state.createTempScene);
  const applyTempScene = useDashboardStore((state) => state.applyTempScene);
  const deleteTempScene = useDashboardStore((state) => state.deleteTempScene);
  const cleanupExpiredScenes = useDashboardStore((state) => state.cleanupExpiredScenes);
  const modeLabel = snapshot.mode === 'live' ? 'Live' : 'Simulated';
  const healthLabel = snapshot.health.healthy ? 'Healthy' : 'Fault';
  const [menuOpen, setMenuOpen] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [ttlMinutes, setTtlMinutes] = useState(10);
  const [apiResult, setApiResult] = useState('Ready.');
  const [apiResultStatus, setApiResultStatus] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle');
  const [apiResultPayload, setApiResultPayload] = useState('');
  const [apiHistory, setApiHistory] = useState<ApiRunRecord[]>([]);
  const [endpointFilter, setEndpointFilter] = useState('');
  const [sensorId, setSensorId] = useState('radar_main');
  const [profileName, setProfileName] = useState('default');
  const [offerSdp, setOfferSdp] = useState('');
  const [activeTab, setActiveTab] = useState<'scenes' | 'ops' | 'config'>('scenes');

  const sortedScenes = useMemo(
    () => [...tempScenes].sort((a, b) => a.expiresAt - b.expiresAt),
    [tempScenes],
  );

  const handleSaveScene = () => {
    createTempScene(sceneName, ttlMinutes);
    setSceneName('');
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    cleanupExpiredScenes();
    setMenuOpen(true);
    setActiveTab('scenes');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
      if (event.key === '1') applyQuickMode('focus-rgb');
      if (event.key === '2') applyQuickMode('focus-thermal');
      if (event.key === '3') applyQuickMode('dual');
      if (event.key === '4') applyQuickMode('sensors');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyQuickMode]);

  const runApiAction = async (label: string, fn: () => Promise<unknown>) => {
    setApiResult(`${label}: running...`);
    setApiResultStatus('running');
    setApiResultPayload('');
    try {
      const payload = await fn();
      setApiResult(`${label}: OK`);
      setApiResultStatus('ok');
      setApiResultPayload(JSON.stringify(payload, null, 2));
      setApiHistory((current) =>
        [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, status: 'ok' as const, at: Date.now() }, ...current].slice(0, 10),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setApiResult(`${label}: FAILED (${message})`);
      setApiResultStatus('fail');
      setApiResultPayload(JSON.stringify({ error: message }, null, 2));
      setApiHistory((current) =>
        [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, status: 'fail' as const, at: Date.now() }, ...current].slice(0, 10),
      );
    }
  };

  const copyApiResult = async () => {
    if (!apiResultPayload) return;
    try {
      await navigator.clipboard.writeText(apiResultPayload);
      setApiResult('Respuesta copiada.');
    } catch {
      setApiResult('No se pudo copiar la respuesta.');
    }
  };

  const filteredApiHistory = useMemo(() => {
    const query = endpointFilter.trim().toLowerCase();
    if (!query) return apiHistory;
    return apiHistory.filter((item) => item.label.toLowerCase().includes(query));
  }, [apiHistory, endpointFilter]);

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 rounded-panel border border-white/10 bg-[linear-gradient(180deg,rgba(12,19,32,0.84),rgba(8,13,23,0.76))] px-5 py-4 shadow-panel backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[2.1rem] font-medium tracking-tight text-white md:text-[2.35rem]">SCAN-U Monitor</h1>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => applyQuickMode('focus-rgb')}
              className="rounded-full px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              RGB
            </button>
            <button
              type="button"
              onClick={() => applyQuickMode('focus-thermal')}
              className="rounded-full px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Thermal
            </button>
            <button
              type="button"
              onClick={() => applyQuickMode('dual')}
              className="rounded-full px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Dual
            </button>
            <button
              type="button"
              onClick={() => applyQuickMode('sensors')}
              className="rounded-full px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Sensors
            </button>
          </div>
          <button
            type="button"
            onContextMenu={handleContextMenu}
            onClick={() => {
              cleanupExpiredScenes();
              setMenuOpen((prev) => !prev);
            }}
            className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
            title="Click derecho para escenas temporales"
          >
            Quick Scenes
          </button>
          <ViewLayoutButton />
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
            <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.85)]" />
            <span>{modeLabel}</span>
            <span className="text-slate-500">|</span>
            <span>{healthLabel}</span>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30 p-4" onClick={() => setMenuOpen(false)}>
          <div
            className="ml-auto w-full max-w-md rounded-panel border border-white/10 bg-[linear-gradient(180deg,rgba(12,19,32,0.96),rgba(8,13,23,0.94))] p-4 shadow-panel backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Escenas temporales</h3>
              <button type="button" onClick={() => setMenuOpen(false)} className="text-xs text-slate-400 transition hover:text-slate-200">
                Cerrar
              </button>
            </div>
            <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('scenes')}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  activeTab === 'scenes' ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Scenes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ops')}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  activeTab === 'ops' ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Ops
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  activeTab === 'config' ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Config
              </button>
            </div>
            {activeTab === 'scenes' ? (
              <>
                <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={sceneName}
                    onChange={(event) => setSceneName(event.target.value)}
                    placeholder="Nombre de escena"
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                  <select
                    value={ttlMinutes}
                    onChange={(event) => setTtlMinutes(Number(event.target.value))}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-slate-100 outline-none"
                  >
                    <option value={5}>5m</option>
                    <option value={10}>10m</option>
                    <option value={30}>30m</option>
                    <option value={60}>60m</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveScene}
                    className="rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/22"
                  >
                    Guardar
                  </button>
                </div>
                <div className="space-y-2">
                  {sortedScenes.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay escenas temporales activas.</p>
                  ) : (
                    sortedScenes.map((scene) => (
                      <div key={scene.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div>
                          <p className="text-sm text-slate-100">{scene.name}</p>
                          <p className="text-xs text-slate-400">Expira: {new Date(scene.expiresAt).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => applyTempScene(scene.id)}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                          >
                            Aplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTempScene(scene.id)}
                            className="rounded-md border border-red-400/20 bg-red-400/10 px-2 py-1 text-xs text-red-100 transition hover:bg-red-400/18"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : null}

            {activeTab === 'ops' ? (
              <div className="space-y-3">
                <details open className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <summary className="cursor-pointer list-none text-xs uppercase tracking-wide text-slate-300">AI Camera</summary>
                  <div className="mt-2">
                  <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      placeholder="profile_name"
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void runApiAction('POST /api/ai_camera/profiles/apply_by_name', () =>
                          dashboardApi.applyAiCameraProfileByName(profileName),
                        )
                      }
                      className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/ai_camera/profiles', () => dashboardApi.fetchAiCameraProfiles())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Profiles
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('POST /api/ai_camera/run', () => dashboardApi.runAiCamera())}
                      className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('POST /api/ai_camera/stop', () => dashboardApi.stopAiCamera())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Stop
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('POST /api/ai_camera/restart', () => dashboardApi.restartAiCamera())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Restart
                    </button>
                  </div>
                  </div>
                </details>

                <details open className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <summary className="cursor-pointer list-none text-xs uppercase tracking-wide text-slate-300">Sensor y Streams</summary>
                  <div className="mt-2">
                  <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={sensorId}
                      onChange={(event) => setSensorId(event.target.value)}
                      placeholder="sensor id"
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/status/{sensor}', () => dashboardApi.fetchSensorStatus(sensorId))}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Status
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/command/{sensor}', () => dashboardApi.fetchSensorCommand(sensorId))}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Command
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => window.open(dashboardApi.webcamDirectLiveUrl(), '_blank', 'noopener,noreferrer')}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Webcam Direct
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(dashboardApi.thermalDirectLiveUrl(), '_blank', 'noopener,noreferrer')}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Thermal Direct
                    </button>
                  </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => window.open(dashboardApi.webcamEmbedUrl(), '_blank', 'noopener,noreferrer')}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Webcam Embed
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(dashboardApi.thermalEmbedUrl(), '_blank', 'noopener,noreferrer')}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Thermal Embed
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(dashboardApi.statusStreamUrl(), '_blank', 'noopener,noreferrer')}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Status Stream
                      </button>
                    </div>
                  </div>
                </details>

                <details className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <summary className="cursor-pointer list-none text-xs uppercase tracking-wide text-slate-300">WebRTC Test</summary>
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={offerSdp}
                      onChange={(event) => setOfferSdp(event.target.value)}
                      placeholder="Paste SDP offer"
                      className="h-20 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500"
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void runApiAction('POST /api/webrtc/webcam/offer', () => dashboardApi.createWebrtcWebcamOffer(offerSdp))}
                        className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                      >
                        Webcam Offer
                      </button>
                      <button
                        type="button"
                        onClick={() => void runApiAction('POST /api/webrtc/ai_camera/offer', () => dashboardApi.createWebrtcAiCameraOffer(offerSdp))}
                        className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                      >
                        AI Offer
                      </button>
                      <button
                        type="button"
                        onClick={() => void runApiAction('POST /api/ai_camera/webrtc/offer', () => dashboardApi.createAiCameraWebrtcOffer(offerSdp))}
                        className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                      >
                        AI Alt Offer
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}

            {activeTab === 'config' ? (
              <div className="space-y-3">
                <details open className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <summary className="cursor-pointer list-none text-xs uppercase tracking-wide text-slate-300">Config</summary>
                  <div className="mt-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/config', () => dashboardApi.fetchConfig())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Load Config
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('POST /api/config/reset', () => dashboardApi.resetConfig())}
                      className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-xs text-amber-100 transition hover:bg-amber-400/20"
                    >
                      Reset Config
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('POST /api/config/reset/model', () => dashboardApi.resetModelConfig())}
                      className="rounded-md border border-red-400/20 bg-red-400/10 px-2 py-1.5 text-xs text-red-100 transition hover:bg-red-400/20"
                    >
                      Reset Model
                    </button>
                  </div>
                  </div>
                </details>
                <details open className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <summary className="cursor-pointer list-none text-xs uppercase tracking-wide text-slate-300">Model y Discovery</summary>
                  <div className="mt-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/model/options', () => dashboardApi.fetchModelOptions())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Model Options
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/model/profiles', () => dashboardApi.fetchModelProfiles())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Model Profiles
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('POST /api/model/profiles/sync_from_config', () => dashboardApi.syncModelProfilesFromConfig())}
                      className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Sync Profiles
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/layer8/module_map', () => dashboardApi.fetchModuleMap())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Module Map
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/devices/v4l2', () => dashboardApi.fetchV4l2Devices())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      V4L2
                    </button>
                    <button
                      type="button"
                      onClick={() => void runApiAction('GET /api/devices/serial', () => dashboardApi.fetchSerialDevices())}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      Serial
                    </button>
                  </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void runApiAction('GET /api/devices/v4l2/formats', () => dashboardApi.fetchV4l2Formats())}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        V4L2 Formats
                      </button>
                      <button
                        type="button"
                        onClick={() => void runApiAction('GET /api/system/metrics', () => dashboardApi.fetchSystemMetrics())}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        System Metrics
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}

            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${
                      apiResultStatus === 'ok'
                        ? 'bg-cyan-300'
                        : apiResultStatus === 'fail'
                          ? 'bg-red-300'
                          : apiResultStatus === 'running'
                            ? 'bg-amber-300'
                            : 'bg-slate-500'
                    }`}
                  />
                  <span>{apiResult}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void copyApiResult()}
                  disabled={!apiResultPayload}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copiar JSON
                </button>
              </div>
              <pre className="max-h-28 overflow-auto rounded-md border border-white/10 bg-slate-950/70 p-2 text-[10px] leading-relaxed text-slate-300">
                {apiResultPayload || '{\n  "status": "idle"\n}'}
              </pre>
              <div className="mt-2 rounded-md border border-white/10 bg-slate-950/40 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Historial</p>
                  <input
                    value={endpointFilter}
                    onChange={(event) => setEndpointFilter(event.target.value)}
                    placeholder="filtrar endpoint"
                    className="w-36 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </div>
                <div className="max-h-24 space-y-1 overflow-auto">
                  {filteredApiHistory.length === 0 ? (
                    <p className="text-[10px] text-slate-500">Sin ejecuciones.</p>
                  ) : (
                    filteredApiHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                        <p className="truncate pr-2 text-[10px] text-slate-300">{item.label}</p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={item.status === 'ok' ? 'text-cyan-300' : 'text-red-300'}>{item.status.toUpperCase()}</span>
                          <span className="text-slate-500">{new Date(item.at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
