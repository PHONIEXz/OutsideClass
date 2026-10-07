# OutsideClass

Turn a learning topic into a short outdoor activity. Read a field card, put the phone away, and come back with an observation.

## Run locally

Node.js 22 or newer is required. There are no application dependencies to install.

```bash
npm run dev
```

Open http://localhost:3000. Three clearly labelled sample activities work immediately without credentials. They are prewritten, not AI-generated. Save a card, enter a reflection, and return through Field notebook.

## Enable Gemma

Copy `.env.example` to `.env`. Set `GEMMA_API_KEY` to a Google AI Studio API key and `GEMMA_MODEL` to a Gemma model available to that key. Restart the server. Do not put the key in public JavaScript or commit `.env`.

The configured starting model is `gemma-4-26b-a4b-it`, documented at https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api . The request uses the Gemini API to run **Gemma**, not a Gemini model. Availability, free allowance, and account eligibility must be checked in your own account; no live key or quota was tested during this build. Do not enable paid billing merely to test this prototype.

User preferences are sent to Google when generating an activity. Saved reflections stay in browser localStorage and are not sent to the model. No account, GPS, camera or microphone is required.

## Deploy to Vercel

1. Use the source repository: https://github.com/PHONIEXz/OutsideClass .
2. Import the repository in Vercel. Use the Other framework preset, `npm run build` as build command and `public` as output directory.
3. Add `GEMMA_API_KEY` and `GEMMA_MODEL` in server environment variables, then deploy.
4. Test a live generation, save its card, reload, and test the card offline on the deployed URL.

The application is deployed at https://outsideclass-phoenix.vercel.app/ . The source repository is https://github.com/PHONIEXz/OutsideClass .

Before widely publicizing live AI, configure provider quotas and a platform rate-limit rule for `/api/activity`. This prototype has no distributed abuse limiter or account system; a public endpoint can consume the key's quota. Browser button disabling is not a security boundary.

## Offline and saved data

After the initial online visit installs the service worker, the app shell, sample activities, and saved cards can be opened offline. AI generation needs internet. Browser storage is local to this browser and device, has a 100-card cap, and may be cleared by the browser. It is not cloud backup. New cards beyond the cap replace the oldest. Print a card to keep a separate copy.

## Checks

```bash
npm test
npm run build
```

Automated tests cover input bounds, model-output structure, provider failures, group activities, access needs, weather, return visits and notebook/photo storage failures. They do not establish live model quality or safety. The deployed card and reflection controls have been checked in a browser. Photo upload, mobile layout and offline behavior still need end-to-end browser checks. AI instructions constrain activities to nearby observation, but generated content still requires human judgment, especially for children.

## Challenge preparation

The app targets the Touch Grass theme with short screen time, outdoor observation and reflective learning. Gemma integration must actually be enabled and demonstrated before claiming a working AI entry. The current samples alone do not demonstrate open-weight model use.

Before submitting: run it outside; record actual observations; test Gemma; publish a fresh public repository with this license; deploy; and write an honest walkthrough using the official submission template. Do not invent field results or claim offline AI inference. This implementation uses hosted inference and offline saved content.

Challenge: https://dev.to/devteam/join-the-hacktoberfest-open-source-ai-challenge-week-1-touch-grass-2450-in-prizes-across-17-4pom

## Architecture

- `public/`: HTML, CSS, vanilla JavaScript, samples and service worker.
- `api/activity.js`: Vercel Node function with bounded inputs, provider timeout and output validation.
- `lib/activity.js`: prompt and validation utilities.
- `server.mjs`: dependency-free local development server.
- `test/`: Node built-in test runner.

MIT-licensed application source. Gemma model usage remains subject to Google's applicable model and service terms.

## Learning pages and updates

Home (`/`), activities (`/learn`), notebook (`/notebook`), guides (`/guides`) and updates (`/updates`) have direct URLs and browser history navigation. Activity timers support pause, resume and recovery after refresh using device-local timestamps; they do not provide a background alarm.

Subscribe to `/updates.xml` with an RSS reader. To publish news, add an item with a unique GUID to `public/updates.xml` and a matching article to the Updates page in `public/index.html`. Email subscription is not configured and no email addresses are collected.

## Same Spot Experiment and Evidence Trails

Name a nearby spot while building a card. A field note can capture what was noticed, a possible explanation, an alternative and a question. From the notebook, “Return to this spot” uses up to 350 characters of each answer to ask Gemma for a new observation that compares with the first one. Earlier notes remain separate and are linked by their local ID. An optional named spot should be a nickname, not an address. Observations and notes stay on this device except when a user intentionally generates a return activity: then the four bounded answers are sent to the configured Gemma API.

Each note can also keep up to two evidence photos in browser IndexedDB. The browser resizes them to at most 1200 px and 600 KB as JPEGs, stripping original metadata. They appear on reopened cards, in the notebook and on printouts. Photos are never sent to Gemma or the server. Browser storage limits can prevent a save; clearing browser data removes the photos and notes together. Supported uploads: PNG, JPEG, WebP and GIF (first frame).

Photo saves reject aborted storage transactions. If saved photos cannot be read, the card prevents an update until it is reopened successfully. Failed notebook deletions keep their photos, and cards removed by the 100-card limit have their photos cleaned up.

## Learning illustrations and uploads

Cards about shadows/light, symmetry, biodiversity and plant parts/growth automatically include a labelled, curated SVG learning diagram. These are educational examples drawn by the website, not AI-generated images or recorded field evidence. Other topics continue to work without a diagram. Diagrams work offline, appear in printed cards and can be downloaded as SVGs.

The card's “Your own images” section accepts up to two photos or sketches. Use Save card to keep images even before writing a reflection. Personal images remain in local browser storage.

## Ask your own questions

The learning form accepts a question or topic up to 600 characters. Suggested topics are optional. Gemma is asked to answer the actual question and choose between a safe, meaningful observation activity and a direct explanation. Explanations state why an outdoor task would not help, have no activity timer, and can still be saved with personal images. Classification and factual quality depend on the model; review responses before using them in class. Older saved cards remain compatible.

“Ask a follow-up question” sends the earlier question and up to 1200 characters of its explanation along with the new question. The UI discloses this before submission; users can clear that context. Images are not included.

When no built-in diagram matches, selected topics link to identified reference-image source pages (USGS water cycle and Commons solar system/unit fractions). Other questions offer a clearly labelled Commons browsing link without inventing a matching image. External references load only when clicked, require internet, and do not become offline attachments.
