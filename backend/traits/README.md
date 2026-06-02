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
2. Copy the full `traits/` tree into this directory.
3. Start the backend — it reads layers from here at runtime.

Without these files, rendering endpoints will return missing-file errors but the rest of the app can still run.
