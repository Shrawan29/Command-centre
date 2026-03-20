import User from "../models/User.js";

// 🔐 Verify User
export const protect = async (req, res, next) => {
  try {
    const userId = req.headers.userid || req.headers.userId;

    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;

    next();
  } catch (error) {
    res.status(500).json({
      message: "Auth error",
      error: error.message,
    });
  }
};

// 🧑‍💼 Admin Only
export const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }

  next();
};

// 🏢 Vendor Only
export const vendorOnly = (req, res, next) => {
  if (req.user.role !== "agency") {
    return res.status(403).json({ message: "Vendor access only" });
  }

  next();
};