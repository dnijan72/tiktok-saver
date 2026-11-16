# TikTok Saver

Paste or share a TikTok link and get back:
- the video file (saved to Photos on iPhone),
- the creator's Instagram (from their TikTok bio or link-in-bio page like Linktree), falling back to their TikTok handle,
- an Instagram caption in the @newyorkers / @newyorklocals / @nysports / @apartmentsnyc voice, with a `🎥: @handle` credit line.

Runs on Cloudflare Workers (free plan).

## Use it
- **Web page:** open the workers.dev link on your phone, enter the access code once, paste a TikTok link.
- **iPhone Shortcut:** share a TikTok → the shortcut saves the video to Photos and copies the caption. Setup steps are in `SHORTCUT.md`.

## Notifications
Add the page to your iPhone home screen (Share → Add to Home Screen), open it from the icon, tap **Turn on notifications**. Each link then runs in the background and you get a notification when the caption is ready; tapping it opens that result. Needs iOS 16.4+.

## API
Both endpoints take JSON `{ "url": "<tiktok link>", "token": "<ACCESS_TOKEN>" }` (or `Authorization: Bearer <token>`).
- `POST /api/info` – also accepts `account` (`newyorkers` default, `newyorklocals`, `nysports`, `apartmentsnyc`) and `note`. Returns `{ caption, credit, full, tiktok, instagram, instagramFoundIn, hasVideo, ... }`. `full` is caption + credit, ready to paste.
- `POST /api/video` – returns the mp4.
- `POST /api/jobs` – same input as /api/info, runs in the background, returns `{ job: { id, status } }`. Poll `POST /api/job {id}`; `POST /api/recent` lists the last 10.
- `POST /api/subscribe {subscription}` – saves a Web Push subscription. `GET /api/push-key` – the VAPID public key.
- `GET /api/health` – shows whether the secrets are set.

## Setup (Cloudflare)
1. Workers & Pages → Create application → import this repo. Project name `tiktok-saver`, build command empty, deploy command `npx wrangler deploy`.
2. Worker → Settings → Variables and Secrets → add **Secrets**:
   - `ACCESS_TOKEN` – any passphrase. Keeps strangers from using your API key.
   - `ANTHROPIC_API_KEY` – for captions.
   - Optional `CAPTION_MODEL` – defaults to `claude-sonnet-5-5`.
3. Every push to `main` redeploys.

## How the video is found
1. Reads the TikTok page's embedded JSON (`__UNIVERSAL_DATA_FOR_REHYDRATION__`) and streams the highest-bitrate no-watermark file with the page's cookies.
2. If TikTok blocks Cloudflare or returns no file, falls back to the tikwm.com API.
3. If both fail, TikTok's oEmbed still gives the caption and handle so the caption works.

TikTok changes its site now and then; when downloads break, `src/tiktok.js` is the file to fix.

## Tests
`npm install` then `npm test`. `npx wrangler dev` runs it locally (put secrets in `.dev.vars`).
