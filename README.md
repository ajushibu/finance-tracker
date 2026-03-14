# Finance Tracker

Personal finance PWA with AI-powered expense categorisation.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your Anthropic API key
The AI features (natural language input, spending insights) call the Anthropic API directly from the browser. The current code sends requests without an API key header — this works inside Claude artifacts but **not** from a standalone app.

To fix this, open `src/App.jsx` and find the two `fetch("https://api.anthropic.com/v1/messages"` calls. Add your API key to the headers:

```js
headers: {
  "Content-Type": "application/json",
  "x-api-key": "YOUR_API_KEY_HERE",
  "anthropic-dangerous-direct-browser-access": "true"
}
```

> ⚠️ **Important**: Embedding an API key in frontend code exposes it publicly. For personal use on your phone this is fine — just set a low spend limit on your Anthropic account. For anything shared, you'd want a small backend proxy.

### 3. Run locally
```bash
npm run dev
```
Opens at `http://localhost:5173`

### 4. Build for production
```bash
npm run build
```
Output goes to `dist/` folder.

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub
3. "Add New Project" → import this repo
4. Framework preset: **Vite** (auto-detected)
5. Click **Deploy**
6. Live in ~30 seconds

## Install as Android App

1. Open your Vercel URL in **Chrome** on Android
2. Chrome will show an "Add to Home screen" banner, or tap **⋮ → Add to Home screen**
3. The app opens fullscreen (no URL bar) with your custom icon

## Tech Stack

- React 18 + Vite
- Fraunces + Manrope typography
- PWA (manifest.json + service worker)
- Anthropic Claude API for AI features
- localStorage for persistence
