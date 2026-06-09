require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/colleges", require("./routes/collegeRoute"));
app.use("/api/lessons", require("./routes/lessonRoute"));
app.use("/api/enrollments", require("./routes/enrollmentRoute"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
