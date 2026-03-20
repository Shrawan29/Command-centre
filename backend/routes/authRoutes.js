import express from "express";
import {
	googleAuth,
	loginWithPassword,
	bootstrapPasswordAuth,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/google", googleAuth);
router.post("/login", loginWithPassword);
router.post("/bootstrap", bootstrapPasswordAuth);

export default router;