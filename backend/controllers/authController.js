import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    // Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { sub, name, email } = payload;

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId: sub,
      });
    }

    res.status(200).json({
      message: "Login successful",
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Google auth failed",
      error: error.message,
    });
  }
};

export const loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      agencyType: user.agencyType,
      contractValue: user.contractValue,
      engagementStart: user.engagementStart,
      engagementEnd: user.engagementEnd,
      primaryContact: user.primaryContact,
      profileScore: user.profileScore,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(200).json({ message: "Login successful", user: safeUser });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// One-time setup helper: only allowed when no passwordHash users exist.
export const bootstrapPasswordAuth = async (req, res) => {
  try {
    const existing = await User.countDocuments({
      passwordHash: { $exists: true, $ne: null },
    });

    if (existing > 0) {
      return res.status(403).json({ message: "Bootstrap disabled" });
    }

    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          email,
          role: role || "admin",
          passwordHash,
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: "Bootstrap successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Bootstrap failed",
      error: error.message,
    });
  }
};