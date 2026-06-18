import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const source = path.join(frontendRoot, "public");
const dist = path.join(frontendRoot, "dist");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of fs.readdirSync(source)) {
  fs.cpSync(path.join(source, entry), path.join(dist, entry), { recursive: true });
}

const required = ["index.html", "app.js", "styles.css"];
for (const file of required) {
  if (!fs.existsSync(path.join(dist, file))) {
    throw new Error(`Build missing ${file}`);
  }
}

console.log(`Frontend build complete: ${dist}`);
