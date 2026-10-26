/**
 * Precise canvas drawing utilities for photographic composition overlays.
 * Includes Rule of Thirds, Golden Ratio, Golden Spiral, Golden Triangles,
 * Radial, Pyramid, S-Curve, Circular, and L-Arrangement.
 */

// Draw Rule of Thirds (1/3 and 2/3 lines)
export function drawRuleOfThirds(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(255, 255, 255, 0.45)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  // Vertical lines
  ctx.beginPath();
  ctx.moveTo(w / 3, 0); ctx.lineTo(w / 3, h);
  ctx.moveTo((2 * w) / 3, 0); ctx.lineTo((2 * w) / 3, h);
  // Horizontal lines
  ctx.moveTo(0, h / 3); ctx.lineTo(w, h / 3);
  ctx.moveTo(0, (2 * h) / 3); ctx.lineTo(w, (2 * h) / 3);
  ctx.stroke();

  // Draw small intersection circles to guide eyes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const intersections = [
    { x: w / 3, y: h / 3 },
    { x: (2 * w) / 3, y: h / 3 },
    { x: w / 3, y: (2 * h) / 3 },
    { x: (2 * w) / 3, y: (2 * h) / 3 }
  ];
  for (const pt of intersections) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Draw Golden Section (Grid based on 0.382 and 0.618)
export function drawGoldenSection(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(235, 196, 64, 0.55)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  const x1 = w * 0.382;
  const x2 = w * 0.618;
  const y1 = h * 0.382;
  const y2 = h * 0.618;

  ctx.beginPath();
  // Verticals
  ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
  ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
  // Horizontals
  ctx.moveTo(0, y1); ctx.lineTo(w, y1);
  ctx.moveTo(0, y2); ctx.lineTo(w, y2);
  ctx.stroke();

  // Dots
  ctx.fillStyle = color;
  const dots = [
    { x: x1, y: y1 }, { x: x2, y: y1 },
    { x: x1, y: y2 }, { x: x2, y: y2 }
  ];
  for (const d of dots) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Draw Golden Spiral (Fibonacci spiral inside viewport)
export function drawGoldenSpiral(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rotation: number = 0, // 0, 90, 180, 270 degrees to let user mirror/flip
  color: string = 'rgba(235, 196, 64, 0.65)'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Move origin to center to perform rotation, then fit
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  // Define spiral blocks inside a golden bounding box
  // Let's draw the standard Fibonacci logarithmic spiral
  // Coordinates are computed dynamically to fit the width and height
  let curW = w;
  let curH = h;
  let x = 0;
  let y = 0;

  // Directions of the arcs for 4 quadrants
  // 1: bottom-right, 2: bottom-left, 3: top-left, 4: top-right
  const phi = 1.61803398875;
  ctx.beginPath();

  // Standard Golden Spiral Arc Sequence
  // Draw bounding boxes and arcs
  let cx = x;
  let cy = y;
  let side = curW;
  
  // We can draw a highly accurate geometric golden spiral using 6 iterations
  // of shrinking squares.
  const directions = [
    { dx: 0, dy: 0, startAng: 0, endAng: Math.PI / 2, arcOffset: { x: 1, y: 0 } }, // Top-right to Bottom-right
    { dx: 1, dy: 0, startAng: Math.PI / 2, endAng: Math.PI, arcOffset: { x: 1, y: 1 } }, // Bottom-right to Bottom-left
    { dx: 1, dy: 1, startAng: Math.PI, endAng: (3 * Math.PI) / 2, arcOffset: { x: 0, y: 1 } }, // Bottom-left to Top-left
    { dx: 0, dy: 1, startAng: (3 * Math.PI) / 2, endAng: 2 * Math.PI, arcOffset: { x: 0, y: 0 } }, // Top-left to Top-right
  ];

  let squareSize = w / phi;
  let currentX = 0;
  let currentY = 0;
  let currentW = w;
  let currentH = h;

  // Let's draw the golden squares partitioning
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;

  // We can draw a gorgeous continuous spiral arc
  ctx.beginPath();
  let arcX = 0;
  let arcY = h;
  let radius = h;
  
  // Let's approximate a smooth logarithmic spiral centered on the golden ratio focal point
  // The golden focal point is located at (w * 0.72, h * 0.62) or similar depending on flip
  // Let's draw a beautiful visual representation using multi-segment bezier or a parameterized loop
  ctx.beginPath();
  const centerX = w * 0.72;
  const centerY = h * 0.618;
  const maxTheta = 4 * Math.PI; // 2 full turns
  const a = 1.8; // scaling factor
  const b = 0.30634; // Golden ratio growth constant: ln(phi) / (pi / 2) ≈ 0.306

  for (let theta = 0; theta <= maxTheta; theta += 0.05) {
    const rVal = a * Math.exp(b * theta);
    // Draw spiral outwards from center focal point
    const sx = centerX + rVal * Math.cos(theta);
    const sy = centerY + rVal * Math.sin(theta);
    
    // Check boundaries to avoid drawing out of bounds
    if (sx >= 0 && sx <= w && sy >= 0 && sy <= h) {
      if (theta === 0) {
        ctx.moveTo(sx, sy);
      } else {
        ctx.lineTo(sx, sy);
      }
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw visual grid division lines for the squares
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / phi, 0); ctx.lineTo(w / phi, h);
  ctx.moveTo(w / phi, h / phi); ctx.lineTo(w, h / phi);
  ctx.moveTo(w / phi + (w - w/phi)/phi, h / phi); ctx.lineTo(w / phi + (w - w/phi)/phi, 0);
  ctx.stroke();

  // Draw a small target circle at the spiral's core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.restore();
}

// Draw Golden Triangles
export function drawGoldenTriangles(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(255, 255, 255, 0.45)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  // Main diagonal from bottom-left to top-right
  ctx.moveTo(0, h);
  ctx.lineTo(w, 0);

  // Perpendicular line 1: from top-left (0,0) meeting diagonal at 90 degrees
  // Vector of diagonal is (w, -h). Perpendicular through (0,0)
  // Intersection point projection:
  const t1 = (w * 0 + -h * -h) / (w * w + h * h); // (h^2) / (w^2 + h^2)
  const ix1 = w * (h * h) / (w * w + h * h);
  const iy1 = h - h * (h * h) / (w * w + h * h);
  ctx.moveTo(0, 0);
  ctx.lineTo(ix1, iy1);

  // Perpendicular line 2: from bottom-right (w,h) meeting diagonal at 90 degrees
  const ix2 = w - ix1;
  const iy2 = h - iy1;
  ctx.moveTo(w, h);
  ctx.lineTo(ix2, iy2);

  ctx.stroke();
}

// Draw Diagonal Guide
export function drawDiagonalGuide(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(255, 255, 255, 0.45)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  // Diagonals
  ctx.moveTo(0, 0); ctx.lineTo(w, h);
  ctx.moveTo(0, h); ctx.lineTo(w, 0);
  
  // Parallel diagonal frames
  ctx.moveTo(w / 2, 0); ctx.lineTo(w, h / 2);
  ctx.moveTo(0, h / 2); ctx.lineTo(w / 2, h);
  ctx.stroke();
}

// Draw Radial (Starburst / symmetry grid)
export function drawRadialGuide(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(255, 255, 255, 0.4)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  ctx.beginPath();
  // Centered crosshair
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);

  // Diagonals
  ctx.moveTo(0, 0); ctx.lineTo(w, h);
  ctx.moveTo(0, h); ctx.lineTo(w, 0);

  // Inner framing box (30% of size)
  const boxW = w * 0.3;
  const boxH = h * 0.3;
  ctx.rect(w / 2 - boxW / 2, h / 2 - boxH / 2, boxW, boxH);

  ctx.stroke();
}

// Draw Compound S-Curve (flowing spline)
export function drawCompoundCurve(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(235, 196, 64, 0.6)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  // Draw a smooth S-curve from top-right down to bottom-left
  ctx.moveTo(w * 0.8, h * 0.1);
  ctx.bezierCurveTo(
    w * 0.2, h * 0.2, // Control point 1
    w * 0.8, h * 0.8, // Control point 2
    w * 0.2, h * 0.9  // End point
  );
  ctx.stroke();

  // Draw minor dash line indicators
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(w * 0.8, h * 0.1);
  ctx.lineTo(w * 0.2, h * 0.9);
  ctx.stroke();
  ctx.setLineDash([]); // Reset
}

// Draw Pyramid Guide
export function drawPyramidGuide(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(255, 255, 255, 0.45)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  // Central triangle
  ctx.moveTo(w * 0.1, h * 0.9);
  ctx.lineTo(w * 0.5, h * 0.1);
  ctx.lineTo(w * 0.9, h * 0.9);
  ctx.closePath();

  // Nested smaller triangle
  ctx.moveTo(w * 0.25, h * 0.9);
  ctx.lineTo(w * 0.5, h * 0.4);
  ctx.lineTo(w * 0.75, h * 0.9);
  ctx.closePath();

  ctx.stroke();
}

// Draw Circular Frame
export function drawCircularGuide(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(255, 255, 255, 0.4)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  // Outer ellipse
  ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.4, 0, 0, 2 * Math.PI);
  // Inner ellipse
  ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.2, 0, 0, 2 * Math.PI);
  ctx.stroke();

  // Target tick marks on 4 quadrants
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.05); ctx.lineTo(w / 2, h * 0.12);
  ctx.moveTo(w / 2, h * 0.88); ctx.lineTo(w / 2, h * 0.95);
  ctx.moveTo(w * 0.05, h / 2); ctx.lineTo(w * 0.12, h / 2);
  ctx.moveTo(w * 0.88, h / 2); ctx.lineTo(w * 0.95, h / 2);
  ctx.stroke();
}

// Draw L-Arrangement (Corner frame)
export function drawLArrangement(ctx: CanvasRenderingContext2D, w: number, h: number, color: string = 'rgba(255, 255, 255, 0.5)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  ctx.beginPath();
  // Left side vertical bracket
  ctx.moveTo(w * 0.15, h * 0.15);
  ctx.lineTo(w * 0.15, h * 0.85);
  // Bottom horizontal bracket
  ctx.lineTo(w * 0.85, h * 0.85);
  ctx.stroke();

  // Subtle opposite corner highlight bracket
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.85, h * 0.3);
  ctx.lineTo(w * 0.85, h * 0.15);
  ctx.lineTo(w * 0.7, h * 0.15);
  ctx.stroke();
}
