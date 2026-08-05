import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const roots = ["script.js", "data", "scripts", "tests"];
const files = [];

function collect(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = fs.statSync(absolutePath);

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolutePath)) {
      collect(path.join(relativePath, entry));
    }
  } else if (/\.(?:js|mjs)$/.test(relativePath)) {
    files.push(relativePath);
  }
}

roots.forEach(collect);

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
}

console.log(`${files.length} archivos JavaScript pasaron la comprobación sintáctica.`);
