import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInput, parseActivity } from "../lib/activity.js";
import { samples } from "../public/samples.js";
import handler from "../api/activity.js";
test("rejects invalid and unbounded inputs", () => {
  for (const topic of ["", null, "a".repeat(601)])
    assert.throws(() =>
      validateInput({
        topic,
        minutes: 10,
        level: "Beginner",
        place: "Courtyard",
      }),
    );
  assert.throws(() =>
    validateInput({
      topic: "Shadows",
      minutes: 999,
      level: "Beginner",
      place: "Courtyard",
    }),
  );
});
test("accepts fenced model JSON and rejects invalid structure", () => {
  assert.equal(
    parseActivity("```json\n" + JSON.stringify(samples[0]) + "\n```").title,
    samples[0].title,
  );
  assert.throws(() => parseActivity('{"title":"Hello"}'));
});
function response() {
  return {
    code: 200,
    setHeader() {},
    status(n) {
      this.code = n;
      return this;
    },
    json(x) {
      this.data = x;
      return this;
    },
  };
}
test("missing key returns honest unavailable state", async () => {
  const old = process.env.GEMMA_API_KEY;
  delete process.env.GEMMA_API_KEY;
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: {
          topic: "Light",
          minutes: 10,
          level: "Beginner",
          place: "Courtyard",
        },
      },
      r,
    );
    assert.equal(r.code, 503);
  } finally {
    if (old) process.env.GEMMA_API_KEY = old;
  }
});
test("mocked successful provider response uses Gemma and strips unknown fields", async () => {
  const old = process.env.GEMMA_API_KEY,
    fetchOld = global.fetch;
  process.env.GEMMA_API_KEY = "test";
  global.fetch = async (url, init) => {
    assert.match(url, /models\/gemma-/);
    assert.equal(init.headers["x-goog-api-key"], "test");
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ ...samples[0], untrusted: "ignored" }),
                },
              ],
            },
          },
        ],
      }),
    };
  };
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: {
          topic: "Light",
          minutes: 10,
          level: "Beginner",
          place: "Courtyard",
        },
      },
      r,
    );
    assert.equal(r.code, 200);
    assert.equal(r.data.activity.untrusted, undefined);
    assert.equal(r.data.activity.source, "OutsideClass AI");
  } finally {
    global.fetch = fetchOld;
    if (old) process.env.GEMMA_API_KEY = old;
    else delete process.env.GEMMA_API_KEY;
  }
});
test("accepts prose-wrapped JSON with braces inside strings, rejects truncation and multiple objects", () => {
  const a = { ...samples[0], title: 'Look at {patterns} and "shapes"' };
  assert.equal(
    parseActivity("Here is your card:\n```json\n" + JSON.stringify(a) + "\n```")
      .title,
    a.title,
  );
  assert.throws(() => parseActivity(JSON.stringify(a).slice(0, -5)));
  assert.throws(() =>
    parseActivity(JSON.stringify(a) + "\n" + JSON.stringify(a)),
  );
});
test("distinguishes provider failures and excludes thinking from activity JSON", async () => {
  const oldKey = process.env.GEMMA_API_KEY,
    oldModel = process.env.GEMMA_MODEL,
    oldFetch = global.fetch;
  process.env.GEMMA_API_KEY = "test-private-key";
  process.env.GEMMA_MODEL = "gemma-4-26b-a4b-it";
  const invoke = async (fn) => {
    global.fetch = fn;
    const r = response();
    await handler(
      {
        method: "POST",
        body: {
          topic: "Light",
          minutes: 10,
          level: "Beginner",
          place: "Courtyard",
        },
      },
      r,
    );
    assert.ok(!JSON.stringify(r.data).includes("test-private-key"));
    return r;
  };
  const ok = (result) => async () => ({ ok: true, json: async () => result });
  try {
    for (const [status, code] of [
      [400, "AI_REQUEST_REJECTED"],
      [401, "AI_AUTH"],
      [403, "AI_ACCESS"],
      [404, "AI_MODEL_NOT_FOUND"],
      [429, "AI_QUOTA"],
      [503, "AI_PROVIDER_UNAVAILABLE"],
    ])
      assert.equal(
        (await invoke(async () => ({ ok: false, status }))).data.code,
        code,
      );
    assert.equal(
      (
        await invoke(async () => {
          throw new DOMException("timeout", "TimeoutError");
        })
      ).data.code,
      "AI_TIMEOUT",
    );
    assert.equal(
      (
        await invoke(async () => {
          throw new TypeError("fetch failed");
        })
      ).data.code,
      "AI_NETWORK",
    );
    assert.equal((await invoke(ok({}))).data.code, "AI_EMPTY");
    assert.equal(
      (await invoke(ok({ promptFeedback: { blockReason: "SAFETY" } }))).data
        .code,
      "AI_BLOCKED",
    );
    assert.equal(
      (await invoke(ok({ candidates: [{ finishReason: "MAX_TOKENS" }] }))).data
        .code,
      "AI_TRUNCATED",
    );
    assert.equal(
      (
        await invoke(
          ok({
            candidates: [
              { content: { parts: [{ text: '{"title":"wrong"}' }] } },
            ],
          }),
        )
      ).data.code,
      "AI_ACTIVITY_FORMAT",
    );
    assert.equal(
      (
        await invoke(async () => ({
          ok: true,
          json: async () => {
            throw new SyntaxError("bad");
          },
        }))
      ).data.code,
      "AI_PROVIDER_FORMAT",
    );
    const r = await invoke(async (url, init) => {
      const config = JSON.parse(init.body).generationConfig;
      assert.equal(config.thinkingConfig.thinkingLevel, "minimal");
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  { thought: true, text: "private reasoning" },
                  { text: JSON.stringify(samples[0]) },
                ],
              },
            },
          ],
        }),
      };
    });
    assert.equal(r.code, 200);
    assert.equal(r.data.activity.title, samples[0].title);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GEMMA_MODEL;
    else process.env.GEMMA_MODEL = oldModel;
  }
});

// ---- Group mode ----
import { promptFor } from "../lib/activity.js";
const solo = {
  topic: "Light",
  minutes: 10,
  level: "Beginner",
  place: "Courtyard",
};
const groupCard = {
  ...samples[0],
  groupTips: "Work in pairs. Agree a boundary first.",
  discussion: ["What did you notice first?", "What surprised you?"],
};
test("defaults to a solo learner and keeps the prompt free of group text", () => {
  const input = validateInput(solo);
  assert.equal(input.audience, "Myself");
  assert.equal(input.groupSize, undefined);
  assert.ok(!promptFor(input).includes("discussion"));
});
test("validates group size, age range and audience", () => {
  const ok = validateInput({
    ...solo,
    audience: "Class",
    groupSize: 25,
    ageRange: "8-10",
  });
  assert.equal(ok.groupSize, 25);
  for (const bad of [
    { audience: "Class", groupSize: 1, ageRange: "8-10" },
    { audience: "Class", groupSize: 41, ageRange: "8-10" },
    { audience: "Class", groupSize: 2.5, ageRange: "8-10" },
    { audience: "Class", groupSize: 10, ageRange: "3" },
    { audience: "Class", ageRange: "8-10" },
    { audience: "Boss", groupSize: 5, ageRange: "8-10" },
  ])
    assert.throws(() => validateInput({ ...solo, ...bad }), bad.audience);
});
test("group prompt asks for leader guidance and discussion questions", () => {
  const p = promptFor(
    validateInput({
      ...solo,
      audience: "Class",
      groupSize: 25,
      ageRange: "8-10",
    }),
  );
  assert.match(p, /discussion/);
  assert.match(p, /groupTips/);
  assert.match(p, /25 learners aged 8-10/);
});
test("group cards must include guidance; extra fields are stripped for solo cards", () => {
  assert.throws(() => parseActivity(JSON.stringify(samples[0]), "Class"));
  assert.throws(() =>
    parseActivity(
      JSON.stringify({ ...groupCard, discussion: ["only one"] }),
      "Class",
    ),
  );
  assert.deepEqual(
    parseActivity(JSON.stringify(groupCard), "Class").discussion,
    groupCard.discussion,
  );
  assert.equal(parseActivity(JSON.stringify(groupCard)).discussion, undefined);
});
test("mocked provider returns a group card end to end", async () => {
  const oldKey = process.env.GEMMA_API_KEY,
    oldFetch = global.fetch;
  process.env.GEMMA_API_KEY = "test";
  global.fetch = async (url, init) => {
    assert.match(JSON.parse(init.body).contents[0].parts[0].text, /groupTips/);
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(groupCard) }] },
          },
        ],
      }),
    };
  };
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: { ...solo, audience: "Family", groupSize: 3, ageRange: "5-7" },
      },
      r,
    );
    assert.equal(r.code, 200);
    assert.equal(r.data.activity.groupSize, 3);
    assert.equal(r.data.activity.discussion.length, 2);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = oldKey;
  }
});

import { safetyNotes } from "../public/safety.js";
test("window and seated requests remain in place and include deterministic precautions", () => {
  const input = validateInput({
    ...solo,
    place: "By a window",
    mobility: "Seated",
    audience: "Class",
    groupSize: 20,
    ageRange: "8-10",
  });
  assert.match(promptFor(input), /indoors at a closed window/);
  assert.match(promptFor(input), /without standing, walking/);
  const notes = safetyNotes(input).join(" ");
  assert.match(notes, /An adult leads/);
  assert.match(notes, /Keep the window closed/);
  assert.match(notes, /Stay seated/);
  assert.throws(() => validateInput({ ...solo, mobility: "Flying" }));
});
test("provider includes app-owned precautions for a window activity", async () => {
  const oldKey = process.env.GEMMA_API_KEY,
    oldFetch = global.fetch;
  process.env.GEMMA_API_KEY = "test";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: JSON.stringify(groupCard) }] },
        },
      ],
    }),
  });
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: {
          ...solo,
          place: "By a window",
          mobility: "Seated",
          audience: "Family",
          groupSize: 3,
          ageRange: "5-7",
        },
      },
      r,
    );
    assert.equal(r.code, 200);
    assert.ok(
      r.data.activity.beforeYouGo.some((note) =>
        note.includes("window closed"),
      ),
    );
    assert.ok(
      r.data.activity.beforeYouGo.some((note) => note.includes("Stay seated")),
    );
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = oldKey;
  }
});
test("weather and time are optional manual choices with strict allowed values", () => {
  const defaults = validateInput(solo);
  assert.equal(defaults.weather, "Any");
  assert.equal(defaults.timeOfDay, "Any");
  assert.equal(
    validateInput({ ...solo, weather: "Rainy", timeOfDay: "Evening" }).weather,
    "Rainy",
  );
  assert.throws(() => validateInput({ ...solo, weather: "Stormy" }), /weather/);
  assert.throws(
    () => validateInput({ ...solo, timeOfDay: "Night" }),
    /time of day/,
  );
});
test("conditions guide the prompt and add app-controlled safety notes", () => {
  const input = validateInput({
    ...solo,
    place: "By a window",
    mobility: "Seated",
    weather: "Rainy",
    timeOfDay: "Evening",
  });
  const prompt = promptFor(input);
  assert.match(prompt, /weather \(Rainy\) and time of day \(Evening\)/);
  assert.match(prompt, /indoors at a closed window/);
  assert.match(prompt, /while seated/);
  const notes = safetyNotes(input).join(" ");
  assert.match(notes, /thunder/);
  assert.match(notes, /slippery/);
  assert.match(notes, /still light/);
  assert.match(safetyNotes({ ...solo, weather: "Windy" }).join(" "), /trees/);
  assert.equal(
    safetyNotes({ ...solo, weather: "Hot", timeOfDay: "Midday" }).filter((n) =>
      n.includes("shade"),
    ).length,
    1,
  );
  assert.equal(
    safetyNotes(validateInput(solo)).length,
    safetyNotes(solo).length,
  );
});
test("provider returns selected conditions and their precautions", async () => {
  const oldKey = process.env.GEMMA_API_KEY,
    oldFetch = global.fetch;
  process.env.GEMMA_API_KEY = "test";
  global.fetch = async (url, init) => {
    assert.match(
      JSON.parse(init.body).contents[0].parts[0].text,
      /weather \(Windy\)/,
    );
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(samples[0]) }] },
          },
        ],
      }),
    };
  };
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: { ...solo, weather: "Windy", timeOfDay: "Midday" },
      },
      r,
    );
    assert.equal(r.code, 200);
    assert.equal(r.data.activity.weather, "Windy");
    assert.equal(r.data.activity.timeOfDay, "Midday");
    assert.ok(r.data.activity.beforeYouGo.some((n) => n.includes("trees")));
    assert.ok(r.data.activity.beforeYouGo.some((n) => n.includes("shade")));
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = oldKey;
  }
});
test("return visits use bounded observations and respect original access needs", () => {
  const previous = {
    noticed: "The leaf shadows were short.",
    explanation: "Maybe it was midday.",
    alternative: "Maybe the branch moved.",
    question: "Will they be longer tomorrow?",
  };
  const input = validateInput({
    ...solo,
    place: "By a window",
    mobility: "Seated",
    spot: "Kitchen window",
    previous,
  });
  assert.equal(input.spot, "Kitchen window");
  assert.deepEqual(input.previous, previous);
  const prompt = promptFor(input);
  assert.match(prompt, /return visit/);
  assert.match(prompt, /previously reported/);
  assert.match(prompt, /indoors at a closed window/);
  assert.match(prompt, /while seated/);
  assert.match(prompt, /selected place field is the physical setting/);
  assert.throws(() => validateInput({ ...solo, spot: "A".repeat(61) }), /spot/);
  assert.throws(
    () =>
      validateInput({
        ...solo,
        previous: { ...previous, noticed: "A".repeat(351) },
      }),
    /previous/,
  );
  assert.throws(
    () => validateInput({ ...solo, previous: { noticed: "x" } }),
    /previous/,
  );
});
test("provider uses prior evidence to request a fresh observation at the same spot", async () => {
  const previous = {
    noticed: "Small shadow",
    explanation: "The sun moved",
    alternative: "I moved",
    question: "Can I compare tomorrow?",
  };
  const oldKey = process.env.GEMMA_API_KEY,
    oldFetch = global.fetch;
  process.env.GEMMA_API_KEY = "test";
  global.fetch = async (url, init) => {
    const prompt = JSON.parse(init.body).contents[0].parts[0].text;
    assert.match(prompt, /Small shadow/);
    assert.match(prompt, /Kitchen window/);
    assert.match(prompt, /test those ideas/);
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(samples[0]) }] },
          },
        ],
      }),
    };
  };
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: {
          ...solo,
          place: "By a window",
          spot: "Kitchen window",
          previous,
        },
      },
      r,
    );
    assert.equal(r.code, 200);
    assert.equal(r.data.activity.spot, "Kitchen window");
    assert.deepEqual(r.data.activity.previous, previous);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = oldKey;
  }
});

test("accepts full questions and bounds follow-up context independently", () => {
  assert.equal(
    validateInput({ ...solo, topic: "Why ".repeat(120) }).topic.length,
    479,
  );
  const followUp = {
    question: "What is recursion?",
    answer: "A function calling itself.",
  };
  assert.deepEqual(validateInput({ ...solo, followUp }).followUp, followUp);
  assert.throws(() => validateInput({ ...solo, topic: "x".repeat(601) }));
  assert.throws(() =>
    validateInput({
      ...solo,
      followUp: { ...followUp, answer: "x".repeat(1201) },
    }),
  );
  assert.throws(() => validateInput({ ...solo, followUp: [] }));
  assert.match(
    promptFor(validateInput({ ...solo, followUp })),
    /Do not invent an unrelated outdoor exercise/,
  );
});
const direct = {
  checks: samples[0].checks,
  nextQuestion: "How do I change a value?",
  title: "What a variable means",
  kind: "explanation",
  reason:
    "This programming idea is clearer through a code example than an outdoor task.",
  goal: "Understand named values.",
  explanation:
    "A variable is a name that refers to a value. In Python, score = 5 makes score refer to 5.",
  reflection: "What value could you give score next?",
  safety: "No outdoor task is required.",
  steps: [],
  materials: [],
};
test("direct explanations have no invented activity steps and preserve their reason", () => {
  assert.equal(parseActivity(JSON.stringify(direct)).kind, "explanation");
  assert.equal(parseActivity(JSON.stringify(samples[0])).kind, "activity");
  for (const bad of [
    { ...direct, reason: "" },
    { ...direct, steps: ["Go outside"] },
    { ...direct, kind: "random" },
    { ...samples[0], kind: "explanation" },
  ])
    assert.throws(() => parseActivity(JSON.stringify(bad)));
});
test("provider returns a direct answer and original question with bounded follow-up context", async () => {
  const oldKey = process.env.GEMMA_API_KEY,
    oldFetch = global.fetch;
  process.env.GEMMA_API_KEY = "test";
  global.fetch = async (url, init) => {
    assert.match(
      JSON.parse(init.body).contents[0].parts[0].text,
      /earlier question and answer/,
    );
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(direct) }] },
          },
        ],
      }),
    };
  };
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: {
          ...solo,
          topic: "What is a variable in Python?",
          followUp: {
            question: "What is Python?",
            answer: "A programming language.",
          },
        },
      },
      r,
    );
    assert.equal(r.code, 200);
    assert.equal(r.data.activity.kind, "explanation");
    assert.equal(r.data.activity.topic, "What is a variable in Python?");
    assert.deepEqual(r.data.activity.steps, []);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = oldKey;
  }
});

test("image questions use inline data but never echo image bytes into the saved card", async () => {
  const oldKey = process.env.GEMMA_API_KEY,
    oldFetch = global.fetch;
  process.env.GEMMA_API_KEY = "test";
  const image = {
    mimeType: "image/jpeg",
    data: Buffer.from([255, 216, 255, 224, 0, 1, 255, 217]).toString("base64"),
  };
  global.fetch = async (url, init) => {
    const request = JSON.parse(init.body);
    assert.deepEqual(request.contents[0].parts[1].inlineData, image);
    assert.ok(!request.contents[0].parts[0].text.includes(image.data));
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(samples[0]) }] },
          },
        ],
      }),
    };
  };
  try {
    const r = response();
    await handler(
      {
        method: "POST",
        body: { ...solo, images: [image], imageConsent: true },
      },
      r,
    );
    assert.equal(r.code, 200);
    assert.equal(r.data.activity.imageUsed, true);
    assert.equal(r.data.activity.images, undefined);
    assert.ok(!JSON.stringify(r.data).includes(image.data));
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = oldKey;
  }
});

test("the operator pause switch prevents any hosted inference request", async () => {
  const previous = process.env.GEMMA_DISABLED,
    previousFetch = globalThis.fetch;
  let requested = false;
  process.env.GEMMA_DISABLED = "1";
  globalThis.fetch = async () => {
    requested = true;
    throw Error("must not call provider");
  };
  try {
    const res = response();
    await handler(
      {
        method: "POST",
        body: {
          topic: "Shadows",
          minutes: 10,
          level: "Beginner",
          place: "Courtyard",
        },
      },
      res,
    );
    assert.equal(res.code, 503);
    assert.equal(res.data.code, "AI_PAUSED");
    assert.equal(requested, false);
  } finally {
    if (previous === undefined) delete process.env.GEMMA_DISABLED;
    else process.env.GEMMA_DISABLED = previous;
    globalThis.fetch = previousFetch;
  }
});

test("young learner mode always gets app-owned adult supervision and unbreakable-material guidance", async () => {
  const { safetyNotes } = await import("../public/safety.js");
  const notes = safetyNotes({
    learnerStage: "Young learner",
    audience: "Myself",
  }).join(" ");
  assert.match(notes, /adult nearby/);
  assert.match(notes, /unbreakable/);
  assert.match(notes, /glass or sharp/);
});
