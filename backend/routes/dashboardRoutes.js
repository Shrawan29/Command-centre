import express from "express";
import { getVerticalDashboard } from "../controllers/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Vertical dashboard
router.get("/vertical/:verticalId", protect, getVerticalDashboard);

export default router;