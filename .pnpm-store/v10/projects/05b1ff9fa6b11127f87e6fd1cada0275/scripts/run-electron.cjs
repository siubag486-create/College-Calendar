const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

function getElectronExecutableName() {
  switch (process.platform) {
    case "win32":
      return ["dist", "electron.exe"];
    case "darwin":
      return ["dist", "Electron.app", "Contents", "MacOS", "Electron"];
    default:
      return ["dist", "electron"];
  }
}

function findFromElectronPackage() {
  try {
    const electronPath = require("electron");
    if (typeof electronPath === "string" && fs.existsSync(electronPath)) {
      return electronPath;
    }
  } catch {
    // Fall back to direct filesystem lookup when the package's bin wrapper is broken.
  }

  const fallbackPath = path.join(
    projectRoot,
    "node_modules",
    "electron",
    ...getElectronExecutableName(),
  );

  return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

function findFromPnpmStore() {
  const pnpmDir = path.join(projectRoot, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) {
    return null;
  }

  const candidates = fs
    .readdirSync(pnpmDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("electron@"))
    .map((entry) =>
      path.join(
        pnpmDir,
        entry.name,
        "node_modules",
        "electron",
        ...getElectronExecutableName(),
      ),
    );

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const electronBinary = findFromElectronPackage() ?? findFromPnpmStore();

if (!electronBinary) {
  console.error(
    "Electron executable not found. Run `pnpm install --no-frozen-lockfile` to restore dependencies.",
  );
  process.exit(1);
}

const forwardedArgs = process.argv.slice(2).map((arg) => (arg === "." ? projectRoot : arg));

const child = spawn(electronBinary, forwardedArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  windowsHide: false,
});

child.on("error", (error) => {
  console.error("Failed to start Electron:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

