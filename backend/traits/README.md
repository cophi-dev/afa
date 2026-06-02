# Trait assets (local only)

This directory holds proprietary PNG layers used by the image compositor (`backend/app.py`).
These files are **not** included in the public repository.

## Expected layout

```
traits/
├── Background/
├── Clothes/
├── Earring/
├── Eyes/
├── Fur/
├── Hat/
├── Heads/
├── Hoodie_Fur/
├── Mouth/
├── Special Cases/
├── memes/
└── _blank.png
```

Filenames must match trait values exactly (e.g. `Fur/Black.png`, `Eyes/Laser Eyes.png`).

## Local setup

1. Obtain the trait asset pack from the project maintainers (private distribution).

   If `origin/main` still contains `backend/traits/*.png` (pre-purge remote), you can extract without re-tracking:

   ```bash
   git fetch origin main
   git archive origin/main backend/traits | tar -x -C backend
   ```

   After the public history purge, GitHub no longer ships PNGs — use a local backup or the maintainer pack. PNGs stay untracked (see root `.gitignore`); only this `README.md` is committed.

2. Copy the full `traits/` tree into this directory if you received a separate asset pack.
3. Start the backend — it reads layers from here at runtime.

Without these files, rendering endpoints will return missing-file errors but the rest of the app can still run.
