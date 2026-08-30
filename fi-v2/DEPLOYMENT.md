# Deployment

1. Replace the repository contents with this project.
2. Commit to `main`.
3. Cloudflare Workers should detect the GitHub commit and deploy using `npx wrangler deploy`.
4. Verify `/api/health` and the home page.

Do not add an API key yet. The live provider secret will be added only after the demo dashboard is verified.
