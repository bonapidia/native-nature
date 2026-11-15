// Yard Planner: Claude picks plants to buy from the native plants actually recorded near the user.
import { handler, askClaude, fastModel, cleanWhere, HttpError } from "../../lib/shared.mjs";

const pick = (v, allowed) => (Array.isArray(v) ? v.filter((x) => allowed.includes(x)) : []);
const clean = (s, n = 80) => (typeof s === "string" ? s.replace(/["\n\r]/g, " ").trim().slice(0, n) : "");
const sameSpecies = (a, b) =>
  clean(a).toLowerCase().split(/\s+/).slice(0, 2).join(" ") === clean(b).toLowerCase().split(/\s+/).slice(0, 2).join(" ");

const str = (d) => ({ type: "string", description: d });
const TOOL = {
  name: "plant_list",
  description: "Return the plant shopping list for this family's yard.",
  input_schema: {
    type: "object",
    required: ["summary", "picks", "avoid", "buying_tip"],
    properties: {
      summary: str("2 short sentences on the overall plan"),
      picks: {
        type: "array", minItems: 1, maxItems: 8,
        items: {
          type: "object",
          required: ["scientific_name", "common_name", "type", "why", "kid_safe", "pet_safe"],
          properties: {
            scientific_name: str("exactly as written in the native list"),
            common_name: str("common name"),
            type: { type: "string", enum: ["Flower", "Shrub", "Tree", "Grass", "Vine", "Groundcover"] },
            why: str("one sentence on why it fits this family and yard"),
            attracts: { type: "array", items: { type: "string" }, maxItems: 3 },
            kid_safe: { type: "boolean", description: "true if non-toxic and free of spines or thorns" },
            pet_safe: { type: "boolean", description: "true if non-toxic to dogs and cats" },
            safety_note: str("short warning if not kid- or pet-safe, else empty"),
            sun: str("short"),
            size: str("mature size, short"),
            tip: str("one short planting or care tip"),
          },
        },
      },
      avoid: {
        type: "array", maxItems: 4,
        items: { type: "object", required: ["scientific_name", "common_name", "why"],
          properties: { scientific_name: str("exactly as in the non-native list"), common_name: str("common name"), why: str("one short sentence") } },
      },
      buying_tip: str("1-2 sentences on where to buy native plants in this region (types of places, not store names you are unsure of)"),
    },
  },
};

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

Call the plant_list tool with 6 picks from the native list, 0-4 plants to avoid from the non-native list (only ones that are invasive here and often sold in garden stores), and a buying tip.
If the household has young kids or pets, never pick toxic or spiny plants. Match the sunlight, water, space and plant types.
Keep every text field under 20 words.`;

  const out = await askClaude([{ type: "text", text: prompt }], 3000, fastModel(), TOOL);
  // Only keep picks that really are on the local native list.
  out.picks = (Array.isArray(out.picks) ? out.picks : []).filter((p) => natives.some((n) => sameSpecies(n.sci, p?.scientific_name))).slice(0, 8);
  if (!out.picks.length) throw new HttpError(502, "Couldn't build a plant list this time. Try again.");
  out.avoid = (Array.isArray(out.avoid) ? out.avoid : []).filter((a) => introduced.some((n) => sameSpecies(n.sci, a?.scientific_name))).slice(0, 4);
  return out;
});

export const config = { path: "/api/recommend" };
