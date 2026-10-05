# ReVoCo Frontend

Run `npm install`, copy `.env.example` to `.env`, and run `npm run dev` to start the frontend. `VITE_API_URL` selects the Flask API origin; when unset, Vite proxies `/api` to `http://localhost:5000` during development.

For Vercel, set the project root to `frontend` and configure `VITE_API_URL` to the Render service origin without an `/api` suffix. `vercel.json` rewrites client-side routes to `index.html`.

## Languages

The English catalog is `src/locales/en.json`. When adding user-facing JSX copy, run `npm run i18n:extract` to add static UI strings to the catalog and wrap them with the translator. Use `formatNumber`, `formatCurrency`, and `formatDate` from `src/i18n.jsx` for visible values.

Run `python scripts/translate_locales.py` from the workspace root after configuring Bhashini variables in `.env` to generate the eight regional catalogs. See `backend/README.md` for setup details.
