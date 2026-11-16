// Find a creator's Instagram handle from their TikTok bio or their link-in-bio page (Linktree, Beacons, etc).

const RESERVED = new Set([
  "p", "reel", "reels", "tv", "explore", "accounts", "stories", "direct", "about", "legal",
  "developer", "web", "emails", "privacy", "help", "share", "s", "instagram",
]);

function clean(h) {
  h = String(h || "").replace(/^@/, "").replace(/[._]+$/, "").toLowerCase();
  if (!/^[a-z0-9._]{2,30}$/.test(h) || RESERVED.has(h)) return null;
  return h;
}

export function igFromText(text) {
  const t = String(text || "");
  // instagram.com/handle or instagr.am/handle
  let m = t.match(/(?:instagram\.com|instagr\.am)\/(?!p\/|reel\/|reels\/|explore\/|stories\/)([A-Za-z0-9._]{2,30})/i);
  if (m && clean(m[1])) return clean(m[1]);
  // "IG: handle", "ig - @handle", "insta @handle", "Instagram: handle", "📸 @handle"
  // A separator or @ is required, so "Insta is my main app" doesn't count.
  m = t.match(/(?:\big\b|\binsta(?:gram)?\b|📸|📷)(?:\s*[:\-–—|/]+\s*@?|\s*@)([A-Za-z0-9._]{2,30})/i);
  if (m && clean(m[1])) return clean(m[1]);
  return null;
}

function normalizeLink(link) {
  link = String(link || "").trim();
  if (!link) return null;
  if (!/^https?:\/\//i.test(link)) link = "https://" + link;
  try {
    const u = new URL(link);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

// Returns { handle, source } where source is "bio", "link" or null.
export async function findInstagram({ signature, bioLink }, fetchImpl = fetch) {
  const fromBio = igFromText(signature);
  if (fromBio) return { handle: fromBio, source: "bio" };

  const links = [];
  const n = normalizeLink(bioLink);
  if (n) links.push(n);
  for (const m of String(signature || "").matchAll(/(?:https?:\/\/)?(?:linktr\.ee|beacons\.ai|stan\.store|campsite\.bio|lnk\.bio|linkin\.bio|bio\.link|hoo\.be|komi\.io)\/[A-Za-z0-9._\-/]+/gi)) {
    const l = normalizeLink(m[0]);
    if (l && !links.includes(l)) links.push(l);
  }

  for (const link of links.slice(0, 2)) {
    const direct = igFromText(link);
    if (direct) return { handle: direct, source: "link" };
    try {
      const res = await fetchImpl(link, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
        redirect: "follow",
      });
      const html = (await res.text()).slice(0, 600000);
      const h = igFromText(html.replace(/\\\//g, "/"));
      if (h) return { handle: h, source: "link" };
    } catch {
      // ignore and try the next link
    }
  }
  return { handle: null, source: null };
}
