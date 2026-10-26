export interface CameraParams {
  focalLength: number; // in mm, e.g., 24, 35, 50, 85
  aperture: string;    // e.g., "f/1.8", "f/2.8", "f/4", "f/8"
  shutterSpeed: string;// e.g., "1/60", "1/125", "1/250", "1/500"
  iso: number;         // e.g., 100, 200, 400, 800, 1600, 3200
  ev: number;          // exposure compensation, e.g., -2.0 to +2.0
  wb: string;          // White Balance: "Auto", "Daylight", "Cloudy", "Tungsten", "Fluorescent"
}

export interface ColorChannel {
  hex: string;
  percentage: number;
}

export interface CompositionRule {
  id: string;
  name: string;
  description: string;
  iconName: string;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: number;
  colors: ColorChannel[];
  complianceScore: number;
  cameraParams: CameraParams;
  compositionRule: string;
  heatmapDataUrl?: string; // Saved eye-trace heatmap
  aiCritique?: string;      // Loaded via server-side Gemini API
  focalCropScale?: number;  // The scale factor at capture time
  referenceFilm?: string;   // Target film palette active at capture
  referenceMatch?: number;  // 0-100 match against that palette
}

export interface FramingSuggestion {
  type: 'color' | 'composition' | 'lighting' | 'success';
  message: string;
  priority: 'low' | 'medium' | 'high';
}
