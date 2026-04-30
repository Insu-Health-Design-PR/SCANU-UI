import { useState } from 'react';
import { Play } from 'lucide-react';
import { PanelCard } from '@/components/shared/PanelCard';
import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/shared/Button';
import { dashboardApi } from '@/services/dashboardApi';
import { useDashboardStore } from '@/store/dashboardStore';

export function ExecutionControlsPanel() {
  const mode = useDashboardStore((state) => state.snapshot.mode);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string>('Ready.');

  const runControl = async (action: 'start' | 'stop' | 'reconfigure' | 'reset') => {
    setPendingAction(action);
    try {
      const result =
        action === 'start'
          ? await dashboardApi.runAll()
          : action === 'stop'
            ? await dashboardApi.stopAll()
            : action === 'reconfigure'
              ? await dashboardApi.restartAll()
              : await dashboardApi.reset();
      const success = typeof result.success === 'boolean' ? result.success : true;
      const reason = typeof result.reason === 'string' ? result.reason : '';
      const actionName = typeof result.action === 'string' ? result.action : action;
      setResultText(`${actionName}: ${success ? 'OK' : 'FAILED'}${reason ? ` (${reason})` : ''}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      setResultText(`${action}: FAILED (${message})`);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <PanelCard title="Execution Controls" icon={<Play className="h-4 w-4" />}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button
          variant="primary"
          size="lg"
          onClick={() => void runControl('start')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'start' ? 'Starting...' : 'Start'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void runControl('stop')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'stop' ? 'Stopping...' : 'Stop'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void runControl('reconfigure')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'reconfigure' ? 'Reconfiguring...' : 'Reconfigure'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void runControl('reset')}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'reset' ? 'Resetting...' : 'Reset'}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusChip label={mode === 'live' ? 'Live' : 'Simulated'} tone={mode === 'live' ? 'cyan' : 'slate'} />
        <StatusChip label="All Sensors" tone="slate" />
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
        {resultText}
      </div>
    </PanelCard>
  );
}
