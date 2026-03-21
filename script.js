import { google } from "googleapis";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

// Setup for __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_KEY = process.env.YOUTUBE_API;
const INPUT_FILE = "./playlist.js";
const OUTPUT_FILE = "playlist_metadata.json";

const youtube = google.youtube({
  version: "v3",
  auth: API_KEY,
});

// Function to get videoIds from source file (supports both JSON and JS source files)
async function getIdsFromFile(filePath) {
  const absolutePath = path.resolve(__dirname, filePath);
  const ext = path.extname(filePath);

  if (ext === ".js" || ext === ".mjs") {
    // Dynamic import for JS files
    // Adding a cache-buster (?update=...) if you run this in a long-lived process
    const module = await import(`file://${absolutePath}`);
    const data = module.default;
    return Array.isArray(data) ? data : data.videoIds;
  } else {
    // File system read for JSON
    const content = await fs.readFile(absolutePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.videoIds;
  }
}

// Function to fetch metadata from an array of videoIds
async function fetchMetadata() {
  try {
    const videoIds = await getIdsFromFile(INPUT_FILE);

    if (!videoIds || videoIds.length === 0) {
      throw new Error("No video IDs found in the input file.");
    }

    console.log(`Fetching metadata for ${videoIds.length} videos...`);

    // Chunking logic (50 IDs per request)
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50));
    }

    let allMetadata = [];

    for (const [index, chunk] of chunks.entries()) {
      const response = await youtube.videos.list({
        id: chunk.join(","),
        part: "snippet,statistics,contentDetails",
      });

      allMetadata.push(...response.data.items);
      console.log(`Processed batch ${index + 1}/${chunks.length}`);
    }

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(allMetadata, null, 2));
    console.log(`\nSuccess! Saved to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

fetchMetadata();
