# Football Intelligence Engine 2.1

Cloudflare Workers Static Assets deployment with a consistent prediction API and frontend schema.

Current stage: demo data + explainable statistical forecast. Next stage: live football data provider, D1 historical database, prediction ledger, Elo/xG/Poisson-Dixon-Coles ensemble, Monte Carlo, calibration and walk-forward evaluation.

Cloudflare deployment uses `assets.directory = ./public/` and the Worker entrypoint at `src/index.js`.
