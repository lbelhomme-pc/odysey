import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "web-dist");

async function copyIntoWebDist(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(outputDir, relativePath);
  await cp(source, destination, { recursive: true, force: true });
}

async function writeVersionedServiceWorker() {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const serviceWorkerTemplatePath = path.join(projectRoot, "service-worker.js");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const serviceWorkerTemplate = await readFile(serviceWorkerTemplatePath, "utf8");
  const buildId = `${packageJson.version}-${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
  const compiledServiceWorker = serviceWorkerTemplate.replaceAll("__ODYSEY_BUILD_ID__", buildId);

  await writeFile(path.join(outputDir, "service-worker.js"), compiledServiceWorker, "utf8");
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await copyIntoWebDist("index.html");
  await copyIntoWebDist("index-web.html");
  await copyIntoWebDist("manifest.webmanifest");
  await copyIntoWebDist("src");
  await copyIntoWebDist("node_modules/pdfjs-dist");
  await copyIntoWebDist("node_modules/tesseract.js");
  await copyIntoWebDist("node_modules/tesseract.js-core");
  await copyIntoWebDist("node_modules/idb-keyval");
  await copyIntoWebDist("node_modules/@tesseract.js-data/fra");
  await copyIntoWebDist("node_modules/@tesseract.js-data/eng");
  await writeVersionedServiceWorker();

  await writeFile(path.join(outputDir, ".nojekyll"), "", "utf8");
  console.log(`web-dist pret : ${outputDir}`);
}

main().catch((error) => {
  console.error("Impossible de preparer web-dist", error);
  process.exitCode = 1;
});
