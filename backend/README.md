# ReVoCo Backend

Run commands from this directory after installing CPU-only PyTorch and the remaining dependencies:

```powershell
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Start the API with `python app.py`. `SECRET_KEY` is required. The default local database is SQLite (`app.db`); new marketplace tables are created on startup without deleting existing records. SQLite connections use WAL mode.

Set `SECRET_KEY` to a long, random secret before deployment. Signup and login return signed bearer tokens that expire after 12 hours by default; `REVOCO_TOKEN_TTL_SECONDS` can override the lifetime. CORS allows only `FRONTEND_URL` (default `http://localhost:5173`).

For Render, set `DATABASE_URL` to `sqlite:////var/data/revoco.db` when the persistent disk is mounted at `/var/data`. Use the repository root as the Docker build context and `backend/Dockerfile` as the Dockerfile path.

## Waste classification

The workspace `garbage_model/` extracted PyTorch archive is loaded once at startup on CPU. The loader repacks it in memory and validates its EfficientNet-B0 10-class state dict. Set `WASTE_CLASSIFIER_WEIGHTS` to a different checkpoint file or extracted archive directory to override it. Without valid trained weights, `/api/classify` returns HTTP 503 rather than a random prediction.

## Visual weight and volume estimation

Set `GOOGLE_API_KEY` in the backend process environment to enable `/api/waste/estimate` and completion-photo estimates. `WASTE_ESTIMATION_MODEL` optionally overrides the default model name (`gemini-2.5-flash`). If the key is missing or the provider is unavailable, estimates return an explicit error; the API does not fabricate a weight.

## Frontend translations

Create a workspace-root `.env` from `.env.example` and set `BHASHINI_USER_ID`, `BHASHINI_API_KEY`, and `BHASHINI_PIPELINE_ID`. The selected pipeline must support English (`en`) translation into Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, and Urdu. The user ID and ULCA API key come from the Bhashini profile; the pipeline ID comes from a translation pipeline available to that account. Credentials stay on the backend.

From the workspace root, run `python scripts/translate_locales.py` to translate `frontend/src/locales/en.json` and write the eight regional catalogs. Runtime fallback uses the same pipeline through `/api/i18n/translate` and a browser-local cache. Without Bhashini credentials, English remains as fallback text and the runtime endpoint returns HTTP 503.

## Lot traceability and receipts

Each `WasteLot` keeps its existing database ID. The API derives a display ID (`RV-YYYY-NNNNN`) from that row and signs a stable public tracking URL for its QR code. Set `REVOCO_PUBLIC_APP_URL` to the deployed frontend origin when generating QR links; it defaults to `http://localhost:5173` for local development.

`db.create_all()` adds the trace-event, pickup-item/location, transaction, material-catalog, and historical-rate tables without altering existing tables. Startup backfills existing lots, current municipality rates, and accepted pickups idempotently. Backfilled weights remain estimated unless a collector verification was actually recorded.

The lot lifecycle distinguishes pickup acceptance, collector-confirmed weight, company request/acceptance, recorded payment, recycler receipt, recycling in progress, and recycling completed. Only the verified company associated with a paid lot can advance the recycler lifecycle, and completion requires an explicit final action. Payment records are manual ledger entries; `digital` identifies a reported method and is not proof of payment-provider settlement. Customer receipts require the citizen to confirm the collector's recorded payment.

## Frontend API

The frontend uses `VITE_API_URL`; local Vite development proxies `/api` to `http://localhost:5000`. `GET /api/health` returns `{"ok":true}`. Run backend tests with `python -m pytest -q`.