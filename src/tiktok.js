// Everything that talks to TikTok: resolve a share link, read the video page,
// pull out the video file, the caption and the creator, and stream the mp4.

export const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HTML_HEADERS = {
  "User-Agent": DESKTOP_UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Accept anything the share sheet might hand over: a bare URL, "Check out this video https://vm.tiktok.com/xyz/ ...", etc.
export function extractLink(input) {
  const m = String(input || "").match(/https?:\/\/[^\s"'<>]*tiktok\.com\/[^\s"'<>]*/i);
  if (!m) throw new UserError("That doesn't look like a TikTok link.");
  return m[0].replace(/[).,]+$/, "");
}

export function idFromUrl(url) {
  const m = String(url).match(/\/(?:video|photo)\/(\d{8,})/);
  return m ? m[1] : null;
}

export function handleFromUrl(url) {
  const m = String(url).match(/tiktok\.com\/@([A-Za-z0-9._]+)/);
  return m ? m[1] : null;
}

// Short links (vm.tiktok.com, tiktok.com/t/...) redirect to the full /@user/video/123 URL.
export async function resolveLink(link) {
  if (idFromUrl(link)) return link;
  let url = link;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: HTML_HEADERS, redirect: "manual" });
    const loc = res.headers.get("location");
    if (!loc) break;
    url = new URL(loc, url).href;
    if (idFromUrl(url)) return url.split("?")[0];
  }
  if (idFromUrl(url)) return url.split("?")[0];
  throw new UserError("Couldn't open that TikTok link. Check that it's a video link, not a profile.");
}

function cookieString(res) {
  const raw = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : (res.headers.get("set-cookie") || "").split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  return raw.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

// TikTok ships page data as JSON inside a script tag.
export function readRehydration(html) {
  const m = String(html).match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function itemFromPage(html) {
  const data = readRehydration(html);
  const scope = data && data.__DEFAULT_SCOPE__;
  const detail = scope && scope["webapp.video-detail"];
  const item = detail && detail.itemInfo && detail.itemInfo.itemStruct;
  return item && item.id ? item : null;
}

export function userFromPage(html) {
  const data = readRehydration(html);
  const scope = data && data.__DEFAULT_SCOPE__;
  const ud = scope && scope["webapp.user-detail"];
  return (ud && ud.userInfo && ud.userInfo.user) || null;
}

// Every video address TikTok gives, best first: highest bitrate, CDN hosts before
// www.tiktok.com/aweme/... (that one needs a logged-in browser and returns a web page).
export function videoUrlsFromItem(item) {
  const v = (item && item.video) || {};
  const rates = Array.isArray(v.bitrateInfo) ? v.bitrateInfo.slice() : [];
  rates.sort((a, b) => (b.Bitrate || 0) - (a.Bitrate || 0));
  const all = [];
  for (const r of rates) for (const u of (r && r.PlayAddr && r.PlayAddr.UrlList) || []) all.push(u);
  all.push(v.playAddr, v.downloadAddr);
  const seen = new Set();
  const list = all.filter((u) => typeof u === "string" && /^https?:/.test(u) && !seen.has(u) && seen.add(u));
  const web = (u) => /\/\/www\.tiktok\.com\//.test(u);
  return list.filter((u) => !web(u)).concat(list.filter(web)).slice(0, 8);
}

export function videoUrlFromItem(item) {
  return videoUrlsFromItem(item)[0] || null;
}

// Backup downloader. Returns { videoUrl, videoUrls, ... } or { error }.
export async function tikwm(url) {
  const parse = (j) => {
    if (!j || j.code !== 0 || !j.data) return { error: "tikwm said " + ((j && (j.msg || j.code)) || "nothing") };
    const d = j.data;
    const abs = (u) => (u && u.startsWith("/") ? "https://www.tikwm.com" + u : u);
    if (Array.isArray(d.images) && d.images.length) {
      return { photo: true, desc: d.title || "", handle: d.author && d.author.unique_id, nickname: d.author && d.author.nickname };
    }
    const urls = [abs(d.hdplay), abs(d.play), abs(d.wmplay)].filter(Boolean);
    return { videoUrl: urls[0], videoUrls: urls, desc: d.title || "", handle: d.author && d.author.unique_id, nickname: d.author && d.author.nickname };
  };
  const errors = [];
  const tries = [
    () => fetch("https://www.tikwm.com/api/?hd=1&url=" + encodeURIComponent(url), { headers: { "User-Agent": UA, "Accept": "application/json" } }),
    () => fetch("https://www.tikwm.com/api/", { method: "POST", headers: { "User-Agent": UA, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: "hd=1&url=" + encodeURIComponent(url) }),
  ];
  for (const go of tries) {
    try {
      const res = await go();
      const text = await res.text();
      let j = null;
      try { j = JSON.parse(text); } catch { errors.push("tikwm HTTP " + res.status + " (not JSON)"); continue; }
      const r = parse(j);
      if (!r.error) return r;
      errors.push(r.error);
      if (/limit/i.test(r.error)) await new Promise((ok) => setTimeout(ok, 1200));
    } catch (e) {
      errors.push("tikwm " + String((e && e.message) || e));
    }
  }
  return { error: errors.join(", ") };
}

async function oembed(url) {
  try {
    const res = await fetch("https://www.tiktok.com/oembed?url=" + encodeURIComponent(url), {
      headers: { "User-Agent": DESKTOP_UA },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return { desc: j.title || "", handle: j.author_unique_id || handleFromUrl(j.author_url || ""), nickname: j.author_name || "" };
  } catch {
    return null;
  }
}

// Returns { url, id, desc, handle, nickname, signature, bioLink, videoUrl, cookies, via }.
export async function getPost(input) {
  const url = await resolveLink(extractLink(input));
  const id = idFromUrl(url);
  if (/\/photo\//.test(url)) throw new UserError("That's a photo slideshow, not a video. Only videos can be saved.");

  let post = null;
  try {
    const res = await fetch(url, { headers: HTML_HEADERS });
    const html = await res.text();
    const item = itemFromPage(html);
    if (item) {
      if (Array.isArray(item.imagePost && item.imagePost.images) && item.imagePost.images.length) {
        throw new UserError("That's a photo slideshow, not a video. Only videos can be saved.");
      }
      const a = item.author || {};
      post = {
        url, id,
        desc: item.desc || "",
        handle: a.uniqueId || handleFromUrl(url),
        nickname: a.nickname || "",
        signature: a.signature || "",
        insId: a.insId || a.ins_id || "",
        bioLink: (a.bioLink && a.bioLink.link) || "",
        videoUrl: videoUrlFromItem(item),
        videoUrls: videoUrlsFromItem(item),
        cookies: cookieString(res),
        via: "tiktok",
      };
    }
  } catch (e) {
    if (e instanceof UserError) throw e;
  }

  if (!post || !post.videoUrl) {
    const t = await tikwm(url);
    if (t && t.photo) throw new UserError("That's a photo slideshow, not a video. Only videos can be saved.");
    if (t && t.videoUrl) {
      post = Object.assign({ url, id, signature: "", bioLink: "", cookies: "" }, post || {}, {
        videoUrl: t.videoUrl,
        videoUrls: t.videoUrls,
        desc: (post && post.desc) || t.desc,
        handle: (post && post.handle) || t.handle || handleFromUrl(url),
        nickname: (post && post.nickname) || t.nickname || "",
        via: "tikwm",
      });
    }
  }

  if (!post) {
    const o = await oembed(url);
    if (o) post = { url, id, desc: o.desc, handle: o.handle || handleFromUrl(url), nickname: o.nickname, signature: "", bioLink: "", videoUrl: null, cookies: "", via: "oembed" };
  }
  if (!post) throw new UserError("TikTok didn't return this video. It may be private, deleted or age-restricted.", 502);
  return post;
}

// The creator's bio and link-in-bio, from their profile page (the video page doesn't always include them).
export async function getProfile(handle) {
  if (!handle) return { signature: "", bioLink: "" };
  try {
    const res = await fetch("https://www.tiktok.com/@" + encodeURIComponent(handle), { headers: HTML_HEADERS });
    const user = userFromPage(await res.text());
    if (!user) return { signature: "", bioLink: "" };
    return { signature: user.signature || "", bioLink: (user.bioLink && user.bioLink.link) || "", insId: user.insId || user.ins_id || "" };
  } catch {
    return { signature: "", bioLink: "" };
  }
}

const MAX_BYTES = 95 * 1024 * 1024;

// True when the bytes are an mp4 (has an "ftyp" box near the start).
export function looksLikeMp4(bytes) {
  if (!bytes || bytes.length < 50000) return false;
  const head = String.fromCharCode(...bytes.slice(0, 64));
  return head.includes("ftyp");
}

export async function tryDownload(url, headers) {
  try {
    const res = await fetch(url, { headers, redirect: "follow" });
    if (!res.ok && res.status !== 206) return { error: "HTTP " + res.status };
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return { error: "too large" };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!looksLikeMp4(bytes)) return { error: "not a video (" + (res.headers.get("content-type") || "?") + ", " + bytes.length + " bytes)" };
    return { bytes };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// Download the whole mp4 into memory and check it, trying each source in turn,
// so a broken download becomes a clear error instead of a cut-off file.
export async function fetchVideo(post) {
  const tried = [];
  if (post.via !== "tikwm") {
    const headers = {
      "User-Agent": DESKTOP_UA,
      "Referer": "https://www.tiktok.com/",
      "Origin": "https://www.tiktok.com",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Range": "bytes=0-",
    };
    if (post.cookies) headers.Cookie = post.cookies;
    const urls = (post.videoUrls && post.videoUrls.length ? post.videoUrls : [post.videoUrl]).filter(Boolean).slice(0, 4);
    for (const [i, u] of urls.entries()) {
      const r = await tryDownload(u, headers);
      if (r.bytes) return r.bytes;
      tried.push(`tiktok #${i + 1} (${new URL(u).hostname}): ${r.error}`);
    }
  }
  const backup = post.via === "tikwm" ? { videoUrls: post.videoUrls || [post.videoUrl] } : await tikwm(post.url);
  if (backup.error) tried.push(backup.error);
  for (const [i, u] of (backup.videoUrls || []).entries()) {
    const r = await tryDownload(u, { "User-Agent": UA, "Accept": "*/*" });
    if (r.bytes) return r.bytes;
    tried.push(`backup #${i + 1}: ${r.error}`);
  }
  if (post.via !== "tikwm" && !/tt_chain_token/.test(post.cookies || "")) tried.push("no TikTok session cookie");
  console.log("video download failed", post.url, tried.join(" | "));
  throw new UserError("Couldn't download this video right now (" + (tried.join("; ") || "no file found") + "). Try again in a minute.", 502);
}

// Status-only report for debugging downloads (never returns video data or captions).
export async function diagnose(input) {
  const out = { steps: [] };
  try {
    const post = await getPost(input);
    out.via = post.via;
    out.handle = post.handle;
    out.hasCookies = !!post.cookies;
    out.hasChainToken = /tt_chain_token/.test(post.cookies || "");
    out.candidates = (post.videoUrls || [post.videoUrl]).filter(Boolean).map((u) => new URL(u).hostname);
    const headers = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "Referer": "https://www.tiktok.com/", "Origin": "https://www.tiktok.com", "Accept": "*/*", "Range": "bytes=0-" };
    if (post.cookies) headers.Cookie = post.cookies;
    for (const u of (post.videoUrls || [post.videoUrl]).filter(Boolean).slice(0, 4)) {
      const r = await tryDownload(u, headers);
      out.steps.push({ source: "tiktok " + new URL(u).hostname, ok: !!r.bytes, size: r.bytes ? r.bytes.length : undefined, error: r.error });
      if (r.bytes) break;
    }
    const t = await tikwm(post.url);
    out.steps.push({ source: "tikwm api", ok: !t.error, urls: (t.videoUrls || []).length, error: t.error });
    if (!t.error && t.videoUrls && t.videoUrls[0]) {
      const r = await tryDownload(t.videoUrls[0], { "User-Agent": UA, "Accept": "*/*" });
      out.steps.push({ source: "tikwm file", ok: !!r.bytes, size: r.bytes ? r.bytes.length : undefined, error: r.error });
    }
  } catch (e) {
    out.error = String((e && e.message) || e);
  }
  return out;
}
