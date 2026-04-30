import { create } from 'zustand';
import { emptyDashboardSnapshot } from '@/data/initial/emptyDashboardSnapshot';
import { dashboardApi } from '@/services/dashboardApi';
import type { LayoutPreset, FocusView, LayoutStyle, CustomLayoutModules, UiPreferences, TempScene } from '@/types/layout';
import type { DashboardSnapshot } from '@/types/domain';

const STORAGE_KEY = 'scanu-layer8-ui-prefs';
const SCENES_STORAGE_KEY = 'scanu-layer8-temp-scenes';

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
  tempScenes: TempScene[];
  setSnapshot: (snapshot: DashboardSnapshot) => void;
  updateSnapshot: (updater: (current: DashboardSnapshot) => DashboardSnapshot) => void;
  setPreviewLayout: (layout: LayoutPreset) => void;
  applyLayout: (layout: LayoutPreset) => void;
  applyPreviewLayout: () => void;
  setFocusView: (focus: FocusView) => void;
  toggleCustomModule: (key: keyof CustomLayoutModules) => void;
  setCustomModules: (modules: CustomLayoutModules) => void;
  setLayoutStyle: (style: LayoutStyle) => void;
  applyQuickMode: (mode: 'minimal' | 'focus-rgb' | 'focus-thermal' | 'dual' | 'sensors' | 'ops') => void;
  createTempScene: (name: string, ttlMinutes: number) => void;
  applyTempScene: (sceneId: string) => void;
  deleteTempScene: (sceneId: string) => void;
  cleanupExpiredScenes: () => void;
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

function loadScenes(): TempScene[] {
  try {
    const raw = window.localStorage.getItem(SCENES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TempScene[];
    const now = Date.now();
    return parsed.filter((scene) => scene && typeof scene.expiresAt === 'number' && scene.expiresAt > now);
  } catch {
    return [];
  }
}

function saveScenes(scenes: TempScene[]) {
  try {
    window.localStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(scenes));
  } catch {
    // Best effort only.
  }
}

const prefs = loadPrefs();
const initialScenes = loadScenes();

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  appliedLayout: prefs.appliedLayout,
  previewLayout: prefs.previewLayout,
  focusView: prefs.focusView,
  layoutStyle: prefs.layoutStyle,
  snapshot: emptyDashboardSnapshot,
  tempScenes: initialScenes,
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
  setCustomModules: (customModules) => {
    set({ customModules });
    const state = get();
    savePrefs({
      appliedLayout: state.appliedLayout,
      previewLayout: state.previewLayout,
      focusView: state.focusView,
      layoutStyle: state.layoutStyle,
      customModules,
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
  applyQuickMode: (mode) => {
    const opsModules: CustomLayoutModules = {
      rgb: false,
      thermal: false,
      pointCloud: false,
      presence: false,
      systemStatus: true,
      execution: true,
      consoleLog: true,
    };
    const state = get();
    const next =
      mode === 'focus-rgb'
        ? { ...state, appliedLayout: 'Visual Detection' as const, previewLayout: 'Visual Detection' as const, focusView: 'rgb' as const }
        : mode === 'focus-thermal'
          ? { ...state, appliedLayout: 'Thermal Cam' as const, previewLayout: 'Thermal Cam' as const, focusView: 'thermal' as const }
          : mode === 'dual'
            ? { ...state, appliedLayout: 'Visual + Thermal' as const, previewLayout: 'Visual + Thermal' as const }
            : mode === 'sensors'
              ? { ...state, appliedLayout: 'Point Cloud Only' as const, previewLayout: 'Point Cloud Only' as const, focusView: 'pointCloud' as const }
              : mode === 'ops'
                ? {
                    ...state,
                    appliedLayout: 'Custom Combination' as const,
                    previewLayout: 'Custom Combination' as const,
                    layoutStyle: 'grid' as const,
                    customModules: opsModules,
                  }
                : { ...state, appliedLayout: 'Triple View' as const, previewLayout: 'Triple View' as const };

    set({
      appliedLayout: next.appliedLayout,
      previewLayout: next.previewLayout,
      focusView: next.focusView,
      layoutStyle: next.layoutStyle,
      customModules: next.customModules,
    });
    savePrefs({
      appliedLayout: next.appliedLayout,
      previewLayout: next.previewLayout,
      focusView: next.focusView,
      layoutStyle: next.layoutStyle,
      customModules: next.customModules,
    });
  },
  createTempScene: (name, ttlMinutes) => {
    const state = get();
    const now = Date.now();
    const ttlMs = Math.max(1, ttlMinutes) * 60 * 1000;
    const scene: TempScene = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || 'Temporal scene',
      createdAt: now,
      expiresAt: now + ttlMs,
      prefs: {
        appliedLayout: state.appliedLayout,
        previewLayout: state.previewLayout,
        focusView: state.focusView,
        layoutStyle: state.layoutStyle,
        customModules: state.customModules,
      },
    };
    const nextScenes = [scene, ...state.tempScenes].slice(0, 8);
    set({ tempScenes: nextScenes });
    saveScenes(nextScenes);
  },
  applyTempScene: (sceneId) => {
    const state = get();
    const scene = state.tempScenes.find((item) => item.id === sceneId);
    if (!scene) return;
    if (scene.expiresAt <= Date.now()) {
      const nextScenes = state.tempScenes.filter((item) => item.id !== sceneId);
      set({ tempScenes: nextScenes });
      saveScenes(nextScenes);
      return;
    }
    const prefsToApply = scene.prefs;
    set({
      appliedLayout: prefsToApply.appliedLayout,
      previewLayout: prefsToApply.previewLayout,
      focusView: prefsToApply.focusView,
      layoutStyle: prefsToApply.layoutStyle,
      customModules: prefsToApply.customModules,
    });
    savePrefs(prefsToApply);
  },
  deleteTempScene: (sceneId) => {
    const state = get();
    const nextScenes = state.tempScenes.filter((item) => item.id !== sceneId);
    set({ tempScenes: nextScenes });
    saveScenes(nextScenes);
  },
  cleanupExpiredScenes: () => {
    const state = get();
    const now = Date.now();
    const nextScenes = state.tempScenes.filter((item) => item.expiresAt > now);
    if (nextScenes.length === state.tempScenes.length) return;
    set({ tempScenes: nextScenes });
    saveScenes(nextScenes);
  },
}));
