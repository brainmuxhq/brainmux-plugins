import https from "node:https";
import { z } from "zod";

export interface UseCase { id: string; label: string; guidance: string; }
export interface OpenRouterConfig { api: { models: string }; useCases: UseCase[]; }

// SSOT — one authoritative place for the OpenRouter endpoint + use-case guidance.
// Embedded (not a separate file) so it resolves identically from tsc output and the
// esbuild bundle — same reasoning as core/generate.ts and commands/init.ts.
export const OPENROUTER: OpenRouterConfig = {
  api: { models: "https://openrouter.ai/api/v1/models" }, // public, no key
  useCases: [
    { id: "chat",   label: "Chat / summary", guidance: "cheap, fast, wide context; grunt & summarize" },
    { id: "coding", label: "Coding",         guidance: "high SWE-bench, 128k+ context, good price/perf" },
    { id: "deep",   label: "Deep reasoning", guidance: "strongest reasoning; price secondary" },
    { id: "cheap",  label: "Cheapest",       guidance: "lowest $/token; quality secondary" },
    { id: "long",   label: "Long context",   guidance: "largest context window (1M+)" },
  ],
};

const ConfigSchema = z.object({
  api: z.object({ models: z.string().url() }),
  useCases: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), guidance: z.string().min(1) })).min(1),
});
ConfigSchema.parse(OPENROUTER); // fail loudly if the embedded SSOT is edited wrong

export function getUseCases(): UseCase[] {
  return OPENROUTER.useCases;
}

export interface ModelRow {
  id: string;
  contextLength: number | null;
  promptPrice: number | null;      // per-token USD
  completionPrice: number | null;  // per-token USD
  modality: string;
  name: string;
  raw: unknown;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export function parseModelsPayload(json: unknown): ModelRow[] {
  const data = (json as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error("unexpected OpenRouter /models response: no data[] array");
  return data.map((m) => {
    const o = (m ?? {}) as Record<string, any>;
    return {
      id: String(o.id ?? ""),
      contextLength: num(o.context_length),
      promptPrice: num(o.pricing?.prompt),
      completionPrice: num(o.pricing?.completion),
      modality: typeof o.architecture?.modality === "string" ? o.architecture.modality : "text->text",
      name: String(o.name ?? o.id ?? ""),
      raw: m,
    };
  });
}

export function fetchModels(): Promise<ModelRow[]> {
  return new Promise((resolve, reject) => {
    const req = https.get(OPENROUTER.api.models, { timeout: 20000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 400) { res.resume(); reject(new Error(`could not fetch OpenRouter catalog: HTTP ${status}`)); return; }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve(parseModelsPayload(JSON.parse(body))); }
        catch (e) { reject(new Error(`could not parse OpenRouter catalog: ${(e as Error).message}`)); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("could not fetch OpenRouter catalog: timed out")); });
    req.on("error", (e) => reject(new Error(`could not fetch OpenRouter catalog: ${e.message}`)));
  });
}

function per1M(price: number | null): string {
  return price == null ? "?" : `$${(price * 1_000_000).toFixed(2)}`;
}

export function formatModels(rows: ModelRow[], opts: { query?: string } = {}): string {
  const q = opts.query?.toLowerCase();
  const filtered = (q ? rows.filter((r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => (a.promptPrice ?? Infinity) - (b.promptPrice ?? Infinity));
  const header = `${"model".padEnd(44)} ${"ctx".padStart(10)}  ${"$in/1M".padStart(9)} ${"$out/1M".padStart(9)}  modality`;
  const lines = filtered.map((r) => {
    const ctx = r.contextLength != null ? r.contextLength.toLocaleString("en-US") : "?";
    return `${r.id.padEnd(44)} ${ctx.padStart(10)}  ${per1M(r.promptPrice).padStart(9)} ${per1M(r.completionPrice).padStart(9)}  ${r.modality}`;
  });
  return [header, ...lines].join("\n");
}
