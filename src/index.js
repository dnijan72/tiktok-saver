import { getPost, fetchVideo, UserError } from "./tiktok.js";
import { info } from "./info.js";
import { PAGE } from "./page.js";
import { ICONS, MANIFEST, SERVICE_WORKER } from "./assets.js";

const jobsStub = (env) => env.JOBS.get(env.JOBS.idFromName("main"));

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function safeEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json().catch(() => ({}));
  if (type.includes("form")) return Object.fromEntries(await request.formData());
  const text = await request.text();
  try { return JSON.parse(text); } catch { return { url: text }; }
}

function authorized(request, body, env) {
  const header = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return safeEqual(body.token || header, env.ACCESS_TOKEN);
}

async function video(body) {
  const post = await getPost(body.url);
  const upstream = await fetchVideo(post);
  const name = `tiktok-${(post.handle || "video").replace(/[^A-Za-z0-9._-]/g, "")}-${post.id || Date.now()}.mp4`;
  const headers = new Headers({
    "content-type": "video/mp4",
    "content-disposition": `attachment; filename="${name}"`,
    "cache-control": "no-store",
    "x-filename": name,
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  return new Response(upstream.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    const icon = request.method === "GET" && url.pathname.match(/^\/(?:icon-(180|192|512)|apple-touch-icon(?:-precomposed)?)\.png$/);
    if (icon) {
      const bytes = Uint8Array.from(atob(ICONS[icon[1] || "180"]), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    }
    if (request.method === "GET" && url.pathname === "/manifest.webmanifest") {
      return new Response(MANIFEST, { headers: { "content-type": "application/manifest+json" } });
    }
    if (request.method === "GET" && url.pathname === "/sw.js") {
      return new Response(SERVICE_WORKER, { headers: { "content-type": "text/javascript", "cache-control": "no-cache" } });
    }
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, captions: !!env.ANTHROPIC_API_KEY, locked: !!env.ACCESS_TOKEN });
    }

    if (request.method === "GET" && url.pathname === "/api/push-key") {
      if (!env.JOBS) return json({ ok: false, error: "Notifications aren't set up." }, 500);
      return json({ ok: true, key: await jobsStub(env).publicKey() });
    }

    if (request.method === "POST" && ["/api/subscribe", "/api/jobs", "/api/job", "/api/recent"].includes(url.pathname)) {
      if (!env.ACCESS_TOKEN) return json({ ok: false, error: "ACCESS_TOKEN isn't set in Cloudflare yet." }, 500);
      const body = await readBody(request);
      if (!authorized(request, body, env)) return json({ ok: false, error: "Wrong access code." }, 401);
      if (!env.JOBS) return json({ ok: false, error: "Background jobs aren't set up." }, 500);
      const stub = jobsStub(env);
      try {
        if (url.pathname === "/api/subscribe") return json({ ok: true, devices: await stub.subscribe(body.subscription) });
        if (url.pathname === "/api/jobs") {
          if (!body.url) throw new UserError("Paste a TikTok link first.");
          const input = { url: String(body.url).slice(0, 500), account: body.account, note: String(body.note || "").slice(0, 300), skipCaption: !!body.skipCaption };
          return json({ ok: true, job: await stub.create(input) });
        }
        if (url.pathname === "/api/job") {
          const job = await stub.get(String(body.id || ""));
          return job ? json({ ok: true, job }) : json({ ok: false, error: "That result has expired." }, 404);
        }
        return json({ ok: true, jobs: await stub.recent(10) });
      } catch (e) {
        return json({ ok: false, error: e instanceof UserError ? e.message : String(e.message || e) }, e instanceof UserError ? e.status : 400);
      }
    }

    if (request.method === "POST" && (url.pathname === "/api/info" || url.pathname === "/api/video")) {
      if (!env.ACCESS_TOKEN) return json({ ok: false, error: "ACCESS_TOKEN isn't set in Cloudflare yet." }, 500);
      const body = await readBody(request);
      if (!authorized(request, body, env)) return json({ ok: false, error: "Wrong access code." }, 401);
      try {
        return url.pathname === "/api/info" ? json(await info(body, env)) : await video(body);
      } catch (e) {
        const status = e instanceof UserError ? e.status : 500;
        return json({ ok: false, error: e instanceof UserError ? e.message : "Something went wrong: " + String(e.message || e) }, status);
      }
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};
