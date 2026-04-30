import { create } from 'zustand';
import { emptyDashboardSnapshot } from '@/data/initial/emptyDashboardSnapshot';
import { dashboardApi } from '@/services/dashboardApi';
import type { LayoutPreset, FocusView, LayoutStyle, CustomLayoutModules, UiPreferences } from '@/types/layout';
import type { DashboardSnapshot } from '@/types/domain';

const STORAGE_KEY = 'scanu-layer8-ui-prefs';

const defaultModules: CustomLayoutModules = {
  rgb: true,
  thermal: true,
  pointCloud: true,
  presence: true,
  systemStatus: true,
  execution: true,
  consoleLog: true,
};

interface DashboardStore extends UiPreferences {
  snapshot: DashboardSnapshot;
  setSnapshot: (snapshot: DashboardSnapshot) => void;
  updateSnapshot: (updater: (current: DashboardSnapshot) => DashboardSnapshot) => void;
  setPreviewLayout: (layout: LayoutPreset) => void;
  applyLayout: (layout: LayoutPreset) => void;
  applyPreviewLayout: () => void;
  setFocusView: (focus: FocusView) => void;
  toggleCustomModule: (key: keyof CustomLayoutModules) => void;
  setLayoutStyle: (style: LayoutStyle) => void;
  hydratePrefs: () => Promise<void>;
}

const defaultPrefs: UiPreferences = {
  appliedLayout: 'Triple View',
  previewLayout: 'Triple View',
  focusView: 'rgb',
  layoutStyle: 'grid',
  customModules: defaultModules,
};

function migrateLayoutPreset(layout: unknown): LayoutPreset | undefined {
  if (layout === '1 Camera') return 'Visual Detection';
  if (layout === '2 Cameras') return 'Visual + Thermal';
  if (layout === 'RGB + Point Cloud') return 'Visual Detection + Point Cloud';
  if (layout === 'Thermal + Point Cloud') return 'Thermal Cam + Point Cloud';
  return typeof layout === 'string' ? (layout as LayoutPreset) : undefined;
}

function normalizePrefs(parsed: Partial<UiPreferences>): UiPreferences {
  return {
    appliedLayout: migrateLayoutPreset(parsed.appliedLayout) ?? defaultPrefs.appliedLayout,
    previewLayout: migrateLayoutPreset(parsed.previewLayout) ?? defaultPrefs.previewLayout,
    focusView: parsed.focusView ?? defaultPrefs.focusView,
    layoutStyle: parsed.layoutStyle ?? defaultPrefs.layoutStyle,
    customModules: {
      ...defaultPrefs.customModules,
      ...(parsed.customModules ?? {}),
    },
  };
}

function loadPrefs(): UiPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return normalizePrefs(parsed);
  } catch {
    return defaultPrefs;
  }
}

function savePrefs(prefs: UiPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best effort only.
  }
  void dashboardApi.saveUiPrefs(prefs);
}

const prefs = loadPrefs();

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  appliedLayout: prefs.appliedLayout,
  previewLayout: prefs.previewLayout,
  focusView: prefs.focusView,
  layoutStyle: prefs.layoutStyle,
  snapshot: emptyDashboardSnapshot,
  customModules: prefs.customModules,
  setSnapshot: (snapshot) => set({ snapshot }),
  updateSnapshot: (updater) =>
    set((state) => ({
      snapshot: updater(state.snapshot),
    })),
  hydratePrefs: async () => {
    const remote = await dashboardApi.fetchUiPrefs();
    if (!remote) return;
    const normalized = normalizePrefs(remote);
    set(normalized);
    savePrefs(normalized);
  },
  setPreviewLayout: (previewLayout) => {
    set({ previewLayout });
    const state = get();
    savePrefs({
      appliedLayout: state.appliedLayout,
      previewLayout,
      focusView: state.focusView,
      layoutStyle: state.layoutStyle,
      customModules: state.customModules,
    });
  },
  applyLayout: (layout) => {
    set({ appliedLayout: layout, previewLayout: layout });
    const state = get();
    savePrefs({
      appliedLayout: state.appliedLayout,
      previewLayout: state.previewLayout,
      focusView: state.focusView,
      layoutStyle: state.layoutStyle,
      customModules: state.customModules,
    });
  },
  applyPreviewLayout: () => {
    set((state) => ({ appliedLayout: state.previewLayout }));
    const state = get();
    savePrefs({
      appliedLayout: state.appliedLayout,
      previewLayout: state.previewLayout,
      focusView: state.focusView,
      layoutStyle: state.layoutStyle,
      customModules: state.customModules,
    });
  },
  setFocusView: (focusView) => {
    set({ focusView });
    const state = get();
    savePrefs({
      appliedLayout: state.appliedLayout,
      previewLayout: state.previewLayout,
      focusView,
      layoutStyle: state.layoutStyle,
      customModules: state.customModules,
    });
  },
  toggleCustomModule: (key) => {
    set((state) => ({
      customModules: {
        ...state.customModules,
        [key]: !state.customModules[key],
      },
    }));
    const state = get();
    savePrefs({
      appliedLayout: state.appliedLayout,
      previewLayout: state.previewLayout,
      focusView: state.focusView,
      layoutStyle: state.layoutStyle,
      customModules: state.customModules,
    });
  },
  setLayoutStyle: (layoutStyle) => {
    set({ layoutStyle });
    const state = get();
    savePrefs({
      appliedLayout: state.appliedLayout,
      previewLayout: state.previewLayout,
      focusView: state.focusView,
      layoutStyle,
      customModules: state.customModules,
    });
  },
}));
