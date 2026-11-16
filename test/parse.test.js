import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLink, idFromUrl, itemFromPage, userFromPage, videoUrlFromItem } from "../src/tiktok.js";
import { igFromText, findInstagram } from "../src/instagram.js";
import { creditLine } from "../src/caption.js";
import worker from "../src/index.js";

const page = (scope) =>
  `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: scope })}</script></html>`;

test("pulls the link out of share-sheet text", () => {
  assert.equal(extractLink("Check this out! https://vm.tiktok.com/ZMabc123/ lol"), "https://vm.tiktok.com/ZMabc123/");
  assert.equal(extractLink("https://www.tiktok.com/@nyc.guy/video/7312345678901234567?is_from_webapp=1"),
    "https://www.tiktok.com/@nyc.guy/video/7312345678901234567?is_from_webapp=1");
  assert.throws(() => extractLink("https://instagram.com/p/abc"));
  assert.equal(idFromUrl("https://www.tiktok.com/@a/video/7312345678901234567?x=1"), "7312345678901234567");
});

test("reads the video page data", () => {
  const html = page({
    "webapp.video-detail": { itemInfo: { itemStruct: {
      id: "7312345678901234567", desc: "Rat carrying a whole slice on the 1 train",
      author: { uniqueId: "subwaycam", nickname: "Subway Cam", signature: "NYC daily 🚇 IG: subway.cam" },
      video: { playAddr: "https://v16.example/play.mp4", downloadAddr: "https://v16.example/wm.mp4",
        bitrateInfo: [{ Bitrate: 500, PlayAddr: { UrlList: ["https://v16.example/low.mp4"] } }, { Bitrate: 1500, PlayAddr: { UrlList: ["https://a/hi.mp4", "https://b/hi.mp4"] } }] },
    } } },
  });
  const item = itemFromPage(html);
  assert.equal(item.author.uniqueId, "subwaycam");
  assert.equal(videoUrlFromItem(item), "https://b/hi.mp4");
  assert.equal(videoUrlFromItem({ video: { playAddr: "p", downloadAddr: "d" } }), "p");
  assert.equal(itemFromPage("<html>captcha</html>"), null);
  const user = userFromPage(page({ "webapp.user-detail": { userInfo: { user: { signature: "hi", bioLink: { link: "linktr.ee/x" } } } } }));
  assert.equal(user.bioLink.link, "linktr.ee/x");
});

test("finds Instagram handles in bios", () => {
  assert.equal(igFromText("NYC daily 🚇 IG: subway.cam"), "subway.cam");
  assert.equal(igFromText("follow my insta @Bk_Eats."), "bk_eats");
  assert.equal(igFromText("instagram.com/nyc.walks/"), "nyc.walks");
  assert.equal(igFromText("📸 @shotby.dee"), "shotby.dee");
  assert.equal(igFromText("Insta is where I post more"), null);
  assert.equal(igFromText("big apple vibes"), null);
  assert.equal(igFromText("instagram.com/p/Cxyz123"), null);
  assert.equal(igFromText("nothing here"), null);
});

test("follows a Linktree to find Instagram", async () => {
  const fakeFetch = async (url) => ({
    text: async () => url.includes("linktr.ee")
      ? '<a href="https://www.tiktok.com/@x">TikTok</a><a href="https:\\/\\/www.instagram.com\\/real.handle\\/">Instagram</a>'
      : "",
  });
  assert.deepEqual(await findInstagram({ signature: "comedy", bioLink: "linktr.ee/someone" }, fakeFetch), { handle: "real.handle", source: "link" });
  assert.deepEqual(await findInstagram({ signature: "ig - @first.choice", bioLink: "linktr.ee/x" }, fakeFetch), { handle: "first.choice", source: "bio" });
  assert.deepEqual(await findInstagram({ signature: "", bioLink: "" }, fakeFetch), { handle: null, source: null });
});

test("credit line", () => {
  assert.equal(creditLine("ig.person", "tt.person"), "🎥: @ig.person");
  assert.equal(creditLine(null, "tt.person"), "🎥: @tt.person on TikTok");
});

test("API needs the access code", async () => {
  const env = { ACCESS_TOKEN: "secret-123" };
  const req = (body) => new Request("https://x.dev/api/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let r = await worker.fetch(req({ url: "https://www.tiktok.com/@a/video/7312345678901234567", token: "nope" }), env);
  assert.equal(r.status, 401);
  r = await worker.fetch(req({ url: "x", token: "secret-123" }), {});
  assert.equal(r.status, 500);
  r = await worker.fetch(req({ url: "not a link", token: "secret-123" }), env);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /TikTok link/);
  r = await worker.fetch(new Request("https://x.dev/"), env);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /TikTok <span>Saver<\/span>/);
});

test("serves the app icon and manifest", async () => {
  let r = await worker.fetch(new Request("https://x.dev/apple-touch-icon.png"), {});
  assert.equal(r.headers.get("content-type"), "image/png");
  const b = new Uint8Array(await r.arrayBuffer());
  assert.deepEqual([...b.slice(1, 4)], [80, 78, 71]);
  r = await worker.fetch(new Request("https://x.dev/manifest.webmanifest"), {});
  assert.equal(JSON.parse(await r.text()).display, "standalone");
  r = await worker.fetch(new Request("https://x.dev/"), {});
  assert.match(await r.text(), /apple-touch-icon/);
});

test("manual Instagram and stronger detection", async () => {
  const { manualInstagram } = await import("../src/instagram.js");
  assert.equal(manualInstagram("@Dee.Shoots"), "dee.shoots");
  assert.equal(manualInstagram("https://www.instagram.com/dee.shoots/?hl=en"), "dee.shoots");
  assert.equal(manualInstagram("dee_shoots "), "dee_shoots");
  assert.equal(manualInstagram(""), null);
  assert.equal(igFromText("IG ➡️ nycwalks"), "nycwalks");
  assert.equal(igFromText("insta → @bk.food"), "bk.food");
  assert.deepEqual(await findInstagram({ signature: "", bioLink: "", insId: "linked.one" }, async () => ({ text: async () => "" })), { handle: "linked.one", source: "tiktok" });
});

test("video download checks for a real mp4 and falls back to the backup", async () => {
  const { fetchVideo, looksLikeMp4 } = await import("../src/tiktok.js");
  const mp4 = new Uint8Array(200000); mp4.set([0, 0, 0, 32, 102, 116, 121, 112], 0); // ....ftyp
  assert.ok(looksLikeMp4(mp4));
  assert.ok(!looksLikeMp4(new TextEncoder().encode("<html>blocked</html>".repeat(5000))));
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://v16.tiktok/")) return new Response("<html>Access denied</html>", { status: 200, headers: { "content-type": "text/html" } });
    if (String(url).includes("tikwm.com/api")) return new Response(JSON.stringify({ code: 0, data: { hdplay: "/hd.mp4", play: "https://cdn.x/play.mp4", title: "t", author: { unique_id: "a" } } }));
    if (String(url) === "https://www.tikwm.com/hd.mp4") return new Response("nope", { status: 403 });
    if (String(url) === "https://cdn.x/play.mp4") return new Response(mp4, { headers: { "content-type": "video/mp4" } });
    return new Response("", { status: 404 });
  };
  try {
    const bytes = await fetchVideo({ url: "https://www.tiktok.com/@a/video/7312345678901234567", videoUrl: "https://v16.tiktok/x.mp4", via: "tiktok", cookies: "a=b" });
    assert.equal(bytes.length, mp4.length);
    assert.deepEqual(calls.slice(-2), ["https://www.tikwm.com/hd.mp4", "https://cdn.x/play.mp4"]);
    globalThis.fetch = async () => new Response("<html>no</html>", { status: 200 });
    await assert.rejects(fetchVideo({ url: "https://www.tiktok.com/@a/video/1", videoUrl: "https://v16.tiktok/x.mp4", via: "tiktok" }), /Couldn't download/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
