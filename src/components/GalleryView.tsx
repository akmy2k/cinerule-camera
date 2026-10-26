import React, { useState, useEffect } from 'react';
import { CapturedPhoto } from '../types';
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
import {
  Calendar,
  Camera,
  Trash2,
  Sparkles,
  Layers,
  Sliders,
  Eye,
  Info,
  ChevronRight,
  Maximize2,
  X,
  FileCheck,
  Award,
  BookOpen,
  ArrowLeft,
  Settings,
  CloudLightning,
  AlertTriangle,
  Flame
} from 'lucide-react';

interface GalleryViewProps {
  photos: CapturedPhoto[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ photos, onDelete, onClearAll }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<CapturedPhoto | null>(null);
  const [overlayActive, setOverlayActive] = useState<boolean>(false);
  const [heatmapActive, setHeatmapActive] = useState<boolean>(false);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.55);

  // Gemini AI Critique states
  const [loadingCritique, setLoadingCritique] = useState<boolean>(false);
  const [critiqueError, setCritiqueError] = useState<string | null>(null);

  // Overlay Canvas ref inside the modal to draw retrofitted composition grids
  const modalCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Local, on-device Calibration & Critique generator (completely offline/cPanel friendly)
  const generateLocalReview = (photo: CapturedPhoto): string => {
    const ruleName = photo.compositionRule || 'Rule of Thirds';
    const score = photo.complianceScore || 0;
    const colors = photo.colors || [];
    const params = photo.cameraParams || { focalLength: 35, aperture: 'f/2.8', iso: 200, shutterSpeed: '1/125', ev: 0, wb: 'Auto' };

    // Extract colors
    let dominantColorHex = '#888888';
    let dominantPct = 0;
    let secondaryColorHex = '#888888';
    let secondaryPct = 0;
    let accentColorHex = '#888888';
    let accentPct = 0;

    if (colors.length > 0) {
      dominantColorHex = colors[0].hex;
      dominantPct = colors[0].percentage;
    }
    if (colors.length > 1) {
      secondaryColorHex = colors[1].hex;
      secondaryPct = colors[1].percentage;
    }
    if (colors.length > 2) {
      accentColorHex = colors[2].hex;
      accentPct = colors[2].percentage;
    }

    // Calculate deviation from perfect 60-30-10 rule
    const dominantDev = Math.abs(dominantPct - 60);
    const secondaryDev = Math.abs(secondaryPct - 30);
    const accentDev = Math.abs(accentPct - 10);
    const totalDev = dominantDev + secondaryDev + accentDev;

    let colorEvaluation = '';
    if (totalDev < 15) {
      colorEvaluation = `The color palette is incredibly harmonious, showing exceptional adherence to the classic 60-30-10 rule. The dominant color (${dominantColorHex} at ${dominantPct}%) creates a powerful background mood, while the secondary tone (${secondaryColorHex} at ${secondaryPct}%) provides stable structural balance. The vibrant accent accentuates key visual nodes (${accentColorHex} at ${accentPct}%) beautifully without overwhelming the scene.`;
    } else if (totalDev < 30) {
      colorEvaluation = `The image achieves a pleasing color balance. The dominant tone (${dominantColorHex} at ${dominantPct}%) establishes the primary atmospheric layer. The secondary color (${secondaryColorHex} at ${secondaryPct}%) supports the composition effectively, though the accent color (${accentColorHex} at ${accentPct}%) is slightly ${accentPct < 10 ? 'under-represented and could be more prominent' : 'strong and could be dialled back for a more subtle finish'}.`;
    } else {
      colorEvaluation = `The color scheme is dynamic and high-contrast, departing from standard proportions. The primary shade (${dominantColorHex}) commands a significant ${dominantPct}%, creating a highly saturated background. The secondary tone (${secondaryColorHex} at ${secondaryPct}%) and accent (${accentColorHex} at ${accentPct}%) compete slightly for visual dominance, creating an energetic and intense aesthetic rather than traditional passive harmony.`;
    }

    // Composition evaluation based on score
    let compEvaluation = '';
    if (score >= 85) {
      compEvaluation = `Excellent alignment with the '${ruleName}' rule (Calibration Score: ${score}%). Your focal subject is placed precisely along the mathematical nodes, guiding the viewer's eye along the structured lines of force. There is a strong sense of deliberate framing, visual balance, and tension.`;
    } else if (score >= 65) {
      compEvaluation = `Good compositional structure (Calibration Score: ${score}%). The scene shows clear intent to leverage the '${ruleName}' framework. Some primary elements are slightly offset from the exact nodes, which creates a softer, more casual balance. Shifting your framing slightly to align more tightly with the overlay grids would increase the visual impact.`;
    } else {
      compEvaluation = `Dynamic framing with some asymmetry (Calibration Score: ${score}%). While the '${ruleName}' grid was active, the central mass of the photograph lies outside the standard alignment coordinates. This produces a free-form composition with off-center visual weight. This can work for candid shots, but tighter alignment is recommended for formal structure.`;
    }

    // Actionable technical advices
    let advice1 = '';
    let advice2 = '';

    // Tailored to focal length
    if (params.focalLength <= 24) {
      advice1 = `• WIDE-ANGLE STRETCH: At ${params.focalLength}mm, watch for lens distortion around the edges. Keep your main subject closer to the center nodes to prevent unwanted physical stretching of faces or objects.`;
    } else if (params.focalLength >= 70) {
      advice1 = `• COMPRESSION & DEPTH: With a telephoto focal length of ${params.focalLength}mm, background compression is high. Make sure the foreground subject stands out clearly by maintaining a high-contrast background or shallow depth of field.`;
    } else {
      advice1 = `• NATURAL PERSPECTIVE: Your focal length of ${params.focalLength}mm mimics standard human vision. Focus on physical footwork—take two steps forward or to the side to eliminate distracting background elements and simplify your composition.`;
    }

    // Tailored to score & lighting/ISO
    if (params.iso > 800) {
      advice2 = `• SENSOR CALIBRATION: The high ISO of ${params.iso} introduces noise. If you are shooting in low-light, try to stabilize the camera or lower the exposure value (EV) slightly to preserve color saturation and keep details clean.`;
    } else if (score < 75) {
      advice2 = `• PRECISION GRIDDING: Try zooming in slightly or cropping the shot post-capture to realign the key visual elements with the exact grid intersections of the '${ruleName}' rule to instantly boost visual weight.`;
    } else {
      advice2 = `• APERTURE SEPARATION: At ${params.aperture}, consider how much depth of field you want. A wider aperture (smaller f-number) will create beautiful blur (bokeh) that isolates your calibrated colors perfectly.`;
    }

    return `🎨 COLOR HARMONY:
${colorEvaluation}

📏 COMPOSITION ALIGNMENT:
${compEvaluation}

⚡ ACTIONABLE ADVICE:
${advice1}
${advice2}`;
  };

  // Trigger server-side Gemini API critique
  const requestAICritique = async (photo: CapturedPhoto) => {
    if (!photo) return;
    setLoadingCritique(true);
    setCritiqueError(null);

    // Simulate on-device matrix scan for visual feedback
    setTimeout(() => {
      try {
        const critiqueText = generateLocalReview(photo);
        
        // Update the active selected photo state with critique
        const updatedPhoto = { ...photo, aiCritique: critiqueText };
        setSelectedPhoto(updatedPhoto);
        
        // Update inside stored parent storage also
        photo.aiCritique = critiqueText;
        
        // Store in localStorage
        const local = localStorage.getItem('auracam_gallery');
        if (local) {
          const list: CapturedPhoto[] = JSON.parse(local);
          const idx = list.findIndex(p => p.id === photo.id);
          if (idx !== -1) {
            list[idx].aiCritique = critiqueText;
            localStorage.setItem('auracam_gallery', JSON.stringify(list));
          }
        }
      } catch (err: any) {
        console.error(err);
        setCritiqueError('Unable to generate calibration report.');
      } finally {
        setLoadingCritique(false);
      }
    }, 600);
  };

  // Redraw modal overlays whenever toggles or selected photo changes
  useEffect(() => {
    const canvas = modalCanvasRef.current;
    if (!canvas || !selectedPhoto) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear overlay canvas
    ctx.clearRect(0, 0, w, h);

    if (overlayActive) {
      ctx.save();
      // Match active stored composition rule to draw on top of saved photo
      const rule = selectedPhoto.compositionRule;
      if (rule.includes('Thirds')) {
        drawRuleOfThirds(ctx, w, h, 'rgba(255, 191, 0, 0.75)');
      } else if (rule.includes('Section')) {
        drawGoldenSection(ctx, w, h, 'rgba(235, 196, 64, 0.8)');
      } else if (rule.includes('Spiral')) {
        drawGoldenSpiral(ctx, w, h, 0, 'rgba(235, 196, 64, 0.85)');
      } else if (rule.includes('Triangles')) {
        drawGoldenTriangles(ctx, w, h, 'rgba(255, 255, 255, 0.7)');
      } else if (rule.includes('Diagonal')) {
        drawDiagonalGuide(ctx, w, h, 'rgba(255, 255, 255, 0.7)');
      } else if (rule.includes('Radial')) {
        drawRadialGuide(ctx, w, h, 'rgba(255, 255, 255, 0.65)');
      } else if (rule.includes('Curve')) {
        drawCompoundCurve(ctx, w, h, 'rgba(235, 196, 64, 0.8)');
      } else if (rule.includes('Pyramid')) {
        drawPyramidGuide(ctx, w, h, 'rgba(255, 255, 255, 0.7)');
      } else if (rule.includes('Circular')) {
        drawCircularGuide(ctx, w, h, 'rgba(255, 255, 255, 0.65)');
      } else if (rule.includes('L-Arrangement')) {
        drawLArrangement(ctx, w, h, 'rgba(255, 255, 255, 0.8)');
      }
      ctx.restore();
    }
  }, [selectedPhoto, overlayActive]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 select-none font-sans">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#222226] pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <Award className="w-5 h-5 text-blue-400" />
            CAPTURED FRAME GALLERY
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            On-device localized frame storage and 60-30-10 color diagnostics.
          </p>
        </div>
        
        {photos.length > 0 && (
          <button
            id="gallery_clear_all_button"
            onClick={() => {
              if (window.confirm("Are you sure you want to permanently delete all captured frames in the gallery?")) {
                onClearAll();
              }
            }}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Storage</span>
          </button>
        )}
      </div>

      {/* NO CAPTURES EMPTY STATE */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-[#141417] border border-dashed border-[#222226] rounded-2xl text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#0A0A0B] border border-[#222226] flex items-center justify-center text-slate-400 mb-4">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">No Captures Yet</h3>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Go back to the Live Monitor and trigger a Screen Grab to inspect your 60-30-10 color compliance scores and overlays!
          </p>
        </div>
      ) : (
        
        /* PHOTO GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(photo => (
            <div
              id={`photo_card_${photo.id}`}
              key={photo.id}
              onClick={() => {
                setSelectedPhoto(photo);
                setOverlayActive(false);
                setHeatmapActive(false);
                setCritiqueError(null);
              }}
              className="bg-[#141417] border border-[#222226] hover:border-slate-600 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer group flex flex-col shadow-lg"
            >
              {/* Image Frame Viewport */}
              <div className="relative aspect-video bg-[#0A0A0B] overflow-hidden">
                <img
                  src={photo.dataUrl}
                  alt={photo.compositionRule}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                
                {/* Score badge */}
                <div className="absolute top-2 right-2 bg-[#0A0A0B]/85 backdrop-blur-md px-2 py-0.5 rounded-lg border border-[#222226] text-[9px] font-mono font-bold text-blue-400 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 text-blue-400 fill-blue-400/20 animate-pulse" />
                  <span>{photo.complianceScore}% Match</span>
                </div>

                {/* Overlaid Grid Indicator Tag */}
                <div className="absolute bottom-2 left-2 bg-[#0A0A0B]/85 backdrop-blur-md px-1.5 py-0.5 rounded border border-[#222226] text-[8px] font-mono text-slate-300">
                  {photo.compositionRule}
                </div>
              </div>

              {/* Stored Stats summary footer */}
              <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                
                {/* 60-30-10 dominant color stripe */}
                <div className="flex flex-col gap-1">
                  <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-800">
                    {photo.colors.map((ch, idx) => (
                      <div
                        key={idx}
                        className="h-full"
                        style={{
                          backgroundColor: ch.hex,
                          width: `${ch.percentage}%`
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: photo.colors[0]?.hex }} />
                      {photo.colors[0]?.percentage}%
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: photo.colors[1]?.hex }} />
                      {photo.colors[1]?.percentage}%
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: photo.colors[2]?.hex }} />
                      {photo.colors[2]?.percentage}%
                    </span>
                  </div>
                </div>

                {/* Time and trash row */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{photo.cameraParams.focalLength}mm • f/{photo.cameraParams.aperture.replace('f/', '')}</span>
                  
                  <button
                    id={`photo_delete_button_${photo.id}`}
                    onClick={(e) => {
                      e.stopPropagation(); // prevent opening modal
                      if (window.confirm("Permanently delete this screen grab?")) {
                        onDelete(photo.id);
                      }
                    }}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAILED INSPECTOR MODAL */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-[#0A0A0B]/90 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          
          {/* Modal Card */}
          <div className="bg-[#141417] border border-[#222226] rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col md:grid md:grid-cols-12 overflow-hidden my-4">
            
            {/* Left Box: Active Image & Overlays Viewport (Col Span 7) */}
            <div className="md:col-span-7 relative bg-[#0A0A0B] aspect-video flex items-center justify-center border-b md:border-b-0 md:border-r border-[#222226]">
              
              {/* Photo Source */}
              <img
                src={selectedPhoto.dataUrl}
                alt={selectedPhoto.compositionRule}
                className="w-full h-full object-contain block"
                referrerPolicy="no-referrer"
              />

              {/* Original Saliency Heatmap Overlay (if toggled) */}
              {heatmapActive && selectedPhoto.heatmapDataUrl && (
                <img
                  src={selectedPhoto.heatmapDataUrl}
                  alt="Saved heatmap"
                  className="absolute inset-0 w-full h-full object-contain block pointer-events-none mix-blend-screen"
                  style={{ opacity: heatmapOpacity }}
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Dynamic canvas for redrawing original grid layers */}
              <canvas
                ref={modalCanvasRef}
                width={768}
                height={432}
                className="absolute inset-0 w-full h-full object-contain block pointer-events-none"
              />

              {/* Close Button top corner on Viewport */}
              <button
                id="gallery_modal_close_top"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 left-3 p-2 bg-[#141417]/95 hover:bg-[#1e1e24] text-slate-300 rounded-full border border-[#222226] transition-colors cursor-pointer"
                title="Back to gallery"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Visual overlays controller panel inside viewport */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                <div className="flex gap-1.5">
                  <button
                    id="gallery_overlay_toggle"
                    onClick={() => setOverlayActive(!overlayActive)}
                    className={`px-2.5 py-1.5 text-[10px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      overlayActive
                        ? 'bg-white text-[#0A0A0B] border-white'
                        : 'bg-[#0A0A0B]/85 hover:bg-[#141417] text-slate-300 border-[#222226]'
                    }`}
                  >
                    Grid Lines: {overlayActive ? 'ON' : 'OFF'}
                  </button>

                  {selectedPhoto.heatmapDataUrl && (
                    <button
                      id="gallery_heatmap_toggle"
                      onClick={() => setHeatmapActive(!heatmapActive)}
                      className={`px-2.5 py-1.5 text-[10px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                        heatmapActive
                          ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
                          : 'bg-[#0A0A0B]/85 hover:bg-[#141417] text-slate-300 border-[#222226]'
                      }`}
                    >
                      Eye-Trace: {heatmapActive ? 'ACTIVE' : 'OFF'}
                    </button>
                  )}
                </div>

                <div className="bg-[#0A0A0B]/85 backdrop-blur-md px-2 py-1 rounded text-[9px] font-mono text-slate-400 border border-[#222226]">
                  Focal scale: {selectedPhoto.focalCropScale?.toFixed(1) || '1.0'}x
                </div>
              </div>

            </div>

            {/* Right Box: Analytics & AI Critic Panel (Col Span 5) */}
            <div className="md:col-span-5 p-5 sm:p-6 flex flex-col justify-between max-h-[500px] md:max-h-none overflow-y-auto">
              
              <div className="flex flex-col gap-4">
                
                {/* Header title */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest font-semibold">METADATA REPORT</span>
                    <h3 className="text-base font-bold text-white flex items-center gap-1.5 uppercase font-mono tracking-tight">
                      {selectedPhoto.compositionRule} Capture
                    </h3>
                  </div>
                  <button
                    id="gallery_modal_close_main"
                    onClick={() => setSelectedPhoto(null)}
                    className="p-1.5 hover:bg-[#1e1e24] text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Camera Parameter HUD */}
                <div className="grid grid-cols-3 gap-1.5 bg-[#0A0A0B] rounded-2xl p-4 border border-[#222226] text-[10px] font-mono text-slate-300">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 uppercase text-[8px]">Lens Length</span>
                    <span className="text-slate-100 font-bold">{selectedPhoto.cameraParams.focalLength}mm</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 uppercase text-[8px]">Aperture</span>
                    <span className="text-slate-100 font-bold">{selectedPhoto.cameraParams.aperture}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 uppercase text-[8px]">ISO Rate</span>
                    <span className="text-slate-100 font-bold">ISO {selectedPhoto.cameraParams.iso}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    <span className="text-slate-500 uppercase text-[8px]">Shutter Speed</span>
                    <span className="text-slate-100 font-bold">{selectedPhoto.cameraParams.shutterSpeed}s</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    <span className="text-slate-500 uppercase text-[8px]">Compensation</span>
                    <span className="text-slate-100 font-bold">{selectedPhoto.cameraParams.ev >= 0 ? `+${selectedPhoto.cameraParams.ev.toFixed(1)}` : selectedPhoto.cameraParams.ev.toFixed(1)} EV</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    <span className="text-slate-500 uppercase text-[8px]">White Balance</span>
                    <span className="text-slate-100 font-bold">{selectedPhoto.cameraParams.wb}</span>
                  </div>
                </div>

                {/* 60-30-10 diagnostic breakdown */}
                <div className="flex flex-col gap-2 bg-[#0A0A0B] border border-[#222226] rounded-2xl p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold font-mono text-slate-300">60-30-10 Palette Ratio</span>
                    <span className="text-xs font-bold text-blue-400 font-mono">{selectedPhoto.complianceScore}% Compliance</span>
                  </div>
                  
                  <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-800">
                    {selectedPhoto.colors.map((ch, idx) => (
                      <div
                        key={idx}
                        className="h-full"
                        style={{
                          backgroundColor: ch.hex,
                          width: `${ch.percentage}%`
                        }}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {selectedPhoto.colors.map((ch, idx) => (
                      <div key={idx} className="flex flex-col gap-0.5 bg-[#141417] p-1.5 rounded border border-[#222226]">
                        <span className="text-[8px] text-slate-500 font-mono">
                          {idx === 0 ? '60% Dom' : idx === 1 ? '30% Sec' : '10% Acc'}
                        </span>
                        <div className="flex items-center gap-1 font-mono text-[9px] font-bold text-slate-200">
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ch.hex }} />
                          <span>{ch.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HEATMAP ADJUSTMENT OPACITY (only visible when heatmap is toggled on) */}
                {heatmapActive && (
                  <div className="flex flex-col gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                    <label className="text-[10px] font-mono font-bold text-blue-400 flex items-center justify-between">
                      <span>Heatmap Transparency</span>
                      <span>{Math.round(heatmapOpacity * 100)}%</span>
                    </label>
                    <input
                      id="gallery_heatmap_opacity_slider"
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={heatmapOpacity}
                      onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 bg-[#0A0A0B] rounded appearance-none h-1 cursor-pointer"
                    />
                  </div>
                )}

                {/* PERSISTENT CALIBRATION ZONE */}
                <div className="border-t border-[#222226] pt-4 mt-1">
                  
                  {/* If critique has not been retrieved yet */}
                  {!selectedPhoto.aiCritique && !loadingCritique && (
                    <button
                      id="gallery_ai_critique_trigger"
                      onClick={() => requestAICritique(selectedPhoto)}
                      className="w-full py-3 px-4 bg-white hover:bg-gray-200 text-[#0A0A0B] rounded-2xl font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer uppercase tracking-wider"
                    >
                      <Sparkles className="w-4 h-4 text-black fill-black animate-pulse" />
                      <span>GENERATE CALIBRATION REPORT</span>
                    </button>
                  )}

                  {/* Loading Spinner */}
                  {loadingCritique && (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-300 gap-2.5 bg-[#0A0A0B] border border-[#222226] rounded-xl p-4">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Analyzing Composition & Colors...</span>
                    </div>
                  )}

                  {/* Critique Error Notice */}
                  {critiqueError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-xs text-red-400 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 font-bold font-mono">
                        <AlertTriangle className="w-4 h-4" />
                        <span>CALIBRATION FAIL</span>
                      </div>
                      <p className="font-sans leading-relaxed text-red-300/90">{critiqueError}</p>
                    </div>
                  )}

                  {/* Loaded Critique Display (rendered beautifully with Markdown feel) */}
                  {selectedPhoto.aiCritique && (
                    <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-400/20 rounded-xl p-4 text-slate-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 font-mono mb-2 uppercase">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span>CAMERA CALIBRATION REPORT</span>
                      </div>
                      <div className="text-[11px] leading-relaxed font-sans space-y-2 whitespace-pre-line text-slate-300">
                        {selectedPhoto.aiCritique}
                      </div>
                    </div>
                  )}

                </div>

              </div>

              {/* Close Button Bottom for fast mobile exit */}
              <button
                id="gallery_modal_close_bottom"
                onClick={() => setSelectedPhoto(null)}
                className="w-full mt-6 py-2.5 bg-[#0A0A0B] hover:bg-[#1e1e24] text-[#E0E0E0] text-xs font-semibold rounded-xl transition-colors border border-[#222226] cursor-pointer uppercase font-mono tracking-wider"
              >
                Back to Grid
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};
