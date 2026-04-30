import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { CustomLayoutBuilder } from '@/components/view-layout/CustomLayoutBuilder';
import type { CustomLayoutModules, FocusView, LayoutPreset, LayoutStyle } from '@/types/layout';

interface LayoutPreviewModalProps {
  open: boolean;
  layout: LayoutPreset;
  onBack: () => void;
  onClose: () => void;
  onApply: () => void;
  customModules: CustomLayoutModules;
  layoutStyle: LayoutStyle;
  focusView: FocusView;
  onToggleModule: (key: keyof CustomLayoutModules) => void;
  onSelectStyle: (style: LayoutStyle) => void;
  onSelectFocusView: (focusView: FocusView) => void;
}

function Frame({ title, subtitle, className = '' }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/15 bg-[linear-gradient(180deg,rgba(10,18,32,0.86),rgba(6,10,18,0.82))] p-4 ${className}`}>
      <div className="text-base font-medium text-slate-100">{title}</div>
      {subtitle ? <div className="mt-2 text-sm text-slate-400">{subtitle}</div> : null}
    </div>
  );
}

function OptionalInfo({ text }: { text: string }) {
  return <Frame title="Optional info below:" subtitle={text} className="min-h-20" />;
}

function CustomPreview({
  modules,
  layoutStyle,
  focusView,
}: {
  modules: CustomLayoutModules;
  layoutStyle: LayoutStyle;
  focusView: FocusView;
}) {
  const orderedModules = [
    modules.rgb ? { id: 'rgb', label: 'Visual Detection' } : null,
    modules.thermal ? { id: 'thermal', label: 'Thermal Cam' } : null,
    modules.pointCloud ? { id: 'pointCloud', label: 'Point Cloud' } : null,
    modules.presence ? { id: 'presence', label: 'Presence Sensor' } : null,
  ].filter(Boolean) as Array<{ id: FocusView; label: string }>;

  const focused = orderedModules.find((module) => module.id === focusView) ?? orderedModules[0];
  const others = orderedModules.filter((module) => module.id !== focused?.id);

  const utilityModules = [
    modules.systemStatus ? 'System Status' : null,
    modules.execution ? 'Execution Controls' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {orderedModules.length === 0 ? (
        <Frame title="No primary modules selected" subtitle="Enable at least one camera, point cloud, or presence module." />
      ) : layoutStyle === 'fullscreen' ? (
        <>
          <Frame title={focused.label} subtitle="fullscreen main panel" className="aspect-[16/6]" />
          {others.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {others.map((module) => (
                <Frame key={module.id} title={module.label} className="aspect-video" />
              ))}
            </div>
          ) : null}
        </>
      ) : layoutStyle === 'focus' ? (
        <>
          <Frame title={focused.label} subtitle="focused main panel" className="aspect-[16/6]" />
          {others.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {others.map((module) => (
                <Frame key={module.id} title={module.label} className="aspect-video" />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orderedModules.map((module) => (
            <Frame key={module.id} title={module.label} className="aspect-video" />
          ))}
        </div>
      )}

      {utilityModules.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {utilityModules.map((name) => (
            <Frame key={name} title={name} />
          ))}
        </div>
      ) : null}

      {modules.consoleLog ? <Frame title="Console Log" subtitle="trigger log / system events" /> : null}
    </div>
  );
}

function PresetPreview({
  layout,
  customModules,
  layoutStyle,
  focusView,
}: {
  layout: LayoutPreset;
  customModules: CustomLayoutModules;
  layoutStyle: LayoutStyle;
  focusView: FocusView;
}) {
  if (layout === 'Visual Detection') {
    return (
      <div className="space-y-4">
        <Frame title="Visual Detection" subtitle="large preview" className="aspect-[16/7]" />
        <OptionalInfo text="Presence Sensor | System Status | minimal controls" />
      </div>
    );
  }

  if (layout === 'Thermal Cam') {
    return (
      <div className="space-y-4">
        <Frame title="Thermal Cam" subtitle="large preview" className="aspect-[16/7]" />
        <OptionalInfo text="Presence Sensor | System Status | minimal controls" />
      </div>
    );
  }

  if (layout === 'Visual + Thermal') {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Frame title="Visual Detection" subtitle="large preview" className="aspect-video" />
          <Frame title="Thermal Cam" subtitle="large preview" className="aspect-video" />
        </div>
        <OptionalInfo text="Presence Sensor | System Status | minimal controls" />
      </div>
    );
  }

  if (layout === 'Visual Detection + Point Cloud') {
    return (
      <div className="space-y-4">
        <Frame title="Visual Detection" subtitle="live stream" className="aspect-video" />
        <Frame title="Point Cloud" subtitle="3D / radar visualization" className="aspect-[16/6]" />
      </div>
    );
  }

  if (layout === 'Thermal Cam + Point Cloud') {
    return (
      <div className="space-y-4">
        <Frame title="Thermal Cam" subtitle="live thermal stream" className="aspect-video" />
        <Frame title="Point Cloud" subtitle="3D / radar visualization" className="aspect-[16/6]" />
      </div>
    );
  }

  if (layout === 'Point Cloud Only') {
    return (
      <div className="space-y-4">
        <Frame title="Point Cloud" subtitle="full screen radar scene" className="aspect-[16/6]" />
        <OptionalInfo text="Presence Sensor | Status | small controls" />
      </div>
    );
  }

  if (layout === 'Custom Combination') {
    return <CustomPreview modules={customModules} layoutStyle={layoutStyle} focusView={focusView} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Frame title="Visual Detection" className="aspect-video" />
        <Frame title="Thermal Cam" className="aspect-video" />
      </div>
      <Frame title="Point Cloud" className="aspect-[16/6]" />
      <Frame title="Presence Sensor | Status | Execution" />
    </div>
  );
}

export function LayoutPreviewModal({
  open,
  layout,
  onBack,
  onClose,
  onApply,
  customModules,
  layoutStyle,
  focusView,
  onToggleModule,
  onSelectStyle,
  onSelectFocusView,
}: LayoutPreviewModalProps) {
  const [flashPreview, setFlashPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const handlePreviewLayout = () => {
    setFlashPreview(true);
    setTimeout(() => setFlashPreview(false), 420);
    const node = document.getElementById('layout-preview-canvas');
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-slate-950/88 p-3 py-4 backdrop-blur-sm sm:p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="layout-preview-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-7xl overflow-y-auto rounded-[1.25rem] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,19,32,0.98),rgba(8,13,23,0.96))] p-4 shadow-panel sm:rounded-[2rem] sm:p-5"
          >
            <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 sm:flex-row sm:items-center">
              <h3 id="layout-preview-title" className="text-xl font-medium text-white sm:text-2xl">
                Layout Preview: {layout}
              </h3>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
                <Button
                  data-testid="apply-layout"
                  variant="primary"
                  size="md"
                  onClick={onApply}
                >
                  Apply Layout
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onBack}
                >
                  Back
                </Button>
                <Button
                  data-testid="close-layout-preview"
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                >
                  Close
                </Button>
                <button
                  aria-label="Close layout preview"
                  onClick={onClose}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={`grid gap-4 ${layout === 'Custom Combination' ? 'xl:grid-cols-[2fr_1fr]' : 'xl:grid-cols-1'}`}>
              <div
                id="layout-preview-canvas"
                className={`rounded-[1.5rem] border bg-[linear-gradient(180deg,#0a1221,#060a12)] p-5 transition ${
                  flashPreview ? 'border-cyan-300/55 shadow-[0_0_0_1px_rgba(103,232,249,0.45),0_0_34px_rgba(34,211,238,0.18)]' : 'border-white/10'
                }`}
              >
                <PresetPreview layout={layout} customModules={customModules} layoutStyle={layoutStyle} focusView={focusView} />
              </div>

              {layout === 'Custom Combination' ? (
                <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                  <CustomLayoutBuilder
                    modules={customModules}
                    layoutStyle={layoutStyle}
                    focusView={focusView}
                    onToggleModule={onToggleModule}
                    onSelectStyle={onSelectStyle}
                    onSelectFocusView={onSelectFocusView}
                    onPreviewLayout={handlePreviewLayout}
                  />
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
