# OpenRouter Model Picker — Design (Plan 3)

**Date:** 2026-09-02
**Status:** Approved (design) — pending spec review → implementation plan
**Depends on:** core migration + control-plane (Plan 1 + 2) done on `main`; `bmux` CLI + `brainmux` skill live.

## 1. Purpose

Let the user discover and pick OpenRouter models conversationally, from the **live** catalog, and wire the choice into a brain — instead of Claude guessing model slugs from memory (which risks hallucinated/stale slugs). One authoritative place defines the OpenRouter API endpoint(s) and the use-case guidance; a `bmux models` command surfaces the live catalog; the `brainmux` skill teaches Claude to recommend from that live list per use-case and apply the choice via `bmux config`.

## 2. SSOT — embedded in `src/core/openrouter.ts`

A single authoritative definition of the OpenRouter API endpoint(s) + the use-case catalog, as a **constant in code** (not a separate YAML file).

- **Why a constant, not `templates/openrouter.yaml`:** the shipped CLI is the esbuild bundle `dist/bmux.js`; reading a sibling file at runtime is path-fragile in the bundle (the exact bug that broke `bmux init` templatesDir, fixed by embedding). `core/generate.ts` and `commands/init.ts` already embed their templates as constants. Embedding here keeps one authoritative place, no parallel file/constant copies, and no bundle path resolution. The SSOT property holds: one place, hand-editable (edit the `.ts`, rebuild).
- **Shape** (zod-validated on load so a bad edit fails loudly):
  ```ts
  export interface UseCase { id: string; label: string; guidance: string; }
  export interface OpenRouterConfig { api: { models: string }; useCases: UseCase[]; }
  export const OPENROUTER: OpenRouterConfig = {
    api: { models: "https://openrouter.ai/api/v1/models" }, // public, no key
    useCases: [
      { id: "chat",   label: "Chat/summary", guidance: "cheap, fast, wide ctx; grunt/summarize" },
      { id: "coding", label: "Coding",       guidance: "high SWE-bench, 128k+ ctx, good price/perf" },
      { id: "deep",   label: "Deep reasoning", guidance: "strongest open model; price secondary" },
      { id: "cheap",  label: "Cheapest",      guidance: "lowest $/token; quality secondary" },
      { id: "long",   label: "Long context",  guidance: "largest context (1M+)" },
    ],
  };
  ```

## 3. `src/core/openrouter.ts` — SSOT + fetch

- `OPENROUTER` (the constant above) + a zod schema `validateOpenRouter()` run once at module load (throws a readable error if the constant is malformed).
- `getUseCases(): UseCase[]` — returns `OPENROUTER.useCases`.
- `interface ModelRow { id: string; contextLength: number | null; promptPrice: number | null; completionPrice: number | null; modality: string; name: string; raw: unknown; }`
- `parseModelsPayload(json: unknown): ModelRow[]` — **pure** mapper from the raw `/models` JSON (`data[]`) → `ModelRow[]` (map `id`, `context_length`, `pricing.prompt`, `pricing.completion`, `architecture.modality`, `name`; keep the full object in `raw` for `--json`). Extracted from the fetch so it is unit-testable against a fixture payload with NO network. **All parsing is done in Node from the raw JSON — never via an LLM summary** (WebFetch-style summaries hallucinate model ids/prices; the CLI must not).
- `fetchModels(): Promise<ModelRow[]>` — HTTPS GET `OPENROUTER.api.models` (node:https), `JSON.parse` the body, `parseModelsPayload(...)`. Rejects with a readable error on network/HTTP/parse failure. No API key (public endpoint).
- `formatModels(rows: ModelRow[], opts?: { query?: string }): string` — pure: optional case-insensitive substring filter on `id`/`name`, sort by `promptPrice` asc (nulls last), render aligned `id · ctx · $prompt/$completion(/1M) · modality · name` lines. Pure → unit-testable without network.
- Model objects carry rich fields useful for use-case judgment — `architecture.input_modalities`, `supported_parameters`, `reasoning`, and optional `benchmarks`. The compact table shows `modality`; the FULL record (for deep judgment, e.g. coding benchmarks or tool support) is available via `bmux models --json` (emits the raw records). This keeps the default output scannable while letting the skill fetch detail when needed.
- The OpenRouter `/models` response has **no category/use-case field** (verified against the live payload) — grouping is only by provider prefix. So use-case fit is judged by the skill from these fields, not an API filter. A `?category=` query parameter is **unverified** (could not confirm); if later confirmed, a `bmux models --category <c>` passthrough can be added — out of scope now.

## 4. `src/commands/models.ts` — the `bmux models` command

- `runModels(rest: string[], env?): Promise<number>`:
  - `bmux models --use-cases` → print the use-case catalog (`id` · `label` · `guidance`) from `getUseCases()`; return 0.
  - `bmux models [query]` → `await fetchModels()`, `formatModels(rows, { query })`, print compact table; return 0. On fetch error → `bmux models: <reason>` to stderr, return 1.
  - `bmux models --json [query]` → emit the raw model records (optionally filtered) as JSON, for deep use-case judgment (benchmarks, supported_parameters, reasoning, input_modalities). Return 0.
- Pricing shown per-1M-token (OpenRouter pricing is per-token; multiply for readability) with a header noting the unit.

## 5. CLI + skill wiring

- `cli.ts`: dispatch `if (cmd === "models") return await runModels(rest, env);`. Add a `bmux models` line to the HELP block.
- `skills/brainmux/SKILL.md` gets two additions:
  - **Model discovery:** for model/pricing/use-case questions, run `bmux models --use-cases` (the catalog) and `bmux models [query]` (the **live** list; `--json` for detail), recommend per the use-case guidance **from the live output** (never from memory — models + prices change), then wire the pick via `bmux config set-model <brain> <id>` or `add-brain`, then `bmux up`. The skill does not restate the use-case list — it points at `bmux models --use-cases` (no SSOT duplication).
  - **Default provider = OpenRouter; do NOT present a provider-choice menu on setup.** One OpenRouter key reaches thousands of models across providers (DeepSeek/Qwen/GLM/GPT/Gemini…), so setup assumes OpenRouter: guide the user to add `OPENROUTER_API_KEY` (hidden, in a separate terminal) — nothing else. Only use a direct provider (`deepseek/…`, `openai/…`) if the user explicitly asks; never ask them to choose a provider up front.

## 6. Error handling

- Offline / OpenRouter down → `fetchModels` rejects; `bmux models` prints `bmux models: could not fetch OpenRouter catalog — <reason> (check network)` and exits 1.
- Malformed SSOT constant (developer error) → zod throws at load with the offending path.
- No key required; if OpenRouter ever gates `/models`, the error message surfaces the HTTP status.

## 7. Testing

- **Unit (no network):** `validateOpenRouter` accepts the shipped constant; `formatModels` filters by query + sorts by price + renders aligned rows for a small fixture `ModelRow[]`; `getUseCases` returns the catalog.
- **Unit (parse):** a fixture OpenRouter `/models` JSON payload → `parseModelsPayload` maps to `ModelRow[]` correctly (extract the pure parser so it is testable without HTTP).
- **Manual/live:** `bmux models` returns real rows; `bmux models qwen` filters; `bmux models --use-cases` prints the catalog. (Network-gated, like the Docker smoke.)

## 8. Non-goals (YAGNI)

- Direct-provider model lists (DeepSeek/OpenAI `/models`) — OpenRouter aggregates them; deferred.
- Caching the catalog — fetch live each call (fast); revisit only if rate-limited.
- Executable use-case filters / curated allowlists in the SSOT — the skill (LLM) does use-case judgment from the live list; the SSOT carries guidance text only.
- Auto-selecting/writing a model without user confirmation — Claude proposes, the user confirms, then `bmux config` applies.
