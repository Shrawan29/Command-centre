import Vertical from "../models/Vertical.js";
import KPI from "../models/KPI.js";

// @desc   Create Vertical
export const createVertical = async (req, res) => {
  try {
    const { name, description } = req.body;

    const vertical = await Vertical.create({
      name,
      description,
      createdBy: req.body.createdBy || null,
    });

    res.status(201).json({
      message: "Vertical created successfully",
      vertical,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating vertical",
      error: error.message,
    });
  }
};

// @desc   Get all Verticals
export const getVerticals = async (req, res) => {
  try {
    let verticals;

    // 🧑‍💼 Admin → all verticals
    if (req.user.role === "admin") {
      verticals = await Vertical.find();
    }

    // 🏢 Vendor → only assigned verticals
    else {
      const kpis = await KPI.find({ assignedTo: req.user._id });

      const verticalIds = [...new Set(kpis.map(k => k.vertical.toString()))];

      verticals = await Vertical.find({ _id: { $in: verticalIds } });
    }

    res.status(200).json(verticals);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching verticals",
      error: error.message,
    });
  }
};

// @desc   Get single Vertical
export const getVerticalById = async (req, res) => {
  try {
    const { id } = req.params;

    const vertical = await Vertical.findById(id);

    res.status(200).json(vertical);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching vertical",
      error: error.message,
    });
  }
};

// @desc   Update Vertical
export const updateVertical = async (req, res) => {
  try {
    const { id } = req.params;

    const vertical = await Vertical.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    res.status(200).json(vertical);
  } catch (error) {
    res.status(500).json({
      message: "Error updating vertical",
      error: error.message,
    });
  }
};

// @desc   Delete Vertical
export const deleteVertical = async (req, res) => {
  try {
    const { id } = req.params;

    await Vertical.findByIdAndDelete(id);

    res.status(200).json({
      message: "Vertical deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting vertical",
      error: error.message,
    });
  }
};