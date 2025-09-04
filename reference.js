const express = require("express");
const axios = require("axios");
const OTPAuth = require("otpauth");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8058;

const SP_DC = `AQCgDStrc8we9Uvegr-GyqX-CRJWPLIMVyLgh3bQ7Mo2m9HLgm8mQSQ3OEjwxsPgJOjuECUBKlbe4OQXrHWm_l2mx7zCUzEQvsTbGbWV4WL2PR_tGQ1xtq2UYv9YE3I9EJbg3vf6I_cTX-38zU6SFV9hodfmOuFNsTM0mKO6lZAWsv-TbCAL5oZPSj_ksOcFQwyz2rR8TJON5KYVM7Q`;
const SECRETS_URL =
  "https://raw.githubusercontent.com/Thereallo1026/spotify-secrets/refs/heads/main/secrets/secretDict.json";

let authToken = "";

// -------------------- TOTP MANAGEMENT --------------------
let currentTotp = null;
let currentTotpVersion = null;
let lastFetchTime = 0;
const FETCH_INTERVAL = 60 * 60 * 1000; // 1 hour

initializeTOTPSecrets();
setInterval(updateTOTPSecrets, FETCH_INTERVAL);

async function initializeTOTPSecrets() {
  try {
    await updateTOTPSecrets();
  } catch (error) {
    console.error("Failed to initialize TOTP secrets:", error);
    useFallbackSecret();
  }
}

async function updateTOTPSecrets() {
  try {
    const now = Date.now();
    if (now - lastFetchTime < FETCH_INTERVAL) return;

    console.log("Fetching updated TOTP secrets...");
    const secrets = await fetchSecretsFromGitHub();
    const newestVersion = findNewestVersion(secrets);

    if (newestVersion && newestVersion !== currentTotpVersion) {
      const secretData = secrets[newestVersion];
      const totpSecret = createTotpSecret(secretData);

      currentTotp = new OTPAuth.TOTP({
        period: 30,
        digits: 6,
        algorithm: "SHA1",
        secret: totpSecret,
      });

      currentTotpVersion = newestVersion;
      lastFetchTime = now;
      console.log(`TOTP secrets updated to version ${newestVersion}`);

      if (!authToken) {
        console.log("No auth token after TOTP update, reauthenticating...");
        await refreshAuthToken();
      }
    } else {
      console.log(`No new TOTP secrets found, using version ${newestVersion}`);
    }
  } catch (error) {
    console.error("Failed to update TOTP secrets:", error);
    if (!currentTotp) useFallbackSecret();
  }
}

async function fetchSecretsFromGitHub() {
  const response = await axios.get(SECRETS_URL, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return response.data;
}

function findNewestVersion(secrets) {
  const versions = Object.keys(secrets).map(Number);
  return Math.max(...versions).toString();
}

function createTotpSecret(data) {
  const mappedData = data.map((value, index) => value ^ ((index % 33) + 9));
  const hexData = Buffer.from(mappedData.join(""), "utf8").toString("hex");
  return OTPAuth.Secret.fromHex(hexData);
}

function useFallbackSecret() {
  const fallbackData = [
    99, 111, 47, 88, 49, 56, 118, 65, 52, 67, 50, 104, 117, 101, 55, 94, 95, 75,
    94, 49, 69, 36, 85, 64, 74, 60,
  ];
  const totpSecret = createTotpSecret(fallbackData);

  currentTotp = new OTPAuth.TOTP({
    period: 30,
    digits: 6,
    algorithm: "SHA1",
    secret: totpSecret,
  });

  currentTotpVersion = "19";
  console.log("Using fallback TOTP secret");
}

function generateTOTP(timestamp) {
  if (!currentTotp) throw new Error("TOTP not initialized");
  return currentTotp.generate({ timestamp });
}

// -------------------- AUTHENTICATION --------------------
async function getServerTime() {
  try {
    const { data } = await axios.get(
      "https://open.spotify.com/api/server-time",
      {
        headers: {
          "User-Agent": userAgent(),
          Origin: "https://open.spotify.com/",
          Referer: "https://open.spotify.com/",
          Cookie: `sp_dc=${SP_DC}`,
        },
      }
    );

    const time = Number(data.serverTime);
    if (isNaN(time)) throw new Error("Invalid server time");
    return time * 1000;
  } catch {
    return Date.now();
  }
}

async function generateAuthPayload(
  reason = "init",
  productType = "mobile-web-player"
) {
  const localTime = Date.now();
  const serverTime = await getServerTime();
  console.log("Generating auth payload")
  console.log(currentTotpVersion);
  console.log(reason);
  console.log(productType);
  return {
    reason,
    productType,
    totp: generateTOTP(localTime),
    totpVer: currentTotpVersion || "19",
    totpServer: generateTOTP(Math.floor(serverTime / 30) * 30000),
  };
}

async function spotifyAuth() {
  try {
    const payload = await generateAuthPayload();
    const url = new URL("https://open.spotify.com/api/token");
    Object.entries(payload).forEach(([k, v]) => url.searchParams.append(k, v));

    const response = await axios.get(url.toString(), {
      headers: {
        "User-Agent": userAgent(),
        Origin: "https://open.spotify.com/",
        Referer: "https://open.spotify.com/",
        Cookie: `sp_dc=${SP_DC}`,
      },
    });

    if (response.data?.accessToken) return response.data.accessToken;
    console.error("No access token in response:", response.data);
    return false;
  } catch (error) {
    console.error("Error fetching authentication:", error.message);

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
      console.error("Body:", error.response.data);
    }

    return false;
  }
}

async function refreshAuthToken() {
  const auth = await spotifyAuth();
  if (auth) {
    authToken = `Bearer ${auth}`;
    console.log("Auth token refreshed");
  } else {
    console.error("Failed to refresh auth token");
  }
}

setInterval(refreshAuthToken, 30 * 60 * 1000);
refreshAuthToken();

// -------------------- CANVAS API (protobuf version) --------------------
async function getCanvases(trackUri) {
  try {
    // Lazy import protobuf definitions
    const { CanvasRequest, CanvasResponse } = (await import("./proto/_canvas_pb.cjs")).default;

    const accessToken = authToken.replace("Bearer ", "");

    const canvasRequest = new CanvasRequest();
    const track = new CanvasRequest.Track();
    track.setTrackUri(trackUri);
    canvasRequest.addTracks(track);

    const requestBytes = canvasRequest.serializeBinary();

    const response = await axios.post(
      "https://spclient.wg.spotify.com/canvaz-cache/v0/canvases",
      requestBytes,
      {
        responseType: "arraybuffer",
        headers: {
          Accept: "application/protobuf",
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept-Language": "en",
          "User-Agent": "Spotify/9.0.34.593 iOS/18.4 (iPhone15,3)",
          "Accept-Encoding": "gzip, deflate, br",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status !== 200) {
      console.error(
        `Canvas fetch failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const parsed = CanvasResponse.deserializeBinary(response.data).toObject();
    return parsed;
  } catch (error) {
    console.error("Canvas request error:", error);
    return null;
  }
}

app.get("/canvas/:id", async (req, res) => {
  if (!authToken)
    return res.status(401).json({ error: "Auth token not available." });

  const trackUri = `spotify:track:${req.params.id}`;
  const result = await getCanvases(trackUri);

  if (result.canvasesList[0]) res.json({ canvasUrl: result.canvasesList[0].canvasUrl });
  else res.status(500).json({ error: "Failed to fetch canvas" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// -------------------- HELPERS --------------------
function userAgent() {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";
}