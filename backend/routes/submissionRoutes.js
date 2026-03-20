import express from "express";
import {
  submitData,
  getKPIProgress,
  getAdminSubmissions,
} from "../controllers/submissionController.js";
import { sendKPIReport } from "../controllers/submissionController.js";


import { adminOnly, protect, vendorOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Submit weekly data
router.post("/", protect, vendorOnly, submitData);
router.get("/admin", protect, adminOnly, getAdminSubmissions);
router.get("/report/:kpiId", protect, sendKPIReport);

// Get KPI progress
router.get("/:kpiId", protect, getKPIProgress);

export default router;