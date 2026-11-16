# Backend-Deploy ohne Laptop (GitHub Actions → App Engine)

Dieses Dokument beschreibt die **einmalige GCP-Einrichtung** für Philipp und den manuellen Deploy über `.github/workflows/backend-deploy.yml`.

**Projekt:** `afa-editor` (App Engine Standard, Region `europe-west`)  
**Live-Rollback:** Version `eco-1` bleibt erhalten; **`perf-rb` nicht anfassen.**

## Was der Workflow macht

1. Authentifizierung per **Workload Identity Federation** (keine JSON-Keys im Repo).
2. Sync der Trait-PNGs aus einem **privaten GCS-Bucket** nach `backend/traits/`.
3. **Trait-Check** gegen `backend/trait_manifest.json` (`backend/scripts/verify_traits.py`) — CI bricht ab, wenn Dateien fehlen.
4. Deploy mit `backend/app.deploy.yaml` (`min_instances: 0`), Version `ci-<sha>-<timestamp>`, **`--no-promote`**.
5. **Smoke-Test** (u. a. AFA `#0`, Death-Bot-Ape `#228`) auf der Test-URL.
6. Optional: 100 % Traffic auf die neue Version (`promote_after_smoke`).

## Einmalige GCP-Einrichtung (Phillipp)

Alle Platzhalter in **GROSSBUCHSTABEN** anpassen. Befehle in Cloud Shell oder lokal mit `gcloud` ausführen.

### 1. Projekt und APIs

```bash
export GCP_PROJECT_ID=afa-editor
gcloud config set project "${GCP_PROJECT_ID}"

gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  storage.googleapis.com \
  appengine.googleapis.com
```

### 2. Workload Identity Pool + GitHub-Provider (nur Repo `cophi-dev/afa`)

```bash
export GCP_PROJECT_ID=afa-editor
export GITHUB_ORG=cophi-dev
export GITHUB_REPO=afa
export POOL_ID=github-actions
export PROVIDER_ID=github

gcloud iam workload-identity-pools create "${POOL_ID}" \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${GITHUB_ORG}/${GITHUB_REPO}'"

# Ausgabe für GitHub-Variable notieren:
gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --format="value(name)"
```

### 3. Deploy-Service-Account (minimale Rollen)

```bash
export GCP_PROJECT_ID=afa-editor
export DEPLOY_SA_NAME=afa-github-deploy
export DEPLOY_SA="${DEPLOY_SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "${DEPLOY_SA_NAME}" \
  --display-name="AFA GitHub Actions Deploy"

# App Engine deploy + Versionen/Traffic
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/appengine.deployer"

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/appengine.serviceAdmin"

# Trait-Bucket lesen (nur rsync)
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/storage.objectViewer"

# Workload Identity: GitHub darf diesen SA impersonieren
export POOL_ID=github-actions
export GITHUB_ORG=cophi-dev
export GITHUB_REPO=afa

gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA}" \
  --project="${GCP_PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"
```

`PROJECT_NUMBER` durch die numerische Projekt-ID ersetzen:

```bash
gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)'
```

### 4. Privater GCS-Bucket für Traits

```bash
export GCP_PROJECT_ID=afa-editor
export BUCKET_NAME=afa-traits-PRIVATE-SUFFIX   # z. B. afa-traits-prod-afa-editor

gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --location=europe-west1 \
  --uniform-bucket-level-access

# Deploy-SA darf lesen (zusätzlich zu objectViewer auf Projekt-Ebene, falls gewünscht nur Bucket-scoped):
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/storage.objectViewer"
```

### 5. Traits von Google Drive hochladen

Quelle im Drive: Ordner **Dokumente/AFA/traits** (Folder-ID `1qP1xaKDTyyPJY4CmuAan-FFsOD2iueZc`).

1. Traits lokal oder per `rclone`/Drive-Desktop als vollständigen Baum unter z. B. `./traits-src/` ablegen (gleiche Struktur wie `backend/traits/README.md`).
2. Nach GCS spiegeln (Präfix `traits/` im Bucket — der Workflow synct `gs://BUCKET/traits` → `backend/traits`):

```bash
export BUCKET_NAME=afa-traits-PRIVATE-SUFFIX

gcloud storage rsync -r ./traits-src/ "gs://${BUCKET_NAME}/traits"
```

**Hinweis zu Dateinamen:** Im Drive heißt z. B. `Hoodie_Fur/Death_Bot.png`; der Code erwartet `Death Bot.png`. Das Backend löst Leerzeichen/Unterstrich per `resolve_asset_path` — die Quelldateien müssen **nicht** umbenannt werden.

**Star Glasses:** `memes/star_glasses/` bzw. `memes/star_glasses.png` fehlen in manchen Packs; `memes/silvester_eyes/` (23 PNGs) ist vollständig — der Compositor nutzt Legacy-Fallbacks.

### 6. GitHub Repository-Variablen (cophi-dev/afa)

Unter **Settings → Secrets and variables → Actions → Variables**:

| Variable | Beispiel / Inhalt |
|----------|-------------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Voller Provider-Name aus Schritt 2 (`projects/…/providers/github`) |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `afa-github-deploy@afa-editor.iam.gserviceaccount.com` |
| `GCS_TRAITS_BUCKET` | `afa-traits-PRIVATE-SUFFIX` (ohne `gs://`) |

Keine Service-Account-JSON-Keys committen.

### 7. Deploy auslösen

GitHub → **Actions** → **Backend deploy (App Engine)** → **Run workflow**.

- `promote_after_smoke`: aktiv = Traffic nach erfolgreichem Smoke-Test auf die neue Version.
- Bei Fehlschlag bleibt Traffic auf `eco-1` (bzw. der aktuell gesetzten Produktions-Version).

## Trait-Manifest pflegen

Nach Änderungen an `db.json` oder Asset-Pfaden in `app.py`:

```bash
cd backend
python scripts/generate_trait_manifest.py
git add trait_manifest.json
```

PR-CI prüft, dass die generierte Datei committed ist.

## Lokaler Trait-Check

```bash
cd backend
python scripts/verify_traits.py
```

## Rollback

Traffic zurück auf `eco-1`:

```bash
gcloud app services set-traffic default --splits=eco-1=1 --project=afa-editor
```

Version `perf-rb` weder löschen noch Traffic darauf umlegen, sofern nicht ausdrücklich gewünscht.