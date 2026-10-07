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

This package is prepared for Vercel but has not been deployed or verified on Vercel. The source repository is https://github.com/PHONIEXz/OutsideClass . A hosted application URL is not yet available.

Before widely publicizing live AI, configure provider quotas and a platform rate-limit rule for `/api/activity`. This prototype has no distributed abuse limiter or account system; a public endpoint can consume the key's quota. Browser button disabling is not a security boundary.

## Offline and saved data

After the initial online visit installs the service worker, the app shell, sample activities, and saved cards can be opened offline. AI generation needs internet. Browser storage is local to this browser and device, has a 100-card cap, and may be cleared by the browser. It is not cloud backup. New cards beyond the cap replace the oldest. Print a card to keep a separate copy.

## Checks

```bash
npm test
npm run build
```

Automated tests cover input bounds, model-output structure, missing credentials, and a mocked provider success. They do not establish live model quality or safety. Browser verification was attempted but blocked because the runtime browser was unavailable and its download failed. Mobile layout and offline behavior still need a real browser check. AI instructions constrain activities to nearby observation, but generated content still requires human judgment, especially for children.

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
