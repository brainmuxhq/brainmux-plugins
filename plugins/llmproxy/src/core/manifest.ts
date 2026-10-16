import fs from "node:fs";
import YAML from "yaml";
import { z } from "zod";
import { THINKING_LEVELS } from "./thinking.js";

// Restrict to bare model-id chars so the value can't inject YAML into the generated
// per-brain config.yaml (e.g. a newline + `master_key: …`). Covers OpenRouter slugs
// like `openrouter/qwen/qwen3.7-flash` and variant suffixes (`…:free`).
const ModelId = z.string().regex(/^[A-Za-z0-9/._:-]+$/, "model must be a bare model id (letters, digits and / . _ : -)");

// A LiteLLM brain: one container on a local port, translating to a provider (OpenRouter, …).
const LiteLLMBrainSchema = z.object({
  port: z.number().int().min(1).max(65535),
  model: ModelId,
  providerKey: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "providerKey must be an ENV_VAR-style name"),
  // Thinking levels steer a direct endpoint's thinking budget; a LiteLLM brain would ignore it silently.
  thinking: z.undefined({ errorMap: () => ({ message: "thinking is for direct (url) brains only" }) }),
});

// A DIRECT brain: an endpoint that already speaks the Anthropic Messages API (e.g. a vLLM
// server) — no LiteLLM container. Auth = `Authorization: Bearer <token>`, the token read at
// run time from `authTokenFile` (never copied into ~/.brainmux/.env).
const DirectBrainSchema = z
  .object({
    url: z
      .string()
      .url("url must be an absolute URL")
      .refine((u) => /^https?:\/\//i.test(u), "url must be http:// or https://"),
    model: ModelId,
    authTokenFile: z.string().min(1, "authTokenFile must be a path"),
    // Child Claude Code's CLAUDE_CODE_MAX_OUTPUT_TOKENS. Small limits leave reasoning models
    // with thinking-only / half tool calls, so the default is generous (DEFAULT_MAX_OUTPUT_TOKENS).
    maxOutputTokens: z.number().int().min(1).optional(),
    // The model's real context window (input + output), e.g. 131072. Claude Code assumes 200K for
    // a model it doesn't know and would overflow the server; with this it compacts in time.
    contextWindow: z.number().int().min(1024).optional(),
    // How much the model may think per request (off|low|medium|deep → see core/thinking.ts).
    // Default DEFAULT_THINKING; `bmux delegate --thinking` overrides it per task.
    thinking: z.enum(THINKING_LEVELS, { errorMap: () => ({ message: `thinking must be one of ${THINKING_LEVELS.join("|")}` }) }).optional(),
  })
  .strict(); // a stray `port`/`providerKey` on a url brain is a mistake, not something to ignore

export const DEFAULT_MAX_OUTPUT_TOKENS = 20000;

export type LiteLLMBrain = z.infer<typeof LiteLLMBrainSchema>;
export type DirectBrain = z.infer<typeof DirectBrainSchema>;
export type Brain = LiteLLMBrain | DirectBrain;

export function isDirect(b: Brain): b is DirectBrain {
  return "url" in b;
}

// `url` present → direct brain, otherwise LiteLLM brain. Dispatching on the key (instead of a
// plain z.union) keeps the error messages specific to the shape the user meant.
const BrainSchema = z.unknown().transform((v, ctx): Brain => {
  const schema = v && typeof v === "object" && "url" in v ? DirectBrainSchema : LiteLLMBrainSchema;
  const r = schema.safeParse(v);
  if (!r.success) {
    for (const issue of r.error.issues) ctx.addIssue(issue);
    return z.NEVER;
  }
  return r.data;
});

const BrainsConfigSchema = z
  .object({
    version: z.literal(1, { errorMap: () => ({ message: "version must be 1" }) }),
    brains: z.record(
      z.string().regex(/^[a-z][a-z0-9]*$/, "brain name must be lowercase alphanumeric, starting with a letter"),
      BrainSchema,
    ),
  })
  .superRefine((cfg, ctx) => {
    const seen = new Map<number, string>();
    for (const [name, b] of Object.entries(cfg.brains)) {
      if (isDirect(b)) continue; // direct brains bind no local port
      const prev = seen.get(b.port);
      if (prev) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate port ${b.port} used by both "${prev}" and "${name}"`,
          path: ["brains", name, "port"],
        });
      }
      seen.set(b.port, name);
    }
  });

export type BrainsConfig = z.infer<typeof BrainsConfigSchema>;

/** The brains that run as LiteLLM containers (the stack: compose, up/ps, health, spend). */
export function litellmBrains(cfg: BrainsConfig): [string, LiteLLMBrain][] {
  return Object.entries(cfg.brains).filter((e): e is [string, LiteLLMBrain] => !isDirect(e[1]));
}

export function parseBrains(text: string): BrainsConfig {
  let raw: unknown;
  try {
    raw = YAML.parse(text);
  } catch (e) {
    throw new Error(`brains.yaml is not valid YAML: ${(e as Error).message}`);
  }
  const result = BrainsConfigSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`brains.yaml is invalid:\n${lines.join("\n")}`);
  }
  return result.data;
}

export function loadBrains(file: string): BrainsConfig {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`brains.yaml not found at ${file} — run \`bmux init\` first.`);
  }
  return parseBrains(text);
}
