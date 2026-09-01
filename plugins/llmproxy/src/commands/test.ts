import http from "node:http";
import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";

export function isAlive(responseJson: string): boolean {
  try {
    const o = JSON.parse(responseJson) as { role?: string };
    return o.role === "assistant";
  } catch {
    return false;
  }
}

function messagesProbe(port: number, apiKey: string): Promise<string> {
  const body = JSON.stringify({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [{ role: "user", content: "reply exactly: OK" }],
  });
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/v1/messages",
        method: "POST",
        timeout: 60000,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve('{"error":"timeout"}');
    });
    req.on("error", (e) => resolve(JSON.stringify({ error: String(e) })));
    req.write(body);
    req.end();
  });
}

export async function runTest(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const paths = resolvePaths(env);
  const cfg = loadBrains(paths.brainsYaml);
  let fail = 0;
  for (const [name, b] of Object.entries(cfg.brains)) {
    const key = getKey(paths.envFile, masterKeyVar(name)) ?? "";
    const out = await messagesProbe(b.port, key);
    if (isAlive(out)) {
      const m = out.match(/"text":"([^"]*)"/);
      process.stdout.write(`${(name + ":").padEnd(10)} OK  ${m ? m[1].slice(0, 40) : "(alive)"}\n`);
    } else {
      process.stdout.write(`${(name + ":").padEnd(10)} FAIL -> ${out.slice(0, 120)}\n`);
      fail = 1;
    }
  }
  return fail;
}
