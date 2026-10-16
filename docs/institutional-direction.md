# OutsideClass school pilot

## What the first release does

The `/school` workspace follows one complete teacher workflow: school and term → class label/count → sample or saved activity → learning objective and optional checked curriculum reference → review and supervision/access arrangements → ready plan → printed group investigation sheet → teacher-entered participation, reviewed-evidence counts and observations → term report and backup.

This release is a single-browser, single-school, single-term planning pilot. It has no authenticated school accounts, cloud sync, permissions, independent approvals or shared institutional database. Anyone with access to the browser can access its records. No learner roster is collected. It makes no AI call and excludes notebook reflections, photo bytes, learner labels, previous context and spot names from activity snapshots. Free text is still entered by the teacher: avoid sensitive information.

School backups are separate from notebook backups. Restore requires an empty school workspace and validates the entire file before writing. No existing records are overwritten. Storage limits are 50 classes, 200 sessions and 2 MB. Browser clearing can erase work. Multiple tabs use a write-conflict check rather than silently replacing another tab's changes.

Reports count participant-sessions and evidence-sessions, not unique learners or proven learning gains. Curriculum references are entered and checked by the teacher; no official curriculum alignment is claimed. Ready plans are self-reviewed, not safety-certified. A material change to a plan requires review again. Completed session records may be corrected; they are not an audit log.

## What we learned from the winners, 16 October 2026

Sources reviewed: organiser announcement and the authors' write-ups. This is product analysis, not access to private judging scores, a live app comparison or independent reproduction of their evaluation results.

- [Official winners](https://dev.to/devteam/congrats-to-the-hacktoberfest-open-source-ai-challenge-touch-grass-winners-152c): Paper Trail by Mike Kim won overall; Grow a Song won Best Use of Gemma; Golden Hour won Best Use of Render.
- [Paper Trail](https://dev.to/mike_kim_692aa79c288bfed8/paper-trail-gemma-writes-your-walk-a-field-card-then-the-screen-goes-away-3mf4): one printable result, real observation data, source-backed descriptions, constrained generation, explicit fallbacks, a repeatable 72-species evaluation and a manual review that still found incorrect tips. Lesson: test meaning and usefulness, not just JSON structure; disclose remaining errors.
- [Grow a Song](https://dev.to/anshsaini/grow-a-song-my-run-wrote-its-own-soundtrack-with-gemma-running-on-my-phone-44ml): time outside changes an audible outcome; the author reports an actual run, device results and background-crash fixes. Lesson: demonstrate the real-world behaviour and recovery path.
- [Golden Hour](https://dev.to/tanay_singh_1005/golden-hour-an-open-model-that-finds-your-40-minutes-outside-and-where-to-spend-them-5fe8): deterministic weather/time/place decisions with a narrow model-writing role. Lesson: arithmetic, counts and permissions belong in tested application code.

Likely strengths are memorable outcomes, clear theme fit and inspectable evidence. These are inferences; they do not establish why OutsideClass lost. A large on-device model download is not automatically a good fit for low-data school devices. We should adopt the evaluation discipline rather than copy their brands, code or product wholesale.

## Next institutional foundation

Before accepting shared student records or selling multi-user school access:

1. Provision a database and adult staff authentication. Enforce membership and tenant isolation in every server read/write. Test cross-school access denial. Roles are never just UI toggles.
2. Add owner-controlled invitations, class assignments and real reviewer identities. Preserve revision history and approval invalidation.
3. Define retention, deletion/export, recovery, school consent responsibilities and AI-provider data boundaries. Keep learner accounts optional; start with anonymous group evidence.
4. Add approved, licensed curriculum source packs with document edition/page and human verification. Evaluate scientific accuracy and age suitability using a fixed set of cases and teacher reviews. Publishing a library requires its content rights to be established.
5. Add resilient offline submission sync with idempotency/conflict handling; verify on actual low-end devices and limited networks.
6. Pilot with a few schools for four weeks. Measure preparation time, actual session completion, evidence review, voluntary repeat use and willingness to pay. Do not describe a synthetic demo as school adoption or a learning-outcome study.

Keep personal OutsideClass usable throughout the migration. Defer payroll, admissions, fee management, public student profiles, native apps and an open marketplace until the practical-learning workflow has paying repeat users.

## Verification on 16 October 2026

All 78 tests and build checks passed. Six new school-domain tests cover snapshot privacy, required review, report aggregation, evidence/participation limits, malformed backup rejection, and storage round-trip/failure. Existing worker tests now check installation of the separate school shell and modules as well as offline school-route retrieval.

Production commit `c146ec4` was READY and the `/school` route was tested in desktop Chrome. Through the visible UI, a synthetic school/class was created, an unreviewed ready attempt was rejected, a draft was saved and edited, and a reviewed plan was marked ready. A result with evidence greater than participation was rejected. Valid test counts and a clearly labelled synthetic observation were saved, survived a reload and produced matching term totals. The school backup downloaded with the expected class, plan and result. Re-importing into the occupied workspace refused to overwrite it.

The screenshot in `school-preview.jpg` contains synthetic software-test data, not claims of adoption, attendance or learning improvement. No real learners were enrolled or assessed. Browser-extension metadata errors appeared in the browser log; they are not application errors. Physical printing, fresh-browser restoration, real-phone/offline use and multi-tab conflict behaviour were not independently verified through live UI in this session. The relevant pure storage and worker behaviours have automated checks; a full device acceptance session remains necessary.
