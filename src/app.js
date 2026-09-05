require("dotenv").config();

const AgentStatus = require("./models/AgentStatus");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  createPrintJob,
  getAllPrintJobs,
  getPrintJobById,
  updatePrintJobStatus,
  getPendingPrintJobs,
  claimPrintJob,
  updateAgentJobStatus,
  cancelPrintJob
} = require("./services/printService");

const {
  uploadFileToDrive,
  downloadFileFromDrive
} = require("./google-services/googleDriveService");

const app = express();

// ============================================================
// CONFIGURATION
// ============================================================

const AGENT_KEY =
  process.env.PRINT_AGENT_KEY ||
  "printstation-agent-secret";

// ============================================================
// UPLOAD DIRECTORY
// ============================================================

const UPLOAD_DIR = path.resolve(
  __dirname,
  "..",
  "uploads"
);

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true
});

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173"
  })
);

app.use(express.json());

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    const extension =
      path.extname(file.originalname);

    const uniqueName =
      `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${extension}`;

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 20 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png"
    ];

    const extension =
      path.extname(
        file.originalname
      ).toLowerCase();

    if (
      allowedExtensions.includes(
        extension
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, JPG, JPEG and PNG files are allowed."
        )
      );
    }
  }
});

// ============================================================
// CHECK IF PRINT AGENT IS ONLINE
// ============================================================

const requireAgentOnline = async (
  req,
  res,
  next
) => {
  try {
    const agent =
      await AgentStatus.findOne({
        agentId: "default-agent"
      });

    // Agent has never connected
    if (
      !agent ||
      !agent.lastSeen
    ) {
      return res.status(503).json({
        message:
          "Printer is offline. Please start the Print Agent first."
      });
    }

    const now = Date.now();

    const lastSeen =
      new Date(
        agent.lastSeen
      ).getTime();

    const secondsSinceLastSeen =
      (now - lastSeen) / 1000;

    // Agent must have contacted
    // backend within last 15 seconds
    if (
      secondsSinceLastSeen > 15
    ) {
      return res.status(503).json({
        message:
          "Printer is offline. Please start the Print Agent first."
      });
    }

    next();

  } catch (error) {
    console.error(
      "Agent online check error:",
      error
    );

    return res.status(503).json({
      message:
        "Unable to verify printer status."
    });
  }
};

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message:
      "PrintStation backend is running"
  });
});

// ============================================================
// CUSTOMER PRINT API
// ============================================================

app.post(
  "/api/print",

  // IMPORTANT:
  // Check printer BEFORE accepting/uploading the file
  requireAgentOnline,

  upload.single("file"),

  async (req, res) => {
    let localFilePath = null;

    try {

      // ------------------------------------------------------
      // CHECK FILE
      // ------------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          message:
            "No file uploaded"
        });
      }

      localFilePath =
        req.file.path;

      // ------------------------------------------------------
      // GET BASIC PRINT SETTINGS
      // ------------------------------------------------------

      const printType =
        req.body.printType;

      const copies =
        Number(req.body.copies);

      // ------------------------------------------------------
      // VALIDATE PRINT TYPE
      // ------------------------------------------------------

      if (
        ![
          "black-white",
          "color"
        ].includes(printType)
      ) {

        if (
          localFilePath &&
          fs.existsSync(
            localFilePath
          )
        ) {
          fs.unlinkSync(
            localFilePath
          );
        }

        return res.status(400).json({
          message:
            "Invalid print type"
        });
      }

      // ------------------------------------------------------
      // VALIDATE COPIES
      // ------------------------------------------------------

      if (
        !Number.isInteger(copies) ||
        copies < 1 ||
        copies > 100
      ) {

        if (
          localFilePath &&
          fs.existsSync(
            localFilePath
          )
        ) {
          fs.unlinkSync(
            localFilePath
          );
        }

        return res.status(400).json({
          message:
            "Copies must be between 1 and 100"
        });
      }

      // ------------------------------------------------------
      // GET ADVANCED PRINT SETTINGS
      // ------------------------------------------------------

      const orientation =
        req.body.orientation ||
        "portrait";

      const paperSize =
        req.body.paperSize ||
        "A4";

      const fit =
        req.body.fit ||
        "shrink-to-fit";

      const pageMargins =
        req.body.pageMargins ||
        "uniform";

      const pageSelection =
        req.body.pageSelection ||
        "all";

      const pageRange =
        req.body.pageRange ||
        "";

      // ------------------------------------------------------
      // VALIDATE ORIENTATION
      // ------------------------------------------------------

      if (
        ![
          "portrait",
          "landscape"
        ].includes(orientation)
      ) {

        fs.unlinkSync(localFilePath);

        return res.status(400).json({
          message:
            "Invalid orientation"
        });
      }

      // ------------------------------------------------------
      // VALIDATE PAPER SIZE
      // ------------------------------------------------------

      if (
        ![
          "A4",
          "Letter",
          "Legal"
        ].includes(paperSize)
      ) {

        fs.unlinkSync(localFilePath);

        return res.status(400).json({
          message:
            "Invalid paper size"
        });
      }

      // ------------------------------------------------------
      // VALIDATE FIT
      // ------------------------------------------------------

      if (
        ![
          "shrink-to-fit",
          "fit-to-page",
          "actual-size"
        ].includes(fit)
      ) {

        fs.unlinkSync(localFilePath);

        return res.status(400).json({
          message:
            "Invalid fit option"
        });
      }

      // ------------------------------------------------------
      // VALIDATE PAGE MARGINS
      // ------------------------------------------------------

      if (
        ![
          "uniform",
          "none",
          "minimum"
        ].includes(pageMargins)
      ) {

        fs.unlinkSync(localFilePath);

        return res.status(400).json({
          message:
            "Invalid page margins"
        });
      }

      // ------------------------------------------------------
      // VALIDATE PAGE SELECTION
      // ------------------------------------------------------

      if (
        ![
          "all",
          "range"
        ].includes(pageSelection)
      ) {

        fs.unlinkSync(localFilePath);

        return res.status(400).json({
          message:
            "Invalid page selection"
        });
      }

      // ------------------------------------------------------
      // PAGE RANGE VALIDATION
      // ------------------------------------------------------

      if (
        pageSelection === "range" &&
        !pageRange.trim()
      ) {

        fs.unlinkSync(localFilePath);

        return res.status(400).json({
          message:
            "Page range is required"
        });
      }

      // ------------------------------------------------------
      // GENERATE JOB ID
      // ------------------------------------------------------

      const jobId =
        `PS${Math.floor(
          10000000 +
          Math.random() * 90000000
        )}`;

      console.log();

      console.log(
        "========================================"
      );

      console.log(
        "NEW PRINT REQUEST"
      );

      console.log(
        "========================================"
      );

      console.log(
        "Job ID:",
        jobId
      );

      console.log(
        "File:",
        req.file.originalname
      );

      console.log(
        "Print Type:",
        printType
      );

      console.log(
        "Copies:",
        copies
      );

      console.log(
        "Orientation:",
        orientation
      );

      console.log(
        "Paper Size:",
        paperSize
      );

      console.log(
        "Fit:",
        fit
      );

      console.log(
        "Page Margins:",
        pageMargins
      );

      console.log(
        "Page Selection:",
        pageSelection
      );

      console.log(
        "Page Range:",
        pageRange || "All"
      );

      // ------------------------------------------------------
      // UPLOAD TO GOOGLE DRIVE
      // ------------------------------------------------------

      console.log(
        "Uploading file to Google Drive..."
      );

      const driveFile =
        await uploadFileToDrive(
          localFilePath,
          req.file.originalname,
          req.file.mimetype
        );

      console.log(
        "Google Drive upload successful"
      );

      console.log(
        "Drive File ID:",
        driveFile.id
      );

      // ------------------------------------------------------
      // SAVE JOB IN MONGODB
      // ------------------------------------------------------

      const job =
        await createPrintJob({

          jobId,

          fileName:
            req.file.originalname,

          storedFileName:
            null,

          filePath:
            null,

          fileSize:
            req.file.size,

          googleDriveFileId:
            driveFile.id,

          googleDriveUrl:
            driveFile.webViewLink ||
            null,

          printType,

          copies,

          orientation,

          paperSize,

          fit,

          pageMargins,

          pageSelection,

          pageRange

        });

      // ------------------------------------------------------
      // DELETE LOCAL TEMPORARY FILE
      // ------------------------------------------------------

      if (
        localFilePath &&
        fs.existsSync(
          localFilePath
        )
      ) {

        fs.unlinkSync(
          localFilePath
        );

        localFilePath = null;
      }

      console.log(
        "Job saved successfully"
      );

      console.log(
        "Job ID:",
        job.jobId
      );

      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(201).json({

        message:
          "Print job created successfully",

        jobId:
          job.jobId,

        status:
          job.status,

        fileName:
          job.fileName

      });

    } catch (error) {

      console.error(
        "Print job error:",
        error
      );

      // Remove temporary file
      // if something failed

      if (
        localFilePath &&
        fs.existsSync(
          localFilePath
        )
      ) {

        try {

          fs.unlinkSync(
            localFilePath
          );

        } catch (deleteError) {

          console.error(
            "Could not delete temporary file:",
            deleteError.message
          );

        }
      }

      return res.status(500).json({

        message:
          "Failed to create print job",

        error:
          error.message

      });
    }
  }
);

// ============================================================
// CUSTOMER — CANCEL PRINT JOB
// ============================================================

app.patch(
  "/api/print/:id/cancel",

  async (req, res) => {

    try {

      const job =
        await cancelPrintJob(
          req.params.id
        );

      if (!job) {

        return res.status(409).json({
          message:
            "Job cannot be cancelled because it is already printing or has finished."
        });

      }

      console.log(
        "Print job cancelled:",
        job.jobId
      );

      return res.json({

        message:
          "Print job cancelled successfully.",

        job

      });

    } catch (error) {

      console.error(
        "Failed to cancel print job:",
        error
      );

      return res.status(500).json({

        message:
          "Failed to cancel print job."

      });
    }
  }
);

// ============================================================
// ADMIN — GET ALL JOBS
// ============================================================

app.get(
  "/api/admin/jobs",

  async (req, res) => {

    try {

      const jobs =
        await getAllPrintJobs();

      res.json(jobs);

    } catch (error) {

      console.error(
        "Admin jobs error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to get print jobs"
      });
    }
  }
);

// ============================================================
// ADMIN — GET SINGLE JOB
// ============================================================

app.get(
  "/api/admin/jobs/:id",

  async (req, res) => {

    try {

      const job =
        await getPrintJobById(
          req.params.id
        );

      if (!job) {

        return res.status(404).json({
          message:
            "Print job not found"
        });
      }

      res.json(job);

    } catch (error) {

      console.error(
        "Get job error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to get print job"
      });
    }
  }
);

// ============================================================
// ADMIN — UPDATE JOB STATUS
// ============================================================

app.patch(
  "/api/admin/jobs/:id/status",

  async (req, res) => {

    try {

      const {
        status
      } = req.body;

      const allowedStatuses = [
        "Pending",
        "Printing",
        "Completed",
        "Failed",
        "Cancelled"
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid status"
        });
      }

      const job =
        await updatePrintJobStatus(
          req.params.id,
          status
        );

      if (!job) {

        return res.status(404).json({
          message:
            "Print job not found"
        });
      }

      res.json(job);

    } catch (error) {

      console.error(
        "Status update error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update status"
      });
    }
  }
);

// ============================================================
// PRINT AGENT AUTHENTICATION
// ============================================================

const authenticateAgent = (
  req,
  res,
  next
) => {

  const key =
    req.headers["x-agent-key"];

  if (
    !key ||
    key !== AGENT_KEY
  ) {

    return res.status(401).json({
      message:
        "Unauthorized agent"
    });
  }

  next();
};

// ============================================================
// AGENT — GET PENDING JOBS
// ============================================================

app.get(
  "/api/agent/jobs/pending",

  authenticateAgent,

  async (req, res) => {

    try {

      // ------------------------------------------------------
      // RECORD AGENT ACTIVITY
      // ------------------------------------------------------

      await AgentStatus.findOneAndUpdate(

        {
          agentId:
            "default-agent"
        },

        {
          agentId:
            "default-agent",

          status:
            "online",

          lastSeen:
            new Date()
        },

        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

      // ------------------------------------------------------
      // GET PENDING PRINT JOBS
      // ------------------------------------------------------

      const jobs =
        await getPendingPrintJobs();

      res.json({

        count:
          jobs.length,

        jobs

      });

    } catch (error) {

      console.error(
        "Agent pending jobs error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to get pending jobs"
      });
    }
  }
);

// ============================================================
// CUSTOMER — CHECK PRINT AGENT STATUS
// ============================================================

app.get(
  "/api/agent/status",

  async (req, res) => {

    try {

      const agent =
        await AgentStatus.findOne({
          agentId:
            "default-agent"
        });

      // Agent has never connected

      if (
        !agent ||
        !agent.lastSeen
      ) {

        return res.json({

          online: false,

          status:
            "offline"

        });
      }

      const now =
        Date.now();

      const lastSeen =
        new Date(
          agent.lastSeen
        ).getTime();

      const secondsSinceLastSeen =
        (now - lastSeen) / 1000;

      // Agent must have contacted
      // backend within last 15 seconds

      const online =
        secondsSinceLastSeen <= 15;

      return res.json({

        online,

        status:
          online
            ? "online"
            : "offline",

        lastSeen:
          agent.lastSeen

      });

    } catch (error) {

      console.error(
        "Agent status error:",
        error
      );

      res.status(500).json({

        online: false,

        status:
          "offline",

        message:
          "Unable to check print service"

      });
    }
  }
);

// ============================================================
// AGENT — CLAIM JOB
// ============================================================

app.patch(
  "/api/agent/jobs/:id/claim",

  authenticateAgent,

  async (req, res) => {

    try {

      const job =
        await claimPrintJob(
          req.params.id
        );

      if (!job) {

        return res.status(409).json({
          message:
            "Job is no longer pending"
        });
      }

      res.json(job);

    } catch (error) {

      console.error(
        "Agent claim error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to claim job"
      });
    }
  }
);

// ============================================================
// AGENT — DOWNLOAD FILE FROM GOOGLE DRIVE
// ============================================================

app.get(
  "/api/agent/jobs/:id/file",

  authenticateAgent,

  async (req, res) => {

    let temporaryFile = null;

    try {

      const job =
        await getPrintJobById(
          req.params.id
        );

      if (!job) {

        return res.status(404).json({
          message:
            "Print job not found"
        });
      }

      if (
        !job.googleDriveFileId
      ) {

        return res.status(404).json({
          message:
            "Google Drive file not found for this job"
        });
      }

      // ------------------------------------------------------
      // MAKE SAFE FILE NAME
      // ------------------------------------------------------

      const safeFileName =
        path.basename(
          job.fileName
        );

      temporaryFile =
        path.join(
          UPLOAD_DIR,
          `agent-${Date.now()}-${safeFileName}`
        );

      console.log(
        `Downloading ${job.fileName} from Google Drive...`
      );

      // ------------------------------------------------------
      // DOWNLOAD FROM GOOGLE DRIVE
      // ------------------------------------------------------

      await downloadFileFromDrive(
        job.googleDriveFileId,
        temporaryFile
      );

      console.log(
        "Google Drive download successful"
      );

      // ------------------------------------------------------
      // SEND FILE TO PRINT AGENT
      // ------------------------------------------------------

      res.download(
        temporaryFile,
        safeFileName,

        (error) => {

          // --------------------------------------------------
          // DELETE TEMPORARY FILE
          // --------------------------------------------------

          if (
            temporaryFile &&
            fs.existsSync(
              temporaryFile
            )
          ) {

            try {

              fs.unlinkSync(
                temporaryFile
              );

            } catch (deleteError) {

              console.error(
                "Temporary file cleanup error:",
                deleteError.message
              );
            }
          }

          if (error) {

            console.error(
              "File download response error:",
              error.message
            );
          }
        }
      );

    } catch (error) {

      console.error(
        "Agent file error:",
        error
      );

      // ------------------------------------------------------
      // CLEANUP TEMPORARY FILE
      // ------------------------------------------------------

      if (
        temporaryFile &&
        fs.existsSync(
          temporaryFile
        )
      ) {

        try {

          fs.unlinkSync(
            temporaryFile
          );

        } catch (deleteError) {

          console.error(
            "Temporary file cleanup error:",
            deleteError.message
          );
        }
      }

      res.status(500).json({

        message:
          "Failed to download file",

        error:
          error.message

      });
    }
  }
);

// ============================================================
// AGENT — UPDATE STATUS
// ============================================================

app.patch(
  "/api/agent/jobs/:id/status",

  authenticateAgent,

  async (req, res) => {

    try {

      const {
        status
      } = req.body;

      const allowedStatuses = [
        "Completed",
        "Failed"
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {

        return res.status(400).json({
          message:
            "Agent can only set Completed or Failed"
        });
      }

      const job =
        await updateAgentJobStatus(
          req.params.id,
          status
        );

      if (!job) {

        return res.status(404).json({
          message:
            "Print job not found"
        });
      }

      res.json(job);

    } catch (error) {

      console.error(
        "Agent status error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update job status"
      });
    }
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "Server error:",
      error
    );

    // --------------------------------------------------------
    // MULTER FILE SIZE ERROR
    // --------------------------------------------------------

    if (
      error instanceof multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({
          message:
            "File size must be 20MB or less"
        });
      }
    }

    // --------------------------------------------------------
    // GENERAL ERROR
    // --------------------------------------------------------

    res.status(500).json({

      message:
        error.message ||
        "Something went wrong"

    });
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = app;