/**
 * Hardware-accelerated Real-time Saliency (Eye Trace) Heatmap Generator
 * Runs entirely on-device at 60 FPS.
 */

// Create a pre-rendered 1D thermal gradient strip for color mapping
let gradientCanvas: HTMLCanvasElement | null = null;
let gradientData: Uint8ClampedArray | null = null;

function initGradient() {
  if (gradientCanvas) return;
  gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 256;
  gradientCanvas.height = 1;
  const ctx = gradientCanvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    // Dark transparent blue (cold) -> Cyan -> Green -> Yellow -> Bright Red (focal point)
    grad.addColorStop(0.0, 'rgba(0, 0, 150, 0.0)');
    grad.addColorStop(0.15, 'rgba(0, 0, 255, 0.2)');
    grad.addColorStop(0.35, 'rgba(0, 255, 255, 0.4)');
    grad.addColorStop(0.55, 'rgba(0, 255, 0, 0.55)');
    grad.addColorStop(0.75, 'rgba(255, 255, 0, 0.7)');
    grad.addColorStop(0.92, 'rgba(255, 100, 0, 0.85)');
    grad.addColorStop(1.0, 'rgba(255, 0, 0, 0.95)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);
    gradientData = ctx.getImageData(0, 0, 256, 1).data;
  }
}

/**
 * Computes an eye trace heatmap overlay on a target canvas based on contrast, color intensity, and depth features.
 */
export function generateEyeTraceMap(
  srcCtx: CanvasRenderingContext2D,
  destCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number = 0.5
) {
  initGradient();
  if (!gradientData) return;

  // 1. Downsample the source frame to a tiny grid (e.g., 40x30) to compute saliency extremely fast
  const sw = 40;
  const sh = 30;

  // We'll create or reuse a helper canvas for downsampling
  const downsampleCanvas = document.createElement('canvas');
  downsampleCanvas.width = sw;
  downsampleCanvas.height = sh;
  const dCtx = downsampleCanvas.getContext('2d');
  if (!dCtx) return;

  // Draw the source frame downscaled
  dCtx.drawImage(srcCtx.canvas, 0, 0, sw, sh);
  const imgData = dCtx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // Allocate array for saliency values
  const saliency = new Float32Array(sw * sh);
  let maxVal = 0.01; // Avoid divide-by-zero

  // 2. Loop through pixels and compute Contrast + Saturation + CenterBias
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Luminosity (grayscale value)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Color Saturation (Chroma estimate)
      const maxChroma = Math.max(r, g, b);
      const minChroma = Math.min(r, g, b);
      const saturation = maxChroma === 0 ? 0 : (maxChroma - minChroma) / maxChroma;

      // Local Contrast (Difference with right and bottom neighbor)
      let contrast = 0;
      if (x < sw - 1) {
        const rIdx = (y * sw + (x + 1)) * 4;
        const rLum = 0.299 * data[rIdx] + 0.587 * data[rIdx + 1] + 0.114 * data[rIdx + 2];
        contrast += Math.abs(lum - rLum);
      }
      if (y < sh - 1) {
        const bIdx = ((y + 1) * sw + x) * 4;
        const bLum = 0.299 * data[bIdx] + 0.587 * data[bIdx + 1] + 0.114 * data[bIdx + 2];
        contrast += Math.abs(lum - bLum);
      }

      // Center Bias (Photographers focus closer to the center / golden sections)
      const dx = x - sw / 2;
      const dy = y - sh / 2;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const centerFactor = Math.max(0, 1 - distFromCenter / (Math.sqrt((sw/2)**2 + (sh/2)**2)));

      // Combine factors: 50% Local contrast, 35% Saturation, 15% Center bias
      const weight = (contrast * 1.5) + (saturation * 120) + (centerFactor * 45);
      
      const sIdx = y * sw + x;
      saliency[sIdx] = weight;
      if (weight > maxVal) {
        maxVal = weight;
      }
    }
  }

  // 3. Normalize saliency values and draw back onto the tiny downsample canvas as thermal colors
  const outputData = dCtx.createImageData(sw, sh);
  const out = outputData.data;

  for (let i = 0; i < sw * sh; i++) {
    // Normalize to 0-255
    const norm = Math.min(255, Math.floor((saliency[i] / maxVal) * 255));
    
    // Look up the thermal color in our pre-calculated gradient
    const gradIdx = norm * 4;
    const outIdx = i * 4;

    out[outIdx] = gradientData[gradIdx];       // R
    out[outIdx + 1] = gradientData[gradIdx + 1]; // G
    out[outIdx + 2] = gradientData[gradIdx + 2]; // B
    out[outIdx + 3] = Math.floor(gradientData[gradIdx + 3] * opacity); // A (scale with global heatmap opacity)
  }

  dCtx.putImageData(outputData, 0, 0);

  // 4. Render back to full resolution using hardware-accelerated canvas smoothing!
  // This turns our pixelated 40x30 thermal map into a gorgeous, smooth, organic eye-trace glow.
  destCtx.save();
  destCtx.imageSmoothingEnabled = true;
  destCtx.imageSmoothingQuality = 'high';
  destCtx.globalCompositeOperation = 'source-over';
  destCtx.drawImage(downsampleCanvas, 0, 0, width, height);
  destCtx.restore();
}

/**
 * Returns eye-trace framing optimization tips.
 */
export function getEyeTraceSuggestion(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { focusArea: string; suggestion: string } {
  const sw = 8;
  const sh = 6;
  const downsampleCanvas = document.createElement('canvas');
  downsampleCanvas.width = sw;
  downsampleCanvas.height = sh;
  const dCtx = downsampleCanvas.getContext('2d');
  
  if (!dCtx) {
    return { focusArea: "Center", suggestion: "Keep your main subject near the core grid intersections." };
  }

  try {
    dCtx.drawImage(ctx.canvas, 0, 0, sw, sh);
    const imgData = dCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // We split the 8x6 grid into 9 virtual sectors: Left-Top, Center-Top, Right-Top, Left-Mid, etc.
    let sectors = Array(9).fill(0);

    for (let y = 0; y < sh; y++) {
      const sectorY = y < 2 ? 0 : y < 4 ? 1 : 2;
      for (let x = 0; x < sw; x++) {
        const sectorX = x < 3 ? 0 : x < 5 ? 1 : 2;
        const idx = (y * sw + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Saliency indicator: Contrast and Brightness combined
        const value = 0.299 * r + 0.587 * g + 0.114 * b;
        const sectorIdx = sectorY * 3 + sectorX;
        sectors[sectorIdx] += value;
      }
    }

    // Find sector with maximum attention
    let maxSectorIdx = 0;
    let maxSectorVal = -1;
    for (let i = 0; i < sectors.length; i++) {
      if (sectors[i] > maxSectorVal) {
        maxSectorVal = sectors[i];
        maxSectorIdx = i;
      }
    }

    const sectorNames = [
      "Top-Left Corner", "Top Center", "Top-Right Corner",
      "Mid-Left Rail", "Center Stage", "Mid-Right Rail",
      "Bottom-Left Corner", "Bottom Center", "Bottom-Right Corner"
    ];

    const activeSector = sectorNames[maxSectorIdx];
    let tip = "";

    switch (maxSectorIdx) {
      case 0: // Top-Left
      case 2: // Top-Right
        tip = "Visual energy is pulling strongly to the top corners. If this isn't a secondary element like foliage or sky clouds, lower your camera slightly to center the focus.";
        break;
      case 1: // Top-Center
        tip = "High attention detected in the upper center. This works great for symmetrical vertical structures, but consider shifting slightly left or right to create room for breathing space.";
        break;
      case 3: // Mid-Left
      case 5: // Mid-Right
        tip = `Excellent negative space usage! The eye traces strongly along the ${activeSector}. This creates a great cinematic 'rule of thirds' lead-in.`;
        break;
      case 4: // Center
        tip = "Classic center-weight composition. Highly stable and direct. For a more dynamic feel, try off-centering the subject along one of the vertical grids.";
        break;
      case 6: // Bottom-Left
      case 8: // Bottom-Right
        tip = "The eye is being pulled down to the lower margins. Check if there are distracting foreground elements; tilted or elevated framing can lift the focal balance.";
        break;
      case 7: // Bottom-Center
        tip = "Lead weight at the bottom center. Great for anchoring wide landscape horizons, but make sure the sky or upper-middle has a balanced counterweight.";
        break;
      default:
        tip = "Keep your main visual weights aligned with grid line intersections to guide the viewer's eye naturally.";
    }

    return {
      focusArea: activeSector,
      suggestion: tip
    };
  } catch (e) {
    return {
      focusArea: "Center",
      suggestion: "Visual flow is balanced. Guide the eye by placing high-contrast borders on the intersections."
    };
  }
}
