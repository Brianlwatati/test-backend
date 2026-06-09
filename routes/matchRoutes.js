const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const {
  createMatch,
  getMatches,
  getMatchById,
  updateMatch,
  deleteMatch,
} = require("../controllers/matches/matchController");

router.use(auth);

router.post("/", createMatch);
router.get("/", getMatches);
router.get("/:id", getMatchById);
router.put("/:id", updateMatch);
router.delete("/:id", deleteMatch);

module.exports = router;
