import { PresenceSensorPanel } from '@/components/panels/PresenceSensorPanel';
import { PointCloudPanel } from '@/components/panels/PointCloudPanel';
import { RgbCameraPanel } from '@/components/panels/RgbCameraPanel';
import { ThermalCameraPanel } from '@/components/panels/ThermalCameraPanel';
import { ConsoleLogPanel } from '@/components/panels/ConsoleLogPanel';
import { ExecutionControlsPanel } from '@/components/panels/ExecutionControlsPanel';
import { SystemStatusPanel } from '@/components/panels/SystemStatusPanel';
import { useDashboardStore } from '@/store/dashboardStore';

type MainModuleId = 'rgb' | 'thermal' | 'pointCloud' | 'presence';

const MAIN_MODULE_ORDER: MainModuleId[] = ['rgb', 'thermal', 'pointCloud', 'presence'];

function renderMainModule(id: MainModuleId) {
  if (id === 'rgb') return <RgbCameraPanel key={id} />;
  if (id === 'thermal') return <ThermalCameraPanel key={id} />;
  if (id === 'pointCloud') return <PointCloudPanel key={id} />;
  return <PresenceSensorPanel key={id} />;
}

function EqualPair({ children }: { children: [JSX.Element, JSX.Element] }) {
  return <div className="grid gap-5 lg:grid-cols-2">{children}</div>;
}

function CustomCombinationView() {
  const { customModules, layoutStyle, focusView } = useDashboardStore((state) => ({
    customModules: state.customModules,
    layoutStyle: state.layoutStyle,
    focusView: state.focusView,
  }));

  const enabledMain = MAIN_MODULE_ORDER.filter((id) => customModules[id]);
  const focusModule = enabledMain.includes(focusView as MainModuleId) ? (focusView as MainModuleId) : enabledMain[0];
  const otherModules = enabledMain.filter((id) => id !== focusModule);
  const hasOps = customModules.systemStatus || customModules.execution;

  if (enabledMain.length === 0) {
    return (
      <div className="rounded-panel border border-white/10 bg-surface-800/70 p-6 text-sm text-slate-300">
        Enable at least one module in Custom Combination.
      </div>
    );
  }

  if (layoutStyle === 'focus' || layoutStyle === 'fullscreen') {
    return (
      <div className="space-y-5">
        {focusModule ? renderMainModule(focusModule) : null}
        {otherModules.length ? <div className="grid gap-5 lg:grid-cols-2">{otherModules.map((id) => renderMainModule(id))}</div> : null}
        {hasOps ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {customModules.systemStatus ? <SystemStatusPanel /> : null}
            {customModules.execution ? <ExecutionControlsPanel /> : null}
          </div>
        ) : null}
        {customModules.consoleLog ? <ConsoleLogPanel /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">{enabledMain.map((id) => renderMainModule(id))}</div>
      {hasOps ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {customModules.systemStatus ? <SystemStatusPanel /> : null}
          {customModules.execution ? <ExecutionControlsPanel /> : null}
        </div>
      ) : null}
      {customModules.consoleLog ? <ConsoleLogPanel /> : null}
    </div>
  );
}

function TripleView() {
  return (
    <div className="space-y-5">
      <EqualPair>
        {[<RgbCameraPanel key="rgb" />, <ThermalCameraPanel key="thermal" />]}
      </EqualPair>
      <EqualPair>
        {[<PointCloudPanel key="point-cloud" />, <PresenceSensorPanel key="presence" />]}
      </EqualPair>
    </div>
  );
}

export function LayoutRenderer() {
  const layout = useDashboardStore((state) => state.appliedLayout);

  switch (layout) {
    case 'Visual Detection':
      return <RgbCameraPanel />;
    case 'Thermal Cam':
      return <ThermalCameraPanel />;
    case 'Visual + Thermal':
      return (
        <EqualPair>
          {[<RgbCameraPanel key="rgb" />, <ThermalCameraPanel key="thermal" />]}
        </EqualPair>
      );
    case 'Visual Detection + Point Cloud':
      return (
        <EqualPair>
          {[<RgbCameraPanel key="rgb" />, <PointCloudPanel key="point-cloud" />]}
        </EqualPair>
      );
    case 'Thermal Cam + Point Cloud':
      return (
        <EqualPair>
          {[<ThermalCameraPanel key="thermal" />, <PointCloudPanel key="point-cloud" />]}
        </EqualPair>
      );
    case 'Point Cloud Only':
      return <PointCloudPanel />;
    case 'Custom Combination':
      return <CustomCombinationView />;
    case 'Triple View':
    default:
      return <TripleView />;
  }
}
