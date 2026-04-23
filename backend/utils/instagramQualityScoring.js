import crypto from "crypto";
import MediaQualityScore from "../models/MediaQualityScore.js";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_REVIEW_CACHE_HOURS = 24 * 7;

function clampScore(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, num));
}

function average(values = [], fallback = 0) {
  const nums = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!nums.length) return fallback;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function getOpenAiApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function getAiProvider(apiKey = "") {
  const endpointHint = String(process.env.AI_QUALITY_CHAT_COMPLETIONS_URL || "").toLowerCase();
  if (endpointHint.includes("openrouter.ai")) return "openrouter";
  if (String(apiKey || "").startsWith("sk-or-v1")) return "openrouter";
  return "openai";
}

function getAiEndpoint(provider = "openai") {
  const explicit = String(process.env.AI_QUALITY_CHAT_COMPLETIONS_URL || "").trim();
  if (explicit) return explicit;
  return provider === "openrouter" ? OPENROUTER_ENDPOINT : OPENAI_ENDPOINT;
}

function normalizeModelForProvider(model, provider = "openai") {
  const normalized = String(model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  if (provider !== "openrouter") return normalized;
  if (normalized.includes("/")) return normalized;
  return `openai/${normalized}`;
}

function getOpenAiModel() {
  return String(process.env.OPENAI_QUALITY_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function buildAiHeaders(apiKey, provider = "openai") {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] =
      String(process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "http://localhost:5000").trim();
    headers["X-Title"] =
      String(process.env.OPENROUTER_APP_NAME || "Command Centre KPI Quality Auditor").trim();
  }

  return headers;
}

function getCacheAgeMs() {
  const hours = Number(process.env.AI_QUALITY_CACHE_HOURS || DEFAULT_REVIEW_CACHE_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_REVIEW_CACHE_HOURS * 60 * 60 * 1000;
  }
  return hours * 60 * 60 * 1000;
}

function normalizeMediaType(item) {
  return String(item?.media_type || "").toUpperCase();
}

function normalizeProductType(item) {
  return String(item?.media_product_type || "").toUpperCase();
}

function isStory(item) {
  return normalizeMediaType(item) === "STORY";
}

function isReel(item) {
  const mediaType = normalizeMediaType(item);
  const productType = normalizeProductType(item);
  return mediaType === "REELS" || productType === "REELS";
}

function getPrimaryImageUrl(item) {
  // Use preview image for visual evaluation. Reels/videos generally expose thumbnail_url.
  const thumbnail = String(item?.thumbnail_url || "").trim();
  if (thumbnail) return thumbnail;

  const mediaUrl = String(item?.media_url || "").trim();
  if (mediaUrl) return mediaUrl;

  return "";
}

function hasCaption(item) {
  return Boolean(String(item?.caption || "").trim());
}

function isTaggedCollabWithoutCaption(item) {
  const taggedCollab = Boolean(item?.__isTaggedCollab);
  const ownedByAccount = Boolean(item?.__isOwnedByAccount);
  return taggedCollab && !ownedByAccount && !hasCaption(item);
}

function buildCaptionFingerprint(item) {
  const mediaId = String(item?.id || "").trim();
  const caption = String(item?.caption || "").trim();
  const mediaType = normalizeMediaType(item);
  const productType = normalizeProductType(item);
  const permalink = String(item?.permalink || "").trim();
  const timestamp = String(item?.timestamp || "").trim();

  return crypto
    .createHash("sha256")
    // Do not use media_url/thumbnail_url here because those URLs can rotate
    // and would trigger unnecessary re-scoring for unchanged posts.
    .update([mediaId, caption, mediaType, productType, permalink, timestamp].join("|"))
    .digest("hex");
}

function parseJsonLoose(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Handle JSON inside code fences.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function countMatches(text = "", regex) {
  const matches = String(text).match(regex);
  return Array.isArray(matches) ? matches.length : 0;
}

function heuristicQualityScores(item) {
  const caption = String(item?.caption || "").trim();
  const captionLower = caption.toLowerCase();
  const reel = isReel(item);

  const genericHotelPhrases = [
    "book now",
    "luxury stay",
    "best hotel",
    "comfortable rooms",
    "exclusive offer",
    "call now",
  ];

  const cpTerms = [
    "centre point",
    "cp",
    "meeting point",
    "ramdaspeth",
    "nagpur",
  ];

  const wittySignals = [
    "weekend",
    "vibe",
    "bold",
    "twist",
    "sip",
    "brunch",
    "plot twist",
    "not your",
  ];

  let brandTone = caption ? 65 : 35;
  brandTone += Math.min(10, Math.floor(caption.length / 40));
  brandTone += cpTerms.some((term) => captionLower.includes(term)) ? 12 : 0;
  brandTone += wittySignals.some((term) => captionLower.includes(term)) ? 10 : 0;
  brandTone -= genericHotelPhrases.some((term) => captionLower.includes(term)) ? 20 : 0;
  brandTone -= caption.length > 0 && caption.length < 25 ? 8 : 0;

  let captionZeroErrors = caption ? 92 : 55;
  captionZeroErrors -= countMatches(caption, /\s{2,}/g) * 8;
  captionZeroErrors -= countMatches(caption, /[!?]{3,}/g) * 5;
  captionZeroErrors -= /\b(teh|recieve|definately|seperate|occured)\b/i.test(caption) ? 20 : 0;
  captionZeroErrors -= /\b(i|im|ive|dont|cant|wont)\b/.test(caption) ? 5 : 0;

  // Without vision, keep visual/logo metrics conservative but non-zero.
  let visualConsistency = 68;
  visualConsistency += getPrimaryImageUrl(item) ? 8 : -8;
  visualConsistency += cpTerms.some((term) => captionLower.includes(term)) ? 8 : 0;

  let logoAssetUsage = 66;
  logoAssetUsage += cpTerms.some((term) => captionLower.includes(term)) ? 10 : 0;
  logoAssetUsage += /#cp|#centrepoint|@centrepointhotel|@centrepointhospitality/i.test(caption) ? 8 : 0;

  let reelContentQuality = reel ? 74 : 100;
  if (reel) {
    reelContentQuality += getPrimaryImageUrl(item) ? 8 : -10;
    reelContentQuality += caption.length >= 30 ? 4 : -4;
  }

  return {
    scores: {
      brandToneInCaptions: clampScore(brandTone),
      visualConsistencyWithCpBrand: clampScore(visualConsistency),
      logoAndBrandAssetUsage: clampScore(logoAssetUsage),
      reelContentQuality: clampScore(reelContentQuality, 100),
      captionZeroErrors: clampScore(captionZeroErrors),
    },
    evaluator: "heuristic",
    model: "heuristic-v1",
    notes: "Heuristic fallback used (OPENAI_API_KEY missing or AI request failed).",
  };
}

async function scoreWithOpenAi(item, account = {}) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const provider = getAiProvider(apiKey);
  const endpoint = getAiEndpoint(provider);
  const model = normalizeModelForProvider(getOpenAiModel(), provider);
  const imageUrl = getPrimaryImageUrl(item);
  const caption = String(item?.caption || "").trim();
  const reel = isReel(item);

  const brandContext = [
    "Centre Point Hotels brand tone requirements:",
    "- Bold, clear, witty, semi-formal captions",
    "- Avoid generic hotel copy",
    "- Strong brand consistency in visuals",
    "- Correct logo/brand asset usage",
    "- Reels should look professional (lighting, framing, edit, music fit)",
  ].join("\n");

  const mediaContext = [
    `Account: ${account?.name || account?.username || "Unknown"}`,
    `Media id: ${String(item?.id || "")}`,
    `Media type: ${normalizeMediaType(item)}`,
    `Media product type: ${normalizeProductType(item)}`,
    `Timestamp: ${String(item?.timestamp || "")}`,
    `Caption: ${caption || "(empty)"}`,
    `Permalink: ${String(item?.permalink || "")}`,
    `Is reel: ${reel ? "yes" : "no"}`,
  ].join("\n");

  const outputContract = [
    "Return ONLY valid JSON with this shape:",
    "{",
    '  "brandToneInCaptions": number(0-100),',
    '  "visualConsistencyWithCpBrand": number(0-100),',
    '  "logoAndBrandAssetUsage": number(0-100),',
    '  "reelContentQuality": number(0-100),',
    '  "captionZeroErrors": number(0-100),',
    '  "notes": "short explanation"',
    "}",
    "For non-reel media, set reelContentQuality to 100.",
  ].join("\n");

  const userContent = [
    { type: "text", text: `${brandContext}\n\n${mediaContext}\n\n${outputContract}` },
  ];

  if (imageUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildAiHeaders(apiKey, provider),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict brand quality auditor. Score exactly per rubric and return JSON only.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = { raw };
  }

  if (!response.ok || body?.error) {
    const message = body?.error?.message || body?.raw || `AI request failed (${response.status})`;
    throw new Error(message);
  }

  const content = body?.choices?.[0]?.message?.content || "";
  const parsed = parseJsonLoose(content);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenAI returned non-JSON quality payload");
  }

  return {
    scores: {
      brandToneInCaptions: clampScore(parsed.brandToneInCaptions),
      visualConsistencyWithCpBrand: clampScore(parsed.visualConsistencyWithCpBrand),
      logoAndBrandAssetUsage: clampScore(parsed.logoAndBrandAssetUsage),
      reelContentQuality: clampScore(parsed.reelContentQuality, reel ? 0 : 100),
      captionZeroErrors: clampScore(parsed.captionZeroErrors),
    },
    evaluator: "openai",
    model,
    notes: String(parsed.notes || "").slice(0, 500),
  };
}

async function evaluateSingleMedia(item, account = {}, warnings = []) {
  if (!getOpenAiApiKey()) {
    return heuristicQualityScores(item);
  }

  try {
    return await scoreWithOpenAi(item, account);
  } catch (error) {
    warnings.push(`quality (${String(item?.id || "unknown")}): ${String(error?.message || error)}`);
    return heuristicQualityScores(item);
  }
}

function toStoredDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStoredScores(scores = {}) {
  return {
    brandToneInCaptions: clampScore(scores.brandToneInCaptions),
    visualConsistencyWithCpBrand: clampScore(scores.visualConsistencyWithCpBrand),
    logoAndBrandAssetUsage: clampScore(scores.logoAndBrandAssetUsage),
    reelContentQuality: clampScore(scores.reelContentQuality, 100),
    captionZeroErrors: clampScore(scores.captionZeroErrors),
  };
}

function buildAggregates(evaluations = []) {
  const brandToneValues = evaluations
    .filter((entry) => entry.captionScorable)
    .map((entry) => entry.scores.brandToneInCaptions);
  const visualValues = evaluations.map((entry) => entry.scores.visualConsistencyWithCpBrand);
  const logoValues = evaluations.map((entry) => entry.scores.logoAndBrandAssetUsage);
  const captionValues = evaluations
    .filter((entry) => entry.captionScorable)
    .map((entry) => entry.scores.captionZeroErrors);

  const reelValues = evaluations
    .filter((entry) => entry.reel)
    .map((entry) => entry.scores.reelContentQuality);

  return {
    brandToneInCaptionsScore: average(brandToneValues, 0),
    visualConsistencyCpBrandScore: average(visualValues, 0),
    logoAssetUsageComplianceScore: average(logoValues, 0),
    reelContentQualityScore: average(reelValues, 100),
    captionZeroErrorsScore: average(captionValues, 0),
  };
}

export async function computeQualityKpiMetrics(media = [], { account } = {}) {
  const eligibleMedia = (Array.isArray(media) ? media : [])
    .filter((item) => item?.id && !isStory(item));

  if (!eligibleMedia.length) {
    return {
      metrics: {
        brandToneInCaptionsScore: 0,
        visualConsistencyCpBrandScore: 0,
        logoAssetUsageComplianceScore: 0,
        reelContentQualityScore: 100,
        captionZeroErrorsScore: 0,
      },
      warnings: [],
    };
  }

  const cacheAgeMs = getCacheAgeMs();
  const warnings = [];

  const mediaIds = eligibleMedia.map((item) => String(item.id));
  const existingRows = await MediaQualityScore.find({ mediaId: { $in: mediaIds } }).lean();
  const existingByMediaId = new Map(existingRows.map((row) => [String(row.mediaId), row]));

  const evaluations = [];

  for (const item of eligibleMedia) {
    const mediaId = String(item.id);
    const fingerprint = buildCaptionFingerprint(item);
    const existing = existingByMediaId.get(mediaId);

    const isFresh = existing?.reviewedAt
      ? (Date.now() - new Date(existing.reviewedAt).getTime()) < cacheAgeMs
      : false;

    const captionScorable = !isTaggedCollabWithoutCaption(item);

    if (existing && isFresh && String(existing.captionFingerprint || "") === fingerprint) {
      evaluations.push({
        mediaId,
        reel: isReel(item),
        captionScorable,
        scores: normalizeStoredScores(existing.scores || {}),
      });
      continue;
    }

    const result = await evaluateSingleMedia(item, account, warnings);
    const normalizedScores = normalizeStoredScores(result.scores || {});

    await MediaQualityScore.findOneAndUpdate(
      { mediaId },
      {
        mediaId,
        accountId: String(account?.id || ""),
        mediaType: normalizeMediaType(item),
        mediaProductType: normalizeProductType(item),
        timestamp: toStoredDate(item?.timestamp),
        permalink: String(item?.permalink || ""),
        captionFingerprint: fingerprint,
        evaluator: result.evaluator,
        model: result.model,
        scores: normalizedScores,
        notes: String(result.notes || ""),
        reviewedAt: new Date(),
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    evaluations.push({
      mediaId,
      reel: isReel(item),
      captionScorable,
      scores: normalizedScores,
    });
  }

  return {
    metrics: buildAggregates(evaluations),
    warnings,
  };
}
