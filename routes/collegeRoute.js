
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createCollege,
  getColleges,
  getCollegeById,
  updateCollege,
  deleteCollege,
} = require("../controllers/collegeController");

router.use(auth);

router.post("/", createCollege);
router.get("/", getColleges);
router.get("/:id", getCollegeById);
router.put("/:id", updateCollege);
router.delete("/:id", deleteCollege);


module.exports = router;