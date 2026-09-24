// server.js - Universal Node entry point compatible with all Node.js versions & process managers (PM2 / systemd)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distServer = path.join(__dirname, "dist", "server.js");

if (fs.existsSync(distServer)) {
  await import("./dist/server.js");
} else {
  try {
    const { register } = await import("tsx/esm/api");
    register();
    await import("./server.ts");
  } catch (e) {
    console.error("Unable to load tsx runtime. Please execute 'npm run build' first to generate dist/server.js");
    process.exit(1);
  }
}
