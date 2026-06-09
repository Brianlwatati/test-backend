
const router = express.Router();

// Define your lesson routes here
router.get("/", (req, res) => {
  res.send("Lessons endpoint");
});

module.exports = router;