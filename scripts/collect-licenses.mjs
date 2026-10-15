import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const packages = [
  "@magenta/sketch",
  "@tensorflow/tfjs",
  "@tensorflow/tfjs-core",
  "@tensorflow/tfjs-data",
  "@tensorflow/tfjs-layers",
  "@tensorflow/tfjs-converter",
  "seedrandom",
  "react",
  "react-dom",
  "scheduler",
];
const sections = [];
for (const name of packages) {
  const root = dirname(require.resolve(`${name}/package.json`));
  let license;
  for (const file of ["LICENSE", "LICENSE.txt", "LICENSE.md"]) {
    try {
      license = await readFile(join(root, file), "utf8");
      break;
    } catch {
      /* Try the package's next conventional license name. */
    }
  }
  if (!license && name === "@magenta/sketch")
    license = await readFile(
      new URL("../public/LICENSE-MAGENTA.txt", import.meta.url),
      "utf8",
    );
  if (!license && name.startsWith("@tensorflow/"))
    license = await readFile(
      new URL("../public/LICENSE-TENSORFLOW.txt", import.meta.url),
      "utf8",
    );
  if (!license && name === "seedrandom")
    license = (await readFile(join(root, "seedrandom.js"), "utf8"))
      .split("*/")[0]
      .replace("/*", "");
  if (!license) throw new Error(`Missing license for ${name}`);
  sections.push(`${name}\n${"=".repeat(name.length)}\n${license}`);
}
await writeFile(
  new URL("../public/THIRD_PARTY_LICENSES.txt", import.meta.url),
  sections.join("\n\n"),
);
console.log("Collected runtime dependency licenses.");
