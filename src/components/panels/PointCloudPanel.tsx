import { useState } from 'react';
import { Radar } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { CollapsibleControls } from '@/components/shared/CollapsibleControls';
import { PanelCard } from '@/components/shared/PanelCard';
import { StatusChip } from '@/components/shared/StatusChip';
import { cn } from '@/lib/cn';
import { dashboardApi } from '@/services/dashboardApi';
import { useDashboardStore } from '@/store/dashboardStore';

type MmwaveAction = 'run' | 'stop' | 'restart' | 'status';

interface PointCloudPanelProps {
  compactFrame?: boolean;
}

function formatMeters(value: number): string {
  return `${value.toFixed(1)}m`;
}

function getResultMessage(result: Record<string, unknown>): string {
  const message = result.message ?? result.detail ?? result.status ?? result.state ?? result.reason ?? result.error;
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof result.running === 'boolean') return result.running ? 'Running' : 'Stopped';
  if (typeof result.success === 'boolean') return result.success ? 'OK' : 'Failed';
  if (typeof result.ok === 'boolean') return result.ok ? 'OK' : 'Failed';
  return 'OK';
}

export function PointCloudPanel({ compactFrame = false }: PointCloudPanelProps) {
  const pointCloud = useDashboardStore((state) => state.snapshot.pointCloud);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<MmwaveAction | null>(null);
  const [controlText, setControlText] = useState('mmWave controls ready.');
  const renderPoints = pointCloud.renderPoints;
  const hasPoints = renderPoints.length > 0;
  const nearestPoint = hasPoints
    ? renderPoints.reduce((nearest, point) => (point.distanceMeters < nearest.distanceMeters ? point : nearest))
    : null;
  const trackedPoints = pointCloud.trackedPoints;
  const updateAgeSeconds = pointCloud.lastUpdateMs / 1000;
  const updateRateHz = pointCloud.updateRateHz;
  const frameClassName = compactFrame ? 'aspect-[16/8]' : 'aspect-[4/3]';

  const runMmwaveAction = async (action: MmwaveAction) => {
    setPendingAction(action);
    try {
      const result =
        action === 'run'
          ? await dashboardApi.runMmwave()
          : action === 'stop'
            ? await dashboardApi.stopMmwave()
            : action === 'restart'
              ? await dashboardApi.restartMmwave()
              : await dashboardApi.fetchMmwaveStatus();

      setControlText(`${action}: ${getResultMessage(result)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      setControlText(`${action}: FAILED (${message})`);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <PanelCard title="Point Cloud" icon={<Radar className="h-4 w-4" />}>
      <div className="mb-3 flex flex-wrap gap-2">
        <StatusChip label={hasPoints ? 'Live Points' : 'No Points'} tone={hasPoints ? 'cyan' : 'amber'} />
        <StatusChip label={pointCloud.stale ? 'Waiting' : 'Fresh'} tone={pointCloud.stale ? 'slate' : 'green'} />
      </div>
      <div className="relative overflow-hidden rounded-[1.2rem] border border-cyan-400/10 bg-[radial-gradient(circle_at_50%_92%,rgba(45,212,191,0.18),transparent_32%),linear-gradient(180deg,#08111f,#05070e)]">
        <div className={cn('relative', frameClassName)}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute left-[8%] right-[8%] top-[12%] border-t border-dashed border-cyan-200/10" />
          <div className="absolute left-[8%] right-[8%] top-[50%] border-t border-dashed border-cyan-200/10" />
          <div className="absolute left-[8%] right-[8%] top-[88%] border-t border-cyan-200/15" />
          <div className="absolute left-1/2 top-[12%] h-[76%] border-l border-cyan-200/10" />
          <div className="absolute bottom-[7%] left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-cyan-300/20 shadow-[0_0_22px_rgba(34,211,238,0.35)]" />
          <div className="absolute left-[9%] top-[10%] text-[10px] uppercase tracking-[0.18em] text-slate-600">6m</div>
          <div className="absolute left-[9%] top-[48%] text-[10px] uppercase tracking-[0.18em] text-slate-600">3m</div>
          <div className="absolute bottom-[7%] left-[9%] text-[10px] uppercase tracking-[0.18em] text-slate-600">-3m</div>
          <div className="absolute bottom-[7%] right-[9%] text-[10px] uppercase tracking-[0.18em] text-slate-600">+3m</div>
          {hasPoints ? (
            renderPoints.map((point) => (
              <span
                key={point.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
                title={`x ${formatMeters(point.xMeters)}, y ${formatMeters(point.yMeters)}, z ${formatMeters(point.zMeters)}`}
                style={{
                  left: point.left,
                  top: point.top,
                  width: point.size,
                  height: point.size,
                  opacity: point.opacity,
                  backgroundColor: point.color,
                  boxShadow: `0 0 18px ${point.color}`,
                }}
              />
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-400">
              No point cloud data from backend
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-4">
        <span>Points {trackedPoints}</span>
        <span>Nearest {nearestPoint ? formatMeters(nearestPoint.distanceMeters) : 'none'}</span>
        <span>Update {updateAgeSeconds.toFixed(1)}s</span>
        <span>Rate {updateRateHz.toFixed(1)} Hz</span>
      </div>
      <CollapsibleControls open={controlsOpen} onToggle={() => setControlsOpen((open) => !open)} status={controlText}>
        <div className="grid gap-2 sm:grid-cols-4">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void runMmwaveAction('run')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'run' ? 'Starting...' : 'Run'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runMmwaveAction('stop')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'stop' ? 'Stopping...' : 'Stop'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runMmwaveAction('restart')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'restart' ? 'Restarting...' : 'Restart'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runMmwaveAction('status')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'status' ? 'Checking...' : 'Status'}
          </Button>
        </div>
      </CollapsibleControls>
    </PanelCard>
  );
}
