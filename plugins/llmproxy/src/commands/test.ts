import http from "node:http";
import https from "node:https";
import { resolvePaths } from "../core/paths.js";
import { loadBrains, isDirect } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";
import { readAuthToken } from "../core/authtoken.js";

export function isAlive(responseJson: string): boolean {
  try {
    const o = JSON.parse(responseJson) as { role?: string };
    return o.role === "assistant";
  } catch {
    return false;
  }
}

export interface Probe {
  base: string; // endpoint root; /v1/messages is appended
  model: string; // a LiteLLM brain routes any id (wildcard); a direct endpoint needs its real model id
  headers: Record<string, string>; // auth: x-api-key (LiteLLM master key) or Authorization: Bearer (direct)
}

export function messagesProbe(p: Probe, timeoutMs = 60000): Promise<string> {
  const body = JSON.stringify({
    model: p.model,
    max_tokens: 1024,
    messages: [{ role: "user", content: "reply exactly: OK" }],
  });
  const url = new URL(p.base.replace(/\/+$/, "") + "/v1/messages");
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = lib.request(
      url,
      {
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "anthropic-version": "2023-06-01",
          ...p.headers,
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
  const entries = Object.entries(cfg.brains);
  // Probe every brain concurrently — a hung/slow brain (up to its own 60s timeout) no longer
  // stalls the others. One request per brain. Output stays in manifest order.
  const results = await Promise.all(
    entries.map(async ([name, b]) => {
      const tag = (name + ":").padEnd(10);
      let probe: Probe;
      if (isDirect(b)) {
        let token: string;
        try {
          token = readAuthToken(b.authTokenFile, env.HOME || undefined);
        } catch (e) {
          return { ok: false, line: `${tag} FAIL -> ${(e as Error).message}` };
        }
        probe = { base: b.url, model: b.model, headers: { authorization: `Bearer ${token}` } };
      } else {
        const key = getKey(paths.envFile, masterKeyVar(name));
        if (!key) return { ok: false, line: `${tag} FAIL -> ${masterKeyVar(name)} missing in .env — run \`bmux init\`` };
        probe = { base: `http://127.0.0.1:${b.port}`, model: "claude-opus-4-8", headers: { "x-api-key": key } };
      }
      const out = await messagesProbe(probe);
      if (isAlive(out)) {
        const m = out.match(/"text":"([^"]*)"/);
        return { ok: true, line: `${tag} OK  ${m ? m[1].slice(0, 40) : "(alive)"}` };
      }
      return { ok: false, line: `${tag} FAIL -> ${out.slice(0, 120)}` };
    }),
  );
  for (const r of results) process.stdout.write(r.line + "\n");
  return results.some((r) => !r.ok) ? 1 : 0;
}
