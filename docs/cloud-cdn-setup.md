# Cloud CDN in front of AFA image API

**Gewählt (Stand PR #49 / Phillip GO 00:30): Option B — Vercel Edge** via `/img/get-asset` und `/img/get-asset-preview` in `vercel.json`. Asset-Picker-Kacheln (`?size=384`) laden nur diesen Pfad; Hauptbild und übrige APIs bleiben auf `/api/*` bzw. direkt GAE. Option A bleibt als späteres Upgrade dokumentiert.

This document also describes **Option A** (Google Cloud CDN + LB) if edge caching on Vercel is not enough. **Do not run Option A from CI or a cloud agent** — it creates billable GCP resources.

## Prerequisites

- GCP project with App Engine app `afa-editor` (region `europe-west`).
- Image responses are CDN-ready when served from current `main`:
  - Deterministic URLs (full query string identifies the composite).
  - `Cache-Control: public, max-age=31536000, immutable` for minted `/api/get-asset` (with optional `?size=160|256|384` WebP).
  - `Cache-Control: public, max-age=300` for unminted `/api/get-asset-preview`.
  - `ETag` on image bodies (SHA-256 prefix).
  - No session cookies on image routes; `Vary: Cookie` stripped on image responses.

## Option A — Serverless NEG + External HTTPS LB + Cloud CDN (recommended for GAE)

**Rough monthly cost (EU, order of magnitude):** ~$18–25 base LB forwarding rule + ~$0.01–0.04/GB egress from CDN edge (often **lower** than repeated App Engine CPU for hot picker tiles). Minimum **~$20/mo** even at low traffic because of the forwarding rule.

### 1. Reserve global static IP

```bash
gcloud compute addresses create afa-images-ip --global --project=YOUR_PROJECT
gcloud compute addresses describe afa-images-ip --global --format='get(address)'
```

### 2. Serverless NEG pointing at App Engine

App Engine Standard uses a **serverless regional NEG** (region must match the App Engine location, e.g. `europe-west1`):

```bash
gcloud compute network-endpoint-groups create afa-gae-neg \
  --region=europe-west1 \
  --network-endpoint-type=serverless \
  --app-engine-app \
  --project=YOUR_PROJECT
```

### 3. Backend service + CDN

```bash
gcloud compute backend-services create afa-images-backend \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --protocol=HTTPS \
  --enable-cdn \
  --cache-mode=CACHE_ALL_STATIC \
  --default-ttl=31536000 \
  --max-ttl=31536000 \
  --client-ttl=31536000 \
  --negative-caching=false \
  --project=YOUR_PROJECT

gcloud compute backend-services add-backend afa-images-backend \
  --global \
  --network-endpoint-group=afa-gae-neg \
  --network-endpoint-group-region=europe-west1 \
  --project=YOUR_PROJECT
```

Optional: restrict cached paths with a URL map so only `/api/get-asset*` and `/api/get-asset-preview*` use the CDN-enabled backend; send other paths to a passthrough or block.

### 4. URL map, proxy, forwarding rule

```bash
gcloud compute url-maps create afa-images-map \
  --default-service=afa-images-backend \
  --global \
  --project=YOUR_PROJECT

gcloud compute target-https-proxies create afa-images-https-proxy \
  --url-map=afa-images-map \
  --global \
  --project=YOUR_PROJECT

gcloud compute ssl-certificates create afa-images-cert \
  --domains=images.afa-editor.example \
  --global \
  --project=YOUR_PROJECT

gcloud compute target-https-proxies update afa-images-https-proxy \
  --ssl-certificates=afa-images-cert \
  --global \
  --project=YOUR_PROJECT

gcloud compute forwarding-rules create afa-images-https-rule \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --network-tier=PREMIUM \
  --address=afa-images-ip \
  --target-https-proxy=afa-images-https-proxy \
  --ports=443 \
  --global \
  --project=YOUR_PROJECT
```

### 5. DNS

Create `A` record for your chosen hostname → reserved IP. Point the frontend image base URL (`REACT_APP_*` / Vercel env) at `https://images.afa-editor.example` for static composites only, or rewrite in `vercel.json` (see Option B).

### 6. Verify caching

```bash
curl -sI 'https://images.afa-editor.example/api/get-asset?tokenId=1&assetType=AFA&size=384'
# Expect: Cache-Control immutable, ETag, X-Render-Cache MISS then HIT on repeat
# Check: no Set-Cookie, no Vary: Cookie
```

Use `gcloud compute backend-services get-effective-security-policies` / CDN metrics in Cloud Console for hit ratio.

---

## Option B — Vercel rewrite + Edge cache (**deployed in repo**)

**Rough monthly cost:** **$0 extra** on Vercel Hobby/Pro if traffic stays within included bandwidth; edge requests count against plan limits. No global static IP or forwarding-rule minimum.

Implementation in `frontend/vercel.json` (Vercel project root; before SPA fallback). Root `vercel.json` mirrors the same routes for non-frontend deploys:

- **Rewrites** (query string forwarded automatically → part of edge cache key):
  - `/img/get-asset` → `https://afa-editor.ew.r.appspot.com/api/get-asset`
  - `/img/get-asset-preview` → `https://afa-editor.ew.r.appspot.com/api/get-asset-preview`
- **Response headers** on those sources:
  - `CDN-Cache-Control` + `Vercel-CDN-Cache-Control`: `public, max-age=31536000, immutable` (picker thumbs)
  - Preview path: `public, max-age=300`

Frontend: `frontend/src/AssetStrip.js` calls `/img/…?size=384` on Vercel; `localhost` falls back to `/api/…` (CRA proxy).

**Verify after Vercel preview deploy:**

```bash
URL='https://YOUR-PREVIEW.vercel.app/img/get-asset?tokenId=1&assetType=AFA&size=384'
curl -sI "$URL" | grep -iE '^(HTTP|content-type|x-vercel-cache|cache-control)'
curl -sI "$URL" | grep -iE '^(HTTP|x-vercel-cache)'   # second request → x-vercel-cache: HIT
curl -s "$URL" | file -   # WebP image data (once backend on GAE serves ?size= WebP)
```

**Caveats:**

- First request per edge POP / URL still hits App Engine (MISS). GAE should send immutable `Cache-Control` after backend PR deploy for best behavior; until then edge TTL is driven by `Vercel-CDN-Cache-Control` above.
- Main studio preview (`/api/get-asset` full size) is **not** edge-cached — only picker paths.
- Option A scales better for very hot global traffic on the same URLs.

---

## Comparison

| Approach | Setup complexity | Fixed monthly cost | Best for |
|----------|-------------------|--------------------|----------|
| **A — Cloud CDN + LB** | High (NEG, cert, DNS) | ~$20+ LB + egress | Many users, same popular apes, minimal GAE CPU |
| **B — Vercel edge** | Low (config only) | Plan bandwidth | Moderate traffic, already on Vercel |

---

## Deploy checklist (human)

1. Merge PR; Vercel picks up `vercel.json` automatically (Option B active for picker).
2. `gcloud app deploy backend/app.yaml` (F2, `min_instances: 1`, gthread workers) for LRU + WebP + immutable headers on GAE.
3. Confirm `curl -sI` on preview/live `/img/get-asset?…&size=384`: second request `x-vercel-cache: HIT`.
4. Option A only if Vercel edge limits or hit ratio is insufficient.
