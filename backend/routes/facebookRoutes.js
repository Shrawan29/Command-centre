import express from "express";
import { getInstagramMetrics } from "../controllers/facebookController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Token-based Instagram metrics (no KPI mapping)
router.get("/instagram/metrics", protect, getInstagramMetrics);

export default router;
