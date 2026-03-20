import User from "../models/User.js";
import bcrypt from "bcryptjs";

// @desc   Create or Login User (for now simple)
export const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      googleId,
      role,
      agencyType,
      contractValue,
      engagementStart,
      engagementEnd,
      primaryContact,
    } = req.body;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Check if user already exists
    let user = await User.findOne({ email }).select("+passwordHash");

    if (user) {
      user.passwordHash = await bcrypt.hash(password, 10);
      if (role) user.role = role;
      if (name) user.name = name;
      if (googleId) user.googleId = googleId;
      if (agencyType !== undefined) user.agencyType = agencyType;
      if (contractValue !== undefined) user.contractValue = Number(contractValue) || 0;
      if (engagementStart !== undefined) user.engagementStart = engagementStart || null;
      if (engagementEnd !== undefined) user.engagementEnd = engagementEnd || null;
      if (primaryContact !== undefined) user.primaryContact = primaryContact;
      await user.save();

      return res.status(200).json({
        message: "User updated successfully",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          googleId: user.googleId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    }

    // Create new user
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name,
      email,
      googleId,
      ...(role ? { role } : {}),
      ...(agencyType !== undefined ? { agencyType } : {}),
      ...(contractValue !== undefined ? { contractValue: Number(contractValue) || 0 } : {}),
      ...(engagementStart !== undefined ? { engagementStart: engagementStart || null } : {}),
      ...(engagementEnd !== undefined ? { engagementEnd: engagementEnd || null } : {}),
      ...(primaryContact !== undefined ? { primaryContact } : {}),
      passwordHash,
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating user",
      error: error.message,
    });
  }
};

// @desc   Get all users (Admin)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-__v");

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// @desc   Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      password,
      agencyType,
      contractValue,
      engagementStart,
      engagementEnd,
      primaryContact,
    } = req.body;

    const next = {};
    if (name !== undefined) next.name = name;
    if (role !== undefined) next.role = role;
    if (agencyType !== undefined) next.agencyType = agencyType;
    if (contractValue !== undefined) next.contractValue = Number(contractValue) || 0;
    if (engagementStart !== undefined) next.engagementStart = engagementStart || null;
    if (engagementEnd !== undefined) next.engagementEnd = engagementEnd || null;
    if (primaryContact !== undefined) next.primaryContact = primaryContact;
    if (password) {
      next.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(
      id,
      next,
      { new: true }
    );

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Error updating user",
      error: error.message,
    });
  }
};

// @desc   Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await User.findByIdAndDelete(id);

    res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting user",
      error: error.message,
    });
  }
};