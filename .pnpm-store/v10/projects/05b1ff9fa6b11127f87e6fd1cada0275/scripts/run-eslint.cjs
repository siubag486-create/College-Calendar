const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

function findPackageEntry(packageName, entryParts) {
  const directPath = path.join(projectRoot, "node_modules", packageName, ...entryParts);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const pnpmDir = path.join(projectRoot, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(pnpmDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${packageName}@`))
    .map((entry) =>
      path.join(pnpmDir, entry.name, "node_modules", packageName, ...entryParts),
    );

  return matches.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const eslintCli = findPackageEntry("eslint", ["bin", "eslint.js"]);

if (!eslintCli) {
  console.error("ESLint CLI not found in node_modules. Restore dependencies before running lint.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [eslintCli, ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
