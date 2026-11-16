import { DurableObject } from "cloudflare:workers";
import { info } from "./info.js";
import { makeVapidKeys, sendPush } from "./push.js";

const KEEP_JOBS = 40;

// One instance ("main") holds the push subscriptions, the VAPID keys and recent jobs.
// Jobs run from the alarm so they finish even if the phone closes the app.
export class Jobs extends DurableObject {
  async vapid() {
    let v = await this.ctx.storage.get("vapid");
    if (!v) {
      v = await makeVapidKeys();
      await this.ctx.storage.put("vapid", v);
    }
    return v;
  }

  async publicKey() {
    return (await this.vapid()).publicKey;
  }

  async subscribe(sub) {
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) throw new Error("Bad subscription");
    const subs = (await this.ctx.storage.get("subs")) || {};
    subs[sub.endpoint] = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: Date.now() };
    await this.ctx.storage.put("subs", subs);
    return Object.keys(subs).length;
  }

  async create(input) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const job = { id, status: "working", input, createdAt: Date.now() };
    await this.ctx.storage.put("job:" + id, job);
    const order = (await this.ctx.storage.get("order")) || [];
    order.unshift(id);
    const drop = order.splice(KEEP_JOBS);
    await this.ctx.storage.put("order", order);
    if (drop.length) await this.ctx.storage.delete(drop.map((d) => "job:" + d));
    await this.ctx.storage.setAlarm(Date.now());
    return this.view(job);
  }

  view(job) {
    if (!job) return null;
    const { input, ...rest } = job;
    return { ...rest, url: input && input.url, account: input && input.account };
  }

  async get(id) {
    return this.view(await this.ctx.storage.get("job:" + id));
  }

  async recent(n = 10) {
    const order = ((await this.ctx.storage.get("order")) || []).slice(0, n);
    const jobs = await this.ctx.storage.get(order.map((id) => "job:" + id));
    return order.map((id) => this.view(jobs.get("job:" + id))).filter(Boolean);
  }

  async alarm() {
    const order = (await this.ctx.storage.get("order")) || [];
    for (const id of order.slice().reverse()) {
      const job = await this.ctx.storage.get("job:" + id);
      if (!job || job.status !== "working") continue;
      if (Date.now() - job.createdAt > 10 * 60 * 1000) {
        job.status = "error";
        job.error = "Timed out. Try again.";
      } else {
        try {
          job.result = await info(job.input, this.env);
          job.status = "done";
        } catch (e) {
          job.status = "error";
          job.error = String((e && e.message) || e);
        }
      }
      job.finishedAt = Date.now();
      await this.ctx.storage.put("job:" + id, job);
      await this.notify(job);
    }
  }

  async notify(job) {
    const subs = (await this.ctx.storage.get("subs")) || {};
    const list = Object.values(subs);
    if (!list.length) return;
    const r = job.result || {};
    const who = r.instagram ? "@" + r.instagram : r.tiktok ? "@" + r.tiktok + " (TikTok)" : "the video";
    const payload = job.status === "done"
      ? { title: "Caption ready ✅", body: `Credit: ${who}. Tap to copy it and save the video.`, url: "/?job=" + job.id, tag: job.id }
      : { title: "TikTok Saver couldn't finish", body: job.error || "Something went wrong.", url: "/?job=" + job.id, tag: job.id };
    const vapid = await this.vapid();
    const subject = this.env.PUSH_SUBJECT || "https://tiktok-saver.dnijankin.workers.dev";
    let changed = false;
    for (const sub of list) {
      try {
        const status = await sendPush(sub, payload, vapid, subject);
        if (status === 404 || status === 410) { delete subs[sub.endpoint]; changed = true; }
      } catch {
        // keep the subscription; a later job may get through
      }
    }
    if (changed) await this.ctx.storage.put("subs", subs);
  }
}
