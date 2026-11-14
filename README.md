# Bansuri AI Studio

An installable, offline-first companion for the bansuri and Indian classical music:
live swara detection, raag identification, a 72-raag encyclopedia, a bansuri tuner,
a synthesised tanpura, practice recording with analysis, and a graded learning centre.

Plain HTML, CSS and JavaScript modules. No build step, no dependencies, no network calls at runtime.

## Run it on this computer

```bash
node tools/serve.mjs
```

Then open http://localhost:5173. The microphone works on `localhost`.

## Put it on a phone

Phones only allow the microphone and offline installation over **https**. Upload this folder as-is
to any static https host (GitHub Pages, Netlify, Cloudflare Pages, your own server), then:

- **iPhone**: open the link in Safari, Share, "Add to Home Screen".
- **Android**: open the link in Chrome, menu, "Install app" / "Add to Home screen".

After the first load the app is stored on the device and every feature works with no connection.
The only things that need internet are that first visit and picking up a newer version.

## Tests

```bash
node tools/test.mjs
```

Checks pitch-detection accuracy on synthetic tones, note segmentation, intonation reporting,
Sa estimation, raag identification on ten raags, and the structure of the raag database.

## Layout

| Path | What it is |
| --- | --- |
| `js/pitch.js` | YIN pitch detector with multi-period refinement, and frame smoothing |
| `js/analysis.js` | Note segmentation, intonation statistics, meend / vibrato detection, Sa estimation |
| `js/raags.js` | The raag database. Add an entry and the whole app picks it up |
| `js/raagid.js` | Rule-based raag identification with explanations |
| `js/tanpura.js` | Additive tanpura synthesis with a jivari formant sweep |
| `js/lessons.js` | Learning Centre curriculum |
| `js/views/` | One file per section |
| `sw.js` | Offline cache. Bump `VERSION` whenever files change |

## Releasing a change

Edit files, then bump `VERSION` in `sw.js` (and add any new file to its `ASSETS` list) so
installed copies fetch the new version.

## Honest limits

- Detection is monophonic. Use earphones for the tanpura while the detector is listening.
- Raag identification reports resemblance with reasons, never certainty.
- The tanpura is synthesised rather than sampled.
- iOS pauses web audio in the background and mutes it when the ring/silent switch is on silent.
