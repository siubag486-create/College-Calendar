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

function runNodeTarget(scriptPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[electron-dev] running: ${path.basename(scriptPath)} ${args.join(" ")}`);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...options.env,
      },
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

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", script], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`PowerShell killed by signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
        return;
      }

      resolve(stdout.trim());
    });
  });
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listRunningNextBuildPids() {
  if (process.platform !== "win32") {
    return [];
  }

  const escapedRoot = escapeRegex(projectRoot).replace(/'/g, "''");
  const output = await runPowerShell(`
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -eq 'node.exe' -and
        $_.CommandLine -match '${escapedRoot}' -and
        $_.CommandLine -match 'next build --webpack'
      } |
      Select-Object -ExpandProperty ProcessId
  `);

  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function clearStaleNextLock() {
  const nextLockPath = path.join(projectRoot, ".next", "lock");
  if (!fs.existsSync(nextLockPath)) {
    return;
  }

  const runningBuildPids = await listRunningNextBuildPids();
  if (runningBuildPids.length > 0) {
    throw new Error(
      `Another next build is already running for this project (PID ${runningBuildPids.join(", ")}).`,
    );
  }

  fs.rmSync(nextLockPath, { force: true });
  console.log("[electron-dev] removed stale .next lock");
}

const nextCli = findPackageEntry("next", ["dist", "bin", "next"]);
const tscCli = findPackageEntry("typescript", ["lib", "tsc.js"]);

if (!nextCli) {
  console.error("Next.js build CLI not found in node_modules. Restore dependencies before running electron:dev.");
  process.exit(1);
}

if (!tscCli) {
  console.error("TypeScript CLI not found in node_modules. Restore dependencies before running electron:dev.");
  process.exit(1);
}

function waitForDevServer(url, timeoutMs = 60000) {
  const http = require("http");
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Dev server did not start within ${timeoutMs / 1000}s`));
        return;
      }
      http
        .get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            setTimeout(check, 500);
          }
        })
        .on("error", () => {
          setTimeout(check, 500);
        });
    }
    check();
  });
}

function spawnBackground(scriptPath, args, options = {}) {
  console.log(`[electron-dev] spawning: ${path.basename(scriptPath)} ${args.join(" ")}`);
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });
  child.on("error", (err) => {
    console.error(`[electron-dev] ${path.basename(scriptPath)} error:`, err.message);
  });
  return child;
}

async function main() {
  try {
    // 1. Compile Electron TypeScript
    await runNodeTarget(tscCli, ["--project", "tsconfig.electron.json"]);

    // 2. Start next dev server in background
    console.log("[electron-dev] starting next dev server...");
    const nextDevChild = spawnBackground(nextCli, ["dev", "--webpack"], {
      env: { BROWSER: "none" },
    });

    // 3. Wait for dev server to be ready
    const devUrl = "http://localhost:3000";
    console.log("[electron-dev] waiting for dev server at", devUrl);
    await waitForDevServer(devUrl);
    console.log("[electron-dev] dev server is ready!");

    if (process.argv.includes("--skip-electron")) {
      nextDevChild.kill();
      process.exit(0);
    }

    // 4. Launch Electron pointing to dev server
    const electronChild = spawnBackground(
      path.join(__dirname, "run-electron.cjs"),
      ["."],
      {
        env: {
          COLLEGE_WIDGET_DEV: "1",
          COLLEGE_DEV_SERVER_URL: devUrl,
        },
      },
    );

    // 5. When Electron exits, kill dev server and exit
    electronChild.on("exit", (code) => {
      console.log("[electron-dev] Electron exited, stopping dev server...");
      nextDevChild.kill();
      process.exit(code ?? 0);
    });

    // If dev server crashes, kill Electron and exit
    nextDevChild.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error("[electron-dev] dev server crashed with code", code);
        if (electronChild && !electronChild.killed) {
          electronChild.kill();
        }
        process.exit(1);
      }
    });

    // Handle Ctrl+C gracefully
    process.on("SIGINT", () => {
      nextDevChild.kill();
      electronChild.kill();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      nextDevChild.kill();
      electronChild.kill();
      process.exit(0);
    });
  } catch (err) {
    console.error("[electron-dev] error:", err.message);
    process.exit(1);
  }
}

main();
