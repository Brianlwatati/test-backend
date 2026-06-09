const jwt = require("jsonwebtoken");
const College = require("../models/College");

exports.createCollege = async (req, res) => {
  try {
    const { name, location, description, logoUrl } = req.body;  
    const college = new College({ name, location, description, logoUrl });
    await college.save();   
    res.status(201).json(college);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getColleges = async (req, res) => {
  try {
    const colleges = await College.find();
    res.json(colleges);
    } catch (error) {
    res.status(500).json({ message: error.message });
    }
};

exports.getCollegeById = async (req, res) => {
  try {
    const college = await College.findById(req.params.id);
    if (!college) {
      return res.status(404).json({ message: "College not found" });
    }
    res.json(college);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCollege = async (req, res) => {
  try {
    const { name, location, description, logoUrl } = req.body;
    const college = await College.findByIdAndUpdate(req.params.id, { name, location, description, logoUrl }, { new: true });
    if (!college) {
      return res.status(404).json({ message: "College not found" });
    }
    res.json(college);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCollege = async (req, res) => {
  try {
    const college = await College.findByIdAndDelete(req.params.id);
    if (!college) {
      return res.status(404).json({ message: "College not found" });
    }
    res.json({ message: "College deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

