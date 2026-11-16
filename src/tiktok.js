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

// Best video address, preferring the no-watermark play address at the highest bitrate.
export function videoUrlFromItem(item) {
  const v = (item && item.video) || {};
  const rates = Array.isArray(v.bitrateInfo) ? v.bitrateInfo.slice() : [];
  rates.sort((a, b) => (b.Bitrate || 0) - (a.Bitrate || 0));
  for (const r of rates) {
    const list = r && r.PlayAddr && r.PlayAddr.UrlList;
    if (Array.isArray(list) && list.length) return list[list.length - 1] || list[0];
  }
  return v.playAddr || v.downloadAddr || null;
}

async function tikwm(url) {
  try {
    const res = await fetch("https://www.tikwm.com/api/?hd=1&url=" + encodeURIComponent(url), {
      headers: { "User-Agent": UA, "Accept": "application/json" },
    });
    const j = await res.json();
    if (!j || j.code !== 0 || !j.data) return null;
    const d = j.data;
    const abs = (u) => (u && u.startsWith("/") ? "https://www.tikwm.com" + u : u);
    if (Array.isArray(d.images) && d.images.length) {
      return { photo: true, desc: d.title || "", handle: d.author && d.author.unique_id, nickname: d.author && d.author.nickname };
    }
    return {
      videoUrl: abs(d.hdplay) || abs(d.play),
      desc: d.title || "",
      handle: d.author && d.author.unique_id,
      nickname: d.author && d.author.nickname,
    };
  } catch {
    return null;
  }
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
        bioLink: (a.bioLink && a.bioLink.link) || "",
        videoUrl: videoUrlFromItem(item),
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
    return { signature: user.signature || "", bioLink: (user.bioLink && user.bioLink.link) || "" };
  } catch {
    return { signature: "", bioLink: "" };
  }
}

// Stream the mp4. TikTok's video servers want the cookies and referer from the page visit.
export async function fetchVideo(post) {
  if (!post.videoUrl) throw new UserError("Found the post, but TikTok didn't hand over the video file. Try again in a minute.", 502);
  const headers = { "User-Agent": DESKTOP_UA, "Referer": "https://www.tiktok.com/", "Accept": "*/*" };
  if (post.cookies) headers.Cookie = post.cookies;
  let res = await fetch(post.videoUrl, { headers });
  if (!res.ok || !(res.headers.get("content-type") || "").match(/video|octet-stream/)) {
    // One retry through the backup service if TikTok refused the file.
    const t = post.via === "tikwm" ? null : await tikwm(post.url);
    if (t && t.videoUrl) res = await fetch(t.videoUrl, { headers: { "User-Agent": UA } });
  }
  if (!res.ok) throw new UserError("TikTok refused the video download (" + res.status + "). Try again in a minute.", 502);
  return res;
}
