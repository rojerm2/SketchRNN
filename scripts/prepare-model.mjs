import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";

const url =
  "https://storage.googleapis.com/quickdraw-models/sketchRNN/models/cat.gen.json";
const expected =
  "54d83b0b790323eb758739d7c685f12e1a68740361f35e451a3e0cee1b577ae9";
const path = new URL("../public/models/cat.gen.json", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
let bytes;
try {
  bytes = await readFile(path);
} catch {
  /* Download on first preparation. */
}
if (!bytes || hash(bytes) !== expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok)
    throw new Error(`Model download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== expected)
    throw new Error(
      "Model checksum changed. Inspect the upstream asset before updating the pinned checksum.",
    );
  const checkpoint = JSON.parse(bytes.toString());
  if (checkpoint[0]?.name !== "cat" || checkpoint[1]?.length !== 5)
    throw new Error("Unexpected checkpoint format.");
  await writeFile(new URL(`${path.href}.tmp`), bytes);
  await rename(new URL(`${path.href}.tmp`), path);
}
console.log(`Cat checkpoint ready: ${bytes.length} bytes; SHA-256 ${expected}`);
