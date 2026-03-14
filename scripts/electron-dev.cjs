const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

function runNodeTarget(scriptPath, args) {
  return new Promise((resolve, reject) => {
    console.log(`[electron-dev] running: ${path.basename(scriptPath)} ${args.join(" ")}`);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Process killed by signal ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

const nextBuildCli = findPackageEntry("next", ["dist", "cli", "next-build.js"]);
const tscCli = findPackageEntry("typescript", ["lib", "tsc.js"]);

if (!nextBuildCli) {
  console.error("Next.js build CLI not found in node_modules. Restore dependencies before running electron:dev.");
  process.exit(1);
}

if (!tscCli) {
  console.error("TypeScript CLI not found in node_modules. Restore dependencies before running electron:dev.");
  process.exit(1);
}

async function main() {
  try {
    await runNodeTarget(nextBuildCli, ["--webpack"]);
    await runNodeTarget(tscCli, ["--project", "tsconfig.electron.json"]);

    if (process.argv.includes("--skip-electron")) {
      process.exit(0);
    }

    await runNodeTarget(path.join(__dirname, "run-electron.cjs"), ["."]);
  } catch (err) {
    console.error("[electron-dev] error:", err.message);
    process.exit(1);
  }
}

main();
