# TikTok Saver – notes for Claude
- Owner: Dylan (NewYorkers.Co). Deployed from GitHub to Cloudflare Workers; push to `main` redeploys.
- `src/tiktok.js` – TikTok scraping (page JSON → tikwm fallback → oEmbed for metadata only). `src/instagram.js` – IG handle from bio or link-in-bio page. `src/caption.js` – Anthropic API caption + credit line. `src/page.js` – the mobile web page. `src/index.js` – routes and access-code check.
- Caption rules mirror Dylan's style: real New Yorker voice, no hashtags, max 2 emojis total (1 in caption + credit), almost no em-dashes, no engagement question, never invent facts.
- Secrets live only in Cloudflare: ACCESS_TOKEN, ANTHROPIC_API_KEY. Never commit them.
- Run `npm test` before pushing.
