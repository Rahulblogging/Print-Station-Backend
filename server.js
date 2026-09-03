require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/db/connectDB");

// ==================================================
// PORT
// ==================================================

const PORT = process.env.PORT || 5000;

// ==================================================
// START SERVER
// ==================================================

const startServer = async () => {
  try {
    // Connect MongoDB first
    await connectDB();

    // Start Express
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `PrintStation server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start PrintStation server:",
      error
    );

    process.exit(1);
  }
};

startServer();