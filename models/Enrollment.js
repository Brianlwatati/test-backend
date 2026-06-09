const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
{
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson"
    },

    status: {
        type: String,
        default: "active"
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "Enrollment",
    enrollmentSchema
);