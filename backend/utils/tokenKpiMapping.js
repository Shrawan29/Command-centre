export const KPI_NAME_TO_TOKEN_METRIC = {
  "Feed posts published per month": "feedPostsPublished",
  "Reels published per month": "reelsPublished",
  "Story posts per week": "storyPostsPerWeek",
  "Instagram follower growth": "followerGrowthPercent",
  "Average Reel views": "averageReelViews",
  "Average Reel completion rate": "averageReelCompletionRate",
  "Engagement rate (feed posts)": "engagementRateFeedPosts",
  "Reach per post (organic)": "reachPerPost",
  "Saves per post (average)": "savesPerPostAverage",
  "Brand tone in captions": "brandToneInCaptionsScore",
  "Visual consistency with CP brand": "visualConsistencyCpBrandScore",
  "Logo and brand asset usage": "logoAssetUsageComplianceScore",
  "Reel content quality": "reelContentQualityScore",
  "Caption - zero errors": "captionZeroErrorsScore",
  "Caption - Zero errors": "captionZeroErrorsScore",
  "Total Media Published": "mediaPublished",
  "Reels Published": "reelsPublished",
  "Stories Published": "storiesPublished",
  "Image Posts Published": "imagesPublished",
  "Video Posts Published": "videosPublished",
  "Carousel Posts Published": "carouselsPublished",
  "Followers Count": "followersCount",
  "Lifetime Media Count": "mediaCount",
  "Profile Views": "profileViews",
  Reach: "reach",
  "Accounts Engaged": "accountsEngaged",
  "Total Interactions": "totalInteractions",
  "Website Clicks": "websiteClicks",
  "Profile Link Taps": "profileLinkTaps",
  Views: "views",
  Likes: "likes",
  Comments: "comments",
  Shares: "shares",
  Saves: "saves",
  Replies: "replies",
};

function normalizeKpiName(name = "") {
  return String(name || "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_KPI_NAME_TO_TOKEN_METRIC = Object.fromEntries(
  Object.entries(KPI_NAME_TO_TOKEN_METRIC).map(([name, key]) => [normalizeKpiName(name), key])
);

function resolveMetricKeyForKpiName(name = "") {
  const direct = KPI_NAME_TO_TOKEN_METRIC[String(name || "")];
  if (direct) return direct;

  return NORMALIZED_KPI_NAME_TO_TOKEN_METRIC[normalizeKpiName(name)] || null;
}

export function hasTokenMappedKpi(kpis = []) {
  return kpis.some((kpi) => Boolean(resolveMetricKeyForKpiName(String(kpi?.name || ""))));
}

export function getForcedTokenTotal(kpi, tokenPayload) {
  const metricKey = resolveMetricKeyForKpiName(String(kpi?.name || ""));
  if (!metricKey) return { metricKey: null, total: null };

  const raw = tokenPayload?.metrics?.[metricKey];
  const total = Number(raw);
  if (!Number.isFinite(total)) {
    return { metricKey, total: null };
  }

  return { metricKey, total };
}

export function buildForcedMetricOptions(forced) {
  if (!forced?.metricKey || forced?.total === null) return undefined;

  return {
    forcedTotal: forced.total,
    source: "facebook_access_token",
    metricKey: forced.metricKey,
  };
}

export function buildTokenMeta(forced, tokenPayload) {
  if (!forced?.metricKey) return null;

  return {
    available: forced.total !== null,
    metricKey: forced.metricKey,
    account: tokenPayload?.account || null,
    window: tokenPayload?.window || null,
    warnings: Array.isArray(tokenPayload?.warnings) ? tokenPayload.warnings : [],
  };
}
