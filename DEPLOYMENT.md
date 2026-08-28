# Zero-budget deployment

Recommended bootstrap architecture:

GitHub repository -> GitHub Actions -> data/today.json -> Cloudflare Pages.

1. Create a GitHub repository and upload this project.
2. Add repository secret FOOTBALL_DATA_API_KEY.
3. Connect the repository to Cloudflare Pages.
4. Use the repository root as the output directory and no build command.
5. Deploy.

The workflow refreshes fixture data every 30 minutes when the provider key is configured.

For a server-backed deployment, the existing Express app can be deployed to Render. Render currently offers free web services, but free services spin down after 15 minutes of inactivity and local filesystem changes are lost on restart/redeploy, so persistent production data should eventually move to a managed database.
