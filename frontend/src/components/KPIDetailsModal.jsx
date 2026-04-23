
import React from 'react';

// Map technical metric keys to user-friendly labels
const METRIC_LABELS = {
  feedPostsPublished: 'Feed Posts Published',
  reelsPublished: 'Reels Published',
  storiesPublished: 'Stories Published',
  imagesPublished: 'Image Posts Published',
  videosPublished: 'Video Posts Published',
  carouselsPublished: 'Carousel Posts Published',
  followersCount: 'Followers Count',
  mediaCount: 'Lifetime Media Count',
  profileViews: 'Profile Views',
  reach: 'Reach',
  accountsEngaged: 'Accounts Engaged',
  totalInteractions: 'Total Interactions',
  websiteClicks: 'Website Clicks',
  profileLinkTaps: 'Profile Link Taps',
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  replies: 'Replies',
  followerGrowthPercent: 'Follower Growth (%)',
  averageReelViews: 'Average Reel Views',
  averageReelCompletionRate: 'Average Reel Completion Rate (%)',
  engagementRateFeedPosts: 'Engagement Rate (Feed Posts %)',
  reachPerPost: 'Reach Per Post',
  savesPerPostAverage: 'Saves Per Post (Average)',
  brandToneInCaptionsScore: 'Brand Tone in Captions (Score)',
  visualConsistencyCpBrandScore: 'Visual Consistency (Score)',
  logoAssetUsageComplianceScore: 'Logo/Asset Usage Compliance (Score)',
  reelContentQualityScore: 'Reel Content Quality (Score)',
  captionZeroErrorsScore: 'Caption Zero Errors (Score)',
};

// For each KPI type, show only the most relevant metrics
const KPI_TYPE_METRICS = {
  'Feed posts published per month': ['feedPostsPublished', 'likes', 'comments', 'engagementRateFeedPosts', 'reachPerPost', 'savesPerPostAverage'],
  'Reels published per month': ['reelsPublished', 'averageReelViews', 'averageReelCompletionRate', 'likes', 'comments'],
  'Story posts per week': ['storiesPublished', 'reach', 'accountsEngaged'],
  'Instagram follower growth': ['followersCount', 'followerGrowthPercent'],
  'Average Reel views': ['averageReelViews', 'reelsPublished'],
  'Engagement rate (feed posts)': ['engagementRateFeedPosts', 'feedPostsPublished', 'likes', 'comments'],
  'Reach per post (organic)': ['reachPerPost', 'feedPostsPublished'],
  'Saves per post (average)': ['savesPerPostAverage', 'feedPostsPublished'],
  // Add more mappings as needed
};


export default function KPIDetailsModal({ kpi, onClose }) {
  if (!kpi) return null;

  const tokenMetrics = kpi?.meta?.tokenMetrics || {};
  const kpiType = kpi.name;
  const metricKeys = KPI_TYPE_METRICS[kpiType] || Object.keys(tokenMetrics);
  const hasMetrics = metricKeys.length > 0 && Object.keys(tokenMetrics).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
          onClick={onClose}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-4">KPI Details</h2>
        <div className="space-y-2 mb-4">
          <div><span className="font-semibold">Name:</span> {kpi.name || '—'}</div>
          <div><span className="font-semibold">Category:</span> {kpi.category || '—'}</div>
          <div><span className="font-semibold">Unit:</span> {kpi.unit || '—'}</div>
          <div><span className="font-semibold">Frequency:</span> {kpi.frequency || '—'}</div>
          <div><span className="font-semibold">Target:</span> {kpi.target || '—'}</div>
          <div><span className="font-semibold">Status:</span> {kpi.status || '—'}</div>
          <div><span className="font-semibold">Due Date:</span> {kpi.dueDate || kpi.deadline || 'Ongoing'}</div>
          <div><span className="font-semibold">Assigned To:</span> {typeof kpi.assignedTo === 'object' && kpi.assignedTo !== null ? (kpi.assignedTo.name || kpi.assignedTo.username || kpi.assignedTo.email || kpi.assignedTo._id) : (kpi.assignedToName || kpi.assignedTo || '—')}</div>
          {kpi.description && <div><span className="font-semibold">Description:</span> {kpi.description}</div>}
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Key Metrics</h3>
          {hasMetrics ? (
            <ul className="space-y-1">
              {metricKeys.map((key) => (
                key in tokenMetrics ? (
                  <li key={key}>
                    <span className="font-medium text-slate-700">{METRIC_LABELS[key] || key}:</span> {typeof tokenMetrics[key] === 'object' ? JSON.stringify(tokenMetrics[key]) : tokenMetrics[key]}
                  </li>
                ) : null
              ))}
            </ul>
          ) : (
            <div className="text-slate-400 text-sm">No additional metrics available for this KPI.</div>
          )}
        </div>
      </div>
    </div>
  );
}
