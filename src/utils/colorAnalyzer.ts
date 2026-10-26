import { ColorChannel } from '../types';

// Convert RGB to HEX
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert HEX to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Simple euclidean distance between two colors in RGB space
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

// Boost saturation of an RGB color to prevent muddy/dull readouts (e.g. green looking brown)
export function boostSaturation(r: number, g: number, b: number, factor: number = 1.10): { r: number; g: number; b: number } {
  const rNormal = r / 255;
  const gNormal = g / 255;
  const bNormal = b / 255;
  
  const max = Math.max(rNormal, gNormal, bNormal);
  const min = Math.min(rNormal, gNormal, bNormal);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNormal: h = (gNormal - bNormal) / d + (gNormal < bNormal ? 6 : 0); break;
      case gNormal: h = (bNormal - rNormal) / d + 2; break;
      case bNormal: h = (rNormal - gNormal) / d + 4; break;
    }
    h /= 6;
  }

  // Boost saturation and brightness realistically by 10%
  s = Math.min(1.0, s * factor);
  l = Math.min(1.0, l * 1.10);

  // Convert back to RGB
  let rOut, gOut, bOut;
  if (s === 0) {
    rOut = gOut = bOut = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rOut = hue2rgb(p, q, h + 1/3);
    gOut = hue2rgb(p, q, h);
    bOut = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(rOut * 255))),
    g: Math.max(0, Math.min(255, Math.round(gOut * 255))),
    b: Math.max(0, Math.min(255, Math.round(bOut * 255)))
  };
}

/**
 * Intelligent pre-brightness and pre-saturation boost pass helper.
 * This runs on every sampled raw pixel before clustering to expand colors.
 */
function preBoostPixel(r: number, g: number, b: number): { r: number; g: number; b: number } {
  const rNormal = r / 255;
  const gNormal = g / 255;
  const bNormal = b / 255;

  const max = Math.max(rNormal, gNormal, bNormal);
  const min = Math.min(rNormal, gNormal, bNormal);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNormal: h = (gNormal - bNormal) / d + (gNormal < bNormal ? 6 : 0); break;
      case gNormal: h = (bNormal - rNormal) / d + 2; break;
      case bNormal: h = (rNormal - gNormal) / d + 4; break;
    }
    h /= 6;
  }

  // Pre-boost: apply exactly 10% boost to brightness and 10% boost to saturation
  l = Math.min(1.0, l * 1.10);
  s = Math.min(1.0, s * 1.10);

  // Convert back to RGB
  let rOut, gOut, bOut;
  if (s === 0) {
    rOut = gOut = bOut = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rOut = hue2rgb(p, q, h + 1/3);
    gOut = hue2rgb(p, q, h);
    bOut = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(rOut * 255))),
    g: Math.max(0, Math.min(255, Math.round(gOut * 255))),
    b: Math.max(0, Math.min(255, Math.round(bOut * 255)))
  };
}

/**
 * Extracts the 3 dominant colors from an HTML5 Canvas using a fast k-means clustering.
 * Subsamples the canvas to maintain 60fps responsiveness.
 */
export function extractDominantColors(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { colors: ColorChannel[]; complianceScore: number } {
  // Use a tiny offscreen buffer size to analyze colors very quickly
  const sampleW = 24;
  const sampleH = 18;
  
  // Center-weighted window: exclude the outer 12% border to avoid dark peripheral/vignette colors
  const startX = Math.floor(width * 0.12);
  const endX = width - startX;
  const startY = Math.floor(height * 0.12);
  const endY = height - startY;

  const activeW = endX - startX;
  const activeH = endY - startY;

  const pixelData: { r: number; g: number; b: number }[] = [];
  const stepX = Math.max(1, Math.floor(activeW / sampleW));
  const stepY = Math.max(1, Math.floor(activeH / sampleH));

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = startY; y < endY; y += stepY) {
      for (let x = startX; x < endX; x += stepX) {
        const index = (y * width + x) * 4;
        if (index < data.length) {
          const rawR = data[index];
          const rawG = data[index + 1];
          const rawB = data[index + 2];
          const boosted = preBoostPixel(rawR, rawG, rawB);
          pixelData.push(boosted);
        }
      }
    }
  } catch (e) {
    // Fail-safe if canvas is tainted or empty
    return {
      colors: [
        { hex: '#3b82f6', percentage: 60 },
        { hex: '#10b981', percentage: 30 },
        { hex: '#f59e0b', percentage: 10 }
      ],
      complianceScore: 100
    };
  }

  if (pixelData.length === 0) {
    return {
      colors: [
        { hex: '#888888', percentage: 60 },
        { hex: '#aaaaaa', percentage: 30 },
        { hex: '#cccccc', percentage: 10 }
      ],
      complianceScore: 100
    };
  }

  // Quick K-Means clustering for k = 3
  // 1. Deterministic farthest-point seeding over a coarse colour histogram.
  //    Seeds come only from bins holding >= 2% of the frame, so a stray noisy
  //    pixel can't become the "accent". Start from the most populated bin, then
  //    add the populated bin farthest from every chosen seed. Stable frame to
  //    frame, and it finds a small accent instead of averaging it away.
  const bins = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (const p of pixelData) {
    const key = ((p.r >> 5) << 6) | ((p.g >> 5) << 3) | (p.b >> 5);
    const bin = bins.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    bin.r += p.r; bin.g += p.g; bin.b += p.b; bin.n++;
    bins.set(key, bin);
  }
  const minCount = Math.max(2, Math.floor(pixelData.length * 0.02));
  const allBins = [...bins.values()].map(b => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n }));
  let candidates = allBins.filter(b => b.n >= minCount);
  if (candidates.length === 0) candidates = allBins;
  candidates.sort((a, b) => b.n - a.n);

  let centroids: { r: number; g: number; b: number }[] = [{ r: candidates[0].r, g: candidates[0].g, b: candidates[0].b }];
  while (centroids.length < 3) {
    let farthest: { r: number; g: number; b: number } = candidates[0];
    let farthestDist = -1;
    for (const p of candidates) {
      let nearest = Infinity;
      for (const c of centroids) {
        nearest = Math.min(nearest, colorDistance(p.r, p.g, p.b, c.r, c.g, c.b));
      }
      if (nearest > farthestDist) { farthestDist = nearest; farthest = p; }
    }
    // Flat frame (every pixel the same): offset so clusters don't collapse
    centroids.push(farthestDist < 10
      ? { r: (centroids[0].r + 60 * centroids.length) % 255, g: (centroids[0].g + 90) % 255, b: (centroids[0].b + 120) % 255 }
      : { r: farthest.r, g: farthest.g, b: farthest.b });
  }

  const maxIterations = 6; // Sample is only ~430 pixels, so a few extra passes are cheap
  let clusters: { r: number; g: number; b: number }[][] = [[], [], []];

  for (let iter = 0; iter < maxIterations; iter++) {
    clusters = [[], [], []];
    
    // Assign pixels to closest centroid
    for (const pixel of pixelData) {
      let minDist = Infinity;
      let closestClusterIndex = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(pixel.r, pixel.g, pixel.b, centroids[i].r, centroids[i].g, centroids[i].b);
        if (dist < minDist) {
          minDist = dist;
          closestClusterIndex = i;
        }
      }
      clusters[closestClusterIndex].push(pixel);
    }

    // Update centroids
    for (let i = 0; i < centroids.length; i++) {
      const cluster = clusters[i];
      if (cluster.length > 0) {
        let sumR = 0, sumG = 0, sumB = 0;
        for (const p of cluster) {
          sumR += p.r;
          sumG += p.g;
          sumB += p.b;
        }
        centroids[i] = {
          r: sumR / cluster.length,
          g: sumG / cluster.length,
          b: sumB / cluster.length
        };
      }
    }
  }

  // Calculate percentages and create the resulting channel list
  const totalPixels = pixelData.length;
  let channels: ColorChannel[] = centroids.map((centroid, index) => {
    const boosted = boostSaturation(centroid.r, centroid.g, centroid.b, 1.10);
    const hex = rgbToHex(boosted.r, boosted.g, boosted.b);
    const count = clusters[index].length;
    const percentage = Math.max(1, Math.round((count / totalPixels) * 100));
    return { hex, percentage };
  });

  // Sort channels descending by percentage
  channels.sort((a, b) => b.percentage - a.percentage);

  // Normalize percentages to sum exactly to 100%
  const currentSum = channels.reduce((sum, ch) => sum + ch.percentage, 0);
  if (currentSum !== 100 && currentSum > 0) {
    const diff = 100 - currentSum;
    channels[0].percentage = Math.max(1, channels[0].percentage + diff);
  }

  // Calculate 60-30-10 compliance score
  // Ideal proportions: 60%, 30%, 10%
  // Sum of absolute errors = |P1 - 60| + |P2 - 30| + |P3 - 10|
  // The maximum possible error is roughly 100 (e.g. if one color occupies 100%: |100-60| + |0-30| + |0-10| = 80)
  const error =
    Math.abs(channels[0].percentage - 60) +
    Math.abs(channels[1].percentage - 30) +
    Math.abs(channels[2].percentage - 10);

  // Max error is 80 (since total is 100). Let's calculate percentage compliance.
  // 0 error = 100% score, 80 error = 0% score.
  const complianceScore = Math.max(0, Math.min(100, Math.round(100 - (error / 80) * 100)));

  return {
    colors: channels,
    complianceScore
  };
}

/**
 * Returns user suggestions based on current color compliance and parameters
 */
export function getColorSuggestions(colors: ColorChannel[], score: number): string {
  if (score >= 90) {
    return "Perfect! Your scene has a highly professional 60-30-10 color harmony.";
  }
  if (score >= 75) {
    return "Excellent color harmony. The dominant tones are well-balanced.";
  }

  const [dom, sec, acc] = colors;
  if (!dom || !sec || !acc) return "Analyzing color profile...";

  if (dom.percentage > 75) {
    return `Scene is too monochromatic (${dom.percentage}% dominant). Introduce a secondary colored object (~30%) or a small vibrant accent item (~10%) to break up the space.`;
  }
  if (dom.percentage < 45) {
    return `Colors are cluttered (dominant is only ${dom.percentage}%). Try simplifying the frame or narrowing the view to establish a clear main background color (~60%).`;
  }
  if (acc.percentage > 22) {
    return `Accent color is overwhelming (${acc.percentage}%). Try reframing to isolate the pop of accent color to a smaller area (~10%) to draw stronger focal interest.`;
  }
  if (sec.percentage < 18) {
    return `The secondary framing color is too weak (${sec.percentage}%). Add a supportive element (like furniture, foliage, or a shadow wall) to occupy roughly 30% of the space.`;
  }

  return "Adjust composition slightly to emphasize the dominant background or balance the accent pop.";
}
