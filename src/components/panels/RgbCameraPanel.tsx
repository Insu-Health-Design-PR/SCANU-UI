import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { CollapsibleControls } from '@/components/shared/CollapsibleControls';
import { PanelCard } from '@/components/shared/PanelCard';
import { StatusChip } from '@/components/shared/StatusChip';
import { cn } from '@/lib/cn';
import { dashboardApi } from '@/services/dashboardApi';
import { useDashboardStore } from '@/store/dashboardStore';

type AiCameraAction = 'run' | 'stop' | 'restart' | 'status';

interface RgbCameraPanelProps {
  compactFrame?: boolean;
}

function getResultMessage(result: Record<string, unknown>): string {
  const message = result.message ?? result.detail ?? result.status ?? result.state ?? result.error;
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof result.ok === 'boolean') return result.ok ? 'OK' : 'Failed';
  return 'OK';
}

export function RgbCameraPanel({ compactFrame = false }: RgbCameraPanelProps) {
  const rgb = useDashboardStore((state) => state.snapshot.rgb);
  const imageSrc = dashboardApi.aiCameraPreviewUrl();
  const [streamError, setStreamError] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AiCameraAction | null>(null);
  const [controlText, setControlText] = useState('Visual detection controls ready.');

  const hasFeed = Boolean(imageSrc) && !streamError;
  const frameClassName = compactFrame ? 'aspect-[16/8]' : 'aspect-[4/3]';

  const runAiCameraAction = async (action: AiCameraAction) => {
    setPendingAction(action);
    try {
      const result =
        action === 'run'
          ? await dashboardApi.runAiCamera()
          : action === 'stop'
            ? await dashboardApi.stopAiCamera()
            : action === 'restart'
              ? await dashboardApi.restartAiCamera()
              : await dashboardApi.fetchAiCameraStatus();

      setControlText(`${action}: ${getResultMessage(result)}`);
      if (action === 'run' || action === 'restart') setStreamError(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      setControlText(`${action}: FAILED (${message})`);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <PanelCard title="Visual Detection" icon={<Camera className="h-4 w-4" />}>
      <div className="mb-3 flex flex-wrap gap-2">
        <StatusChip label={hasFeed ? 'Live Feed' : 'No Feed'} tone={hasFeed ? 'cyan' : 'amber'} />
      </div>
      <div className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-slate-950">
        {hasFeed ? (
          <img
            src={imageSrc}
            alt="Visual detection stream"
            className={cn(frameClassName, 'w-full object-cover')}
            onError={() => setStreamError(true)}
            onLoad={() => setStreamError(false)}
          />
        ) : (
          <div className={cn('flex items-center justify-center bg-slate-950 px-4 text-center text-sm text-slate-400', frameClassName)}>
            No visual detection stream from backend
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
        <span>{rgb.resolution}</span>
        <span>|</span>
        <span>{rgb.fps} FPS</span>
        <span>|</span>
        <span>{rgb.status}</span>
        <span>|</span>
        <span>Latency {rgb.latencyMs} ms</span>
      </div>
      <CollapsibleControls open={controlsOpen} onToggle={() => setControlsOpen((open) => !open)} status={controlText}>
        <div className="grid gap-2 sm:grid-cols-4">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void runAiCameraAction('run')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'run' ? 'Starting...' : 'Run'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runAiCameraAction('stop')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'stop' ? 'Stopping...' : 'Stop'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runAiCameraAction('restart')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'restart' ? 'Restarting...' : 'Restart'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runAiCameraAction('status')}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'status' ? 'Checking...' : 'Status'}
          </Button>
        </div>
      </CollapsibleControls>
    </PanelCard>
  );
}
