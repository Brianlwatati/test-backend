const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const {
  getMatches,
  getMatchById,
  updateMatch,
  deleteMatch,
  getTeamMatchResultsByMatchday,
} = require("../controllers/matches/matchController");

const {
  createMatch,
  updateMatchResult,
  updateMatchResultBatch,
} = require("../controllers/matches/createMatch");

// router.use(auth);

router.post("/", createMatch);
router.get("/", getMatches);
router.get("/results/table", getTeamMatchResultsByMatchday);
router.get("/:id", getMatchById);
router.put("/:id", updateMatch);
router.put("/result/single", updateMatchResult);
router.post("/result/batch", updateMatchResultBatch);
router.delete("/:id", deleteMatch);

module.exports = router;
