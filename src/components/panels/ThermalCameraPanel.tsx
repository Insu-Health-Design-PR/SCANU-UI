import { useEffect, useMemo, useState } from 'react';
import { Maximize2, Thermometer } from 'lucide-react';
import { PanelCard } from '@/components/shared/PanelCard';
import { StatusChip } from '@/components/shared/StatusChip';
import { dashboardApi, type ThermalStatusResponse } from '@/services/dashboardApi';
import { useDashboardStore } from '@/store/dashboardStore';

type ThermalAction = 'run' | 'stop' | 'restart' | 'auto';

function getStatusLabel(status: ThermalStatusResponse | null): string {
  if (!status) return 'Status unknown';
  if (typeof status.status === 'string') return status.status;
  if (typeof status.state === 'string') return status.state;
  if (typeof status.running === 'boolean') return status.running ? 'Running' : 'Stopped';
  return 'Status ready';
}

function getDeviceLabel(status: ThermalStatusResponse | null): string {
  const device = status?.thermal_device ?? status?.device;
  return typeof device === 'string' && device.trim() ? device : 'No device reported';
}

export function ThermalCameraPanel() {
  const thermal = useDashboardStore((state) => state.snapshot.thermal);
  const streamUrl = useMemo(() => dashboardApi.thermalPreviewUrl(), []);
  const [streamError, setStreamError] = useState(false);
  const [thermalStatus, setThermalStatus] = useState<ThermalStatusResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<ThermalAction | null>(null);
  const [controlText, setControlText] = useState('Thermal controls ready.');
  const imageSrc = thermal.frameBase64 ? `data:image/jpeg;base64,${thermal.frameBase64}` : streamUrl;
  const hasFeed = Boolean(imageSrc) && !streamError;
  const statusLabel = getStatusLabel(thermalStatus);
  const isRunning = thermalStatus?.running === true || statusLabel.toLowerCase().includes('run');

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;

    const loadStatus = async () => {
      try {
        const next = await dashboardApi.fetchThermalStatus();
        if (!disposed) setThermalStatus(next);
      } catch {
        if (!disposed) setThermalStatus(null);
      }
    };

    void loadStatus();
    timer = window.setInterval(loadStatus, 3000);

    return () => {
      disposed = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  const runThermalAction = async (action: ThermalAction) => {
    setPendingAction(action);
    try {
      const result =
        action === 'run'
          ? await dashboardApi.runThermal()
          : action === 'stop'
            ? await dashboardApi.stopThermal()
            : action === 'restart'
              ? await dashboardApi.restartThermal()
              : await dashboardApi.autoConfigureThermal();
      const message = result.message ?? result.detail ?? result.status ?? 'OK';
      setControlText(`${action}: ${message}`);
      const nextStatus = await dashboardApi.fetchThermalStatus();
      setThermalStatus(nextStatus);
      if (action === 'run' || action === 'restart' || action === 'auto') setStreamError(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      setControlText(`${action}: FAILED (${message})`);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <PanelCard title="Thermal Cam" icon={<Thermometer className="h-4 w-4" />} action={<Maximize2 className="h-4 w-4 text-slate-500" />}>
      <div className="mb-3 flex flex-wrap gap-2">
        <StatusChip label={hasFeed ? 'MJPEG Feed' : 'No Feed'} tone={hasFeed ? 'cyan' : 'amber'} />
        <StatusChip label={statusLabel} tone={isRunning ? 'cyan' : 'slate'} />
        {thermal.stale && thermal.frameBase64 && !streamError ? <StatusChip label="Stale" tone="red" /> : null}
      </div>
      <div className="overflow-hidden rounded-[1.2rem] border border-orange-400/10 bg-slate-950">
        {hasFeed ? (
          <img
            src={imageSrc}
            alt="Thermal stream"
            className="aspect-[16/9] w-full object-cover"
            onError={() => setStreamError(true)}
            onLoad={() => setStreamError(false)}
          />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center bg-slate-950 px-4 text-center text-sm text-slate-400">
            No thermal stream from backend
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
        <span>Thermal</span>
        <span>|</span>
        <span>{thermal.fps} FPS</span>
        <span>|</span>
        <span>{thermal.status}</span>
        <span>|</span>
        <span>Latency {thermal.latencyMs} ms</span>
      </div>
      <div className="mt-3 text-xs text-slate-400">{getDeviceLabel(thermalStatus)}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <button
          onClick={() => void runThermalAction('run')}
          disabled={pendingAction !== null}
          className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60"
        >
          {pendingAction === 'run' ? 'Starting...' : 'Run'}
        </button>
        <button
          onClick={() => void runThermalAction('stop')}
          disabled={pendingAction !== null}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
        >
          {pendingAction === 'stop' ? 'Stopping...' : 'Stop'}
        </button>
        <button
          onClick={() => void runThermalAction('restart')}
          disabled={pendingAction !== null}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
        >
          {pendingAction === 'restart' ? 'Restarting...' : 'Restart'}
        </button>
        <button
          onClick={() => void runThermalAction('auto')}
          disabled={pendingAction !== null}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
        >
          {pendingAction === 'auto' ? 'Detecting...' : 'Auto'}
        </button>
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-slate-400">{controlText}</div>
    </PanelCard>
  );
}
