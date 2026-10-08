# Web launch verification

OutsideClass is a browser-first learning tool: question → hosted Gemma answer or activity → practice → local evidence and reflection → backup/recovery. Native mobile packaging is deferred.

## Verified

All 56 automated tests and the build syntax checks passed on 8 October 2026.

- Input bounds, structured model output, provider failures and app-owned safety context.
- Image consent, JPEG size limits, and excluding image bytes from prompts/response metadata.
- Reflections and photos remain local unless deliberately included in a question or shared file.
- Backup round-trip, fresh-notebook restoration, duplicate-safe imports, capacity rejection and rollback on storage failure.
- Notebook capacity no longer silently evicts existing cards.
- Returning through page navigation keeps the current card's unsaved text and photos.
- Classroom lesson exports remove prior context and learner labels; learner work exports retain practice results.
- Worker tests simulate no network, stalled network, server errors, cache write failure, versioned icons and obsolete cache cleanup. They verify that API calls and external references never enter the offline cache.
- Desktop keyboard generation and live Gemma rendering were checked on the published website; restored notes, practice scores and two evidence images were visible in a fresh notebook.
- The published classroom flow generated a seated, rainy-day, closed-window activity. Two correct practice answers, a synthetic evidence photo and a clearly labelled software-test reflection survived navigation and reload.
- A paused five-minute timer recovered after reload with its saved card, photo and practice score. The classroom activity-pack download completed. Learner-work export reached a browser-control timeout, so that additional live check remains unverified; its automated round-trip checks pass.
- Footer link contrast was increased, and the print-only evidence section no longer duplicates uploaded photos on screen. Empty evidence sections remain hidden when printing.

Automated offline tests are not a physical phone/airplane-mode test. A DOM/keyboard pass is not a complete screen-reader or Lighthouse audit. Practice scores do not certify learning, and no outdoor observations have been fabricated.

## Device acceptance session

Use a real Android phone or iPhone in its normal browser:

1. Visit Activities online. Generate a short question, read its card, and save it.
2. Attach a non-personal test photo and save a reflection. Reopen it from Notebook.
3. Start a sample timer, pause it, reload, resume, and finish. The timer does not ring while the phone is locked.
4. Download a notebook backup. Open it on another device/browser and verify the notes, photos and practice results.
5. On the original device, enable airplane mode after the initial cache installation. Reopen Activities, a sample, Notebook and a saved card. AI requests should explain that internet is needed. Reconnect and verify generation again.
6. Check the page at narrow widths and large text sizes. Complete the flow using keyboard or the phone's screen reader where available.

Keep the backup private. Do not clear a real notebook merely to test recovery.

## One real outdoor lesson

Choose the shadow sample with an adult if children participate. Use an unbreakable object in a safe place, without looking at the sun. Record the date, conditions and what actually happened. Compare two observations, consider an alternative explanation, and save one real question for the next visit. A cloudy day with no clear shadow is a valid result. Only then add observations to a public walkthrough with the learner's agreement.

## Account launch gates

### Google AI Studio

The app's server key identifies the Google project. In the owner's AI Studio account, confirm the configured Gemma model's active rate limits and billing state. If paid use is enabled, choose an affordable project spend cap on the Spend page and review Google's latency/overage caveats. No paid billing or cap was enabled by this implementation.

- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Billing/spend controls: https://ai.google.dev/gemini-api/docs/billing

Emergency pause: set server-only `GEMMA_DISABLED=1` in the Vercel project and redeploy. Samples, saved work and backups continue to function. This is not a distributed quota or spending cap.

### Vercel Firewall

The authenticated project's custom firewall read, update and creation operations returned `404: Seawall Config not found`. No new firewall rule was confirmed or published.

In the project's Firewall settings, start a narrow rule matching **POST** and the exact path **/api/activity**. Begin with **Log**, review legitimate classroom/shared-network traffic, then test a rate limit in preview before enforcement. A starting observation threshold is 60 requests per minute per IP; tune it from actual traffic, because classrooms share IP addresses. The application still has a separate six-per-minute per-instance burst guard.

Review account pricing before enabling rate-limit counting. Do not change automatic DDoS protections, add broad bypasses, or publish a blocking rule without reviewing the match conditions and traffic first.

The Vercel firewall skill requires the owner to publish staged firewall changes. See the project's dashboard for the final account action.

## Still required before broad launch

- Real phone and airplane-mode acceptance session.
- Real outdoor lesson and honest write-up.
- Owner confirmation of Google quotas/billing controls.
- Custom firewall setup, observed rollout and enforcement.
- Full screen-reader/Lighthouse audit if claiming an accessibility conformance level.
