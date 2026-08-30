# Football Intelligence Engine v2.2

Live-data foundation for Cloudflare Workers + D1.

## Current capabilities
- Cloudflare Worker + static frontend
- Optional API-Football fixture ingestion
- D1 storage for fixtures, predictions and sync runs
- Scheduled sync every 6 hours
- Demo fallback when the API secret/database is not configured
- Explainable baseline probability engine

## Next model phase
The baseline is intentionally conservative. It must not pretend to have team-specific xG/form before the historical feature store is populated. The next phase will ingest historical fixtures, compute Elo/form/attack/defence features, then add Poisson/Dixon-Coles, Monte Carlo and calibration.

## Secrets
Configure these in Cloudflare Worker Settings > Variables and Secrets:
- `API_FOOTBALL_KEY` — API-Football key
- `SYNC_SECRET` — random secret used for manual sync requests

Do not commit either value to Git.

## D1
Create a D1 database and execute `migrations/0001_initial.sql`. Bind it to the Worker as `DB`.
