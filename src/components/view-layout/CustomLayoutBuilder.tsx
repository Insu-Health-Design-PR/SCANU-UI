import { Button } from '@/components/shared/Button';
import type { CustomLayoutModules, FocusView, LayoutStyle } from '@/types/layout';

interface CustomLayoutBuilderProps {
  modules: CustomLayoutModules;
  layoutStyle: LayoutStyle;
  focusView: FocusView;
  onToggleModule: (key: keyof CustomLayoutModules) => void;
  onSelectStyle: (style: LayoutStyle) => void;
  onSelectFocusView: (focusView: FocusView) => void;
  onPreviewLayout: () => void;
}

export function CustomLayoutBuilder({
  modules,
  layoutStyle,
  focusView,
  onToggleModule,
  onSelectStyle,
  onSelectFocusView,
  onPreviewLayout,
}: CustomLayoutBuilderProps) {
  const moduleKeys = Object.keys(modules) as Array<keyof CustomLayoutModules>;
  const labels: Record<keyof CustomLayoutModules, string> = {
    rgb: 'Visual Detection',
    thermal: 'Thermal Cam',
    pointCloud: 'Point Cloud',
    presence: 'Presence Sensor',
    systemStatus: 'System Status',
    execution: 'Execution Panel',
    consoleLog: 'Console Log',
  };
  const styleLabels: Record<LayoutStyle, string> = {
    grid: 'Grid',
    focus: 'Focus',
    fullscreen: 'Fullscreen Main',
  };

  const focusCandidates: Array<{ key: FocusView; label: string; enabled: boolean }> = [
    { key: 'rgb', label: 'Visual Detection', enabled: modules.rgb },
    { key: 'thermal', label: 'Thermal Cam', enabled: modules.thermal },
    { key: 'pointCloud', label: 'Point Cloud', enabled: modules.pointCloud },
    { key: 'presence', label: 'Presence Sensor', enabled: modules.presence },
  ];

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <div className="text-sm font-medium text-white">Custom Combination</div>
        <div className="mt-3 grid gap-2">
          {moduleKeys.map((key) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface-700/50 px-3 py-2 text-sm text-slate-200"
            >
              <span>{labels[key]}</span>
              <input
                type="checkbox"
                checked={modules[key]}
                onChange={() => onToggleModule(key)}
                className="h-4 w-4 accent-cyan-400"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-white">Layout style</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['grid', 'focus', 'fullscreen'] as LayoutStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onSelectStyle(style)}
              className={
                style === layoutStyle
                  ? 'rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200'
                  : 'rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300'
              }
            >
              {styleLabels[style]}
            </button>
          ))}
        </div>
      </div>

      {(layoutStyle === 'focus' || layoutStyle === 'fullscreen') && (
        <div>
          <div className="text-sm font-medium text-white">Main module</div>
          <div className="mt-3 grid gap-2">
            {focusCandidates.map((candidate) => (
              <Button
                key={candidate.key}
                variant={candidate.key === focusView ? 'primary' : 'secondary'}
                disabled={!candidate.enabled}
                onClick={() => onSelectFocusView(candidate.key)}
                className="justify-start"
              >
                {candidate.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="primary"
        className="w-full"
        onClick={onPreviewLayout}
      >
        Preview Layout
      </Button>
    </div>
  );
}
