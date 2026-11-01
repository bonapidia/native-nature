// Step 1: Claude looks at the photo, decides plant vs animal, and gives a first ID.
import { handler, readImage, askClaude, DESCRIBE_SHAPE, cleanWhere } from "../../lib/shared.mjs";

export default handler(async (body) => {
  const img = readImage(body);
  const where = cleanWhere(body.where);

  const prompt = `You are an expert naturalist. Identify the main living organism in this photo.
${where ? `The photographer says where they saw it: "${where}". Use it only as context.` : ""}
Reply with ONLY a JSON object of this shape:
{"group": "plant" | "animal" | "fungus" | "none",
 "category": "Plant" | "Tree" | "Flower" | "Mammal" | "Bird" | "Reptile" | "Amphibian" | "Fish" | "Insect" | "Spider" | "Other animal" | "Fungus",
 "common_name": string,
 "scientific_name": "Genus species (or Genus sp. if unsure of species)",
 "confidence": integer 0-100,
 "taxonomy": {"kingdom": string, "family": string, "genus": string},
 ${DESCRIBE_SHAPE}}
"group" is "plant" for any plant, tree, flower, grass, fern, moss or cactus.
If no living organism is visible, use group "none", common_name "No organism found", confidence 0, and explain briefly in fun_fact.
Lower confidence for blurry photos or species that are hard to tell apart.`;

  const result = await askClaude([
    { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
    { type: "text", text: prompt },
  ]);
  if (!["plant", "animal", "fungus", "none"].includes(result.group)) result.group = "animal";
  return result;
});

export const config = { path: "/api/identify" };
