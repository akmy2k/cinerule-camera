/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CineRule — locked single-screen viewfinder (Monitor+ style).
 * One screen: the live monitor. Every guide/analysis overlay is toggled
 * on/off from within the CameraView HUD. No tabs, no chrome.
 */

import { useEffect } from 'react';
import { CapturedPhoto } from './types';
import { CameraView } from './components/CameraView';

export default function App() {
  // Keep the capture pipeline saving to on-device storage so shots persist,
  // even though the gallery screen is gone in the locked single-view layout.
  const handleCapture = (newPhoto: CapturedPhoto) => {
    try {
      const stored = localStorage.getItem('auracam_gallery');
      const prev: CapturedPhoto[] = stored ? JSON.parse(stored) : [];
      localStorage.setItem('auracam_gallery', JSON.stringify([newPhoto, ...prev]));
    } catch (e) {
      console.error('Could not save capture to device storage.', e);
    }
  };

  // Count existing saved shots once for the HUD badge.
  const savedCount = (() => {
    try {
      const stored = localStorage.getItem('auracam_gallery');
      return stored ? (JSON.parse(stored) as CapturedPhoto[]).length : 0;
    } catch {
      return 0;
    }
  })();

  // Lock the app to a fixed, non-scrolling fullscreen surface on mobile.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black text-[#E0E0E0] font-sans overflow-hidden select-none">
      <CameraView onCapture={handleCapture} savedCount={savedCount} />
    </div>
  );
}
