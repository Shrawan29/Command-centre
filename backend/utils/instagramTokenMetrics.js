import { computeQualityKpiMetrics } from "./instagramQualityScoring.js";

const MAX_MEDIA_ITEMS = 2000;
const DEFAULT_TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TOKEN_FIRST_RESPONSE_MAX_WAIT_MS = 4000;
const DEFAULT_GRAPH_REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_GRAPH_TAGS_REQUEST_TIMEOUT_MS = 12000;

const INSIGHT_METRIC_MAP = {
  profileViews: "profile_views",
  reach: "reach",
  accountsEngaged: "accounts_engaged",
  totalInteractions: "total_interactions",
  followerCountDelta: "follower_count",
  websiteClicks: "website_clicks",
  profileLinkTaps: "profile_links_taps",
  views: "views",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  replies: "replies",
};

const DEFAULT_QUALITY_METRICS = {
  brandToneInCaptionsScore: 0,
  visualConsistencyCpBrandScore: 0,
  logoAssetUsageComplianceScore: 0,
  reelContentQualityScore: 100,
  captionZeroErrorsScore: 0,
};

let cachePayload = null;
let cacheExpiresAt = 0;
let cacheRefreshPromise = null;
let lastKnownCollabTaggedMedia = [];

function getGraphVersion() {
  return process.env.FACEBOOK_GRAPH_VERSION || "v23.0";
}

function getAccessToken() {
  return String(process.env.FACEBOOK_ACCESS_TOKEN || "").trim();
}

function getConfiguredInstagramAccountId() {
  return String(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "").trim();
}

function getTokenCacheTtlMs() {
  const configuredTtl = Number(process.env.TOKEN_METRICS_CACHE_TTL_MS || DEFAULT_TOKEN_CACHE_TTL_MS);
  if (!Number.isFinite(configuredTtl) || configuredTtl <= 0) {
    return DEFAULT_TOKEN_CACHE_TTL_MS;
  }

  return configuredTtl;
}

function getTokenFirstResponseMaxWaitMs() {
  const configuredWait = Number(
    process.env.TOKEN_METRICS_FIRST_RESPONSE_MAX_WAIT_MS ||
      DEFAULT_TOKEN_FIRST_RESPONSE_MAX_WAIT_MS
  );

  if (!Number.isFinite(configuredWait) || configuredWait < 0) {
    return DEFAULT_TOKEN_FIRST_RESPONSE_MAX_WAIT_MS;
  }

  return configuredWait;
}

function getGraphRequestTimeoutMs(path = "") {
  const normalizedPath = String(path || "").toLowerCase();
  const isTagsPath = normalizedPath.endsWith("/tags") || normalizedPath.includes("/tags/") || normalizedPath.includes("tags");

  if (isTagsPath) {
    const configuredTagsTimeout = Number(
      process.env.TOKEN_GRAPH_TAGS_REQUEST_TIMEOUT_MS || DEFAULT_GRAPH_TAGS_REQUEST_TIMEOUT_MS
    );

    if (!Number.isFinite(configuredTagsTimeout) || configuredTagsTimeout <= 0) {
      return DEFAULT_GRAPH_TAGS_REQUEST_TIMEOUT_MS;
    }

    return configuredTagsTimeout;
  }

  const configuredTimeout = Number(
    process.env.TOKEN_GRAPH_REQUEST_TIMEOUT_MS || DEFAULT_GRAPH_REQUEST_TIMEOUT_MS
  );

  if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) {
    return DEFAULT_GRAPH_REQUEST_TIMEOUT_MS;
  }

  return configuredTimeout;
}

function buildRefreshInProgressPayload(window = getMonthWindow(0)) {
  return {
    available: false,
    source: "facebook_access_token",
    graphVersion: getGraphVersion(),
    account: null,
    window,
    metrics: {},
    warnings: ["Token metrics refresh in progress"],
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getConfiguredCollabMediaIds() {
  const raw = String(process.env.INSTAGRAM_COLLAB_MEDIA_IDS || "").trim();
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
  );
}

function getConfiguredCollabUsernames() {
  const raw = String(process.env.INSTAGRAM_COLLAB_USERNAMES || "").trim();
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map((entry) => String(entry || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

function getMonthWindow(monthOffset = 0, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59));
  const end =
    monthOffset === 0
      ? new Date(Math.min(endOfMonth.getTime(), now.getTime()))
      : endOfMonth;

  return {
    sinceUnix: Math.floor(start.getTime() / 1000),
    untilUnix: Math.floor(end.getTime() / 1000),
    sinceIso: start.toISOString(),
    untilIso: end.toISOString(),
  };
}

function getElapsedWeeksInMonth(window, now = new Date()) {
  const nowUnix = Math.floor(now.getTime() / 1000);
  const effectiveUntilUnix = Math.min(window?.untilUnix || 0, nowUnix);
  const sinceUnix = Number(window?.sinceUnix || 0);

  if (!Number.isFinite(sinceUnix) || effectiveUntilUnix < sinceUnix) {
    return 0;
  }

  const elapsedSeconds = (effectiveUntilUnix - sinceUnix) + 1;
  return elapsedSeconds / (7 * 24 * 60 * 60);
}

function buildGraphUrl(path, params = {}) {
  const accessToken = getAccessToken();
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(`https://graph.facebook.com/${getGraphVersion()}/${normalizedPath}`);
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  search.set("access_token", accessToken);
  url.search = search.toString();
  return url;
}

async function fetchGraph(path, params = {}) {
  const url = buildGraphUrl(path, params);
  const timeoutMs = getGraphRequestTimeoutMs(path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let rawText;

  try {
    response = await fetch(url, { signal: controller.signal });
    rawText = await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Graph API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = { raw: rawText };
  }

  if (!response.ok || body?.error) {
    const message = body?.error?.message || body?.raw || `Graph API request failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

async function resolveInstagramAccount() {
  const configuredIgAccountId = getConfiguredInstagramAccountId();

  if (configuredIgAccountId) {
    const account = await fetchGraph(configuredIgAccountId, {
      fields: "id,username,name",
    });

    return {
      id: String(account?.id || configuredIgAccountId),
      username: account?.username || null,
      name: account?.name || null,
    };
  }

  const pages = await fetchGraph("me/accounts", {
    fields: "id,name,instagram_business_account{id,username,name},connected_instagram_account{id,username,name}",
    limit: 100,
  });

  const list = Array.isArray(pages?.data) ? pages.data : [];

  for (const page of list) {
    const ig = page?.instagram_business_account || page?.connected_instagram_account;
    if (!ig?.id) continue;

    return {
      id: String(ig.id),
      username: ig?.username || null,
      name: ig?.name || null,
      pageId: page?.id || null,
      pageName: page?.name || null,
    };
  }

  throw new Error("No connected Instagram business account found for this token");
}

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseInsightMetricValue(payload, mode = "sum") {
  const point = payload?.data?.[0];
  if (!point) return null;

  if (point?.total_value?.value !== undefined) {
    return toNumberOrNull(point.total_value.value);
  }

  const values = Array.isArray(point?.values) ? point.values : [];
  if (!values.length) return null;

  const numericValues = values
    .map((entry) => toNumberOrNull(entry?.value))
    .filter((entry) => entry !== null);

  if (!numericValues.length) return null;

  if (mode === "last") {
    return numericValues[numericValues.length - 1];
  }

  return numericValues.reduce((sum, current) => sum + current, 0);
}

function buildInsightRanges(sinceUnix, untilUnix) {
  const start = Math.floor(Number(sinceUnix));
  const end = Math.floor(Number(untilUnix));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return [];
  }

  // Keep each request under Meta's 30-day limit.
  const maxSpanSeconds = (30 * 24 * 60 * 60) - 1;
  const ranges = [];
  let cursor = start;

  while (cursor <= end) {
    const rangeEnd = Math.min(end, cursor + maxSpanSeconds);
    ranges.push({ sinceUnix: cursor, untilUnix: rangeEnd });
    cursor = rangeEnd + 1;
  }

  return ranges;
}

function getMetricAvailableUntilUnix(metricName) {
  const nowUnix = Math.floor(Date.now() / 1000);
  if (metricName === "follower_count") {
    // Meta follower_count excludes current day.
    return nowUnix - 86400;
  }
  return nowUnix;
}

async function fetchInsightMetric(igAccountId, metricName, sinceUnix, untilUnix, options = {}) {
  const parseMode = options?.parseMode || "sum";
  const availableUntil = getMetricAvailableUntilUnix(metricName);
  const cappedUntilUnix = Math.min(Math.floor(Number(untilUnix)), availableUntil);
  const cappedSinceUnix = Math.floor(Number(sinceUnix));

  if (!Number.isFinite(cappedSinceUnix) || !Number.isFinite(cappedUntilUnix) || cappedSinceUnix > cappedUntilUnix) {
    return { value: null, warning: `${metricName}: no available data in requested window` };
  }

  async function doFetch(rangeSince, rangeUntil, metricType) {
    return fetchGraph(`${igAccountId}/insights`, {
      metric: metricName,
      period: "day",
      since: rangeSince,
      until: rangeUntil,
      metric_type: metricType,
    });
  }

  async function fetchRange(rangeSince, rangeUntil) {
    try {
      const payload = await doFetch(rangeSince, rangeUntil, undefined);
      return { value: parseInsightMetricValue(payload, parseMode), warning: null };
    } catch (error) {
      const message = String(error?.message || "");
      if (!message.toLowerCase().includes("metric_type=total_value")) {
        return { value: null, warning: `${metricName}: ${message}` };
      }

      try {
        const payload = await doFetch(rangeSince, rangeUntil, "total_value");
        return { value: parseInsightMetricValue(payload, parseMode), warning: null };
      } catch (retryError) {
        return { value: null, warning: `${metricName}: ${retryError.message}` };
      }
    }
  }

  const ranges = buildInsightRanges(cappedSinceUnix, cappedUntilUnix);
  if (!ranges.length) {
    return { value: null, warning: `${metricName}: invalid time range` };
  }

  if (parseMode === "last") {
    let latestValue = null;
    const warnings = [];

    for (const range of ranges) {
      const result = await fetchRange(range.sinceUnix, range.untilUnix);
      if (result.warning) {
        warnings.push(result.warning);
        continue;
      }
      if (result.value !== null) {
        latestValue = result.value;
      }
    }

    return {
      value: latestValue,
      warning: warnings.length ? warnings.join(" | ") : null,
    };
  }

  let sum = 0;
  let hasAnyValue = false;
  const warnings = [];

  for (const range of ranges) {
    const result = await fetchRange(range.sinceUnix, range.untilUnix);
    if (result.warning) {
      warnings.push(result.warning);
      continue;
    }

    const numericValue = toNumberOrNull(result.value);
    if (numericValue !== null) {
      sum += numericValue;
      hasAnyValue = true;
    }
  }

  return {
    value: hasAnyValue ? sum : null,
    warning: warnings.length ? warnings.join(" | ") : null,
  };
}

async function fetchMediaInsightMetric(mediaId, metricName) {
  try {
    const payload = await fetchGraph(`${mediaId}/insights`, {
      metric: metricName,
    });

    return { value: parseInsightMetricValue(payload, "sum"), warning: null };
  } catch (error) {
    return { value: null, warning: `${metricName} (${mediaId}): ${error.message}` };
  }
}

async function fetchAllMedia(igAccountId, { stopBeforeUnix } = {}) {
  const all = [];
  let after;
  const stopThresholdUnix = Number(stopBeforeUnix);
  const hasStopThreshold = Number.isFinite(stopThresholdUnix) && stopThresholdUnix > 0;

  while (all.length < MAX_MEDIA_ITEMS) {
    const payload = await fetchGraph(`${igAccountId}/media`, {
      fields: "id,caption,media_type,media_product_type,timestamp,media_url,thumbnail_url,permalink",
      limit: 100,
      after,
    });

    const data = Array.isArray(payload?.data) ? payload.data : [];
    all.push(...data);

    if (hasStopThreshold && data.length) {
      const pageOldestUnix = data.reduce((oldest, item) => {
        const parsed = Date.parse(item?.timestamp || "");
        if (!Number.isFinite(parsed)) return oldest;
        const unix = Math.floor(parsed / 1000);
        if (!Number.isFinite(unix)) return oldest;
        return oldest === null ? unix : Math.min(oldest, unix);
      }, null);

      // `/media` is sorted newest-first. Once the current page already dips
      // below the needed boundary, subsequent pages are older and can be skipped.
      if (pageOldestUnix !== null && pageOldestUnix < stopThresholdUnix) {
        break;
      }
    }

    const nextAfter = payload?.paging?.cursors?.after;
    if (!nextAfter) break;
    after = nextAfter;
  }

  return all;
}

async function fetchAllTaggedMedia(igAccountId) {
  // `/tags` can be flaky depending on requested fields/volume.
  // Prioritize lightweight payloads first to improve reliability and speed.
  const attempts = [
    {
      fields: "id,media_type,media_product_type,timestamp,username,permalink",
      limit: 100,
    },
    {
      fields: "id,caption,media_type,media_product_type,timestamp,username,permalink",
      limit: 50,
    },
    {
      fields: "id,media_type,media_product_type,timestamp",
      limit: 100,
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const payload = await fetchGraph(`${igAccountId}/tags`, {
        fields: attempt.fields,
        limit: attempt.limit,
      });

      return Array.isArray(payload?.data) ? payload.data : [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to fetch tagged media");
}

function filterTaggedMediaToConfiguredCollabs(taggedMedia = []) {
  const collabMediaIds = getConfiguredCollabMediaIds();
  const collabUsernames = getConfiguredCollabUsernames();

  // Exclude all plain tagged media by default. Only explicitly configured
  // collab entries are merged into KPI calculations.
  if (!collabMediaIds.size && !collabUsernames.size) {
    return [];
  }

  return taggedMedia.filter((item) => {
    const mediaId = String(item?.id || "").trim();
    const username = String(item?.username || "").trim().toLowerCase();

    if (mediaId && collabMediaIds.has(mediaId)) return true;
    if (username && collabUsernames.has(username)) return true;
    return false;
  });
}

function mergeMediaRecord(existing = {}, incoming = {}) {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === undefined || value === null) continue;

    // Preserve existing non-empty strings if the incoming value is empty.
    if (
      typeof value === "string" &&
      !value.trim() &&
      typeof merged[key] === "string" &&
      merged[key].trim()
    ) {
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

function mergeMediaById(primaryMedia = [], secondaryMedia = []) {
  const merged = new Map();
  for (const item of [...primaryMedia, ...secondaryMedia]) {
    if (!item?.id) continue;

    const id = String(item.id);
    const existing = merged.get(id) || { id };
    merged.set(id, mergeMediaRecord(existing, item));
  }
  return Array.from(merged.values());
}

function filterMediaByWindow(media = [], sinceUnix, untilUnix) {
  return media.filter((item) => {
    const timestamp = Date.parse(item?.timestamp || "");
    if (!Number.isFinite(timestamp)) return false;

    const unix = Math.floor(timestamp / 1000);
    return unix >= sinceUnix && unix <= untilUnix;
  });
}

function isReel(item) {
  const mediaType = String(item?.media_type || "").toUpperCase();
  const productType = String(item?.media_product_type || "").toUpperCase();
  return productType === "REELS" || mediaType === "REELS";
}

function isStory(item) {
  const mediaType = String(item?.media_type || "").toUpperCase();
  return mediaType === "STORY";
}

function isFeedPost(item) {
  return !isStory(item) && !isReel(item);
}

function aggregateMedia(media = []) {
  let reelsPublished = 0;
  let storiesPublished = 0;
  let imagesPublished = 0;
  let videosPublished = 0;
  let carouselsPublished = 0;
  let feedPostsPublished = 0;

  for (const item of media) {
    const mediaType = String(item?.media_type || "").toUpperCase();

    if (isStory(item)) storiesPublished += 1;
    if (isReel(item)) reelsPublished += 1;
    if (isFeedPost(item)) feedPostsPublished += 1;
    if (mediaType === "IMAGE") imagesPublished += 1;
    if (mediaType === "VIDEO" && !isReel(item)) videosPublished += 1;
    if (mediaType === "CAROUSEL_ALBUM") carouselsPublished += 1;
  }

  return {
    mediaPublished: media.length,
    feedPostsPublished,
    reelsPublished,
    storiesPublished,
    imagesPublished,
    videosPublished,
    carouselsPublished,
  };
}

async function computeReelAverages(reels = []) {
  if (!reels.length) {
    return {
      averageReelViews: 0,
      averageReelCompletionRate: 0,
      warnings: [],
    };
  }

  let sumViews = 0;
  let reelsWithViews = 0;
  let sumCompletionRate = 0;
  let reelsWithCompletionRate = 0;
  const warnings = [];

  for (const reel of reels) {
    const viewsResult = await fetchMediaInsightMetric(reel.id, "views");
    if (viewsResult.warning) warnings.push(viewsResult.warning);

    const reachResult = await fetchMediaInsightMetric(reel.id, "reach");
    if (reachResult.warning) warnings.push(reachResult.warning);

    const views = toNumberOrNull(viewsResult.value);
    const reach = toNumberOrNull(reachResult.value);

    if (views !== null) {
      sumViews += views;
      reelsWithViews += 1;
    }

    if (views !== null && reach !== null && reach > 0) {
      // Proxy for completion quality when direct completion metric is unavailable.
      const completionProxy = Math.min(100, (views / reach) * 100);
      sumCompletionRate += completionProxy;
      reelsWithCompletionRate += 1;
    }
  }

  return {
    averageReelViews: reelsWithViews > 0 ? sumViews / reelsWithViews : 0,
    averageReelCompletionRate: reelsWithCompletionRate > 0 ? sumCompletionRate / reelsWithCompletionRate : 0,
    warnings,
  };
}

export async function getCurrentMonthInstagramTokenMetrics({ useCache = true } = {}) {
  if (useCache && cachePayload && Date.now() < cacheExpiresAt) {
    return cachePayload;
  }

  const createRefreshOperation = () => (async () => {
    const accessToken = getAccessToken();
    const currentMonthWindow = getMonthWindow(0);
    const previousMonthWindow = getMonthWindow(-1);

    const basePayload = {
      available: false,
      source: "facebook_access_token",
      graphVersion: getGraphVersion(),
      account: null,
      window: currentMonthWindow,
      metrics: {},
      warnings: [],
    };

    if (!accessToken) {
      const payload = {
        ...basePayload,
        warnings: ["FACEBOOK_ACCESS_TOKEN is missing"],
      };

      cachePayload = payload;
      cacheExpiresAt = Date.now() + getTokenCacheTtlMs();
      return payload;
    }

    try {
      const account = await resolveInstagramAccount();
      const accountFields = await fetchGraph(account.id, {
        fields: "followers_count,media_count",
      }).catch(() => ({}));

      const warnings = [];
      const allMedia = await fetchAllMedia(account.id, {
        stopBeforeUnix: previousMonthWindow.sinceUnix,
      });
      const ownedMediaIds = new Set(allMedia.map((item) => String(item?.id || "")).filter(Boolean));
      let taggedMedia = [];
      let collabTaggedMedia = [];

      try {
        taggedMedia = await fetchAllTaggedMedia(account.id);
        collabTaggedMedia = filterTaggedMediaToConfiguredCollabs(taggedMedia);

        if (collabTaggedMedia.length) {
          lastKnownCollabTaggedMedia = collabTaggedMedia;
        }
      } catch (error) {
        const message = String(error?.message || "");

        if (lastKnownCollabTaggedMedia.length) {
          collabTaggedMedia = lastKnownCollabTaggedMedia;
          warnings.push(`tags: using cached collab tagged media (${message})`);
          
        // Missing permission for /tags is common; silently skip to keep KPI response stable.
        } else if (!message.toLowerCase().includes("does not have permission")) {
          warnings.push(`tags: ${message}`);
        }
      }

      const collabTaggedMediaIds = new Set(
        collabTaggedMedia.map((item) => String(item?.id || "")).filter(Boolean)
      );

      const effectiveMedia = mergeMediaById(allMedia, collabTaggedMedia).map((item) => {
        const id = String(item?.id || "");
        return {
          ...item,
          __isOwnedByAccount: ownedMediaIds.has(id),
          __isTaggedCollab: collabTaggedMediaIds.has(id),
        };
      });

      const currentMonthMedia = filterMediaByWindow(
        effectiveMedia,
        currentMonthWindow.sinceUnix,
        currentMonthWindow.untilUnix
      );

      const previousMonthMedia = filterMediaByWindow(
        effectiveMedia,
        previousMonthWindow.sinceUnix,
        previousMonthWindow.untilUnix
      );

      const currentMediaMetrics = aggregateMedia(currentMonthMedia);
      const previousMediaMetrics = aggregateMedia(previousMonthMedia);
      const elapsedWeeksInMonth = Math.max(getElapsedWeeksInMonth(currentMonthWindow), 1 / 7);
      const storyPostsPerWeek = currentMediaMetrics.storiesPublished / elapsedWeeksInMonth;

      let qualityMetricsResult = {
        metrics: { ...DEFAULT_QUALITY_METRICS },
        warnings: [],
      };

      try {
        qualityMetricsResult = await computeQualityKpiMetrics(currentMonthMedia, {
          account,
        });
        warnings.push(...qualityMetricsResult.warnings);
      } catch (error) {
        warnings.push(`quality: ${String(error?.message || error)}`);
      }

      const insightMetrics = {};
      const insightEntries = Object.entries(INSIGHT_METRIC_MAP);
      const insightConcurrency = Math.max(
        1,
        Number(process.env.TOKEN_INSIGHTS_CONCURRENCY || 4)
      );

      for (let index = 0; index < insightEntries.length; index += insightConcurrency) {
        const batch = insightEntries.slice(index, index + insightConcurrency);
        const batchResults = await Promise.all(
          batch.map(async ([key, metricName]) => {
            const result = await fetchInsightMetric(
              account.id,
              metricName,
              currentMonthWindow.sinceUnix,
              currentMonthWindow.untilUnix
            );

            return { key, result };
          })
        );

        for (const { key, result } of batchResults) {
          insightMetrics[key] = result.value;
          if (result.warning) warnings.push(result.warning);
        }
      }

      const previousReachResult = await fetchInsightMetric(
        account.id,
        "reach",
        previousMonthWindow.sinceUnix,
        previousMonthWindow.untilUnix
      );
      if (previousReachResult.warning) warnings.push(previousReachResult.warning);

      const ownReelsInCurrentMonth = currentMonthMedia.filter(
        (item) => isReel(item) && ownedMediaIds.has(String(item?.id || ""))
      );
      const reelMetrics = await computeReelAverages(ownReelsInCurrentMonth);
      warnings.push(...reelMetrics.warnings);

      const reach = toNumberOrNull(insightMetrics.reach);
      const likes = toNumberOrNull(insightMetrics.likes);
      const comments = toNumberOrNull(insightMetrics.comments);
      const saves = toNumberOrNull(insightMetrics.saves);
      const followerCountDelta = toNumberOrNull(insightMetrics.followerCountDelta);
      const currentFollowers = toNumberOrNull(accountFields?.followers_count);
      const previousReach = toNumberOrNull(previousReachResult.value);

      const feedPostsCurrent = currentMediaMetrics.feedPostsPublished;
      const feedPostsPrevious = previousMediaMetrics.feedPostsPublished;

      const engagementRateFeedPosts =
        reach !== null && reach > 0
          ? (((likes || 0) + (comments || 0)) / reach) * 100
          : 0;

      const reachPerPost =
        reach !== null && feedPostsCurrent > 0
          ? reach / feedPostsCurrent
          : 0;

      const previousReachPerPost =
        previousReach !== null && feedPostsPrevious > 0
          ? previousReach / feedPostsPrevious
          : null;

      const reachPerPostGrowthPercent =
        previousReachPerPost !== null && previousReachPerPost > 0
          ? ((reachPerPost - previousReachPerPost) / previousReachPerPost) * 100
          : 0;

      const savesPerPostAverage =
        saves !== null && feedPostsCurrent > 0
          ? saves / feedPostsCurrent
          : 0;

      const estimatedStartFollowers =
        currentFollowers !== null && followerCountDelta !== null
          ? Math.max(1, currentFollowers - followerCountDelta)
          : null;

      const followerGrowthPercent =
        estimatedStartFollowers !== null && followerCountDelta !== null
          ? (followerCountDelta / estimatedStartFollowers) * 100
          : 0;

      const metrics = {
        ...currentMediaMetrics,
        followersCount: currentFollowers,
        mediaCount: toNumberOrNull(accountFields?.media_count),
        ...insightMetrics,
        storyPostsPerWeek,
        followerGrowthPercent,
        averageReelViews: reelMetrics.averageReelViews,
        averageReelCompletionRate: reelMetrics.averageReelCompletionRate,
        engagementRateFeedPosts,
        reachPerPost,
        reachPerPostGrowthPercent,
        savesPerPostAverage,
        ...qualityMetricsResult.metrics,
      };

      const payload = {
        ...basePayload,
        available: true,
        account,
        metrics,
        warnings,
      };

      cachePayload = payload;
      cacheExpiresAt = Date.now() + getTokenCacheTtlMs();
      return payload;
    } catch (error) {
      const payload = {
        ...basePayload,
        warnings: [error.message],
      };

      cachePayload = payload;
      cacheExpiresAt = Date.now() + getTokenCacheTtlMs();
      return payload;
    }
  })();

  const startCacheRefresh = () => {
    let started = false;

    if (!cacheRefreshPromise) {
      const refreshOperation = createRefreshOperation();
      cacheRefreshPromise = refreshOperation.finally(() => {
        cacheRefreshPromise = null;
      });
      started = true;
    }

    return { promise: cacheRefreshPromise, started };
  };

  // Serve stale payload instantly while refreshing in background.
  if (useCache && cachePayload && Date.now() >= cacheExpiresAt) {
    startCacheRefresh();

    return cachePayload;
  }

  // On first request (no cache yet), avoid blocking the API for a very long token refresh.
  if (useCache && !cachePayload) {
    const refresh = startCacheRefresh();
    const refreshPromise = refresh.promise;

    // If a refresh is already running from another request, return immediately.
    if (!refresh.started) {
      return buildRefreshInProgressPayload(getMonthWindow(0));
    }

    const maxWaitMs = getTokenFirstResponseMaxWaitMs();

    if (maxWaitMs === 0) {
      return buildRefreshInProgressPayload(getMonthWindow(0));
    }

    const result = await Promise.race([
      refreshPromise.then((payload) => ({ timedOut: false, payload })),
      wait(maxWaitMs).then(() => ({ timedOut: true, payload: null })),
    ]);

    if (!result.timedOut) {
      return result.payload;
    }

    return buildRefreshInProgressPayload(getMonthWindow(0));
  }

  if (useCache && cacheRefreshPromise) {
    return cacheRefreshPromise;
  }

  const refreshOperation = createRefreshOperation();
  if (!useCache) {
    return refreshOperation;
  }

  cacheRefreshPromise = refreshOperation.finally(() => {
    cacheRefreshPromise = null;
  });

  return cacheRefreshPromise;
}
