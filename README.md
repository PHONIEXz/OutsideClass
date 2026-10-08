# OutsideClass

**A little less screen. A little more world.** Ask a learning question, read a short field card, put the phone away, and return with evidence of what you noticed.

[Try OutsideClass](https://outsideclass-phoenix.vercel.app/) · [Report a problem](https://github.com/PHONIEXz/OutsideClass/issues)

![Live Gemma explanation and practice questions](docs/learning-preview.jpg)

## What you can do

- Ask your own question. Get a nearby observation activity when one fits, or a direct explanation when it does not.
- Adapt lessons to young learners, families or classes, weather, time available, and seated or window-based participation.
- Ask about two selected images, with consent before sending them to Google AI.
- Use learning illustrations or external references, then attach your own evidence photos.
- Check understanding, explore a next question, and save reflections and practice results.
- Return to a named spot, compare discoveries, and download or restore backups with photos.
- Print lessons or exchange classroom activity packs and learner work files.

Home, Activities, Notebook, Guides and Updates have separate URLs. Updates are available through [RSS](https://outsideclass-phoenix.vercel.app/updates.xml); no email subscription is collected.

## Try it without an API key

Install Node.js 22 or newer, clone this repository, and run:

```bash
npm run dev
```

Open <http://localhost:3000>. There are no application dependencies to install. Three labelled, prewritten sample activities work without credentials and include practice questions. Save a sample, attach a photo, and reopen it from Notebook.

## How the AI works

Copy `.env.example` to `.env`, set `GEMMA_API_KEY` to your Google AI Studio API key, and set `GEMMA_MODEL` to a Gemma model available to your account. Restart the server. Keep `.env` out of version control; the key is used only on the server.

The starting configuration uses `gemma-4-26b-a4b-it` through Google's Gemini API. The API is the hosting interface; the requested model is Gemma. See [Google's Gemma API documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) for availability and terms.

The server validates bounded inputs, applies a timeout, requests structured output, and rejects malformed or incomplete responses. App-written safety notes supplement model output. Generated answers can still be wrong: an adult should review lessons for children, and practice results are not formal grades or proof of mastery.

## Privacy and saved work

Generating a card sends your question and choices to Google, including a spot nickname if supplied. Follow-ups send the displayed earlier question and answer; return visits send the displayed observation context. Use nicknames rather than addresses or personal details. Selected question images are sent only after consent and are resized to JPEG first.

Saved cards and reflections live in this browser's localStorage; evidence photos live in IndexedDB. Notebook photos are not automatically sent to the model. No account, GPS, camera or microphone access is required.

Clearing browser data can erase your notebook. Storage is device-local and capped at 100 cards; new cards are refused at the limit so existing work is kept. Back up your notebook before deleting cards to make room. Download a backup to keep a separate copy. Backups and learner work exports include notes and photos, so share them deliberately. Imports add missing IDs without overwriting existing cards or evicting cards. Activity packs exclude personal reflections, photos and previous conversation context.

## Offline use and mobile

After a successful online visit installs the service worker, cached pages, samples and saved cards can open offline. AI questions and external image references require internet. The timer can recover after refresh but does not provide a background alarm.

The current release is a website, not an Android or iOS package. Native packaging is planned after launch verification. Accounts, automatic cloud backup, device sync and a live classroom dashboard are not included; classroom exchange currently uses files.

## Run checks

```bash
npm test
npm run build
```

At release `09440c9`, all 45 automated tests and syntax checks passed. Tests cover validation, provider failures, safety context, storage failures, consent, scoring, backup rollback and per-instance rate limiting. Live browser checks verified practice scoring, saved progress, notebook download, duplicate-safe import and photo evidence. A live image question returned a relevant description and two practice checks. These show functioning flows, not guaranteed factual accuracy or child safety.

A subsequent desktop keyboard pass reached every generation control in order and submitted a live Gemma question. Restoring a backup into an empty browser notebook recovered two cards, a reflection, practice scores and both evidence photos. Physical-phone testing, full offline recovery, a complete accessibility audit and a real outdoor lesson remain launch requirements. Real-world observations should come from learners, not generated examples.

## Deploy

Import this repository into Vercel using the Other framework preset, build command `npm run build`, and output directory `public`. Add `GEMMA_API_KEY` and `GEMMA_MODEL` as server environment variables. Test a generation and notebook recovery on the deployed URL.

Before broad public use, configure Google quota controls and platform rate limiting for `/api/activity`. The built-in limiter allows six requests per minute per forwarded connection per Vercel instance; it resets with instances and is neither distributed protection nor a hard spending cap. Check account-specific quotas and billing settings before enabling paid inference.

## Source layout

| Path              | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `public/`         | Pages, styles, browser modules, samples and offline service worker |
| `api/activity.js` | Vercel request handler and hosted inference                        |
| `lib/`            | Prompt construction, validation and request limits                 |
| `server.mjs`      | Dependency-free local server                                       |
| `test/`           | Node built-in tests                                                |

MIT-licensed application source. Gemma usage is subject to Google's applicable model and service terms.

## Web launch verification

See [the verification record](docs/web-launch-verification.md) for automated coverage, the manual browser checks, and the remaining account/device steps. The API can be paused without disabling saved work by setting server-only `GEMMA_DISABLED=1` and redeploying. This stops provider calls; it is an emergency control, not a quota cap.
