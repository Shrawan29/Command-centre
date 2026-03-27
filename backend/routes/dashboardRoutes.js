import express from "express";
import { getDashboardOverview, getVerticalDashboard } from "../controllers/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Dashboard overview
router.get("/overview", protect, getDashboardOverview);

// Vertical dashboard
router.get("/vertical/:verticalId", protect, getVerticalDashboard);

export default router;