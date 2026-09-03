const mongoose = require("mongoose");

const printJobSchema = new mongoose.Schema(
  {
    // ========================================================
    // JOB ID
    // ========================================================

    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // ========================================================
    // FILE INFORMATION
    // ========================================================

    fileName: {
      type: String,
      required: true
    },

    storedFileName: {
      type: String,
      required: false
    },

    filePath: {
      type: String,
      required: false
    },

    fileSize: {
      type: Number,
      required: true
    },

    // ========================================================
    // GOOGLE DRIVE
    // ========================================================

    googleDriveFileId: {
      type: String,
      required: true
    },

    googleDriveUrl: {
      type: String,
      default: null
    },

    // ========================================================
    // PRINT SETTINGS
    // ========================================================

    printType: {
      type: String,
      enum: [
        "black-white",
        "color"
      ],
      required: true
    },

    copies: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },

    // ========================================================
    // STATUS
    // ========================================================

    status: {
      type: String,
      enum: [
        "Pending",
        "Printing",
        "Completed",
        "Failed"
      ],
      default: "Pending"
    }
  },
  {
    timestamps: true
  }
);


const PrintJob =
  mongoose.model(
    "PrintJob",
    printJobSchema
  );


module.exports = PrintJob;