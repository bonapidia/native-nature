// Step 2 (plants only): send the photo to Pl@ntNet for a botanist-trained ID.
import { handler, readImage, HttpError, plantnetKey } from "../../lib/shared.mjs";

export default handler(async (body) => {
  const img = readImage(body);
  const key = plantnetKey();
  if (!key) return { disabled: true, matches: [] }; // no Pl@ntNet key: Claude's plant ID is used

  const form = new FormData();
  const ext = img.mediaType.split("/")[1];
  form.append("images", new Blob([Buffer.from(img.data, "base64")], { type: img.mediaType }), `photo.${ext}`);
  form.append("organs", "auto");

  const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(key)}&lang=en&nb-results=5&include-related-images=false`;
  const res = await fetch(url, { method: "POST", body: form });

  if (res.status === 404) return { matches: [] }; // Pl@ntNet found no plant it recognizes
  if (!res.ok) {
    console.error("Pl@ntNet error", res.status, (await res.text()).slice(0, 300));
    if (res.status === 429) throw new HttpError(429, "Pl@ntNet's daily limit was reached. Try again tomorrow.");
    if (res.status === 401 || res.status === 403) throw new HttpError(500, "the Pl@ntNet key in Netlify settings was rejected");
    throw new HttpError(502, "Pl@ntNet couldn't be reached.");
  }

  const data = await res.json();
  const matches = (data.results || []).map((r) => ({
    score: Math.round((r.score || 0) * 100),
    scientific_name: r.species?.scientificNameWithoutAuthor || "",
    common_name: r.species?.commonNames?.[0] || "",
    genus: r.species?.genus?.scientificNameWithoutAuthor || "",
    family: r.species?.family?.scientificNameWithoutAuthor || "",
  }));
  return { matches };
});

export const config = { path: "/api/plantnet" };
