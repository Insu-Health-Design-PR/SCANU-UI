export type LayoutPreset =
  | 'Visual Detection'
  | 'Thermal Cam'
  | 'Visual + Thermal'
  | 'Visual Detection + Point Cloud'
  | 'Thermal Cam + Point Cloud'
  | 'Point Cloud Only'
  | 'Triple View'
  | 'Custom Combination';

export type FocusView = 'rgb' | 'thermal' | 'pointCloud' | 'presence';
export type LayoutStyle = 'grid' | 'focus' | 'fullscreen';

export interface CustomLayoutModules {
  rgb: boolean;
  thermal: boolean;
  pointCloud: boolean;
  presence: boolean;
  systemStatus: boolean;
  execution: boolean;
  consoleLog: boolean;
}

export interface UiPreferences {
  appliedLayout: LayoutPreset;
  previewLayout: LayoutPreset;
  focusView: FocusView;
  layoutStyle: LayoutStyle;
  customModules: CustomLayoutModules;
}

export interface TempScene {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  prefs: UiPreferences;
}
