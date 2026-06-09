const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
{
    title: String,
    description: String,

    collegeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "College"
    },

    capacity: Number,
    instructor: String,
    schedule: Date,
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "Lesson",
    lessonSchema
);