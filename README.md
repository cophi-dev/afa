# AFA Editor

**Compose and preview ApeFacingApe (AFA) portraits before you mint.**

Web studio for the [Ape Facing Apes](https://www.apefacingapes.com) collection: pick a BAYC token, layer outfits, hats, eyes, and special sets, render a live preview, and check whether that ape’s AFA is already minted on-chain.

**Live:** [afa-editor.vercel.app](https://afa-editor.vercel.app) · also [afa-editor.app](https://www.afa-editor.app)

## Features

- **Trait studio** — Build an AFA look from selectable layers (outfit, mouth, hat, eyes, hands, extras) with randomize and preset sets (e.g. Vegas).
- **Live preview** — Server-side compositing via the Python API; animated loader while renders run.
- **Mint awareness** — Minted gallery synced from chain / API; mint status check per token ID with link to [claim](https://www.apefacingapes.com/claim).
- **Share previews** — Vercel middleware serves Open Graph HTML for bots (X, Discord, etc.) with composited preview images.

## Related projects

| Repo | Role |
|------|------|
| [afa-minting-progress](https://github.com/cophi-dev/afa-minting-progress) | Full-collection mint progress grid |
| [nano-bayc](https://github.com/cophi-dev/nano-bayc) | Lightweight BAYC export + mint status |

## Structure

```
frontend/     React (Create React App) — editor UI, Etherscan helpers
backend/      Flask — image compositing, trait assets, /api/* routes
middleware.js Vercel OG / bot HTML for social previews
```

## Run locally

### Frontend only (points at production API)

```bash
cd frontend
npm install
cp ../.env.example .env.development
# Optional: REACT_APP_API_URL=http://localhost:5000
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Full stack (API + UI)

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
export ETHERSCAN_API_KEY=your_key   # optional, for mint sync
python3 app.py

# Terminal 2 — frontend
cd frontend
npm install
# In .env.development:
#   REACT_APP_API_URL=http://localhost:5000
npm start
```

## Deploy

- **Frontend + routing:** Vercel (`vercel.json` rewrites `/api/*` to the backend and serves the React build).
- **Image API:** Google App Engine (`backend/app.yaml`) — default production URL `https://afa-editor.ew.r.appspot.com`.

Set `REACT_APP_API_URL` and `REACT_APP_ETHERSCAN_API_KEY` in Vercel project settings (see `.env.example`).

## Tech

- React 18, ethers.js, sharp (favicon tooling)
- Flask, Pillow — compositing and trait pipeline
- Vercel middleware — OG meta for crawlers

## Credits

Built for the Ape Facing Apes community. BAYC marks and assets are used under license from Yuga Labs, Inc.
