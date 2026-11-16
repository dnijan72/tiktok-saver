import { getPost, getProfile } from "./tiktok.js";
import { findInstagram } from "./instagram.js";
import { writeCaption, creditLine } from "./caption.js";

// Reads the TikTok, finds the credit and writes the caption. Used by /api/info and by background jobs.
export async function info(body, env) {
  const post = await getPost(body.url);
  let { signature, bioLink } = post;
  if (!signature && !bioLink) ({ signature, bioLink } = await getProfile(post.handle));
  const ig = await findInstagram({ signature, bioLink });
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
    instagramFoundIn: ig.source, // "bio", "link" or null
    tiktokCaption: post.desc,
    bio: signature,
    bioLink,
    hasVideo: !!post.videoUrl,
    via: post.via,
    url: post.url,
    captionError,
  };
}
