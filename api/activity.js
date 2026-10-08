import { validateInput, parseActivity, promptFor } from "../lib/activity.js";
import { allowRequest } from "../lib/limits.js";
import { safetyNotes } from "../public/safety.js";

// Never log prompts, model output, credentials or raw provider errors.
function fail(res, status, code, error) {
  console.warn(`[OutsideClass] ${code}`);
  return res.status(status).json({ code, error });
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  if (process.env.GEMMA_DISABLED === "1")
    return fail(
      res,
      503,
      "AI_PAUSED",
      "AI questions are temporarily paused. You can still use samples and your saved notebook.",
    );
  if (!allowRequest(req)) {
    res.setHeader("Retry-After", "60");
    return fail(
      res,
      429,
      "REQUEST_LIMIT",
      "Too many requests from this connection. Wait a minute, then try again.",
    );
  }
  let input;
  try {
    input = validateInput(req.body);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const key = process.env.GEMMA_API_KEY?.trim();
  if (!key)
    return fail(
      res,
      503,
      "AI_NOT_CONFIGURED",
      "Live AI is not connected yet. Try a sample activity below.",
    );
  const model = (process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it").trim();
  if (!/^gemma-[a-z0-9-]+$/.test(model))
    return fail(
      res,
      503,
      "AI_MODEL_CONFIG",
      "The AI model configuration needs attention.",
    );
  const generationConfig = { temperature: 0.4, maxOutputTokens: 4096 };
  // Gemma 4 documents minimal as disabling thinking. Other models must not receive this setting.
  if (model.startsWith("gemma-4-"))
    generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
  let response, result;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: promptFor(input) },
                ...(input.images || []).map((image) => ({ inlineData: image })),
              ],
            },
          ],
          generationConfig,
        }),
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!response.ok) {
      const errors = {
        400: [
          "AI_REQUEST_REJECTED",
          "Google rejected the request. Check the configured model and API key restrictions.",
        ],
        401: [
          "AI_AUTH",
          "Google rejected the API key. Check GEMMA_API_KEY in .env and restart the server.",
        ],
        403: [
          "AI_ACCESS",
          "Google denied access. Check this key’s project permissions and model access.",
        ],
        404: [
          "AI_MODEL_NOT_FOUND",
          "OutsideClass AI is unavailable with the current model configuration. Try a sample while this is checked.",
        ],
        429: [
          "AI_QUOTA",
          "The AI usage limit was reached. Try a sample or come back later.",
        ],
      };
      const [code, message] = errors[response.status] || [
        "AI_PROVIDER_UNAVAILABLE",
        "Google’s AI service is unavailable. Try a sample or retry later.",
      ];
      return fail(res, response.status === 429 ? 429 : 502, code, message);
    }
    try {
      result = await response.json();
    } catch (e) {
      if (e.name === "TimeoutError" || e.name === "AbortError") throw e;
      return fail(
        res,
        502,
        "AI_PROVIDER_FORMAT",
        "Google returned an unreadable response. Please retry later.",
      );
    }
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError")
      return fail(
        res,
        504,
        "AI_TIMEOUT",
        "OutsideClass AI did not finish within 25 seconds. Please retry or use a sample.",
      );
    return fail(
      res,
      502,
      "AI_NETWORK",
      "The server could not reach Google AI. Check your internet connection, then retry.",
    );
  }
  const candidate = result?.candidates?.[0];
  if (
    result?.promptFeedback?.blockReason ||
    (candidate?.finishReason &&
      !["STOP", "MAX_TOKENS"].includes(candidate.finishReason))
  )
    return fail(
      res,
      422,
      "AI_BLOCKED",
      "OutsideClass AI could not provide this activity. Try a different outdoor learning topic.",
    );
  if (candidate?.finishReason === "MAX_TOKENS")
    return fail(
      res,
      502,
      "AI_TRUNCATED",
      "OutsideClass AI ran out of response space before finishing the card. Try a simpler topic.",
    );
  const parts = candidate?.content?.parts;
  const raw = Array.isArray(parts)
    ? parts
        .filter((p) => p && !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("")
    : "";
  if (!raw.trim())
    return fail(
      res,
      502,
      "AI_EMPTY",
      "OutsideClass AI returned no activity text. Please retry or choose a sample.",
    );
  let activity;
  try {
    activity = parseActivity(raw, input.audience);
    if (!activity.checks) throw Error("Missing understanding checks.");
  } catch {
    return fail(
      res,
      502,
      "AI_ACTIVITY_FORMAT",
      "OutsideClass AI replied, but the activity card was not in the required format. Please retry.",
    );
  }
  const { images, ...preferences } = input;
  return res.status(200).json({
    activity: {
      ...activity,
      ...preferences,
      imageUsed: !!images?.length,
      source: "OutsideClass AI",
      beforeYouGo: safetyNotes(input),
    },
  });
}
