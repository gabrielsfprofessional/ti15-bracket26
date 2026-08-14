import { spawn } from "node:child_process";

const port = 3100;
const origin = `http://127.0.0.1:${port}`;
const nextCli = "node_modules/next/dist/bin/next";
const playwrightCli = "node_modules/@playwright/test/cli.js";
let server;

try {
  server = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);

  await waitForServer(origin, server);
  const result = await run(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)]);
  process.exitCode = result;
} finally {
  await stop(server);
}

async function waitForServer(url, processHandle) {
  const deadline = Date.now() + 60_000;
  let lastError = "server has not responded";
  while (Date.now() < deadline) {
    if (processHandle.exitCode != null) {
      throw new Error(`Next server exited early with code ${processHandle.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Playwright exited on ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

async function stop(processHandle) {
  if (!processHandle || processHandle.exitCode != null) return;
  processHandle.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => processHandle.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (processHandle.exitCode == null) processHandle.kill("SIGKILL");
}
