# v2.2 deployment

1. Create a Cloudflare D1 database named `football-intelligence-db`.
2. Open its Console and execute `migrations/0001_initial.sql`.
3. In Worker Settings > Bindings, add the D1 database with binding name `DB`.
4. In Worker Settings > Variables and Secrets, add secrets `API_FOOTBALL_KEY` and `SYNC_SECRET`.
5. Push this repository to GitHub. Cloudflare's Git integration deploys the Worker.
6. The Worker cron runs every 6 hours and refreshes today's and tomorrow's fixtures.

The API-Football free plan is suitable for the bootstrap phase but has a daily request limit; the application therefore batches date requests and stores results in D1 rather than querying the provider from every browser visit.
