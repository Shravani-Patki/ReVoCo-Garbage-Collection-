# ReVoCo

ReVoCo is a community waste-management platform that connects citizens, community collectors, recycling companies, and municipalities. Users can report waste, request pickups, classify waste, and follow cleanup progress. Municipalities coordinate reports and collection work, publish local material rates, organize e-waste drives, and verify company registrations.

## Features

- Waste reporting, location tracking, cleanup coordination, and verification
- Image-based waste classification and optional AI waste-volume estimation
- Pickup requests and a marketplace for recyclable materials
- Municipality dashboards for reports, routing, company verification, rates, and e-waste drives
- Company registration with CPCB details and municipality approval before portal access
- Gamification, rewards, and localized interface text

## Technology

- Frontend: React, Vite, React Router, Axios, Leaflet
- Backend: Flask, Flask-SQLAlchemy, SQLite, Gunicorn
- Waste classification: CPU PyTorch/EfficientNet-B0 and the included `garbage_model/` checkpoint

## Run Locally

### Requirements

- Python 3.11 or newer
- Node.js and npm

### Backend

From the repository root, create and activate a virtual environment, then install the backend dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
Copy-Item backend/.env.example backend/.env
```

Set a non-empty `SECRET_KEY` in `backend/.env` before starting the API. The local SQLite default is `app.db`; on Render, set `DATABASE_URL` to a file on the mounted persistent disk.

Start the API:

```powershell
cd backend
python app.py
```

The API runs at `http://127.0.0.1:5000`. Check that it is up at `http://127.0.0.1:5000/api/health`.

### Frontend

In a second terminal, from the repository root:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Keep the backend running for login, registration, and API-backed features.

## Optional Configuration

Set environment variables in the backend process when enabling these integrations:

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Required secret used to sign access tokens. Set a long, random value. |
| `DATABASE_URL` | SQLAlchemy URL; on Render use `sqlite:////var/data/revoco.db` with a disk mounted at `/var/data`. |
| `FRONTEND_URL` | Allowed CORS origin; set this to the deployed Vercel origin. |
| `REVOCO_PUBLIC_APP_URL` | Public frontend origin used by generated lot QR codes. |
| `REVOCO_TOKEN_TTL_SECONDS` | Access-token lifetime in seconds; defaults to 12 hours. |
| `GOOGLE_API_KEY` | Enables AI waste-volume estimation. |
| `WASTE_ESTIMATION_MODEL` | Overrides the default Gemini estimation model. |
| `WASTE_CLASSIFIER_WEIGHTS` | Overrides the included waste-classification checkpoint. |
| `BHASHINI_USER_ID` | Bhashini user ID for translation. |
| `BHASHINI_API_KEY` | Bhashini API key for translation. |
| `BHASHINI_PIPELINE_ID` | Bhashini translation pipeline ID. |

Without the optional provider credentials, the corresponding integrations return an explicit unavailable or configuration error; the app does not fabricate classifications or estimates.

## Deployment

- Render: use the repository root as the Docker build context and `backend/Dockerfile` as the Dockerfile path. Mount a persistent disk at `/var/data` and set `DATABASE_URL=sqlite:////var/data/revoco.db`, `SECRET_KEY`, and `FRONTEND_URL`.
- Vercel: set the project root to `frontend` and `VITE_API_URL` to the Render service origin without an `/api` suffix. `vercel.json` provides the React Router fallback.

## Tests

Run the backend test suite from the `backend/` directory:

```powershell
python -m pytest -q
```

Run the frontend production build from `frontend/`:

```powershell
npm run build
```

## Repository Layout

```text
backend/       Flask API, models, and backend tests
frontend/      React/Vite application
garbage_model/ Included waste-classification model data
scripts/       Translation utilities
```

## Team TATTVAM

- **Team Leader:** Karthik Kurup
- Shravani Patki
- Om Nerkar
- Dhanali Khandagale
- Maryam Khan
- Gauri Patil