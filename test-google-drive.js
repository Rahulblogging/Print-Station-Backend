require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  uploadFileToDrive
} = require("./src/google-services/googleDriveService");


const test = async () => {

  try {

    const testFile = path.join(
      __dirname,
      "test-drive.txt"
    );

    fs.writeFileSync(
      testFile,
      "PrintStation Google Drive test"
    );

    console.log(
      "Uploading test file..."
    );

    const result =
      await uploadFileToDrive(
        testFile,
        "PrintStation-Test.txt",
        "text/plain"
      );

    console.log(
      "Upload successful!"
    );

    console.log(
      "File ID:",
      result.id
    );

    console.log(
      "File name:",
      result.name
    );

    console.log(
      "Drive link:",
      result.webViewLink
    );

    fs.unlinkSync(
      testFile
    );

  } catch (error) {

    console.error(
      "Google Drive upload failed:"
    );

    console.error(
      error.message
    );
  }
};


test();