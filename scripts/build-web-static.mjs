import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "web-dist");

async function copyIntoWebDist(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(outputDir, relativePath);
  await cp(source, destination, { recursive: true, force: true });
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await copyIntoWebDist("index.html");
  await copyIntoWebDist("index-web.html");
  await copyIntoWebDist("manifest.webmanifest");
  await copyIntoWebDist("service-worker.js");
  await copyIntoWebDist("src");
  await copyIntoWebDist("node_modules/pdfjs-dist");
  await copyIntoWebDist("node_modules/tesseract.js");
  await copyIntoWebDist("node_modules/tesseract.js-core");
  await copyIntoWebDist("node_modules/idb-keyval");
  await copyIntoWebDist("node_modules/@tesseract.js-data/fra");
  await copyIntoWebDist("node_modules/@tesseract.js-data/eng");

  await writeFile(path.join(outputDir, ".nojekyll"), "", "utf8");
  console.log(`web-dist pret : ${outputDir}`);
}

main().catch((error) => {
  console.error("Impossible de preparer web-dist", error);
  process.exitCode = 1;
});
