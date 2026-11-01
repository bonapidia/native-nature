// Step 1: Claude looks at the photo, decides plant vs animal, and gives a first ID.
import { handler, readImage, askClaude, DESCRIBE_SHAPE, cleanWhere, statusShape } from "../../lib/shared.mjs";

export default handler(async (body) => {
  const img = readImage(body);
  const where = cleanWhere(body.where);
  const place = cleanWhere(body.place);

  const prompt = `You are an expert naturalist. First decide whether the main subject of this photo is a real, living (or once-living) plant or animal.
${where ? `The photographer says where they saw it: "${where}". Use it only as context.` : ""}
If it is NOT a plant or animal (for example an object, a person's face, food, a building, a toy, a drawing, a screenshot, a mushroom or other fungus, or nothing clear), reply with exactly {"group": "none"} and nothing else.
Otherwise reply with ONLY a JSON object of this shape:
{"group": "plant" | "animal",
 "category": "Plant" | "Tree" | "Flower" | "Mammal" | "Bird" | "Reptile" | "Amphibian" | "Fish" | "Insect" | "Spider" | "Other animal",
 "common_name": string,
 "scientific_name": "Genus species (or Genus sp. if unsure of species)",
 "confidence": integer 0-100,
 "taxonomy": {"kingdom": string, "family": string, "genus": string},
 ${statusShape(place)}${DESCRIBE_SHAPE}}
"group" is "plant" for any plant, tree, flower, grass, fern, moss or cactus.
Lower confidence for blurry photos or species that are hard to tell apart.`;

  const result = await askClaude([
    { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
    { type: "text", text: prompt },
  ]);
  // Anything that isn't clearly a plant or animal gets no details at all.
  if (result.group !== "plant" && result.group !== "animal") return { group: "none" };
  return result;
});

export const config = { path: "/api/identify" };
