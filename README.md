# Native Nature

Native plants, wildlife, and invasive species, anywhere on Earth.

| Tab | What it does |
|---|---|
| **World Map** | Tap anywhere or search a city to see its native plants, native wildlife, and introduced/invasive species (iNaturalist). |
| **Photo ID** | Identify a plant or animal from a photo. Plants: Pl@ntNet. Animals: Claude. Shows if it's native or invasive where you are. |
| **In Bloom Now** | Plants photographed flowering within 50 km of you in the last 30 days. |
| **Identify a Species** | Search by name for photos, facts, and native status. |
| **Guided ID Key** | Yes/no questions that narrow down what you saw, then show matching species near you. |
| **Camera Record** | Your sightings log, saved in your browser. Export to CSV. |

The site asks for your location once (or you can type a city) and remembers it in your browser.

**No API keys are stored in this code.** They go in Netlify's settings, so this repo is safe to keep on GitHub.

## Put it online

1. In Netlify, choose **Add new project → Import an existing project → GitHub**, then pick this repo. Leave the build settings as they are and click **Deploy**.
2. Open **Site configuration → Environment variables → Add a variable** and add:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your Claude key (starts with `sk-ant-`) |
   | `PLANTNET_API_KEY` | your Pl@ntNet key (starts with `2b10`), optional |

3. Go to **Deploys → Trigger deploy → Deploy site**.
4. Optional: under **Site configuration → Change site name**, rename it to `native-nature`.
5. If you use Pl@ntNet, add your site address (e.g. `native-nature.netlify.app`) under **Authorized domains** at my.plantnet.org.

To change the site later, update the code on GitHub and Netlify redeploys on its own.

## Keep your credits safe

- Never paste a key into any file in this repo.
- Anyone with your site link can use it. Share it only with people you trust.
- Set a monthly spend limit at console.anthropic.com (Settings → Limits).

## If something goes wrong

| What you see | What to do |
|---|---|
| "No Claude API key yet" | Add `ANTHROPIC_API_KEY` in Netlify, then trigger a deploy. |
| "key ... was rejected" | The key was copied wrong. Copy it again in full. |
| "out of credit" | Add credit at console.anthropic.com. |
| "took too long" | Add a variable `CLAUDE_MODEL` = `claude-haiku-5-5`, then redeploy. |

## What's inside

```
public/index.html            the website
netlify/functions/
  identify.mjs               Claude: plant or animal + first ID
  plantnet.mjs               Pl@ntNet plant ID
  describe.mjs               Claude: facts about the Pl@ntNet species
lib/shared.mjs               shared helpers
lib/keys.mjs                 placeholders only (keys go in Netlify)
netlify.toml
```
