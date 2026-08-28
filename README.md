# Football Intelligence — Data-Driven Match Prediction Platform

A polished, deployable prototype for a football analytics/prediction website.

## What is included

- Daily fixture dashboard
- League filters
- Search
- Match analysis modal
- 1X2, double chance, O/U, BTTS and correct-score probabilities
- Explainable prediction factors
- Model agreement / confidence
- Risk labels
- Top opportunities scanner
- Historical model-performance dashboard
- Transparent methodology page
- Demo-mode data so the UI works immediately
- Optional football-data.org fixture integration
- Responsive mobile/desktop UI

## Run locally

1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Optionally add a football-data.org API key.
4. Run:

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Live-data note

The prediction engine is intentionally separated from the fixture provider. The included connector can load fixtures from football-data.org when `FOOTBALL_DATA_API_KEY` is supplied; otherwise it uses demo fixtures.

For production-grade predictions, add a richer data provider containing xG, shots, player availability, lineups, injuries, odds, and event-level data. The model layer is ready to be extended through `server.js`.

## Important

This is a probability/analytics system, not a guarantee of match outcomes. Production deployment should backtest and calibrate the model continuously using walk-forward validation and log every prediction before kickoff.
