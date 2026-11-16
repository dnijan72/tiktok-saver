import { getPost, getProfile } from "./tiktok.js";
import { findInstagram, manualInstagram } from "./instagram.js";
import { writeCaption, creditLine } from "./caption.js";

// Reads the TikTok, finds the credit and writes the caption. Used by /api/info and by background jobs.
export async function info(body, env) {
  const post = await getPost(body.url);
  let { signature, bioLink } = post;
  const manual = manualInstagram(body.instagram);
  let ig = manual ? { handle: manual, source: "manual" } : await findInstagram({ signature, bioLink, insId: post.insId });
  if (!ig.handle) {
    // The video page often leaves out the bio link; the profile page has it.
    const profile = await getProfile(post.handle);
    signature = signature || profile.signature;
    bioLink = bioLink || profile.bioLink;
    ig = await findInstagram({ signature: profile.signature || signature, bioLink: profile.bioLink || bioLink, insId: profile.insId });
  }
  const credit = creditLine(ig.handle, post.handle);

  let caption = "";
  let captionError = null;
  if (body.skipCaption) {
    // Claude wrote the caption in chat; only the video and credit are needed.
  } else if (env.ANTHROPIC_API_KEY) {
    try {
      caption = await writeCaption(env, { account: body.account, desc: post.desc, nickname: post.nickname, handle: post.handle, note: body.note });
    } catch (e) {
      captionError = String(e.message || e);
    }
  } else {
    captionError = "ANTHROPIC_API_KEY isn't set in Cloudflare yet.";
  }

  return {
    ok: true,
    caption,
    credit,
    full: [caption, credit].filter(Boolean).join("\n\n"),
    tiktok: post.handle,
    tiktokName: post.nickname,
    instagram: ig.handle,
    instagramFoundIn: ig.source, // "manual", "tiktok", "bio", "link" or null
    tiktokCaption: post.desc,
    bio: signature,
    bioLink,
    hasVideo: !!post.videoUrl,
    via: post.via,
    url: post.url,
    captionError,
  };
}
