// Helpers shared by the Netlify functions. Keys come from lib/keys.mjs (or Netlify
// environment variables, if set) and never reach the browser.
import * as KEYS from "./keys.mjs";

const real = (v) => (typeof v === "string" && v.trim() && !v.startsWith("PASTE_") ? v.trim() : "");
export const claudeKey = () => real(process.env.ANTHROPIC_API_KEY) || real(KEYS.ANTHROPIC_API_KEY);
export const plantnetKey = () => real(process.env.PLANTNET_API_KEY) || real(KEYS.PLANTNET_API_KEY);
const model = () => real(process.env.CLAUDE_MODEL) || real(KEYS.CLAUDE_MODEL) || "claude-sonnet-5-5";
// A faster model for long text-only answers, so they finish inside Netlify's 10-second limit.
export const fastModel = () => real(process.env.CLAUDE_FAST_MODEL) || "claude-haiku-5-5";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Wrap a handler so every error comes back as { error } JSON.
export function handler(fn) {
  return async (req) => {
    if (req.method !== "POST") return json(405, { error: "Use POST." });
    try {
      const body = await req.json().catch(() => {
        throw new HttpError(400, "Request body must be JSON.");
      });
      return json(200, await fn(body));
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      console.error(e);
      return json(status, { error: e.message || "Something went wrong." });
    }
  };
}

const MAX_IMAGE_CHARS = 5_500_000; // ~4 MB image after base64; the browser shrinks photos first
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function readImage(body) {
  const { image, mediaType = "image/jpeg" } = body || {};
  if (typeof image !== "string" || !image) throw new HttpError(400, "No photo was sent.");
  if (image.length > MAX_IMAGE_CHARS) throw new HttpError(413, "That photo is too large. Try a smaller one.");
  if (!TYPES.includes(mediaType)) throw new HttpError(400, "Use a JPG, PNG, WebP or GIF photo.");
  return { data: image, mediaType };
}

// Pull one JSON object out of Claude's reply, even if it adds a code fence.
export function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start === -1 || end <= start) throw new HttpError(502, "Claude's answer wasn't in the expected format. Try again.");
  const body = src.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {}
  try {
    return JSON.parse(body.replace(/,\s*([}\]])/g, "$1")); // drop trailing commas
  } catch {
    throw new HttpError(502, "Claude's answer wasn't in the expected format. Try again.");
  }
}

// With a `tool` ({ name, description, input_schema }), Claude must answer by filling in that
// structured form, which always comes back as valid JSON.
export async function askClaude(content, maxTokens = 900, modelName, tool) {
  const key = claudeKey();
  if (!key) throw new HttpError(500, "No Claude API key yet. Add ANTHROPIC_API_KEY in Netlify (Site configuration > Environment variables), then redeploy.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelName || model(),
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
      ...(tool ? { tools: [tool], tool_choice: { type: "tool", name: tool.name } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    console.error("Claude API error", res.status, detail);
    if (res.status === 429) throw new HttpError(429, "Too many requests right now. Wait a minute and try again.");
    if (res.status === 401) throw new HttpError(500, "The Claude API key in Netlify settings was rejected. Check it was copied fully.");
    if (res.status === 400 && /credit/i.test(detail)) throw new HttpError(402, "Your Claude API account is out of credit. Add more at console.anthropic.com.");
    if (res.status === 404 && /model/i.test(detail)) throw new HttpError(500, "The CLAUDE_MODEL setting isn't a valid model name.");
    throw new HttpError(502, "Claude couldn't be reached. Try again in a moment.");
  }
  const data = await res.json();
  const cutOff = data.stop_reason === "max_tokens";
  if (cutOff) console.error("Claude hit max_tokens", maxTokens);
  if (tool) {
    const block = (data.content || []).find((b) => b.type === "tool_use");
    if (!block?.input || cutOff) throw new HttpError(502, "Claude's answer was too long and got cut off. Try again.");
    return block.input;
  }
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return parseJson(text);
  } catch (e) {
    console.error("Unreadable Claude reply:", text.slice(0, 500));
    if (cutOff) throw new HttpError(502, "Claude's answer was too long and got cut off. Try again.");
    throw e;
  }
}

export const DESCRIBE_SHAPE = `"yard": {"kid_safe": true if safe for young kids to be around and touch (non-toxic, no spines, not venomous or biting), else false,
   "pet_safe": true if safe for dogs and cats, else false,
   "safety_note": "short reason if not kid- or pet-safe, else empty string",
   "attracts": [plants only: 0-4 of "birds", "butterflies", "bees", "hummingbirds", "lizards and toads"; empty list for animals],
   "plant_type": plants only: "Flower" | "Shrub" | "Tree" | "Grass" | "Vine" | "Groundcover"; empty string for animals,
   "sun": plants only: "full sun" | "part shade" | "full shade"; empty string for animals,
   "water": plants only: "low water" | "normal watering"; empty string for animals,
   "size": "typical adult size, short",
   "yard_role": "one short sentence on how it helps or harms a home yard"},
 "key_features": [2-4 short strings: features that help tell this species apart],
 "habitat": "one sentence on habitat and range",
 "fun_fact": "one surprising, accurate sentence",
 "safety": "one sentence if venomous, toxic, stinging or otherwise dangerous to people or pets; otherwise \\"None\\"",
 "similar": [0-3 look-alike species, common names]`;

export function cleanWhere(where) {
  return typeof where === "string" ? where.replace(/["\n\r]/g, " ").trim().slice(0, 300) : "";
}

// Extra JSON fields asking Claude whether the species is native where the user lives.
export function statusShape(place) {
  return place
    ? `"native_status": "native" | "introduced" | "invasive" | "unknown"  (its status in ${place}; use "invasive" only if it is known to harm local ecosystems there),
 "native_note": "one short sentence about its status in ${place}",
 `
    : "";
}
