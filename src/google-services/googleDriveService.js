const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// ==========================================
// CONFIGURATION
// ==========================================

const BACKEND_DIR = path.resolve(
  __dirname,
  "..",
  ".."
);

// ==========================================
// CREATE OAUTH CLIENT
// ==========================================

const createOAuthClient = () => {
  // ------------------------------------------
  // OPTION 1: ENVIRONMENT VARIABLES
  // Used when deployed on Render
  // ------------------------------------------

  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    const oauth2Client =
      new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

    oauth2Client.setCredentials({
      refresh_token:
        process.env.GOOGLE_REFRESH_TOKEN
    });

    console.log(
      "Google Drive: Using environment variables"
    );

    return oauth2Client;
  }

  // ------------------------------------------
  // OPTION 2: LOCAL JSON FILES
  // Used on your local PC
  // ------------------------------------------

  const clientFileName =
    process.env.GOOGLE_OAUTH_CLIENT_FILE ||
    "google-oauth-client.json";

  const clientFile =
    path.resolve(
      BACKEND_DIR,
      clientFileName
    );

  const tokenFile =
    path.resolve(
      BACKEND_DIR,
      "google-oauth-token.json"
    );

  if (!fs.existsSync(clientFile)) {
    throw new Error(
      `Google OAuth client file not found:\n${clientFile}`
    );
  }

  if (!fs.existsSync(tokenFile)) {
    throw new Error(
      `Google OAuth token file not found:\n${tokenFile}\n` +
      `Run authorize-google-drive.js first.`
    );
  }

  // ------------------------------------------
  // LOAD CLIENT JSON
  // ------------------------------------------

  const credentials =
    JSON.parse(
      fs.readFileSync(
        clientFile,
        "utf8"
      )
    );

  const config =
    credentials.installed ||
    credentials.web;

  if (!config) {
    throw new Error(
      "Invalid Google OAuth client JSON."
    );
  }

  const oauth2Client =
    new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      "http://localhost:3000/oauth2callback"
    );

  // ------------------------------------------
  // LOAD TOKEN
  // ------------------------------------------

  const token =
    JSON.parse(
      fs.readFileSync(
        tokenFile,
        "utf8"
      )
    );

  oauth2Client.setCredentials(
    token
  );

  console.log(
    "Google Drive: Using local JSON files"
  );

  return oauth2Client;
};

// ==========================================
// GOOGLE DRIVE CLIENT
// ==========================================

const oauth2Client =
  createOAuthClient();

const drive = google.drive({
  version: "v3",
  auth: oauth2Client
});

// ==========================================
// UPLOAD FILE
// ==========================================

const uploadFileToDrive = async (
  filePath,
  fileName,
  mimeType
) => {

  const response =
    await drive.files.create({
      requestBody: {
        name: fileName,

        parents: [
          process.env.GOOGLE_DRIVE_FOLDER_ID
        ]
      },

      media: {
        mimeType,

        body:
          fs.createReadStream(
            filePath
          )
      },

      fields:
        "id,name,mimeType,size,webViewLink"
    });

  return response.data;
};

// ==========================================
// DOWNLOAD FILE
// ==========================================

const downloadFileFromDrive = async (
  fileId,
  destinationPath
) => {

  const response =
    await drive.files.get(
      {
        fileId,

        alt: "media"
      },

      {
        responseType: "stream"
      }
    );

  return new Promise(
    (resolve, reject) => {

      const destination =
        fs.createWriteStream(
          destinationPath
        );

      response.data
        .pipe(destination)

        .on(
          "finish",
          resolve
        )

        .on(
          "error",
          reject
        );
    }
  );
};

// ==========================================
// DELETE FILE
// ==========================================

const deleteFileFromDrive = async (
  fileId
) => {

  await drive.files.delete({
    fileId
  });
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  uploadFileToDrive,
  downloadFileFromDrive,
  deleteFileFromDrive
};