import { useMemo, useState } from 'react';
import { Maximize2, Thermometer } from 'lucide-react';
import { PanelCard } from '@/components/shared/PanelCard';
import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/shared/Button';
import { useAsync } from '@/hooks/useAsync';
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
  const [pendingAction, setPendingAction] = useState<ThermalAction | null>(null);
  const [controlText, setControlText] = useState('Thermal controls ready.');

  // Use generic async hook for polling thermal status
  const { data: thermalStatus } = useAsync(
    () => dashboardApi.fetchThermalStatus(),
    { interval: 3000 }
  );

  const imageSrc = thermal.frameBase64 ? `data:image/jpeg;base64,${thermal.frameBase64}` : streamUrl;
  const hasFeed = Boolean(imageSrc) && !streamError;
  const statusLabel = getStatusLabel(thermalStatus);
  const isRunning = thermalStatus?.running === true || statusLabel.toLowerCase().includes('run');

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
      // Manually trigger re-render with new status
      if (nextStatus) setControlText(`${action}: ${message} [Updated]`);
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
        <Button
          variant="primary"
          size="sm"
          onClick={() => void runThermalAction('run')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'run' ? 'Starting...' : 'Run'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void runThermalAction('stop')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'stop' ? 'Stopping...' : 'Stop'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void runThermalAction('restart')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'restart' ? 'Restarting...' : 'Restart'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void runThermalAction('auto')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'auto' ? 'Detecting...' : 'Auto'}
        </Button>
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-slate-400">{controlText}</div>
    </PanelCard>
  );
}
