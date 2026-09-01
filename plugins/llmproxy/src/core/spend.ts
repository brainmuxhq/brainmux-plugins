import http from "node:http";

// Per-brain spend totals derived from that brain's LiteLLM /spend/logs.
// LiteLLM is the source of truth (observation panel); this is a CLI roll-up, not a rewrite.
export interface BrainSpend {
  brain: string;
  ok: boolean;       // false = brain unreachable / unauthorized
  requests: number;
  tokens: number;
  spend: number;     // USD
  note?: string;     // failure reason when ok=false
}

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

// Pure: fold a /spend/logs array into one brain's totals.
export function aggregateSpend(brain: string, rows: unknown): BrainSpend {
  if (!Array.isArray(rows)) return { brain, ok: false, requests: 0, tokens: 0, spend: 0, note: "unexpected response" };
  let spend = 0, tokens = 0;
  for (const r of rows) {
    const o = (r ?? {}) as Record<string, unknown>;
    spend += toNum(o.spend);
    tokens += toNum(o.total_tokens);
  }
  return { brain, ok: true, requests: rows.length, tokens, spend };
}

function usd(n: number): string {
  return `$${n.toFixed(6)}`;
}

// Pure: render the roll-up table + total. `ports` maps brain -> port for the UI hint.
export function formatSpend(rows: BrainSpend[], ports: Record<string, number> = {}): string {
  const header = `${"brain".padEnd(8)} ${"requests".padStart(9)} ${"tokens".padStart(10)} ${"spend".padStart(14)}`;
  const body = rows.map((r) =>
    r.ok
      ? `${r.brain.padEnd(8)} ${String(r.requests).padStart(9)} ${String(r.tokens).padStart(10)} ${usd(r.spend).padStart(14)}`
      : `${r.brain.padEnd(8)} ${"—".padStart(9)} ${"—".padStart(10)} ${"—".padStart(14)}  (${r.note ?? "unreachable"})`,
  );
  const live = rows.filter((r) => r.ok);
  const total = {
    requests: live.reduce((s, r) => s + r.requests, 0),
    tokens: live.reduce((s, r) => s + r.tokens, 0),
    spend: live.reduce((s, r) => s + r.spend, 0),
  };
  const sep = "─".repeat(header.length);
  const totalLine = `${"TOTAL".padEnd(8)} ${String(total.requests).padStart(9)} ${String(total.tokens).padStart(10)} ${usd(total.spend).padStart(14)}`;
  const anyPort = Object.values(ports)[0];
  const hint = anyPort
    ? `\nfull detail + charts: each brain's LiteLLM UI at http://127.0.0.1:<port>/ui`
    : "";
  return [header, ...body, sep, totalLine, hint].filter((s) => s !== "").join("\n");
}

// IO: fetch one brain's /spend/logs. Rejects on non-2xx / transport error so the
// caller can mark that brain unreachable (no silent catch).
export function fetchSpendLogs(port: number, apiKey: string, timeoutMs = 10000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/spend/logs",
        timeout: timeoutMs,
        headers: { authorization: `Bearer ${apiKey}` },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 400) { res.resume(); reject(new Error(`HTTP ${status}`)); return; }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`bad JSON: ${(e as Error).message}`)); }
        });
      },
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("timed out")); });
    req.on("error", (e) => reject(new Error(e.message)));
  });
}
