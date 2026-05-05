import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const appRoot = new URL("../", import.meta.url);
const srcTauri = join(appRoot.pathname, "src-tauri");
const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
const cargoBin = join(home, ".cargo", "bin");
const cargoExe = join(cargoBin, process.platform === "win32" ? "cargo.exe" : "cargo");
const rustcExe = join(cargoBin, process.platform === "win32" ? "rustc.exe" : "rustc");
const env = {
  ...process.env,
  PATH: process.env.PATH?.includes(cargoBin)
    ? process.env.PATH
    : `${process.env.PATH};${cargoBin}`,
};

const args = process.argv.slice(2);
const isRelease = args.includes("build");
const targetDir = isRelease ? "release" : "debug";

function shellCommand(command: string[]) {
  if (process.platform !== "win32") {
    return command;
  }

  const cmdExe = process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe";
  const escaped = command
    .map((part) => (/[ "\t]/.test(part) ? `"${part.replaceAll('"', '\\"')}"` : part))
    .join(" ");

  return [cmdExe, "/d", "/s", "/c", escaped];
}

async function run(command: string[], cwd: string) {
  const proc = Bun.spawn({
    cmd: shellCommand(command),
    cwd,
    env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${command.join(" ")} failed with exit code ${code}`);
  }
}

function runSync(command: string[], cwd: string) {
  const proc = Bun.spawnSync({
    cmd: shellCommand(command),
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr) || `${command.join(" ")} failed`);
  }

  return new TextDecoder().decode(proc.stdout).trim();
}

async function ensureSidecar() {
  const requestedTarget = env.CARGO_BUILD_TARGET?.trim();
  const hostTarget = runSync([rustcExe, "--print", "host-tuple"], join(appRoot.pathname));
  const effectiveTarget = requestedTarget || hostTarget;
  const binaryName = process.platform === "win32" ? "genesis-mcp.exe" : "genesis-mcp";

  await run(
    [
      cargoExe,
      "build",
      "--manifest-path",
      join(srcTauri, "Cargo.toml"),
      "--bin",
      "genesis-mcp",
      ...(requestedTarget ? ["--target", requestedTarget] : []),
      ...(isRelease ? ["--release"] : []),
    ],
    join(appRoot.pathname),
  );

  const builtBinary = requestedTarget
    ? join(srcTauri, "target", requestedTarget, targetDir, binaryName)
    : join(srcTauri, "target", targetDir, binaryName);

  const outputDir = join(srcTauri, "binaries");
  const outputBinary = join(
    outputDir,
    process.platform === "win32" ? `genesis-mcp-${effectiveTarget}.exe` : `genesis-mcp-${effectiveTarget}`,
  );

  await mkdir(outputDir, { recursive: true });
  await cp(builtBinary, outputBinary);
}

await ensureSidecar();
await run(["bunx", "tauri", ...args], join(appRoot.pathname));
