const fs = require("fs");
const path = require("path");
const http = require("http");
const { google } = require("googleapis");
require("dotenv").config();

const CLIENT_FILE = path.resolve(
  process.env.GOOGLE_OAUTH_CLIENT_FILE
);

const TOKEN_FILE = path.join(
  __dirname,
  "google-oauth-token.json"
);

const SCOPES = [
  "https://www.googleapis.com/auth/drive"
];


// ============================================================
// LOAD GOOGLE OAUTH CLIENT
// ============================================================

const credentials = JSON.parse(
  fs.readFileSync(CLIENT_FILE, "utf8")
);

const config =
  credentials.installed ||
  credentials.web;

if (!config) {
  throw new Error(
    "Invalid Google OAuth client JSON."
  );
}

const oauth2Client = new google.auth.OAuth2(
  config.client_id,
  config.client_secret,
  "http://localhost:3000/oauth2callback"
);


// ============================================================
// AUTHORIZATION
// ============================================================

const authorize = async () => {

  const authUrl =
    oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES
    });

  console.log();
  console.log(
    "========================================"
  );
  console.log(
    "GOOGLE DRIVE AUTHORIZATION"
  );
  console.log(
    "========================================"
  );

  console.log();
  console.log(
    "Open this URL in your browser:"
  );

  console.log();
  console.log(authUrl);
  console.log();

  const server = http.createServer(
    async (req, res) => {

      if (
        !req.url.startsWith(
          "/oauth2callback"
        )
      ) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url = new URL(
        req.url,
        "http://localhost:3000"
      );

      const code =
        url.searchParams.get("code");

      const error =
        url.searchParams.get("error");

      if (error) {

        res.writeHead(400, {
          "Content-Type": "text/html"
        });

        res.end(
          "<h2>Authorization failed.</h2>"
        );

        server.close();

        console.error(
          "Google authorization error:",
          error
        );

        return;
      }

      if (!code) {

        res.writeHead(400);

        res.end(
          "Authorization code missing."
        );

        return;
      }

      try {

        const { tokens } =
          await oauth2Client.getToken(
            code
          );

        fs.writeFileSync(
          TOKEN_FILE,
          JSON.stringify(
            tokens,
            null,
            2
          )
        );

        res.writeHead(200, {
          "Content-Type": "text/html"
        });

        res.end(`
          <html>
            <body>
              <h2>PrintStation Google Drive authorization successful!</h2>
              <p>You can close this browser window.</p>
            </body>
          </html>
        `);

        console.log();
        console.log(
          "========================================"
        );
        console.log(
          "AUTHORIZATION SUCCESSFUL!"
        );
        console.log(
          "========================================"
        );

        console.log();
        console.log(
          "Token saved to:"
        );

        console.log(
          TOKEN_FILE
        );

        console.log();

        server.close();

      } catch (err) {

        console.error(
          "Failed to get OAuth token:"
        );

        console.error(
          err.message
        );

        res.writeHead(500);

        res.end(
          "Failed to complete authorization."
        );

        server.close();
      }
    }
  );

  server.listen(
    3000,
    "localhost",
    () => {

      console.log(
        "Waiting for Google authorization..."
      );

      console.log();
      console.log(
        "Your browser should open the Google login page."
      );
    }
  );
};


authorize();