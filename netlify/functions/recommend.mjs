// Yard Planner: Claude picks plants to buy from the native plants actually recorded near the user.
import { handler, askClaude, fastModel, cleanWhere, HttpError } from "../../lib/shared.mjs";

const pick = (v, allowed) => (Array.isArray(v) ? v.filter((x) => allowed.includes(x)) : []);
const clean = (s, n = 80) => (typeof s === "string" ? s.replace(/["\n\r]/g, " ").trim().slice(0, n) : "");
const sameSpecies = (a, b) =>
  clean(a).toLowerCase().split(/\s+/).slice(0, 2).join(" ") === clean(b).toLowerCase().split(/\s+/).slice(0, 2).join(" ");

export default handler(async (body) => {
  const place = cleanWhere(body.place);
  if (!place) throw new HttpError(400, "Set your location first.");
  const natives = (Array.isArray(body.natives) ? body.natives : []).slice(0, 80)
    .map((p) => ({ sci: clean(p?.sci), common: clean(p?.common) })).filter((p) => p.sci);
  if (natives.length < 5) throw new HttpError(400, "Not enough native plants are recorded near you to make a list yet.");
  const introduced = (Array.isArray(body.introduced) ? body.introduced : []).slice(0, 40)
    .map((p) => ({ sci: clean(p?.sci), common: clean(p?.common) })).filter((p) => p.sci);

  const family = pick(body.family, ["young kids", "dogs", "cats"]);
  const attract = pick(body.attract, ["birds", "butterflies", "bees and pollinators", "hummingbirds", "lizards, toads and small wildlife"]);
  const types = pick(body.types, ["flowers", "shrubs", "trees", "grasses", "vines", "groundcover"]);
  const sun = ["full sun", "part shade", "full shade"].includes(body.sun) ? body.sun : "full sun";
  const water = ["low water", "normal watering"].includes(body.water) ? body.water : "normal watering";
  const space = ["small yard or containers", "medium yard", "large yard"].includes(body.space) ? body.space : "medium yard";

  const list = (arr) => arr.map((p) => `${p.sci}${p.common ? ` (${p.common})` : ""}`).join("; ");
  const prompt = `You are a native-plant gardening expert helping a family in ${place} choose plants to buy for their yard.

Their yard and family:
- Household: ${family.length ? family.join(", ") : "no young kids or pets"}
- Wants to attract: ${attract.length ? attract.join(", ") : "general wildlife"}
- Plant types wanted: ${types.length ? types.join(", ") : "any"}
- Sunlight: ${sun}. Water: ${water}. Space: ${space}.

Native plants recorded in their area (choose ONLY from this list):
${list(natives)}

Non-native plants recorded in their area:
${list(introduced) || "none listed"}

Reply with ONLY a JSON object:
{"summary": "2 sentences on the overall plan",
 "picks": [6-8 objects: {"scientific_name": exactly as in the native list, "common_name": string,
   "type": "Flower" | "Shrub" | "Tree" | "Grass" | "Vine" | "Groundcover",
   "why": "one sentence on why it fits this family and yard",
   "attracts": [1-3 short strings],
   "kid_safe": true if non-toxic and free of spines or thorns, else false,
   "pet_safe": true if non-toxic to dogs and cats, else false,
   "safety_note": "short warning if not kid- or pet-safe, else empty string",
   "sun": "short", "size": "mature size, short", "tip": "one short planting or care tip"}],
 "avoid": [0-4 objects from the non-native list that are invasive here and often sold in garden stores: {"common_name": string, "scientific_name": string, "why": "one short sentence"}],
 "buying_tip": "one or two sentences on where to buy native plants in this region (types of places, not specific store names you are unsure of)"}
If the household has young kids or pets, never pick toxic or spiny plants. Match the sunlight, water, space and plant types. Keep every string short.`;

  const out = await askClaude([{ type: "text", text: prompt }], 1600, fastModel());
  // Only keep picks that really are on the local native list.
  out.picks = (Array.isArray(out.picks) ? out.picks : []).filter((p) => natives.some((n) => sameSpecies(n.sci, p?.scientific_name))).slice(0, 8);
  if (!out.picks.length) throw new HttpError(502, "Couldn't build a plant list this time. Try again.");
  out.avoid = (Array.isArray(out.avoid) ? out.avoid : []).filter((a) => introduced.some((n) => sameSpecies(n.sci, a?.scientific_name))).slice(0, 4);
  return out;
});

export const config = { path: "/api/recommend" };
