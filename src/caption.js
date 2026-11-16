// Writes the Instagram caption with Claude, in Dylan's voice for the chosen account.

const MODEL = "claude-sonnet-5-5";

const ACCOUNTS = {
  newyorkers: "@newyorkers: general NYC news and viral NYC moments, 1M+ followers. Caption is 2-4 sentences. The first sentence is a hook that names the main topic. Then add context that makes the clip make sense.",
  newyorklocals: "@newyorklocals: local NYC news, events and openings. Caption is under 3 sentences. Include where and when if the TikTok says so.",
  nysports: "@nysports: New York sports. Caption is 2 sentences max, short and punchy, can use a sports emoji.",
  apartmentsnyc: "@apartmentsnyc: NYC apartments and real estate. Caption is 2-3 sentences. Mention neighborhood, price or size if the TikTok gives them.",
};

const RULES = `Voice: a real New Yorker. Punchy, direct, natural full sentences. Never corporate, never AI-sounding, not wordy.
- No hashtags. At most one emoji in the caption (the credit line adds another).
- Almost no em-dashes.
- Use only facts from the TikTok's caption and creator info. Never invent names, places, numbers or events. If the TikTok caption is vague, keep the Instagram caption general rather than guessing.
- No engagement question at the end.
- Don't mention TikTok, and don't include the credit line or any @handle. That gets added separately.
- Reply with only the caption text.`;

export async function writeCaption(env, { account, desc, nickname, handle, note }) {
  const acct = ACCOUNTS[account] || ACCOUNTS.newyorkers;
  const prompt = `Write an Instagram caption for a reposted TikTok video.

Account: ${acct}

TikTok caption: ${desc ? JSON.stringify(desc) : "(none)"}
Creator: ${nickname || "unknown"} (@${handle || "unknown"})${note ? `\nDylan's note about the video: ${note}` : ""}

${RULES}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: env.CAPTION_MODEL || MODEL, max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Caption request failed (" + res.status + "): " + t.slice(0, 200));
  }
  const j = await res.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  return text.replace(/^["“]|["”]$/g, "").replace(/\s*#\S+/g, "").trim();
}

export function creditLine(instagram, tiktokHandle) {
  if (instagram) return "🎥: @" + instagram;
  if (tiktokHandle) return "🎥: @" + tiktokHandle + " on TikTok";
  return "";
}
