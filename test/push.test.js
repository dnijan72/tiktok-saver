import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptPayload, sendPush, makeVapidKeys, b64url, unb64url } from "../src/push.js";

const enc = new TextEncoder();
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

// Plays the browser's part: decrypt per RFC 8291.
async function decrypt(body, uaKeys, auth, uaPublic) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaKeys.privateKey, 256));
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
  assert.equal(plain[plain.length - 1], 2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

test("push payload decrypts like a browser would", async () => {
  const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: b64url(uaPublic), auth: b64url(auth) } };
  const body = await encryptPayload(sub, { title: "Caption ready ✅", body: "Credit: @x" });
  assert.deepEqual(JSON.parse(await decrypt(body, ua, auth, uaPublic)), { title: "Caption ready ✅", body: "Credit: @x" });
});

test("VAPID header is a valid ES256 JWT for the push service", async () => {
  const vapid = await makeVapidKeys();
  const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const sub = { endpoint: "https://web.push.apple.com/QOabc", keys: { p256dh: b64url(new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey))), auth: b64url(new Uint8Array(16)) } };
  let seen;
  const status = await sendPush(sub, { t: 1 }, vapid, "https://example.workers.dev", async (url, init) => { seen = { url, init }; return { status: 201 }; });
  assert.equal(status, 201);
  assert.equal(seen.init.headers["Content-Encoding"], "aes128gcm");
  const m = seen.init.headers.Authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m);
  const claims = JSON.parse(new TextDecoder().decode(unb64url(m[2])));
  assert.equal(claims.aud, "https://web.push.apple.com");
  assert.equal(m[4], vapid.publicKey);
  const pub = await crypto.subtle.importKey("raw", unb64url(m[4]), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, unb64url(m[3]), enc.encode(m[1] + "." + m[2])));
});
