const PrintJob = require("../models/PrintJob");

// ========================================
// CREATE PRINT JOB
// ========================================

const createPrintJob = async (jobData) => {
  const job = await PrintJob.create({
    jobId: jobData.jobId,

    fileName: jobData.fileName,

    storedFileName:
      jobData.storedFileName || null,

    filePath:
      jobData.filePath || null,

    fileSize: jobData.fileSize,

    googleDriveFileId:
      jobData.googleDriveFileId,

    googleDriveUrl:
      jobData.googleDriveUrl || null,

    // Basic print settings
    printType: jobData.printType,

    copies: jobData.copies,

    // Advanced print settings
    orientation:
      jobData.orientation || "portrait",

    paperSize:
      jobData.paperSize || "A4",

    fit:
      jobData.fit || "shrink-to-fit",

    pageMargins:
      jobData.pageMargins || "uniform",

    pageSelection:
      jobData.pageSelection || "all",

    pageRange:
      jobData.pageRange || "",

    // Initial status
    status: "Pending",
  });

  return job;
};

// ========================================
// GET ALL PRINT JOBS
// ========================================

const getAllPrintJobs = async () => {
  return await PrintJob.find().sort({
    createdAt: -1,
  });
};

// ========================================
// GET PRINT JOB BY ID
// ========================================

const getPrintJobById = async (jobId) => {
  return await PrintJob.findOne({
    jobId,
  });
};

// ========================================
// UPDATE PRINT JOB STATUS
// ========================================

const updatePrintJobStatus = async (
  jobId,
  status
) => {
  return await PrintJob.findOneAndUpdate(
    { jobId },
    { status },
    { new: true }
  );
};

// ========================================
// GET PENDING PRINT JOBS
// ========================================

const getPendingPrintJobs = async () => {
  return await PrintJob.find({
    status: "Pending",
  }).sort({
    createdAt: 1,
  });
};

// ========================================
// CLAIM PRINT JOB
// ========================================

const claimPrintJob = async (jobId) => {
  return await PrintJob.findOneAndUpdate(
    {
      jobId,
      status: "Pending",
    },
    {
      status: "Printing",
    },
    {
      new: true,
    }
  );
};

// ========================================
// UPDATE AGENT JOB STATUS
// ========================================

const updateAgentJobStatus = async (
  jobId,
  status
) => {
  return await PrintJob.findOneAndUpdate(
    { jobId },
    { status },
    { new: true }
  );
};

const cancelPrintJob = async (jobId) => {
  return await PrintJob.findOneAndUpdate(
    {
      jobId,
      status: "Pending",
    },
    {
      status: "Cancelled",
    },
    {
      new: true,
    }
  );
};

module.exports = {
  createPrintJob,
  getAllPrintJobs,
  getPrintJobById,
  updatePrintJobStatus,
  getPendingPrintJobs,
  claimPrintJob,
  updateAgentJobStatus,
  cancelPrintJob,
};