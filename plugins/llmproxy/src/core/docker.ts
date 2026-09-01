import { spawnSync } from "node:child_process";
import http from "node:http";
import type { Paths } from "./paths.js";

export function composeArgs(paths: Paths): string[] {
  // --env-file: secrets live in <BRAINMUX_HOME>/.env, one level above the generated
  // compose file, so docker compose won't auto-load it — point at it explicitly, or
  // ${VAR} interpolation (OPENROUTER_API_KEY, master keys, POSTGRES_PASSWORD) resolves empty.
  return ["compose", "-f", paths.composeYaml, "--env-file", paths.envFile];
}

export function ensureDocker(): void {
  const r = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" });
  if (r.error) throw new Error("docker not found on PATH — install Docker and retry.");
  if (r.status !== 0) throw new Error("docker daemon not reachable — start Docker and retry.");
}

export function runCompose(paths: Paths, args: string[]): number {
  const r = spawnSync("docker", [...composeArgs(paths), ...args], { stdio: "inherit" });
  return r.status ?? 1;
}

export function liveliness(port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/health/liveliness", timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      },
    );
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
  });
}
