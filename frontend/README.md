# ReVoCo Frontend

Run `npm install` followed by `npm run dev` to start the frontend. The Flask API must be running from `backend/` for login, marketplace, and runtime translation services.

## Languages

The English catalog is `src/locales/en.json`. When adding user-facing JSX copy, run `npm run i18n:extract` to add static UI strings to the catalog and wrap them with the translator. Use `formatNumber`, `formatCurrency`, and `formatDate` from `src/i18n.jsx` for visible values.

Run `python scripts/translate_locales.py` from the workspace root after configuring Bhashini variables in `.env` to generate the eight regional catalogs. See `backend/README.md` for setup details.
