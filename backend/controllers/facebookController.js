const MAX_MEDIA_ITEMS = 2000;

function getGraphVersion() {
  return process.env.FACEBOOK_GRAPH_VERSION || "v23.0";
}

function getAccessToken() {
  return String(process.env.FACEBOOK_ACCESS_TOKEN || "").trim();
}

function getConfiguredInstagramAccountId() {
  return String(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "").trim();
}

function getCurrentMonthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  return {
    sinceUnix: Math.floor(start.getTime() / 1000),
    untilUnix: Math.floor(end.getTime() / 1000),
  };
}

function toUnixTimestamp(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;

  return Math.floor(parsed);
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
  const response = await fetch(url);
  const rawText = await response.text();

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

async function fetchAllMedia(igAccountId) {
  const all = [];
  let after;

  while (all.length < MAX_MEDIA_ITEMS) {
    const payload = await fetchGraph(`${igAccountId}/media`, {
      fields: "id,caption,media_type,media_product_type,timestamp",
      limit: 100,
      after,
    });

    const data = Array.isArray(payload?.data) ? payload.data : [];
    all.push(...data);

    const nextAfter = payload?.paging?.cursors?.after;
    if (!nextAfter) break;
    after = nextAfter;
  }

  return all;
}

function filterMediaByWindow(media = [], sinceUnix, untilUnix) {
  return media.filter((item) => {
    const timestamp = Date.parse(item?.timestamp || "");
    if (!Number.isFinite(timestamp)) return false;

    const unix = Math.floor(timestamp / 1000);
    return unix >= sinceUnix && unix <= untilUnix;
  });
}

function aggregateMedia(media = []) {
  let reelsPublished = 0;
  let storiesPublished = 0;
  let imagesPublished = 0;
  let videosPublished = 0;
  let carouselsPublished = 0;

  for (const item of media) {
    const mediaType = String(item?.media_type || "").toUpperCase();
    const productType = String(item?.media_product_type || "").toUpperCase();

    if (mediaType === "STORY") storiesPublished += 1;
    if (mediaType === "IMAGE") imagesPublished += 1;
    if (mediaType === "VIDEO") videosPublished += 1;
    if (mediaType === "CAROUSEL_ALBUM") carouselsPublished += 1;
    if (productType === "REELS" || mediaType === "REELS") reelsPublished += 1;
  }

  return {
    mediaPublished: media.length,
    reelsPublished,
    storiesPublished,
    imagesPublished,
    videosPublished,
    carouselsPublished,
  };
}

async function fetchProfileViews(igAccountId, sinceUnix, untilUnix) {
  try {
    const payload = await fetchGraph(`${igAccountId}/insights`, {
      metric: "profile_views",
      period: "day",
      since: sinceUnix,
      until: untilUnix,
    });

    const values = payload?.data?.[0]?.values;
    if (!Array.isArray(values)) return { value: null, warning: "profile_views metric returned no values" };

    const total = values.reduce((sum, point) => sum + Number(point?.value || 0), 0);
    return { value: total, warning: null };
  } catch (error) {
    return { value: null, warning: error.message };
  }
}

export const getInstagramMetrics = async (req, res) => {
  try {
    const accessToken = getAccessToken();

    if (!accessToken) {
      return res.status(400).json({
        message: "FACEBOOK_ACCESS_TOKEN is empty in backend/.env",
      });
    }

    const defaults = getCurrentMonthWindow();
    const sinceUnix = toUnixTimestamp(req.query?.since, defaults.sinceUnix);
    const untilUnix = toUnixTimestamp(req.query?.until, defaults.untilUnix);
    const includeMedia = String(req.query?.includeMedia || "false").toLowerCase() === "true";

    if (!Number.isFinite(sinceUnix) || !Number.isFinite(untilUnix)) {
      return res.status(400).json({
        message: "Invalid since/until. Use unix timestamps in seconds.",
      });
    }

    if (sinceUnix > untilUnix) {
      return res.status(400).json({
        message: "Invalid window: since cannot be greater than until",
      });
    }

    const account = await resolveInstagramAccount();
    const allMedia = await fetchAllMedia(account.id);
    const mediaInWindow = filterMediaByWindow(allMedia, sinceUnix, untilUnix);
    const mediaMetrics = aggregateMedia(mediaInWindow);
    const profileViews = await fetchProfileViews(account.id, sinceUnix, untilUnix);

    const response = {
      source: "facebook_access_token",
      graphVersion: getGraphVersion(),
      account,
      window: {
        sinceUnix,
        untilUnix,
        sinceIso: new Date(sinceUnix * 1000).toISOString(),
        untilIso: new Date(untilUnix * 1000).toISOString(),
      },
      metrics: {
        ...mediaMetrics,
        profileViews: profileViews.value,
      },
      warnings: profileViews.warning ? [profileViews.warning] : [],
    };

    if (includeMedia) {
      response.media = mediaInWindow;
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching Instagram metrics from Facebook Graph",
      error: error.message,
    });
  }
};
