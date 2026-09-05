const mongoose = require("mongoose");

const printJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    storedFileName: {
      type: String,
      required: false,
    },

    filePath: {
      type: String,
      required: false,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    googleDriveFileId: {
      type: String,
      required: true,
    },

    googleDriveUrl: {
      type: String,
      default: null,
    },

    printType: {
      type: String,
      enum: ["black-white", "color"],
      required: true,
    },

    copies: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    orientation: {
      type: String,
      enum: ["portrait", "landscape"],
      default: "portrait",
    },

    paperSize: {
      type: String,
      enum: ["A4", "Letter", "Legal"],
      default: "A4",
    },

    fit: {
      type: String,
      enum: [
        "shrink-to-fit",
        "fit-to-page",
        "actual-size",
      ],
      default: "shrink-to-fit",
    },

    pageMargins: {
      type: String,
      enum: ["uniform", "none", "minimum"],
      default: "uniform",
    },

    pageSelection: {
      type: String,
      enum: ["all", "range"],
      default: "all",
    },

    pageRange: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Printing",
        "Completed",
        "Failed",
        "Cancelled",
      ],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

const PrintJob = mongoose.model(
  "PrintJob",
  printJobSchema
);

module.exports = PrintJob;