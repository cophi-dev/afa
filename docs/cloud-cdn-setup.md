# Cloud CDN in front of AFA image API

This document describes how to put **Google Cloud CDN** in front of the App Engine image endpoints (`/api/get-asset`, `/api/get-asset-preview`) after the backend changes on `main` land. **Do not run these steps from CI or a cloud agent** — they create billable GCP resources.

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

## Option B — Vercel rewrite + Edge cache (no GCP LB fee)

**Rough monthly cost:** **$0 extra** on Vercel Hobby/Pro if traffic stays within included bandwidth; edge requests count against plan limits. No global static IP or forwarding-rule minimum.

Add a rewrite so browser requests hit the same origin path but Vercel caches immutable responses at the edge:

```json
{
  "headers": [
    {
      "source": "/api/get-asset",
      "headers": [
        { "key": "CDN-Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/get-asset",
      "destination": "https://afa-editor.ew.r.appspot.com/api/get-asset"
    }
  ]
}
```

**Caveats:**

- Query strings must be part of the cache key (Vercel does this by default for `?` URLs).
- `get-asset-preview` should use a **short** edge TTL (match `max-age=300`) via a separate header rule.
- First visitor per edge POP still pays App Engine render cost; CDN/LB in Option A scales better for viral apes.

---

## Comparison

| Approach | Setup complexity | Fixed monthly cost | Best for |
|----------|-------------------|--------------------|----------|
| **A — Cloud CDN + LB** | High (NEG, cert, DNS) | ~$20+ LB + egress | Many users, same popular apes, minimal GAE CPU |
| **B — Vercel edge** | Low (config only) | Plan bandwidth | Moderate traffic, already on Vercel |

---

## Deploy checklist (human)

1. Merge PR and `gcloud app deploy backend/app.yaml` (F2, `min_instances: 1`, gthread workers).
2. Confirm live headers on `afa-editor.ew.r.appspot.com` match above.
3. Choose Option A or B; update frontend API base if using a dedicated image hostname.
4. Monitor `X-Render-Cache` HIT rate on GAE and CDN hit ratio in Console.
