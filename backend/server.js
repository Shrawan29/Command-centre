import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import userRoutes from "./routes/userRoutes.js";
import kpiRoutes from "./routes/kpiRoutes.js";
import verticalRoutes from "./routes/verticalRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import facebookRoutes from "./routes/facebookRoutes.js";
import { getCurrentMonthInstagramTokenMetrics } from "./utils/instagramTokenMetrics.js";



dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/kpis", kpiRoutes);
app.use("/api/verticals", verticalRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/facebook", facebookRoutes);


// Connect DB
connectDB();

// Test route
app.get("/", (req, res) => {
  res.send("Command Centre Backend Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Warm token metrics cache in background to reduce first KPI request latency.
  getCurrentMonthInstagramTokenMetrics({ useCache: true }).catch((error) => {
    console.warn(`Token metrics prewarm skipped: ${error?.message || error}`);
  });
});