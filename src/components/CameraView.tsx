import React, { useRef, useEffect, useState } from 'react';
import { CameraParams, CapturedPhoto, ColorChannel, FramingSuggestion } from '../types';
import { extractDominantColors, getColorSuggestions, hexToRgb, rgbToHex } from '../utils/colorAnalyzer';
import { FILM_PALETTES, FilmPalette, HarmonyRead, PaletteMatch, matchPalette, readHarmony, scoreSixtyThirtyTen } from '../utils/filmPalettes';
import { generateEyeTraceMap, getEyeTraceSuggestion } from '../utils/saliencyEngine';
import {
  drawRuleOfThirds,
  drawGoldenSection,
  drawGoldenSpiral,
  drawGoldenTriangles,
  drawDiagonalGuide,
  drawRadialGuide,
  drawCompoundCurve,
  drawPyramidGuide,
  drawCircularGuide,
  drawLArrangement
} from '../utils/compositionDrawers';
import { Histogram } from './Histogram';
import {
  Camera,
  Layers,
  Settings,
  Eye,
  CameraOff,
  Sparkles,
  RotateCw,
  Sliders,
  Image,
  RefreshCw,
  TrendingUp,
  Volume2,
  Tv,
  Focus,
  Info,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  X,
  Video,
  TreePine,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface CameraViewProps {
  onCapture: (photo: CapturedPhoto) => void;
  savedCount: number;
}

// Composition list with descriptions matching drawings
const COMPOSITION_RULES = [
  { id: 'thirds', name: 'Rule of Thirds', desc: 'Place elements at 1/3 and 2/3 intersections for balance and natural flow.', icon: 'grid' },
  { id: 'golden_section', name: 'Golden Section', desc: 'Align visual weights with the 38.2% and 61.8% golden phi lines.', icon: 'grid-golden' },
  { id: 'spiral', name: 'Golden Spiral', desc: 'Lead the eye dynamically along a logarithmic Fibonacci curve.', icon: 'spiral' },
  { id: 'triangles', name: 'Golden Triangles', desc: 'Divide space with diagonal vectors and perpendicular lines.', icon: 'triangle-diag' },
  { id: 'diagonal', name: 'Diagonal Guide', desc: 'Frame leading linear perspective lines along parallel diagonals.', icon: 'diagonal' },
  { id: 'radial', name: 'Radial Symmetry', desc: 'Converge perspectives to a central point like a starburst.', icon: 'radial' },
  { id: 'curve', name: 'S-Curve Spline', desc: 'Anchor sweeping, fluid visual ribbons for dynamic depth.', icon: 'curve' },
  { id: 'pyramid', name: 'Triangle / Pyramid', desc: 'Build highly stable, wide-bottomed architectural anchors.', icon: 'pyramid' },
  { id: 'circular', name: 'Circular Vignette', desc: 'Center visual energy inside concentric focal frames.', icon: 'circle' },
  { id: 'l_arrange', name: 'L-Arrangement', desc: 'Frame off-center anchors along horizontal and vertical margins.', icon: 'l-frame' }
];

const getContrastColor = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return '#FFFFFF';
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#0A0A0B' : '#FFFFFF';
};

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, savedCount }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stream States
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [usingSimulation, setUsingSimulation] = useState<boolean>(false);

  // Camera settings
  const [params, setParams] = useState<CameraParams>({
    focalLength: 35, // 24, 35, 50, 85
    aperture: 'f/2.8', // f/1.8, f/2.8, f/4, f/8
    shutterSpeed: '1/125', // 1/60, 1/125, 1/250, 1/500
    iso: 200, // 100, 200, 400, 800, 1600, 3200
    ev: 0.0, // -2.0 to 2.0
    wb: 'Auto' // Auto, Daylight, Cloudy, Tungsten, Fluorescent
  });

  // Active Overlays
  const [activeRule, setActiveRule] = useState<string>('thirds');
  const [spiralRotation, setSpiralRotation] = useState<number>(0); // Rotation for spiral: 0, 90, 180, 270
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.6);
  const [histogramChannels, setHistogramChannels] = useState({ r: true, g: true, b: true, lum: true });
  const [showHistogram, setShowHistogram] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [enableColorEngine, setEnableColorEngine] = useState<boolean>(true);
  const [showAIAdvisor, setShowAIAdvisor] = useState<boolean>(true);
  const [isMinimalHUD, setIsMinimalHUD] = useState<boolean>(false);

  // Reference for smoothed color values to prevent bouncing
  const smoothedColorsRef = useRef<{ r: number; g: number; b: number; percentage: number }[]>([]);

  // Extracted metrics
  const [colorProfile, setColorProfile] = useState<ColorChannel[]>([
    { hex: '#1e293b', percentage: 60 },
    { hex: '#475569', percentage: 30 },
    { hex: '#f59e0b', percentage: 10 }
  ]);
  const [colorCompliance, setColorCompliance] = useState<number>(95);
  const [focusAreaName, setFocusAreaName] = useState<string>('Center Stage');
  const [framingSuggestion, setFramingSuggestion] = useState<string>('Align your subject along the horizontal guide rails.');

  // UI Control panels
  const [activePanel, setActivePanel] = useState<'camera' | 'refs' | 'help' | null>('camera');

  // Art-direction reference: an optional target film palette to match live
  const [targetPaletteId, setTargetPaletteId] = useState<string | null>(() => {
    try { return localStorage.getItem('cinerule_target_palette'); } catch { return null; }
  });
  const targetPalette: FilmPalette | null = FILM_PALETTES.find(p => p.id === targetPaletteId) || null;
  const targetPaletteRef = useRef<FilmPalette | null>(targetPalette);
  targetPaletteRef.current = targetPalette;
  const [harmony, setHarmony] = useState<HarmonyRead | null>(null);
  const [paletteMatch, setPaletteMatch] = useState<PaletteMatch | null>(null);
  const [refFilter, setRefFilter] = useState<string>('all');

  const chooseTargetPalette = (id: string | null) => {
    setTargetPaletteId(id);
    if (!id) setPaletteMatch(null);
    try {
      if (id) localStorage.setItem('cinerule_target_palette', id);
      else localStorage.removeItem('cinerule_target_palette');
    } catch { /* storage unavailable: target just won't persist */ }
  };
  const [showCaptureFlash, setShowCaptureFlash] = useState<boolean>(false);

  // Simulated live landscape parameters (for dummy camera movement)
  const simulationTimeRef = useRef<number>(0);

  // Start Camera Stream
  const startCamera = async () => {
    setUsingSimulation(false);
    if (videoRef.current) {
      // Clean up previous stream
      const currentStream = videoRef.current.srcObject as MediaStream;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    }

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: 16 / 9
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // Interruption is safe to ignore
            console.log("Stream play transition handled:", error);
          });
        }
        setStreamActive(true);
      }
    } catch (err) {
      console.warn("Camera hardware not available or denied. Booting generative landscape simulator...", err);
      setUsingSimulation(true);
      setStreamActive(true);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      // Cleanup on unmount
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, [facingMode]);

  // Main Loop: renders active stream (or simulation) onto canvas and runs analytic engines
  useEffect(() => {
    let animationId: number;
    let colorAnalysisCounter = 0;

    const renderLoop = () => {
      simulationTimeRef.current += 0.015; // Simulated motion timer

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const hCanvas = heatmapCanvasRef.current;

      if (!canvas) {
        animationId = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationId = requestAnimationFrame(renderLoop);
        return;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw source video frame OR render the beautiful Generative Scene simulator
      if (!usingSimulation) {
        if (streamActive && video && video.readyState >= video.HAVE_CURRENT_DATA) {
          // Compute digital focal crop/zoom
          // 24mm = no crop (1.0x), 35mm = 1.45x crop, 50mm = 2.1x crop, 85mm = 3.5x crop
          const baseFocal = 24;
          const cropScale = params.focalLength / baseFocal;
          
          const sw = video.videoWidth / cropScale;
          const sh = video.videoHeight / cropScale;
          const sx = (video.videoWidth - sw) / 2;
          const sy = (video.videoHeight - sh) / 2;

          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
        } else {
          // Draw high-contrast, technical waiting/permission screen
          ctx.fillStyle = '#09090b';
          ctx.fillRect(0, 0, cw, ch);
          
          // Draw technical viewfinder ticks/grid
          ctx.strokeStyle = '#27272a';
          ctx.lineWidth = 1;
          for (let i = cw / 6; i < cw; i += cw / 6) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, ch); ctx.stroke();
          }
          for (let j = ch / 6; j < ch; j += ch / 6) {
            ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(cw, j); ctx.stroke();
          }

          // Concentric circles for target centering
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cw / 2, ch / 2 - 20, 65, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.beginPath();
          ctx.arc(cw / 2, ch / 2 - 20, 40 + Math.sin(simulationTimeRef.current * 4) * 4, 0, 2 * Math.PI);
          ctx.stroke();

          // Technical blinking dot
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(cw / 2 - 130, ch / 2 - 22, 4, 0, 2 * Math.PI);
          ctx.fill();

          // Technical text layout
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 12px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CONNECTING WEBCAM FEED...', cw / 2 + 10, ch / 2 - 18);

          ctx.fillStyle = '#71717a';
          ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
          ctx.fillText('If your browser did not prompt for camera permission,', cw / 2, ch / 2 + 25);
          ctx.fillText('please check permission settings or click "Open in New Tab"!', cw / 2, ch / 2 + 40);
        }
      } else {
        // Draw highly polished Generative Landscape Simulation
        // This ensures the app is 100% testable and beautiful offline or inside sandbox
        ctx.save();
        
        // Background sky gradient (time-reactive)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, ch);
        skyGrad.addColorStop(0, '#0f172a'); // deep midnight slate
        skyGrad.addColorStop(0.5, '#1e293b');
        skyGrad.addColorStop(1.0, '#334155'); // dusk transition
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, cw, ch);

        const time = simulationTimeRef.current;

        // Ambient mountains back layer (slower motion)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 10) {
          const y = ch * 0.45 + Math.sin(x * 0.005 + time * 0.1) * 35 + Math.cos(x * 0.01) * 15;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(cw, ch);
        ctx.closePath();
        ctx.fill();

        // Secondary mid-mountain range (greenish pine tone)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 10) {
          const y = ch * 0.6 + Math.sin(x * 0.009 - time * 0.2) * 25 + Math.sin(x * 0.02) * 10;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(cw, ch);
        ctx.closePath();
        ctx.fill();

        // Saliency Target: Vibrant Floating Hot Air Balloon (Accent Pop!)
        // It floats dynamically across the golden section intersections
        const bx = cw * 0.65 + Math.sin(time * 0.3) * 60;
        const by = ch * 0.35 + Math.cos(time * 0.2) * 30;

        // Draw Balloon Body (Accent Color Pop - Rich Amber/Crimson)
        ctx.fillStyle = '#f59e0b'; // Amber Accent
        ctx.beginPath();
        ctx.arc(bx, by, 22, 0, Math.PI, true);
        ctx.lineTo(bx - 10, by + 30);
        ctx.lineTo(bx + 10, by + 30);
        ctx.closePath();
        ctx.fill();

        // Balloon stripes (Secondary colors)
        ctx.fillStyle = '#ef4444'; // Red stripe
        ctx.beginPath();
        ctx.ellipse(bx, by + 5, 8, 20, 0, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff'; // White middle stripe
        ctx.beginPath();
        ctx.ellipse(bx, by + 5, 3, 18, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Balloon basket
        ctx.fillStyle = '#78350f';
        ctx.fillRect(bx - 5, by + 36, 10, 8);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx - 4, by + 30); ctx.lineTo(bx - 4, by + 36);
        ctx.moveTo(bx + 4, by + 30); ctx.lineTo(bx + 4, by + 36);
        ctx.stroke();

        // Foreground foliage branch framing (L-Arrangement anchor)
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.moveTo(0, ch);
        ctx.quadraticCurveTo(cw * 0.15, ch * 0.8, cw * 0.1, ch * 0.4);
        ctx.lineTo(0, ch * 0.35);
        ctx.closePath();
        ctx.fill();

        // Pine leaves on the foreground branch
        ctx.fillStyle = '#052e16'; // Deep forest pine
        for (let i = 0; i < 5; i++) {
          const lx = cw * 0.08 - i * 15;
          const ly = ch * 0.5 + i * 40;
          ctx.beginPath();
          ctx.arc(lx, ly, 15 + i * 5, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Draw simple rule guidelines for simulated crop
        const baseFocal = 24;
        const cropScale = params.focalLength / baseFocal;
        if (cropScale > 1.0) {
          // Crop feedback box
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect((cw - cw/cropScale)/2, (ch - ch/cropScale)/2, cw/cropScale, ch/cropScale);
          
          // Magnify the simulation crop just like a real lens
          const cropW = cw / cropScale;
          const cropH = ch / cropScale;
          const cropX = (cw - cropW) / 2;
          const cropY = (ch - cropH) / 2;
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = cw;
          tempCanvas.height = ch;
          const tCtx = tempCanvas.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cw, ch);
            ctx.drawImage(tempCanvas, 0, 0);
          }
        }

        ctx.restore();
      }

      // 2. Apply Camera Parameters (Shutter/ISO noise, exposure, DOF blur, WB tints)
      ctx.save();
      
      // EV (Exposure Compensation) adjustment
      const evBrightness = 100 + params.ev * 18; // Maps -2.0 to 2.0 -> 64% to 136% brightness
      // White Balance color tints
      let wbHue = '';
      if (params.wb === 'Cloudy') {
        wbHue = 'sepia(25%) saturate(115%) hue-rotate(5deg)'; // Warm orange
      } else if (params.wb === 'Tungsten') {
        wbHue = 'hue-rotate(190deg) saturate(110%)'; // Cool tungsten blue
      } else if (params.wb === 'Fluorescent') {
        wbHue = 'hue-rotate(120deg) opacity(95%)'; // Slight green cast
      } else if (params.wb === 'Daylight') {
        wbHue = 'sepia(10%) saturate(105%)'; // Light warm gold
      }

      // Simulated DOF Aperture Blur (f/1.8 has edge radial blur, f/8 has zero blur)
      let blurFilter = '';
      if (params.aperture === 'f/1.8') {
        // To simulate a real shallow depth of field, we can draw a slightly blurred overlay around the edges
        // Let's apply a fast canvas filter for simple overall soft focus or vignette blur
        // (Just a subtle soft vignette is gorgeous)
      }

      // Combine filters dynamically using canvas filter standard
      const filterString = `brightness(${evBrightness}%) ${wbHue} ${blurFilter}`.trim();
      if (filterString) {
        ctx.filter = filterString;
        // Redraw canvas on top of itself with filter active
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none'; // reset
      }

      // Simulated ISO Grain/Noise (Noise gets high at ISO 1600/3200)
      if (params.iso >= 800) {
        const noiseIntensity = (params.iso - 400) / 3200 * 0.18; // noise weight
        const imgData = ctx.getImageData(0, 0, cw, ch);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * noiseIntensity * 255;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      }

      ctx.restore();

      // 3. Real-time Analytics Engines (Throttled color analysis for flawless 60 FPS)
      if (enableColorEngine) {
        colorAnalysisCounter++;
        if (colorAnalysisCounter % 2 === 0) {
          // Extract 60-30-10 Colors and Score
          const result = extractDominantColors(ctx, cw, ch);
          
          // Smoothen the colors over time to lock them in and prevent bouncing
          const newColors = result.colors;
          if (smoothedColorsRef.current.length === 0) {
            smoothedColorsRef.current = newColors.map(col => {
              const rgb = hexToRgb(col.hex) || { r: 128, g: 128, b: 128 };
              return { ...rgb, percentage: col.percentage };
            });
          } else {
            // Find best matching permutation to prevent color label jumps (index-bouncing)
            const permutations = [
              [0, 1, 2],
              [0, 2, 1],
              [1, 0, 2],
              [1, 2, 0],
              [2, 0, 1],
              [2, 1, 0]
            ];
            
            let bestPermutation = [0, 1, 2];
            let minDistanceSum = Infinity;

            for (const p of permutations) {
              let distSum = 0;
              for (let i = 0; i < 3; i++) {
                const prev = smoothedColorsRef.current[i];
                const incoming = newColors[p[i]] || { hex: '#888888', percentage: 10 };
                const incRgb = hexToRgb(incoming.hex) || { r: 128, g: 128, b: 128 };
                distSum += Math.sqrt(
                  (prev.r - incRgb.r) ** 2 +
                  (prev.g - incRgb.g) ** 2 +
                  (prev.b - incRgb.b) ** 2
                );
              }
              if (distSum < minDistanceSum) {
                minDistanceSum = distSum;
                bestPermutation = p;
              }
            }

            // Apply exponential moving average (EMA) with a responsive alpha (0.18) for quick reaction
            const alpha = 0.18; 
            for (let i = 0; i < 3; i++) {
              const currentSmoothed = smoothedColorsRef.current[i];
              const incomingIdx = bestPermutation[i];
              const incoming = newColors[incomingIdx] || { hex: '#888888', percentage: 10 };
              const incomingRgb = hexToRgb(incoming.hex) || { r: 128, g: 128, b: 128 };
              
              if (currentSmoothed) {
                currentSmoothed.r = currentSmoothed.r * (1 - alpha) + incomingRgb.r * alpha;
                currentSmoothed.g = currentSmoothed.g * (1 - alpha) + incomingRgb.g * alpha;
                currentSmoothed.b = currentSmoothed.b * (1 - alpha) + incomingRgb.b * alpha;
                currentSmoothed.percentage = currentSmoothed.percentage * (1 - alpha) + incoming.percentage * alpha;
              }
            }
          }
          
          const smoothedChannels: ColorChannel[] = smoothedColorsRef.current.map(item => ({
            hex: rgbToHex(item.r, item.g, item.b),
            percentage: item.percentage
          }));
          
          // Normalize percentages to sum exactly to 100
          const sum = smoothedChannels.reduce((acc, c) => acc + c.percentage, 0);
          if (sum > 0) {
            smoothedChannels.forEach(c => {
              c.percentage = (c.percentage / sum) * 100;
            });
          }

          // Display dominant -> accent by size so the 60/30/10 labels stay honest,
          // and score the smoothed values so the readout doesn't flicker.
          smoothedChannels.sort((a, b) => b.percentage - a.percentage);
          const stableScore = scoreSixtyThirtyTen(smoothedChannels);
          setColorProfile(smoothedChannels);
          setColorCompliance(stableScore);
          setHarmony(readHarmony(smoothedChannels));
          const target = targetPaletteRef.current;
          setPaletteMatch(target ? matchPalette(smoothedChannels, target) : null);

          // Get Eye-Trace location name and suggestions
          const trace = getEyeTraceSuggestion(ctx, cw, ch);
          setFocusAreaName(trace.focusArea);
          
          // Combine suggestions
          const colorTip = getColorSuggestions(smoothedChannels, stableScore);
          const refTip = target ? ` ${matchPalette(smoothedChannels, target).tip}` : '';
          setFramingSuggestion(`${trace.suggestion} ${colorTip}${refTip}`);
        }
      } else {
        // Safe resets when color engine is bypassed
        setFocusAreaName('Engine Bypassed');
      }

      // 4. Render Active Heatmap Overlay
      if (showHeatmap && hCanvas) {
        const hCtx = hCanvas.getContext('2d');
        if (hCtx) {
          // Clear previous map
          hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
          // Generate thermal eye trace map
          generateEyeTraceMap(ctx, hCtx, hCanvas.width, hCanvas.height, heatmapOpacity);
        }
      }

      // 5. Draw active composition lines directly over the camera feed (to make it highly visual!)
      ctx.save();
      switch (activeRule) {
        case 'thirds':
          drawRuleOfThirds(ctx, cw, ch);
          break;
        case 'golden_section':
          drawGoldenSection(ctx, cw, ch);
          break;
        case 'spiral':
          drawGoldenSpiral(ctx, cw, ch, spiralRotation);
          break;
        case 'triangles':
          drawGoldenTriangles(ctx, cw, ch);
          break;
        case 'diagonal':
          drawDiagonalGuide(ctx, cw, ch);
          break;
        case 'radial':
          drawRadialGuide(ctx, cw, ch);
          break;
        case 'curve':
          drawCompoundCurve(ctx, cw, ch);
          break;
        case 'pyramid':
          drawPyramidGuide(ctx, cw, ch);
          break;
        case 'circular':
          drawCircularGuide(ctx, cw, ch);
          break;
        case 'l_arrange':
          drawLArrangement(ctx, cw, ch);
          break;
      }
      ctx.restore();

      animationId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [streamActive, params, activeRule, spiralRotation, usingSimulation, showHeatmap, heatmapOpacity, enableColorEngine]);

  // Handle Screen Grab
  const triggerCapture = () => {
    const canvas = canvasRef.current;
    const hCanvas = heatmapCanvasRef.current;
    if (!canvas) return;

    // Trigger visual capture flash
    setShowCaptureFlash(true);
    setTimeout(() => setShowCaptureFlash(false), 200);

    // Save base frame
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // Generate heatmap frame if showing, else compile empty string
    let heatmapDataUrl = '';
    if (hCanvas) {
      heatmapDataUrl = hCanvas.toDataURL('image/png');
    }

    // Capture complete object and pass up to Gallery
    const newPhoto: CapturedPhoto = {
      id: `capture_${Date.now()}`,
      dataUrl,
      timestamp: Date.now(),
      colors: [...colorProfile],
      complianceScore: colorCompliance,
      cameraParams: { ...params },
      compositionRule: COMPOSITION_RULES.find(r => r.id === activeRule)?.name || 'Custom Grid',
      heatmapDataUrl,
      focalCropScale: params.focalLength / 24,
      referenceFilm: targetPalette ? `${targetPalette.film} (${targetPalette.year})` : undefined,
      referenceMatch: paletteMatch?.score
    };

    onCapture(newPhoto);
  };

  const cycleFocalLength = () => {
    const focalLengths = [24, 35, 50, 85];
    const currentIndex = focalLengths.indexOf(params.focalLength);
    const nextIndex = (currentIndex + 1) % focalLengths.length;
    setParams(prev => ({ ...prev, focalLength: focalLengths[nextIndex] }));
  };

  const handleWBCycle = () => {
    const wbModes = ['Auto', 'Daylight', 'Cloudy', 'Tungsten', 'Fluorescent'];
    const currentIndex = wbModes.indexOf(params.wb);
    const nextIndex = (currentIndex + 1) % wbModes.length;
    setParams(prev => ({ ...prev, wb: wbModes[nextIndex] }));
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5 w-full max-w-7xl mx-auto h-full px-4 pt-1 pb-4 select-none">
      
      {/* LEFT AREA: CAMERA VIEWPORT, QUICK CONTROLS & DYNAMIC COLOR BARS (8 Columns) */}
      <div className="lg:col-span-8 flex flex-col gap-3">
        
        {/* COMPACT CAMERA CONTROLS BAR (SPACE SAVER) */}
        {!isMinimalHUD && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#141417] border border-[#222226] p-3 rounded-2xl shadow-md">
            {/* Sensor Source Toggles */}
            <div className="flex items-center gap-1.5 bg-[#0A0A0B] p-1 rounded-xl border border-[#222226] shrink-0">
              <button
                id="camera_source_webcam"
                type="button"
                onClick={() => {
                  setUsingSimulation(false);
                  startCamera();
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  !usingSimulation
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Connect real hardware webcam stream"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Webcam</span>
              </button>
              <button
                id="camera_source_simulated"
                type="button"
                onClick={() => {
                  setUsingSimulation(true);
                  setStreamActive(true);
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  usingSimulation
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to simulated landscape scene"
              >
                <TreePine className="w-3.5 h-3.5" />
                <span>Simulation</span>
              </button>
            </div>

            {/* Quick Composition Grid Selector Dropdown (Saves vertical panel space!) */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider hidden md:inline shrink-0">Measure:</span>
              <select
                id="camera_quick_rule_selector"
                value={activeRule}
                onChange={(e) => {
                  setActiveRule(e.target.value);
                  setSpiralRotation(0); // Reset spiral rotation
                }}
                className="w-full bg-[#0A0A0B] border border-[#222226] text-slate-200 text-xs font-mono font-bold py-2 px-3 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer text-center"
              >
                {COMPOSITION_RULES.map(rule => (
                  <option key={rule.id} value={rule.id}>
                    📏 {rule.name.toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Extremely compact AI Advisor Toggle switch */}
              <button
                id="camera_ai_advisor_quick_toggle"
                type="button"
                onClick={() => setShowAIAdvisor(!showAIAdvisor)}
                className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-mono font-bold uppercase transition-all cursor-pointer border shrink-0 ${
                  showAIAdvisor
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : 'bg-[#0A0A0B] border-[#222226] text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle AI Composition Advisor overlay"
              >
                <Sparkles className={`w-3.5 h-3.5 ${showAIAdvisor ? 'animate-pulse text-blue-400' : ''}`} />
                <span className="hidden xs:inline">Advisor</span>
              </button>
            </div>
          </div>
        )}

        {/* Sandbox explanation notice */}
        {!isMinimalHUD && !usingSimulation && (
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-3 text-[11px] leading-relaxed text-blue-300 font-sans">
            💡 <strong>Sandbox Hint:</strong> If your webcam does not load automatically, please confirm camera permissions, or click <strong>"Open in New Tab"</strong> in the top-right corner to bypass sandbox iframe media constraints!
          </div>
        )}

        {/* Sleek, Non-blocking Live Telemetry & Status Strip (Moved out of the absolute camera overlay to keep top readout clean!) */}
        {!isMinimalHUD && (
          <div className="bg-[#141417] border border-[#222226] rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] font-mono text-slate-300 shadow-md">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                REC LIVE
              </span>
              <span className="text-slate-400 font-bold">60 FPS</span>
              <span className="text-slate-400 bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#222226] hidden xs:inline">{usingSimulation ? 'SIMULATOR SOURCE' : 'HARDWARE SENSOR'}</span>
            </div>
            
            {/* Live Parameter Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#222226]">FL: <strong className="text-blue-400 font-bold">{params.focalLength}mm</strong></span>
              <span className="bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#222226]">ISO: <strong className="text-blue-400 font-bold">{params.iso}</strong></span>
              <span className="bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#222226]">SS: <strong className="text-blue-400 font-bold">{params.shutterSpeed}</strong></span>
              <span className="bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#222226]">Ap: <strong className="text-blue-400 font-bold">{params.aperture}</strong></span>
              <span className="bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#222226]">EV: <strong className="text-blue-400 font-bold">{params.ev >= 0 ? `+${params.ev.toFixed(1)}` : params.ev.toFixed(1)}</strong></span>
              <span className="bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#222226]">WB: <strong className="text-blue-400 font-bold">{params.wb}</strong></span>
              
              {/* Minimal Clean HUD Button */}
              <button
                id="camera_telemetry_hud_button"
                type="button"
                onClick={() => setIsMinimalHUD(true)}
                className="flex items-center gap-1 py-1 px-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-slate-300 hover:text-white text-[9px] font-mono font-bold rounded-lg transition-all shadow-md cursor-pointer uppercase tracking-wider"
                title="Enter Immersive Minimal View (Hide Menus)"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Clean View</span>
              </button>

              {/* Full Screen Mode Toggle Button */}
              <button
                id="camera_telemetry_fullscreen_button"
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="flex items-center gap-1 py-1 px-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-[9px] font-mono font-bold rounded-lg transition-all shadow-md cursor-pointer uppercase tracking-wider"
                title={isFullScreen ? "Exit Full Screen" : "Enter Immersive Viewfinder"}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullScreen ? 'Exit FS' : 'Full Screen'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Core Camera Canvas Wrapper */}
        <div className={`relative aspect-video bg-[#0A0A0B] flex items-center justify-center transition-all ${
          isFullScreen 
            ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-none' 
            : 'w-full rounded-3xl overflow-hidden border border-[#222226] shadow-2xl'
        }`}>
          
          {/* Unobtrusive Minimal HUD Restore Button */}
          {isMinimalHUD && (
            <button
              id="camera_hud_restore_button"
              type="button"
              onClick={() => setIsMinimalHUD(false)}
              className="absolute top-4 left-4 z-40 bg-black/70 hover:bg-black/90 border border-[#222226] text-slate-300 hover:text-white py-1 px-2.5 text-[9px] font-mono font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-lg pointer-events-auto select-none"
              title="Show Settings and Controls"
            >
              <Sliders className="w-3 h-3 text-blue-400" />
              <span>Show Controls</span>
            </button>
          )}
          
          {/* Subtitle / Off Air Notice */}
          {!streamActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 z-10">
              <CameraOff className="w-8 h-8 text-red-500 animate-pulse" />
              <span className="text-xs font-mono">CONNECTING STREAM CORES...</span>
            </div>
          )}

          {/* Core high-performance analysis source canvas */}
          <canvas
            id="camera_monitoring_canvas"
            ref={canvasRef}
            width={768}
            height={432}
            className="w-full h-full object-cover block"
          />

          {/* Saliency overlay canvas */}
          {showHeatmap && (
            <canvas
              id="camera_saliency_heatmap_canvas"
              ref={heatmapCanvasRef}
              width={768}
              height={432}
              className="absolute inset-0 w-full h-full object-cover block pointer-events-none mix-blend-screen"
            />
          )}

          {/* Flash screen indicator on capture */}
          {showCaptureFlash && (
            <div className="absolute inset-0 bg-white z-40 transition-opacity duration-150 animate-flash" />
          )}

          {/* Hidden reference video tag for streaming */}
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
          />

          {/* Live Camera HUD/Telemetry Borders - Sony/RED Monitor style */}
          <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-slate-300 z-10 select-none">
            
            {/* Top region is now completely clean and unblocked! */}
            <div />

            {/* Middle Crop Marks (Visual corners for aesthetic boundary centering) */}
            <div className="absolute inset-x-6 inset-y-12 flex items-center justify-between pointer-events-none opacity-40">
              <div className="flex flex-col justify-between h-full">
                <div className="w-3 h-3 border-t-2 border-l-2 border-white" />
                <div className="w-3 h-3 border-b-2 border-l-2 border-white" />
              </div>
              <div className="flex flex-col justify-between h-full">
                <div className="w-3 h-3 border-t-2 border-r-2 border-white" />
                <div className="w-3 h-3 border-b-2 border-r-2 border-white" />
              </div>
            </div>

            {/* Bottom HUD Row: Color compliance and active grid tag */}
            <div className="flex items-end justify-between">
              
              {/* Color Rule Active Compliance indicator */}
              <div className="flex flex-col gap-1 bg-[#141417]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-[#222226] pointer-events-auto">
                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold font-sans">60-30-10 Compliance</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    {colorProfile.map((col, idx) => (
                      <div
                        key={idx}
                        className="h-full transition-all duration-300"
                        style={{
                          backgroundColor: col.hex,
                          width: `${col.percentage}%`
                        }}
                      />
                    ))}
                  </div>
                  <span className={`font-bold ${colorCompliance >= 85 ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {colorCompliance}%
                  </span>
                </div>
                {targetPalette && paletteMatch && (
                  <span className="text-[9px] text-slate-300">
                    vs <strong className="text-amber-300">{targetPalette.film}</strong>: <strong className={paletteMatch.score >= 75 ? 'text-emerald-400' : 'text-amber-300'}>{paletteMatch.score}%</strong>
                  </span>
                )}
              </div>

              {/* Composition tag details */}
              <div className="bg-[#141417]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-[#222226] text-right flex flex-col gap-0.5 pointer-events-auto">
                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold font-sans">Active Grid</span>
                <span className="text-blue-400 font-bold">{COMPOSITION_RULES.find(r => r.id === activeRule)?.name}</span>
              </div>
            </div>

          </div>

          {/* Quick Spiral Rotation toggle on viewport when Golden Spiral is active */}
          {activeRule === 'spiral' && (
            <button
              id="camera_spiral_rotate_button"
              onClick={() => setSpiralRotation(prev => (prev + 90) % 360)}
              className="absolute top-16 right-4 p-2 bg-[#141417]/90 hover:bg-[#1e1e24] text-blue-400 rounded-lg border border-[#222226] transition-colors z-20 shadow-lg flex items-center gap-1 text-[11px] font-mono cursor-pointer"
              title="Rotate spiral layout"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate</span>
            </button>
          )}

          {/* Floating Cinema Controls Dock (Only in Full Screen) */}
          {isFullScreen && (
            <div className="absolute bottom-4 inset-x-4 flex flex-col gap-2 bg-[#141417]/95 backdrop-blur-md border border-[#222226] p-3 rounded-2xl shadow-2xl pointer-events-auto z-30 max-w-xl mx-auto">
              {/* Row 1: Parameters & Grids */}
              <div className="flex flex-row items-center justify-between gap-2">
                {/* Rule dropdown */}
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest hidden xs:inline">Grid:</span>
                  <select
                    id="camera_fs_rule_selector"
                    value={activeRule}
                    onChange={(e) => {
                      setActiveRule(e.target.value);
                      setSpiralRotation(0);
                    }}
                    className="w-full bg-[#0a0a0b] border border-[#222226] text-slate-200 text-xs font-mono font-bold py-1 px-2 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {COMPOSITION_RULES.map(rule => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Focal length selector */}
                <div className="flex items-center gap-1 bg-[#0a0a0b] p-0.5 rounded-xl border border-[#222226] shrink-0">
                  {[24, 35, 50, 85].map(fl => (
                    <button
                      id={`fs_focal_button_${fl}`}
                      key={fl}
                      onClick={() => setParams(prev => ({ ...prev, focalLength: fl }))}
                      className={`py-1 px-2 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer ${
                        params.focalLength === fl
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {fl}mm
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Big Actions */}
              <div className="flex items-center justify-between gap-2 border-t border-[#222226] pt-2">
                {/* Toggle Eye Trace */}
                <button
                  id="fs_heatmap_toggle"
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`flex items-center gap-1 py-1.5 px-2.5 rounded-xl border transition-all text-[10px] font-mono font-semibold cursor-pointer ${
                    showHeatmap
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 animate-pulse'
                      : 'bg-[#0a0a0b] border-[#222226] text-slate-300'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Trace Map</span>
                </button>

                {/* Shutter Button */}
                <button
                  id="fs_shutter_capture"
                  onClick={triggerCapture}
                  className="flex items-center gap-1.5 py-1.5 px-4 bg-white hover:bg-gray-200 text-[#0a0a0b] rounded-xl font-bold transition-all active:scale-95 cursor-pointer shadow-lg"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono font-extrabold uppercase">GRAB</span>
                </button>

                {/* Flip Camera sensor */}
                <button
                  id="fs_flip_sensor"
                  onClick={() => {
                    if (usingSimulation) {
                      setUsingSimulation(false);
                      startCamera();
                    } else {
                      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
                    }
                  }}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 bg-[#0a0a0b] border border-[#222226] text-slate-300 rounded-xl hover:text-white transition-all text-[10px] font-mono font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Flip Lens</span>
                </button>
              </div>
            </div>
          )}

          {/* Translucent HUD overlay for AI Composition Suggestions, placed inside the viewport at the bottom to maximize space */}
          {showAIAdvisor && framingSuggestion && (
            <div className="absolute bottom-24 inset-x-3 bg-black/85 backdrop-blur-md border border-blue-500/30 text-white p-2.5 rounded-2xl flex items-start justify-between gap-2.5 text-left pointer-events-auto shadow-2xl transition-all duration-300 z-20 max-w-lg mx-auto">
              <div className="flex items-start gap-2.5 flex-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                    AI Advisor • <strong className="text-blue-400">{focusAreaName}</strong>
                  </span>
                  <p className="text-[11px] text-slate-200 leading-normal font-sans font-medium">{framingSuggestion}</p>
                </div>
              </div>
              
              <button
                id="camera_viewport_advisor_dismiss"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAIAdvisor(false);
                }}
                className="pointer-events-auto text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Dismiss AI Advisor"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* NEW: PROMINENT LIVE COLOR HARMONY (60-30-10) BAR */}
        <div className="bg-[#141417] border border-[#222226] rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${enableColorEngine ? 'bg-blue-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-300 uppercase">LIVE COLOR RULE (60-30-10)</span>
            </div>
            <div className="flex items-center gap-2">
              {enableColorEngine && (
                <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-lg">
                  <span>{colorCompliance}% COMPLIANCE</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setEnableColorEngine(!enableColorEngine);
                  if (enableColorEngine) {
                    setShowHistogram(false);
                  }
                }}
                className={`py-1 px-2.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  enableColorEngine
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 shadow-sm'
                    : 'bg-[#0A0A0B] text-slate-400 border border-[#222226] hover:text-slate-200'
                }`}
              >
                {enableColorEngine ? '🟢 ON' : '⚪ OFF'}
              </button>
            </div>
          </div>
          
          {enableColorEngine ? (
            <>
              {/* Larger Color Bar representation */}
              <div className="h-7 w-full flex rounded-xl overflow-hidden border border-[#222226] shadow-inner bg-[#0A0A0B]">
                {colorProfile.map((col, idx) => (
                  <div
                    key={idx}
                    className="h-full flex items-center justify-center text-[10px] font-bold font-mono transition-all duration-300 select-none"
                    style={{
                      backgroundColor: col.hex,
                      width: `${col.percentage}%`,
                      color: getContrastColor(col.hex)
                    }}
                  >
                    {col.percentage >= 6 && `${Math.round(col.percentage)}%`}
                  </div>
                ))}
              </div>

              {/* Color Chips Grid with Hex values */}
              <div className="grid grid-cols-3 gap-2">
                {colorProfile.map((col, idx) => (
                  <div key={idx} className="bg-[#0A0A0B] p-2.5 rounded-xl border border-[#222226] flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0 shadow-sm" style={{ backgroundColor: col.hex }} />
                      <span className="text-[10px] font-mono font-bold text-white uppercase truncate">{col.hex}</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 font-bold uppercase tracking-wider shrink-0">
                      {idx === 0 ? '60% Dom' : idx === 1 ? '30% Sec' : '10% Acc'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Harmony read: names the colour relationship and whether the accent pops */}
              {harmony && (
                <div className="bg-[#0A0A0B] p-2.5 rounded-xl border border-[#222226] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-slate-500 uppercase tracking-wider">Scheme</span>
                    <span className="text-slate-200 font-bold">{harmony.scheme}</span>
                    <span className="text-slate-500 uppercase tracking-wider ml-2">Accent pop</span>
                    <span className={`font-bold ${harmony.accentPop >= 60 ? 'text-emerald-400' : harmony.accentPop >= 35 ? 'text-amber-300' : 'text-red-400'}`}>{harmony.accentPop}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">{harmony.note}</span>
                </div>
              )}

              {/* Target film palette comparison */}
              {targetPalette ? (
                <div className="bg-[#0A0A0B] p-2.5 rounded-xl border border-amber-400/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 uppercase tracking-wider">Target: <strong className="text-amber-300 normal-case">{targetPalette.film}</strong> <span className="text-slate-600">({targetPalette.year})</span></span>
                    <div className="flex items-center gap-2">
                      {paletteMatch && <span className={`font-bold ${paletteMatch.score >= 75 ? 'text-emerald-400' : 'text-amber-300'}`}>{paletteMatch.score}% MATCH</span>}
                      <button type="button" onClick={() => chooseTargetPalette(null)} className="text-slate-500 hover:text-white cursor-pointer" title="Clear target palette"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="h-3 w-full flex rounded-md overflow-hidden border border-[#222226]">
                    <div style={{ backgroundColor: targetPalette.dominant, width: '60%' }} />
                    <div style={{ backgroundColor: targetPalette.secondary, width: '30%' }} />
                    <div style={{ backgroundColor: targetPalette.accent, width: '10%' }} />
                  </div>
                  {paletteMatch && <p className="text-[10px] text-slate-400 font-sans leading-snug">{paletteMatch.tip}</p>}
                </div>
              ) : (
                <button type="button" onClick={() => setActivePanel('refs')} className="text-[10px] font-mono text-slate-500 hover:text-amber-300 text-left cursor-pointer">
                  + Match a film palette (Film Refs)
                </button>
              )}

              {/* Toggle-able RGB/Luminance diagnostics */}
              <div className="flex flex-col gap-2 mt-1 border-t border-[#222226] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">RGB Diagnostics Scope:</span>
                  <button
                    type="button"
                    onClick={() => setShowHistogram(!showHistogram)}
                    className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      showHistogram
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm'
                        : 'bg-[#0A0A0B] text-slate-400 border border-[#222226] hover:text-slate-200'
                    }`}
                  >
                    {showHistogram ? '🟢 Waveform Active' : '⚪ Show Waveform'}
                  </button>
                </div>
                {showHistogram && (
                  <div className="bg-[#0A0A0B] p-3 rounded-xl border border-[#222226] flex flex-col gap-2 mt-1">
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                      <span>Spectral Density Scope</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setHistogramChannels(p => ({ ...p, r: !p.r }))}
                          className={`w-4 h-4 rounded text-[8px] font-bold font-mono transition-colors border cursor-pointer flex items-center justify-center ${histogramChannels.r ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-[#141417] border-[#222226] text-slate-600'}`}
                        >R</button>
                        <button
                          type="button"
                          onClick={() => setHistogramChannels(p => ({ ...p, g: !p.g }))}
                          className={`w-4 h-4 rounded text-[8px] font-bold font-mono transition-colors border cursor-pointer flex items-center justify-center ${histogramChannels.g ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-[#141417] border-[#222226] text-slate-600'}`}
                        >G</button>
                        <button
                          type="button"
                          onClick={() => setHistogramChannels(p => ({ ...p, b: !p.b }))}
                          className={`w-4 h-4 rounded text-[8px] font-bold font-mono transition-colors border cursor-pointer flex items-center justify-center ${histogramChannels.b ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-[#141417] border-[#222226] text-slate-600'}`}
                        >B</button>
                        <button
                          type="button"
                          onClick={() => setHistogramChannels(p => ({ ...p, lum: !p.lum }))}
                          className={`w-4 h-4 rounded text-[8px] font-bold font-mono transition-colors border cursor-pointer flex items-center justify-center ${histogramChannels.lum ? 'bg-slate-200/20 border-slate-400 text-slate-200' : 'bg-[#141417] border-[#222226] text-slate-600'}`}
                        >L</button>
                      </div>
                    </div>
                    <Histogram srcCanvasRef={canvasRef} activeChannels={histogramChannels} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-[#0A0A0B] p-5 rounded-xl border border-[#222226] flex flex-col items-center justify-center text-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                <Sliders className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold font-mono text-zinc-300">Live Diagnostics Paused</span>
                <p className="text-[10px] font-mono text-zinc-500 max-w-xs leading-relaxed">
                  Spectral evaluation and 60-30-10 dominant color checking are disabled to maximize performance and save battery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnableColorEngine(true)}
                className="py-1.5 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer shadow-md uppercase tracking-wider"
              >
                Enable Color Engine
              </button>
            </div>
          )}
        </div>

        {/* CORE CAMERA ACTION TRIGGER BAR (MOBILE OPTIMIZED BIG BUTTONS) */}
        <div className="grid grid-cols-3 gap-3">
          
          {/* Toggle Saliency Heatmap Button */}
          <button
            id="camera_heatmap_toggle_button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex flex-col items-center justify-center py-2.5 px-4 rounded-xl border transition-all duration-200 cursor-pointer ${
              showHeatmap
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                : 'bg-[#141417] hover:bg-[#1e1e24] border-[#222226] text-slate-300'
            }`}
          >
            <Eye className={`w-5 h-5 mb-1 ${showHeatmap ? 'animate-pulse text-cyan-300' : ''}`} />
            <span className="text-[11px] font-mono font-medium">Eye Trace Map</span>
            <span className="text-[9px] text-slate-400 font-mono mt-0.5">{showHeatmap ? 'ACTIVE' : 'OFF'}</span>
          </button>

          {/* Main big circle Trigger Capture / Screen Grab Button */}
          <button
            id="camera_shutter_capture_button"
            onClick={triggerCapture}
            className="relative flex flex-col items-center justify-center bg-white hover:bg-gray-200 text-[#0A0A0B] rounded-xl font-bold transition-all duration-200 shadow-xl shadow-white/5 group overflow-hidden active:scale-95 cursor-pointer"
          >
            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Camera className="w-6 h-6 mb-0.5" />
            <span className="text-xs uppercase tracking-wider font-extrabold font-mono">SCREEN GRAB</span>
            <span className="text-[9px] font-mono font-bold opacity-75 mt-0.5">{savedCount} IN GALLERY</span>
          </button>

          {/* Front/Back Camera sensor switcher */}
          <button
            id="camera_sensor_flip_button"
            onClick={() => {
              if (usingSimulation) {
                // Try restarting webcam stream
                setUsingSimulation(false);
                startCamera();
              } else {
                setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
              }
            }}
            className="flex flex-col items-center justify-center py-2.5 px-4 rounded-xl bg-[#141417] hover:bg-[#1e1e24] border border-[#222226] text-slate-300 transition-all duration-200 cursor-pointer"
          >
            <RefreshCw className="w-5 h-5 mb-1 text-slate-400 group-hover:rotate-180 transition-transform" />
            <span className="text-[11px] font-mono font-medium">Flip Sensor</span>
            <span className="text-[9px] text-slate-400 font-mono mt-0.5">
              {usingSimulation ? 'TRY WEBCAM' : facingMode === 'environment' ? 'REAR LENS' : 'FRONT LENS'}
            </span>
          </button>

        </div>

      </div>

      {/* RIGHT AREA: SCOPES, PARAMETERS & DRAWERS (4 Columns) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        


        {/* Dynamic Drawer Tabs */}
        <div className="flex border border-[#222226] bg-[#0A0A0B] p-1 rounded-xl">
          <button
            id="tab_camera_drawer"
            onClick={() => setActivePanel('camera')}
            className={`flex-1 py-1.5 px-2 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-lg transition-all duration-150 cursor-pointer ${
              activePanel === 'camera' ? 'bg-white text-[#0A0A0B] shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Parameters
          </button>
          <button
            id="tab_refs_drawer"
            onClick={() => setActivePanel('refs')}
            className={`flex-1 py-1.5 px-2 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-lg transition-all duration-150 cursor-pointer ${
              activePanel === 'refs' ? 'bg-white text-[#0A0A0B] shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Film Refs
          </button>
          <button
            id="tab_help_drawer"
            onClick={() => setActivePanel('help')}
            className={`flex-1 py-1.5 px-2 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-lg transition-all duration-150 cursor-pointer ${
              activePanel === 'help' ? 'bg-white text-[#0A0A0B] shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Guidebook
          </button>
        </div>

        {/* ACTIVE DRAWER PANELS CONTAINER */}
        <div className="flex-1 min-h-[280px] bg-[#141417] border border-[#222226] rounded-2xl p-5 overflow-y-auto shadow-lg">
          
          {/* Panel 1: Physical Camera Parameter Sliders */}
          {activePanel === 'camera' && (
            <div className="flex flex-col gap-4">
              <div className="text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase mb-1">Interactive Camera Parameters</div>

              {/* Show/Hide AI Composition Advisor Switch */}
              <div className="bg-[#0A0A0B] p-3 rounded-xl border border-[#222226] flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <Sparkles className={`w-4 h-4 ${showAIAdvisor ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-mono font-bold text-slate-200">AI Advisor HUD</span>
                    <span className="text-[9px] text-slate-400 font-sans">Toggle composition overlay</span>
                  </div>
                </div>
                <button
                  id="camera_settings_ai_advisor_toggle"
                  type="button"
                  onClick={() => setShowAIAdvisor(!showAIAdvisor)}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showAIAdvisor ? 'bg-blue-500' : 'bg-[#222226]'
                  }`}
                  aria-label="Toggle AI Advisor HUD"
                >
                  <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      showAIAdvisor ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Focal length Quick Cycle Selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>Focal Length</span>
                  <span className="text-blue-400 font-bold">{params.focalLength}mm ({params.focalLength === 24 ? '1.0x Wide' : params.focalLength === 35 ? '1.45x Standard' : params.focalLength === 50 ? '2.1x Portrait' : '3.5x Telephoto'})</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[24, 35, 50, 85].map(fl => (
                    <button
                      id={`focal_button_${fl}`}
                      key={fl}
                      onClick={() => setParams(prev => ({ ...prev, focalLength: fl }))}
                      className={`py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer ${
                        params.focalLength === fl
                          ? 'bg-white text-[#0A0A0B] border-white shadow-sm'
                          : 'bg-[#0A0A0B] hover:bg-[#141417] border-[#222226] text-slate-300'
                      }`}
                    >
                      {fl}mm
                    </button>
                  ))}
                </div>
              </div>

              {/* Exposure Compensation EV Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>Exposure Value (EV brightness)</span>
                  <span className="text-blue-400 font-bold">{params.ev >= 0 ? `+${params.ev.toFixed(1)}` : params.ev.toFixed(1)} EV</span>
                </div>
                <input
                  id="camera_ev_slider"
                  type="range"
                  min="-2.0"
                  max="2.0"
                  step="0.5"
                  value={params.ev}
                  onChange={(e) => setParams(prev => ({ ...prev, ev: parseFloat(e.target.value) }))}
                  className="w-full accent-blue-500 bg-[#0A0A0B] border border-[#222226] rounded-lg appearance-none h-1.5 cursor-pointer"
                />
              </div>

              {/* ISO Parameter Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>Sensor Sensitivity (ISO Grain)</span>
                  <span className="text-blue-400 font-bold">ISO {params.iso} {params.iso >= 1600 ? '(HIGH NOISE)' : ''}</span>
                </div>
                <input
                  id="camera_iso_slider"
                  type="range"
                  min="100"
                  max="3200"
                  step="100"
                  value={params.iso}
                  onChange={(e) => setParams(prev => ({ ...prev, iso: parseInt(e.target.value) }))}
                  className="w-full accent-blue-500 bg-[#0A0A0B] border border-[#222226] rounded-lg appearance-none h-1.5 cursor-pointer"
                />
              </div>

              {/* Lens Aperture Selection */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>Lens Aperture (Defocus blur)</span>
                  <span className="text-blue-400 font-bold">{params.aperture}</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {['f/1.8', 'f/2.8', 'f/4', 'f/8'].map(ap => (
                    <button
                      id={`aperture_button_${ap.replace('/', '_')}`}
                      key={ap}
                      onClick={() => setParams(prev => ({ ...prev, aperture: ap }))}
                      className={`py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer ${
                        params.aperture === ap
                          ? 'bg-white text-[#0A0A0B] border-white shadow-sm'
                          : 'bg-[#0A0A0B] hover:bg-[#141417] border-[#222226] text-slate-300'
                      }`}
                    >
                      {ap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shutter Speed Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>Shutter Speed</span>
                  <span className="text-blue-400 font-bold">{params.shutterSpeed}s</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {['1/60', '1/125', '1/250', '1/500'].map(ss => (
                    <button
                      id={`shutter_button_${ss.replace('/', '_')}`}
                      key={ss}
                      onClick={() => setParams(prev => ({ ...prev, shutterSpeed: ss }))}
                      className={`py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer ${
                        params.shutterSpeed === ss
                          ? 'bg-white text-[#0A0A0B] border-white shadow-sm'
                          : 'bg-[#0A0A0B] hover:bg-[#141417] border-[#222226] text-slate-300'
                      }`}
                    >
                      {ss}
                    </button>
                  ))}
                </div>
              </div>

              {/* White Balance Selection */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>White Balance</span>
                  <span className="text-blue-400 font-bold">{params.wb}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Auto', 'Daylight', 'Cloudy', 'Tungsten'].map(wb => (
                    <button
                      id={`wb_button_${wb}`}
                      key={wb}
                      onClick={() => setParams(prev => ({ ...prev, wb }))}
                      className={`py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer ${
                        params.wb === wb
                          ? 'bg-white text-[#0A0A0B] border-white shadow-sm'
                          : 'bg-[#0A0A0B] hover:bg-[#141417] border-[#222226] text-slate-300'
                      }`}
                    >
                      {wb}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Panel 2: Film reference palettes for art direction */}
          {activePanel === 'refs' && (
            <div className="flex flex-col gap-3 font-sans text-slate-300 max-h-[520px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase">60-30-10 in the Movies</div>
                <select
                  value={refFilter}
                  onChange={(e) => setRefFilter(e.target.value)}
                  className="bg-[#0A0A0B] border border-[#222226] text-slate-300 text-[10px] font-mono py-1 px-2 rounded-lg cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="mono-accent">Mono + accent</option>
                  <option value="complementary">Complementary</option>
                  <option value="warm">Warm</option>
                  <option value="cool">Cool</option>
                  <option value="pastel">Pastel</option>
                  <option value="neon">Neon</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Tap a film to set it as your live target. Swatches are approximate, sampled by eye from well-known frames, as a teaching reference.
              </p>
              {FILM_PALETTES.filter(f => refFilter === 'all' || f.family === refFilter).map(f => {
                const active = f.id === targetPaletteId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => chooseTargetPalette(active ? null : f.id)}
                    className={`text-left bg-[#0A0A0B] p-3 rounded-xl border transition-all cursor-pointer ${active ? 'border-amber-400/60 shadow-md shadow-amber-400/10' : 'border-[#222226] hover:border-slate-600'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-100">{f.film} <span className="text-slate-500 font-normal">{f.year}</span></span>
                      <span className="text-[9px] font-mono text-slate-500 truncate">DP: {f.dp}</span>
                    </div>
                    <div className="h-4 w-full flex rounded-md overflow-hidden border border-white/5 mb-2">
                      <div style={{ backgroundColor: f.dominant, width: '60%' }} />
                      <div style={{ backgroundColor: f.secondary, width: '30%' }} />
                      <div style={{ backgroundColor: f.accent, width: '10%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{f.lesson}</p>
                    <p className="text-[11px] text-slate-300 leading-relaxed mt-1"><strong className="text-amber-300 font-mono text-[9px] uppercase tracking-wider">On set:</strong> {f.onSet}</p>
                    {active && <span className="inline-block mt-2 text-[9px] font-mono font-bold text-amber-300 uppercase tracking-wider">● Live target — tap again to clear</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Panel 3: Photographer's Guidebook Info */}
          {activePanel === 'help' && (
            <div className="flex flex-col gap-3 font-sans text-slate-300 max-h-[380px] overflow-y-auto pr-1">
              <div className="text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase mb-1">Visual Grammar Reference</div>
              
              <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#222226]">
                <h4 className="text-xs font-bold text-blue-400 font-mono mb-1">The 60-30-10 Rule</h4>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  A classic design proportion used to establish a clean visual story:
                </p>
                <ul className="text-[11px] list-disc pl-4 mt-1.5 space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">60% Dominant (Canvas):</strong> The main canvas or background color that defines the core environment.</li>
                  <li><strong className="text-slate-200">30% Secondary (Support):</strong> The secondary supporting tone that structures lines and blocks of interest.</li>
                  <li><strong className="text-slate-200">10% Accent (Pop):</strong> A single high-vibrancy pop of color that immediately acts as a magnet for focal tracking.</li>
                </ul>
              </div>

              <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#222226]">
                <h4 className="text-xs font-bold text-blue-400 font-mono mb-1">Who owns each 10%? (on set)</h4>
                <ul className="text-[11px] list-disc pl-4 space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">60 — Production design & location:</strong> walls, floors, sky, haze. Decide it in prep; it's the hardest to change on the day.</li>
                  <li><strong className="text-slate-200">30 — Wardrobe & large set dressing:</strong> costumes of the ensemble, furniture, vehicles. Groups of people read as one block of this colour.</li>
                  <li><strong className="text-slate-200">10 — Story objects, hero wardrobe, practicals:</strong> the one prop, the lead's coat, a neon sign, a lamp. Put it where you want the eye.</li>
                </ul>
              </div>

              <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#222226]">
                <h4 className="text-xs font-bold text-blue-400 font-mono mb-1">Common failures & fixes</h4>
                <ul className="text-[11px] list-disc pl-4 space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Two accents fighting:</strong> the eye ping-pongs. Recolour or remove one, or push one into the 30% family.</li>
                  <li><strong className="text-slate-200">Accent too big:</strong> once it passes ~20% it stops being an accent and becomes a second secondary. Tighten the lens or move it deeper in frame.</li>
                  <li><strong className="text-slate-200">Muddy secondary:</strong> if the 30% is close in value to the 60%, the frame flattens. Separate by value (light vs dark), not only by hue.</li>
                  <li><strong className="text-slate-200">Skin as accent:</strong> in cool, desaturated worlds, faces become the accent for free. Keep wardrobe away from skin tones to protect it.</li>
                  <li><strong className="text-slate-200">Lighting changes the palette:</strong> a gel or practical can turn a neutral wall into the dominant colour. Check the readout under the actual lights.</li>
                </ul>
              </div>

              <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#222226]">
                <h4 className="text-xs font-bold text-blue-400 font-mono mb-1">Reading the meters</h4>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  <strong className="text-slate-200">Compliance</strong> measures proportion only (how close you are to 60/30/10). <strong className="text-slate-200">Scheme</strong> names the relationship between the dominant and accent hues. <strong className="text-slate-200">Accent pop</strong> rates how far the accent separates from the other two in colour and saturation: above 60 it pulls the eye, below 35 it's getting lost. <strong className="text-slate-200">Match</strong> compares your frame with a chosen film palette in perceptual (Lab) colour space.
                </p>
              </div>

              <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#222226]">
                <h4 className="text-xs font-bold text-blue-400 font-mono mb-1">Eye-Trace Thermal Heatmaps</h4>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Human vision is pre-attentive: we immediately seek high local intensity differences. CineRule analyzes contrast gradients, saturation hotspots, and center-biasing to reveal where viewers will focus first, second, and third. Keep key elements in hot red fields!
                </p>
              </div>

              <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#222226]">
                <h4 className="text-xs font-bold text-blue-400 font-mono mb-1">Composition Overlays</h4>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Use Rule of Thirds to add comfortable lead room for looking subjects. Use the Golden Section/Spiral to guide natural logarithmic visual flow. Use Pyramids for heavy landscape objects or monumental architectural balance.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
