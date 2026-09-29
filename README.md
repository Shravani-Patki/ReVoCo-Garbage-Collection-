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

- Frontend: React, Vite, React Router, Leaflet
- Backend: Flask, Flask-SQLAlchemy, SQLite
- Waste classification: PyTorch and the included `garbage_model/` checkpoint

## Run Locally

### Requirements

- Python 3.10 or newer
- Node.js and npm

### Backend

From the repository root, create and activate a virtual environment, then install the backend dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

Start the API:

```powershell
cd backend
python app.py
```

The API runs at `http://127.0.0.1:5000`. The SQLite database is created at `backend/revoco.db` when the app starts. Check that the API is up at `http://127.0.0.1:5000/api/health`.

### Frontend

In a second terminal, from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Keep the backend running for login, registration, and API-backed features.

## Optional Configuration

Set environment variables in the backend process when enabling these integrations:

| Variable | Purpose |
| --- | --- |
| `REVOCO_SECRET_KEY` | Secret used to sign access tokens. Set a long, random value outside local development. |
| `REVOCO_TOKEN_TTL_SECONDS` | Access-token lifetime in seconds; defaults to 12 hours. |
| `GOOGLE_API_KEY` | Enables AI waste-volume estimation. |
| `WASTE_ESTIMATION_MODEL` | Overrides the default Gemini estimation model. |
| `WASTE_CLASSIFIER_WEIGHTS` | Overrides the included waste-classification checkpoint. |
| `BHASHINI_USER_ID` | Bhashini user ID for translation. |
| `BHASHINI_API_KEY` | Bhashini API key for translation. |
| `BHASHINI_PIPELINE_ID` | Bhashini translation pipeline ID. |

Without the optional provider credentials, the corresponding integrations return an explicit unavailable or configuration error; the app does not fabricate classifications or estimates.

## Tests

Run the backend route tests from the `backend/` directory:

```powershell
python -m pytest -q test_market_api.py
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