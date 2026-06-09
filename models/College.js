const mongoose = require("mongoose");

const collegeSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true
    },
    location: String,
    description: String,
    logoUrl: String
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "College",
    collegeSchema
);