// Step 3 (only when Pl@ntNet disagrees with Claude): write the description for Pl@ntNet's species.
import { handler, askClaude, DESCRIBE_SHAPE, cleanWhere, HttpError } from "../../lib/shared.mjs";

export default handler(async (body) => {
  const sci = typeof body.scientific_name === "string" ? body.scientific_name.trim().slice(0, 120) : "";
  if (!sci) throw new HttpError(400, "No species name was sent.");
  const common = typeof body.common_name === "string" ? body.common_name.trim().slice(0, 120) : "";
  const where = cleanWhere(body.where);

  const prompt = `You are an expert naturalist. Describe the plant species ${sci}${common ? ` (${common})` : ""}.
${where ? `It was seen here: "${where}".` : ""}
Reply with ONLY a JSON object of this shape:
{"common_name": "the most widely used English name",
 "category": "Plant" | "Tree" | "Flower",
 ${DESCRIBE_SHAPE}}`;

  return askClaude([{ type: "text", text: prompt }], 600);
});

export const config = { path: "/api/describe" };
