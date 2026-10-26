import React, { useRef, useEffect } from 'react';

interface HistogramProps {
  srcCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeChannels: {
    r: boolean;
    g: boolean;
    b: boolean;
    lum: boolean;
  };
}

export const Histogram: React.FC<HistogramProps> = ({ srcCanvasRef, activeChannels }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animationId: number;

    const renderHistogram = () => {
      const srcCanvas = srcCanvasRef.current;
      const destCanvas = canvasRef.current;

      if (!srcCanvas || !destCanvas) {
        animationId = requestAnimationFrame(renderHistogram);
        return;
      }

      const srcCtx = srcCanvas.getContext('2d');
      const destCtx = destCanvas.getContext('2d');

      if (!srcCtx || !destCtx) {
        animationId = requestAnimationFrame(renderHistogram);
        return;
      }

      const dw = destCanvas.width;
      const dh = destCanvas.height;

      // 1. Clear histogram canvas with a semi-transparent slate backing
      destCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      destCtx.fillRect(0, 0, dw, dh);

      // Draw horizontal target lines (dashed grid)
      destCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      destCtx.lineWidth = 0.5;
      destCtx.beginPath();
      destCtx.moveTo(0, dh * 0.25); destCtx.lineTo(dw, dh * 0.25);
      destCtx.moveTo(0, dh * 0.5); destCtx.lineTo(dw, dh * 0.5);
      destCtx.moveTo(0, dh * 0.75); destCtx.lineTo(dw, dh * 0.75);
      destCtx.stroke();

      try {
        // 2. To keep histogram computing extremely lightweight, we read pixels using a downscaled grid
        // instead of checking every pixel in a 1080p stream. A 120x90 grid (10,800 pixels) is super fast
        // and highly representative.
        const sw = 120;
        const sh = 90;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = sw;
        offCanvas.height = sh;
        const offCtx = offCanvas.getContext('2d');
        
        if (offCtx) {
          offCtx.drawImage(srcCanvas, 0, 0, sw, sh);
          const imgData = offCtx.getImageData(0, 0, sw, sh);
          const data = imgData.data;

          const rHist = new Uint32Array(256);
          const gHist = new Uint32Array(256);
          const bHist = new Uint32Array(256);
          const lHist = new Uint32Array(256);

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

            rHist[r]++;
            gHist[g]++;
            bHist[b]++;
            lHist[lum]++;
          }

          // Find maximum value to scale the graph heights
          let maxCount = 1;
          for (let i = 0; i < 256; i++) {
            if (activeChannels.r && rHist[i] > maxCount) maxCount = rHist[i];
            if (activeChannels.g && gHist[i] > maxCount) maxCount = gHist[i];
            if (activeChannels.b && bHist[i] > maxCount) maxCount = bHist[i];
            if (activeChannels.lum && lHist[i] > maxCount) maxCount = lHist[i];
          }

          // Log scaling to prevent single spikes from squashing the rest of the distribution
          const scaleY = (val: number) => {
            if (val <= 0) return 0;
            // Use log scale or square root scale to make smaller peaks visible
            const ratio = Math.log1p(val) / Math.log1p(maxCount);
            return ratio * (dh - 4); // 2px margin top and bottom
          };

          // Draw channels as filled paths with blend mode
          destCtx.save();
          destCtx.globalCompositeOperation = 'screen';

          const drawPath = (hist: Uint32Array, strokeColor: string, fillColor: string) => {
            destCtx.beginPath();
            destCtx.moveTo(0, dh);
            for (let i = 0; i < 256; i++) {
              const x = (i / 255) * dw;
              const y = dh - scaleY(hist[i]);
              destCtx.lineTo(x, y);
            }
            destCtx.lineTo(dw, dh);
            destCtx.closePath();

            destCtx.fillStyle = fillColor;
            destCtx.fill();
            destCtx.strokeStyle = strokeColor;
            destCtx.lineWidth = 1;
            destCtx.stroke();
          };

          if (activeChannels.r) {
            drawPath(rHist, '#ef4444', 'rgba(239, 68, 68, 0.25)');
          }
          if (activeChannels.g) {
            drawPath(gHist, '#10b981', 'rgba(16, 185, 129, 0.25)');
          }
          if (activeChannels.b) {
            drawPath(bHist, '#3b82f6', 'rgba(59, 130, 246, 0.25)');
          }
          if (activeChannels.lum) {
            drawPath(lHist, '#f1f5f9', 'rgba(241, 245, 249, 0.2)');
          }

          destCtx.restore();
        }
      } catch (e) {
        // Safe fallback if frame is tainted or empty
      }

      animationId = requestAnimationFrame(renderHistogram);
    };

    renderHistogram();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [srcCanvasRef, activeChannels]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900/60 p-1">
      <canvas
        id="camera_histogram_canvas"
        ref={canvasRef}
        width={180}
        height={76}
        className="w-full h-20 block"
      />
      <div className="absolute top-1 left-2 flex gap-1.5 text-[8px] font-mono font-medium text-slate-400 pointer-events-none">
        {activeChannels.lum && <span className="text-slate-100">LUM</span>}
        {activeChannels.r && <span className="text-red-400">R</span>}
        {activeChannels.g && <span className="text-emerald-400">G</span>}
        {activeChannels.b && <span className="text-blue-400">B</span>}
      </div>
    </div>
  );
};
