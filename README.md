# CineRule Camera

Live app: https://akmy2k.github.io/cinerule-camera/

Camera viewfinder with composition guides, aspect ratios, and colour analysis. Runs on your device; no account or API key is needed. Camera permission is required. If unavailable or denied, the app shows a simulated landscape.

## Save to a phone

- iPhone/iPad: open the link in Safari, tap Share, then Add to Home Screen and Add.
- Android: open in Chrome, tap the three-dot menu, then Install app or Add to Home screen.
- Allow camera access. Load the app once online before using it offline.

Captures and preferences are stored in this browser on this device. Clearing browser storage can remove them. This release preserves the original single-screen camera interface; no gallery or cloud sync is included.

## Development

Use Node.js 22+, then `npm ci`, `npm run dev`. Check with `npm run lint` and `npm run build`.

GitHub Pages publishes the `dist` folder through the included Actions workflow. The optional AI Studio server and its API routes are excluded from this browser-only release.
