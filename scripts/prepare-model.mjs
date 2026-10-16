import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";

const catalog = JSON.parse(
  await readFile(
    new URL("../src/model-source.json", import.meta.url),
    "utf8",
  ),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
for (const model of catalog.models) {
  const path = new URL(
    `../public/models/${model.category}.gen.json`,
    import.meta.url,
  );
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    /* Download on first preparation. */
  }
  if (!bytes || hash(bytes) !== model.sha256) {
    const response = await fetch(model.source, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error(`Model download failed: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== model.sha256)
      throw new Error(
        "Model checksum changed. Inspect the upstream asset before updating the pinned checksum.",
      );
    const checkpoint = JSON.parse(bytes.toString());
    if (checkpoint[0]?.name !== model.category || checkpoint[1]?.length !== 5)
      throw new Error("Unexpected checkpoint format.");
    await writeFile(new URL(`${path.href}.tmp`), bytes);
    await rename(new URL(`${path.href}.tmp`), path);
  }
  console.log(
    `${model.label} checkpoint ready: ${bytes.length} bytes; SHA-256 ${model.sha256}`,
  );
}
