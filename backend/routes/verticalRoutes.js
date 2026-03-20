import express from "express";
import {
  createVertical,
  getVerticals,
  getVerticalById,
  updateVertical,
  deleteVertical,
} from "../controllers/verticalController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// CRUD routes
// Admin + Vendor can view
router.get("/", protect, getVerticals);

// Admin only actions
router.post("/", protect, adminOnly, createVertical);
router.put("/:id", protect, adminOnly, updateVertical);
router.delete("/:id", protect, adminOnly, deleteVertical);

// Optional: single vertical
router.get("/:id", protect, getVerticalById);

export default router;