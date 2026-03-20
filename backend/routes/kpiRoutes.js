import express from "express";
import {
  createKPI,
  getKPIs,
  getMyKPIs,
  updateKPI,
  deleteKPI,
} from "../controllers/kpiController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin routes
router.post("/", protect, adminOnly, createKPI);
router.get("/", protect, adminOnly, getKPIs);
router.put("/:id", protect, adminOnly, updateKPI);
router.delete("/:id", protect, adminOnly, deleteKPI);

// Agency route
router.get("/my", protect, getMyKPIs);

export default router;