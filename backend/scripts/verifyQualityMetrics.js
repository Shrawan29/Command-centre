import dotenv from "dotenv";
import mongoose from "mongoose";
import { getCurrentMonthInstagramTokenMetrics } from "../utils/instagramTokenMetrics.js";

dotenv.config({ quiet: true });

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is missing in backend/.env");
}

await mongoose.connect(process.env.MONGO_URI);

const payload = await getCurrentMonthInstagramTokenMetrics({ useCache: false });

console.log(
  JSON.stringify(
    {
      window: payload?.window || null,
      quality: {
        brandToneInCaptionsScore: payload?.metrics?.brandToneInCaptionsScore,
        visualConsistencyCpBrandScore: payload?.metrics?.visualConsistencyCpBrandScore,
        logoAssetUsageComplianceScore: payload?.metrics?.logoAssetUsageComplianceScore,
        reelContentQualityScore: payload?.metrics?.reelContentQualityScore,
        captionZeroErrorsScore: payload?.metrics?.captionZeroErrorsScore,
      },
      mediaPublished: payload?.metrics?.mediaPublished,
      source: payload?.source,
      warnings: payload?.warnings || [],
    },
    null,
    2
  )
);

await mongoose.disconnect();
