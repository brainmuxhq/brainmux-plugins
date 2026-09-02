# llmproxy Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the working `claude-proxy` POSIX-sh prototype into a declarative, `brains.yaml`-driven Node/TypeScript CLI (`bmux`) inside the `@brainmux/llmproxy` plugin, proving golden-parity with the current three brains and passing a live smoke test.

**Architecture:** A single YAML SSOT (`brains.yaml`) validated by zod is fed to a deterministic generator that emits the LiteLLM per-brain configs, a Docker Compose file, and the Postgres init SQL. State lives in `~/.brainmux/` (`BRAINMUX_HOME`), fully separated from the versioned plugin code. The CLI is a thin arg-parser that dispatches to command modules (`init`, stack lifecycle, `launch`, `delegate`, `config`, `test`) which drive `docker compose` and `claude`. Each brain is isolated by **port** (Claude Code sends opaque model ids, so `model_name: "*"` wildcard routing per instance is mandatory).

**Tech Stack:** Node ≥18 (ESM), TypeScript, `zod` (validation), `yaml` (parse), Node built-ins (`node:fs`, `node:child_process`, `node:crypto`, `node:os`, `node:path`), `node --test` (unit + golden), Docker + Docker Compose (runtime), LiteLLM image (mirrored to GHCR).

## Global Constraints

- **Branding (SSOT = repo `CLAUDE.md`, supersedes the design spec's WeCodeApps naming):** org `brainmuxhq`, marketplace repo `brainmuxhq/brainmux-plugins`, npm scope `@brainmux/*`, plugin name `llmproxy`, package `@brainmux/llmproxy`, CLI command `bmux`, domain `brainmux.com`. The string `WeCodeApps`/`wecodeapps`/`azorlu80` must NOT appear in any shipped artifact after Task 1.
- **Node:** `>=18`, `"type": "module"` (ESM `import`, no `require`). TypeScript compiled with `tsc` to `dist/`.
- **Secrets never in `brains.yaml`.** Master keys + provider keys + salt + Postgres password live only in `~/.brainmux/.env` (chmod 600). `.env` is never committed; `.env.example` (template, placeholder values) is.
- **Routing is by PORT, never by model name.** Every generated LiteLLM config uses `model_name: "*"` and `drop_params: true`.
- **State/code separation:** code = plugin (read-only, versioned). State = `BRAINMUX_HOME` (default `~/.brainmux`), containing `brains.yaml`, `.env`, `generated/`, `data/postgres`. Nothing the CLI generates is hand-edited.
- **LiteLLM image:** referenced by a single constant `IMAGE_REF` = the GHCR mirror digest produced in Task 3. MIT core only — never ship/reference the `enterprise/` directory.
- **Postgres data:** fresh on `bmux init` (empty `~/.brainmux/data/postgres`). The prototype's `~/Development/Projects/claude-proxy/data` is NOT migrated and NOT touched until final cleanup (Task 17).
- **Test-before-claim:** no task is "done" until its stated verification command is run and its expected output observed. Golden tests and unit tests run without Docker; the live smoke (Task 16) is Docker-gated.
- **Commit after every task** with a Conventional Commit message.

## File Structure

All paths relative to repo root `~/Development/Projects/brainmux/` unless noted. Work happens inside `plugins/llmproxy/`.

| File | Responsibility |
|---|---|
| `plugins/llmproxy/package.json` | Package manifest; deps (`zod`, `yaml`), scripts (`build`, `test`). |
| `plugins/llmproxy/src/cli.ts` | Thin arg-parse → dispatch to command modules. Help text. |
| `plugins/llmproxy/src/core/paths.ts` | Resolve `BRAINMUX_HOME` + all state paths. Pure. |
| `plugins/llmproxy/src/core/manifest.ts` | zod schema for `brains.yaml`; parse + validate → typed config. |
| `plugins/llmproxy/src/core/env.ts` | `.env` read/write (chmod 600), key generation. |
| `plugins/llmproxy/src/core/generate.ts` | `brains.yaml` → compose + per-brain configs + init SQL. Pure. Holds `IMAGE_REF`. |
| `plugins/llmproxy/src/core/docker.ts` | Wrap `docker compose`; health checks; docker presence detection. |
| `plugins/llmproxy/src/commands/init.ts` | Scaffold `~/.brainmux`, generate master keys, write default `brains.yaml`, generate artifacts. |
| `plugins/llmproxy/src/commands/stack.ts` | `up`/`down`/`restart`/`ps`/`logs`/`health` (regenerate then drive docker). |
| `plugins/llmproxy/src/commands/launch.ts` | `chat`/`deep`/`coder` (generic `launch <brain>`): exec `claude` with brain env, in user cwd. |
| `plugins/llmproxy/src/commands/delegate.ts` | Headless `claude -p` delegation to a brain; modes + recursion guard. |
| `plugins/llmproxy/src/commands/config.ts` | `add-brain`/`remove-brain`/`set-model`/`add-key`/`list` — edit `brains.yaml`/`.env`, regenerate. |
| `plugins/llmproxy/src/commands/test.ts` | Smoke: `/v1/messages` per brain, accept text or thinking-only. |
| `plugins/llmproxy/templates/brains.default.yaml` | Default 3-brain `brains.yaml` written by `init`. |
| `plugins/llmproxy/.env.example` | Secrets template (placeholders only). |
| `plugins/llmproxy/test/manifest.test.ts` | Unit: schema accept/reject. |
| `plugins/llmproxy/test/env.test.ts` | Unit: `.env` parse/round-trip/chmod. |
| `plugins/llmproxy/test/generate.test.ts` | Golden: generate() vs fixtures. |
| `plugins/llmproxy/test/paths.test.ts` | Unit: path resolution + `BRAINMUX_HOME` override. |
| `plugins/llmproxy/test/fixtures/three-brains/*` | Golden fixtures (expected compose/configs/init). |
| `plugins/llmproxy/test/smoke.sh` | Docker-gated live smoke driver (Task 16). |

**Design note (deviation from design spec §5):** the spec lists a `templates/` dir holding compose+brain templates. We embed the compose/config/SQL templates as pure string builders inside `generate.ts` instead — deterministic, golden-testable, no file IO in the hot path. `templates/` holds only the default `brains.yaml`. This is simpler and DRY; noted here so a reviewer doesn't flag the missing template files.

---

### Task 1: Doc alignment — scrub WeCodeApps, retarget spec to brainmux branding

**Files:**
- Modify: `docs/specs/2026-09-01-brainmux-architecture-design.md` (lines 5, 28–32, 54, 60, 115, 173, 178, 183, 187, 212)
- Modify: `web/README.md:6`
- Modify: `CLAUDE.md:23`

**Interfaces:**
- Consumes: nothing.
- Produces: a spec whose branding matches `CLAUDE.md` — later tasks quote the spec's CLI surface and layout without hitting stale names.

- [ ] **Step 1: Retarget the spec's branding.** Apply these exact replacements in `docs/specs/2026-09-01-brainmux-architecture-design.md`:
  - Line 5: `first plugin under the **WeCodeApps** brand.` → `the first plugin in the **brainmux** monorepo.`
  - Line 28: ``azorlu80/wecodeapps-plugins` (marketplace name `wecodeapps`),`` → ``brainmuxhq/brainmux-plugins` (marketplace name `brainmux`),``
  - Line 29: `home to a family of `@wecodeapps/*` plugins.` → `home to a family of `@brainmux/*` plugins.`
  - Line 30: `/plugin marketplace add azorlu80/wecodeapps-plugins` → `/plugin marketplace add brainmuxhq/brainmux-plugins`
  - Line 32: `@wecodeapps/brainmux` → `@brainmux/llmproxy`
  - Line 54: `wecodeapps-plugins/` → `brainmux/`
  - Line 60: `@wecodeapps/brainmux` → `@brainmux/llmproxy`
  - Lines 115, 173: `WeCodeApps-owned registry` → `brainmux-owned registry (GHCR: ghcr.io/brainmuxhq)`
  - Line 178: `<wecodeapps registry>/brainmux-litellm@<digest>` → `ghcr.io/brainmuxhq/brainmux-litellm@<digest>`
  - Line 183: `Docker Hub `wecodeapps` vs GHCR — TBD` → `GHCR ghcr.io/brainmuxhq — chosen`
  - Line 187: `wecodeapps-plugins/plugins/brainmux/` → `brainmux/plugins/llmproxy/`
  - Line 212: `Registry choice for the mirror (Docker Hub `wecodeapps` vs GHCR).` → `Registry: GHCR (ghcr.io/brainmuxhq) — resolved.`
  - Also, plugin-name mentions `plugins/brainmux/`, `plugin.json # @wecodeapps/brainmux`, `skills/ brainmux/` referring to the plugin package should read `plugins/llmproxy/` / `@brainmux/llmproxy`. Keep the skill named `brainmux` (§9 `skills/brainmux`) — that is a skill name, not the package name; leave it.

- [ ] **Step 2: Fix `web/README.md:6`.** Replace `The existing `wecodeapps` portfolio may be repurposed/translated as a starting point.` with `The brainmux.com marketing site — content TBD.`

- [ ] **Step 3: Fix `CLAUDE.md:23`.** Replace the line `- Sahiplik: Ali'nin şahıs firması (yazılım) altında. (WeCodeApps = ayrı/eski portfolio markası, karıştırma.)` with `- Sahiplik: Ali'nin şahıs firması (yazılım) altında.`

- [ ] **Step 4: Verify no references remain.**

Run: `cd ~/Development/Projects/brainmux && grep -rniE 'wecodeapps|azorlu80' --include='*.md' --include='*.json' --include='*.ts' --include='*.yaml' --include='*.yml' . | grep -v node_modules`
Expected: no output (exit 1 from grep = zero matches).

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add docs/specs/2026-09-01-brainmux-architecture-design.md web/README.md CLAUDE.md
git commit -m "docs: retarget spec branding to brainmux, drop WeCodeApps references"
```

---

### Task 2: Package setup — dependencies, tsconfig, dev runner

**Files:**
- Modify: `plugins/llmproxy/package.json`
- Modify: `plugins/llmproxy/tsconfig.json`
- Modify: `plugins/llmproxy/bin/bmux` (entry import path follows the `rootDir` change)

**Interfaces:**
- Consumes: nothing.
- Produces: `zod` and `yaml` importable in `src/`; `npm run build` compiles `src/**` to `dist/`; `npm test` runs `node --test` over compiled tests.

- [ ] **Step 1: Add runtime + dev dependencies.** Edit `plugins/llmproxy/package.json` to add a `dependencies` block and `devDependencies` for Node types. Result:

```json
{
  "name": "@brainmux/llmproxy",
  "version": "0.0.0",
  "description": "Run Claude Code on cheap/alternate LLM brains and delegate grunt work to save your Opus quota.",
  "license": "MIT",
  "type": "module",
  "bin": {
    "bmux": "bin/bmux"
  },
  "files": ["dist", "bin", "templates", "skills", "commands", ".claude-plugin", ".env.example", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "npm run build && node --test \"dist/test/**/*.test.js\""
  },
  "dependencies": {
    "yaml": "^2.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0"
  },
  "engines": { "node": ">=18" }
}
```

- [ ] **Step 2: Confirm tsconfig compiles both `src` and `test` to `dist`.** Read `plugins/llmproxy/tsconfig.json`. It must have `"outDir": "dist"`, `"rootDir": "."` (or include both `src` and `test`), `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, `"strict": true`, and `"include": ["src/**/*", "test/**/*"]`. If `rootDir` is `src`, change it to `.` so `test/` also emits under `dist/test/`. Apply the minimal edit needed to match.

- [ ] **Step 3: Install.**

Run: `cd ~/Development/Projects/brainmux && npm install`
Expected: installs `zod`, `yaml`, `@types/node`; exit 0.

- [ ] **Step 4: Verify the current stub still builds.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm run build`
Expected: `tsc` exits 0, `dist/cli.js` exists.

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/package.json plugins/llmproxy/tsconfig.json package-lock.json
git commit -m "chore(llmproxy): add zod + yaml deps, wire build/test scripts"
```

---

### Task 3: Mirror the LiteLLM image to GHCR (ops) — record the digest

> **Blocking-on-credentials note for the implementer:** this task needs Docker running and push access to `ghcr.io/brainmuxhq`. GHCR push requires a token with the `write:packages` scope. If `docker login ghcr.io` fails, ask the user to run it interactively (`! echo <PAT> | docker login ghcr.io -u azorlu80 --password-stdin`). **Fallback if the push cannot be completed now:** set `IMAGE_REF` (Task 7) to the upstream pin `ghcr.io/berriai/litellm-database@sha256:5ead13edd4efd89f32dab349c1f19447d395affca53f3aeae00f5e6e01b8c08d`, note the follow-up in the commit body, and this task can be redone later (only `IMAGE_REF` + golden fixtures change).

**Files:** none in the repo — this task produces a value (the mirror digest) consumed by Task 7.

**Interfaces:**
- Consumes: upstream pin `ghcr.io/berriai/litellm-database@sha256:5ead13edd4efd89f32dab349c1f19447d395affca53f3aeae00f5e6e01b8c08d`.
- Produces: `MIRROR_DIGEST` = the `sha256:...` digest of `ghcr.io/brainmuxhq/brainmux-litellm` after push. Used verbatim by Task 7's `IMAGE_REF`.

- [ ] **Step 1: Confirm Docker is up.** Run: `docker version` — expect client+server versions (not "Cannot connect to the Docker daemon").

- [ ] **Step 2: Pull the pinned upstream image.**

Run: `docker pull ghcr.io/berriai/litellm-database@sha256:5ead13edd4efd89f32dab349c1f19447d395affca53f3aeae00f5e6e01b8c08d`
Expected: `Status: Downloaded` (or "Image is up to date").

- [ ] **Step 3: Retag for the mirror.**

```bash
docker tag ghcr.io/berriai/litellm-database@sha256:5ead13edd4efd89f32dab349c1f19447d395affca53f3aeae00f5e6e01b8c08d \
  ghcr.io/brainmuxhq/brainmux-litellm:litellm-database-stable
```

- [ ] **Step 4: Log in to GHCR.** If not already logged in, ask the user to run interactively:

`! echo <GHCR_PAT_with_write:packages> | docker login ghcr.io -u azorlu80 --password-stdin`
Expected: `Login Succeeded`.

- [ ] **Step 5: Push.**

Run: `docker push ghcr.io/brainmuxhq/brainmux-litellm:litellm-database-stable`
Expected: push completes; final line prints `...: digest: sha256:<HEX> size: <n>`. **Record that `sha256:<HEX>` as `MIRROR_DIGEST`.**

- [ ] **Step 6: Verify the pushed digest.**

Run: `docker buildx imagetools inspect ghcr.io/brainmuxhq/brainmux-litellm:litellm-database-stable`
Expected: prints a `Digest: sha256:<HEX>` matching `MIRROR_DIGEST`.

- [ ] **Step 7: Make the package public (manual).** In `https://github.com/orgs/brainmuxhq/packages`, open `brainmux-litellm` → Package settings → change visibility to Public. (Otherwise `docker pull` on a fresh machine needs auth.) If access to org settings is unavailable now, note it as a follow-up; local dev still works while logged in.

- [ ] **Step 8: Record the digest for Task 7.** Write `MIRROR_DIGEST` into the scratchpad so Task 7 uses the exact value:

Run: `printf 'IMAGE_REF=ghcr.io/brainmuxhq/brainmux-litellm@%s\n' "sha256:<HEX>" > /tmp/claude-1000/-home-ali-Development-Projects-brainmux-plugins-llmproxy/b28575fc-d099-4197-9de4-a6c2370d7b7b/scratchpad/image-ref.txt`
(No repo commit — this task changes no tracked files.)

---

### Task 4: `core/paths.ts` — resolve BRAINMUX_HOME and state paths

**Files:**
- Create: `plugins/llmproxy/src/core/paths.ts`
- Test: `plugins/llmproxy/test/paths.test.ts`

**Interfaces:**
- Consumes: `process.env` (`BRAINMUX_HOME`), `os.homedir()`.
- Produces:
  ```ts
  export interface Paths {
    home: string;            // BRAINMUX_HOME or ~/.brainmux
    brainsYaml: string;      // <home>/brains.yaml
    envFile: string;         // <home>/.env
    generatedDir: string;    // <home>/generated
    composeYaml: string;     // <home>/generated/compose.yaml
    initDir: string;         // <home>/generated/init
    dataDir: string;         // <home>/data/postgres
    brainConfig(name: string): string; // <home>/generated/<name>.yaml
  }
  export function resolvePaths(env?: NodeJS.ProcessEnv): Paths;
  ```

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/paths.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { resolvePaths } from "../src/core/paths.ts";

test("defaults to ~/.brainmux when BRAINMUX_HOME unset", () => {
  const p = resolvePaths({});
  assert.equal(p.home, path.join(os.homedir(), ".brainmux"));
  assert.equal(p.brainsYaml, path.join(p.home, "brains.yaml"));
  assert.equal(p.composeYaml, path.join(p.home, "generated", "compose.yaml"));
  assert.equal(p.dataDir, path.join(p.home, "data", "postgres"));
  assert.equal(p.brainConfig("chat"), path.join(p.home, "generated", "chat.yaml"));
});

test("honors BRAINMUX_HOME override", () => {
  const p = resolvePaths({ BRAINMUX_HOME: "/custom/home" });
  assert.equal(p.home, "/custom/home");
  assert.equal(p.envFile, path.join("/custom/home", ".env"));
  assert.equal(p.initDir, path.join("/custom/home", "generated", "init"));
});
```

> Note: tests import `../src/*.ts` directly; they compile to `dist/test/*.js` importing `../src/*.js`. TypeScript `NodeNext` rewrites `.ts` import specifiers is NOT automatic — write the import as `../src/core/paths.js` so the compiled JS resolves. **Use `.js` extensions in all relative imports throughout `src/` and `test/`** (NodeNext requirement). Correct the test import to `../src/core/paths.js`.

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: build fails / test errors — `Cannot find module '../src/core/paths.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/core/paths.ts`:

```ts
import os from "node:os";
import path from "node:path";

export interface Paths {
  home: string;
  brainsYaml: string;
  envFile: string;
  generatedDir: string;
  composeYaml: string;
  initDir: string;
  dataDir: string;
  brainConfig(name: string): string;
}

export function resolvePaths(env: NodeJS.ProcessEnv = process.env): Paths {
  const home = env.BRAINMUX_HOME?.trim() || path.join(os.homedir(), ".brainmux");
  const generatedDir = path.join(home, "generated");
  return {
    home,
    brainsYaml: path.join(home, "brains.yaml"),
    envFile: path.join(home, ".env"),
    generatedDir,
    composeYaml: path.join(generatedDir, "compose.yaml"),
    initDir: path.join(generatedDir, "init"),
    dataDir: path.join(home, "data", "postgres"),
    brainConfig: (name: string) => path.join(generatedDir, `${name}.yaml`),
  };
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: `paths` tests pass (2 pass).

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/core/paths.ts plugins/llmproxy/test/paths.test.ts
git commit -m "feat(llmproxy): add core/paths — resolve BRAINMUX_HOME state layout"
```

---

### Task 5: `core/manifest.ts` — zod schema + parse/validate `brains.yaml`

**Files:**
- Create: `plugins/llmproxy/src/core/manifest.ts`
- Test: `plugins/llmproxy/test/manifest.test.ts`

**Interfaces:**
- Consumes: `yaml.parse`, `zod`.
- Produces:
  ```ts
  export interface Brain { port: number; model: string; providerKey: string; }
  export type BrainsConfig = { version: 1; brains: Record<string, Brain>; };
  export function parseBrains(text: string): BrainsConfig; // throws Error(readable) on invalid
  export function loadBrains(file: string): BrainsConfig;   // reads file then parseBrains
  ```

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/manifest.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBrains } from "../src/core/manifest.js";

const good = `
version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,          providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }
`;

test("parses a valid three-brain manifest", () => {
  const cfg = parseBrains(good);
  assert.equal(cfg.version, 1);
  assert.equal(Object.keys(cfg.brains).length, 3);
  assert.equal(cfg.brains.chat.port, 4567);
  assert.equal(cfg.brains.deep.model, "openrouter/z-ai/glm-5.2");
  assert.equal(cfg.brains.coder.providerKey, "OPENROUTER_API_KEY");
});

test("rejects wrong version", () => {
  assert.throws(() => parseBrains("version: 2\nbrains: {}"), /version/i);
});

test("rejects duplicate ports", () => {
  const dup = `
version: 1
brains:
  a: { port: 4000, model: openrouter/x, providerKey: OPENROUTER_API_KEY }
  b: { port: 4000, model: openrouter/y, providerKey: OPENROUTER_API_KEY }
`;
  assert.throws(() => parseBrains(dup), /port/i);
});

test("rejects a bad brain name", () => {
  const bad = `
version: 1
brains:
  "Chat!": { port: 4001, model: openrouter/x, providerKey: OPENROUTER_API_KEY }
`;
  assert.throws(() => parseBrains(bad), /name/i);
});

test("rejects a non-env-style providerKey", () => {
  const bad = `
version: 1
brains:
  chat: { port: 4001, model: openrouter/x, providerKey: my-key }
`;
  assert.throws(() => parseBrains(bad), /providerKey/i);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/core/manifest.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/core/manifest.ts`:

```ts
import fs from "node:fs";
import YAML from "yaml";
import { z } from "zod";

const BrainSchema = z.object({
  port: z.number().int().min(1).max(65535),
  model: z.string().min(1),
  providerKey: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "providerKey must be an ENV_VAR-style name"),
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

export interface Brain { port: number; model: string; providerKey: string; }
export type BrainsConfig = z.infer<typeof BrainsConfigSchema>;

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
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: all 5 manifest tests pass.

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/core/manifest.ts plugins/llmproxy/test/manifest.test.ts
git commit -m "feat(llmproxy): add core/manifest — zod-validated brains.yaml SSOT"
```

---

### Task 6: `core/env.ts` — `.env` read/write, chmod 600, key generation

**Files:**
- Create: `plugins/llmproxy/src/core/env.ts`
- Test: `plugins/llmproxy/test/env.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:crypto`.
- Produces:
  ```ts
  export function parseEnv(text: string): Map<string, string>;
  export function readEnv(file: string): Map<string, string>;       // {} if missing
  export function writeEnv(file: string, map: Map<string, string>): void; // chmod 600
  export function getKey(file: string, key: string): string | undefined;
  export function setKey(file: string, key: string, value: string): void; // upsert, preserves others
  export function genSecret(bytes?: number): string;                 // hex, default 16 bytes
  ```

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/env.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEnv, readEnv, writeEnv, getKey, setKey, genSecret } from "../src/core/env.js";

function tmp(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bmux-env-")), ".env");
}

test("parseEnv ignores comments and blanks, keeps = in values", () => {
  const m = parseEnv("# c\n\nA=1\nB=x=y\n");
  assert.equal(m.get("A"), "1");
  assert.equal(m.get("B"), "x=y");
  assert.equal(m.size, 2);
});

test("writeEnv round-trips and sets mode 600", () => {
  const f = tmp();
  writeEnv(f, new Map([["A", "1"], ["B", "2"]]));
  assert.equal((fs.statSync(f).mode & 0o777), 0o600);
  const m = readEnv(f);
  assert.equal(m.get("A"), "1");
  assert.equal(m.get("B"), "2");
});

test("setKey upserts without dropping siblings", () => {
  const f = tmp();
  writeEnv(f, new Map([["A", "1"]]));
  setKey(f, "B", "2");
  setKey(f, "A", "9");
  assert.equal(getKey(f, "A"), "9");
  assert.equal(getKey(f, "B"), "2");
});

test("readEnv returns empty map for a missing file", () => {
  assert.equal(readEnv("/no/such/.env").size, 0);
});

test("genSecret returns 32 hex chars for 16 bytes and varies", () => {
  const a = genSecret();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, genSecret());
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/core/env.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/core/env.ts`:

```ts
import fs from "node:fs";
import crypto from "node:crypto";

export function parseEnv(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1));
  }
  return map;
}

export function readEnv(file: string): Map<string, string> {
  try {
    return parseEnv(fs.readFileSync(file, "utf8"));
  } catch {
    return new Map();
  }
}

export function writeEnv(file: string, map: Map<string, string>): void {
  const body = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(file, body, { mode: 0o600 });
  fs.chmodSync(file, 0o600); // enforce even if file pre-existed with looser mode
}

export function getKey(file: string, key: string): string | undefined {
  return readEnv(file).get(key);
}

export function setKey(file: string, key: string, value: string): void {
  const map = readEnv(file);
  map.set(key, value);
  writeEnv(file, map);
}

export function genSecret(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: all 5 env tests pass. (chmod assertion is POSIX; this repo is Linux.)

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/core/env.ts plugins/llmproxy/test/env.test.ts
git commit -m "feat(llmproxy): add core/env — .env r/w (chmod 600) + secret gen"
```

---

### Task 7: `core/generate.ts` — brains.yaml → compose + per-brain configs + init SQL (golden)

**Files:**
- Create: `plugins/llmproxy/src/core/generate.ts`
- Test: `plugins/llmproxy/test/generate.test.ts`
- Create fixtures: `plugins/llmproxy/test/fixtures/three-brains/compose.yaml`, `chat.yaml`, `deep.yaml`, `coder.yaml`, `init/01-databases.sql`

**Interfaces:**
- Consumes: `BrainsConfig` (Task 5), `IMAGE_REF` = the digest from Task 3 (`MIRROR_DIGEST`; fallback: upstream pin).
- Produces:
  ```ts
  export const IMAGE_REF: string;
  export function dbName(brain: string): string;        // `litellm_<brain>`
  export function masterKeyVar(brain: string): string;  // `<BRAIN>_MASTER_KEY`
  export interface Generated {
    compose: string;
    configs: Record<string, string>; // brain -> litellm config yaml
    initSql: string;
  }
  export function generate(cfg: BrainsConfig): Generated;
  ```
- **Semantic parity target (from prototype):** for the three brains, each generated per-brain config equals the prototype's `config/<brain>.yaml` (modulo the header comment): `litellm_settings.drop_params: true` + `model_list: [{ model_name: "*", litellm_params: { model: <brain model> } }]`. The compose defines one `brainmux-<brain>` service per brain (ports `127.0.0.1:<port>:4000`, env `LITELLM_SALT_KEY`, `STORE_MODEL_IN_DB`, `DATABASE_URL` → per-brain DB, `LITELLM_MASTER_KEY` → `<BRAIN>_MASTER_KEY`, provider key env passthrough) plus one `brainmux-postgres`. The init SQL is `CREATE DATABASE litellm_<brain>;` per brain. **Two intentional deviations from the prototype file:** (a) `image` is `IMAGE_REF` (mirror digest) not `:main-stable`; (b) volume paths are relative to `generated/` (`../data/postgres`, `./init`, `./<brain>.yaml`) not `./data`/`./config`.

- [ ] **Step 1: Write the golden test.** Create `plugins/llmproxy/test/generate.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrains } from "../src/core/manifest.js";
import { generate, dbName, masterKeyVar } from "../src/core/generate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// fixtures live in the source tree, not dist — walk back to plugins/llmproxy/test
const fixDir = path.resolve(here, "../../test/fixtures/three-brains");

const cfg = parseBrains(`
version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,          providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }
`);

function fixture(rel: string): string {
  return fs.readFileSync(path.join(fixDir, rel), "utf8");
}

test("helpers derive db + master-key names", () => {
  assert.equal(dbName("chat"), "litellm_chat");
  assert.equal(masterKeyVar("chat"), "CHAT_MASTER_KEY");
});

test("compose matches golden", () => {
  assert.equal(generate(cfg).compose, fixture("compose.yaml"));
});

test("per-brain configs match golden", () => {
  const g = generate(cfg);
  assert.equal(g.configs.chat, fixture("chat.yaml"));
  assert.equal(g.configs.deep, fixture("deep.yaml"));
  assert.equal(g.configs.coder, fixture("coder.yaml"));
});

test("init sql matches golden", () => {
  assert.equal(generate(cfg).initSql, fixture("init/01-databases.sql"));
});
```

> Fixture path note: compiled test at `dist/test/generate.test.js` resolves `../../test/fixtures/...` = `plugins/llmproxy/test/fixtures/...`. Keep fixtures in the source `test/` dir (they are not compiled). Verify the relative depth when running; adjust `fixDir` if `dist` nesting differs.

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/core/generate.js'`.

- [ ] **Step 3: Write the implementation.** Create `plugins/llmproxy/src/core/generate.ts`. **Set `IMAGE_REF` to the exact value from Task 3's `/tmp/.../scratchpad/image-ref.txt`** (mirror digest); if the mirror was deferred, use the upstream pin shown below.

```ts
import type { BrainsConfig } from "./manifest.js";

// From Task 3 (GHCR mirror). Fallback if mirror deferred:
//   ghcr.io/berriai/litellm-database@sha256:5ead13edd4efd89f32dab349c1f19447d395affca53f3aeae00f5e6e01b8c08d
export const IMAGE_REF = "ghcr.io/brainmuxhq/brainmux-litellm@sha256:<MIRROR_DIGEST>";

export function dbName(brain: string): string {
  return `litellm_${brain}`;
}

export function masterKeyVar(brain: string): string {
  return `${brain.toUpperCase()}_MASTER_KEY`;
}

function brainConfig(model: string): string {
  return [
    "litellm_settings:",
    "  drop_params: true",
    "",
    "model_list:",
    '  - model_name: "*"',
    "    litellm_params:",
    `      model: ${model}`,
    "",
  ].join("\n");
}

function serviceBlock(name: string, port: number, providerKey: string): string {
  return [
    `  ${name}:`,
    "    <<: *litellm-base",
    `    container_name: brainmux-${name}`,
    "    ports:",
    `      - "127.0.0.1:${port}:4000"`,
    "    environment:",
    "      LITELLM_SALT_KEY: ${LITELLM_SALT_KEY}",
    '      STORE_MODEL_IN_DB: "True"',
    `      DATABASE_URL: postgresql://litellm:\${POSTGRES_PASSWORD}@postgres:5432/${dbName(name)}`,
    `      LITELLM_MASTER_KEY: \${${masterKeyVar(name)}}`,
    `      ${providerKey}: \${${providerKey}}`,
    "    volumes:",
    `      - ./${name}.yaml:/app/config.yaml:ro`,
    "",
  ].join("\n");
}

export interface Generated {
  compose: string;
  configs: Record<string, string>;
  initSql: string;
}

export function generate(cfg: BrainsConfig): Generated {
  const names = Object.keys(cfg.brains); // insertion order preserved by YAML.parse

  const header = [
    "# GENERATED by bmux from brains.yaml — do not hand-edit.",
    "# Edit brains.yaml then run `bmux up` (regenerates) or `bmux config ...`.",
    "",
    "x-litellm-base: &litellm-base",
    `  image: ${IMAGE_REF}`,
    "  restart: unless-stopped",
    "  depends_on:",
    "    postgres:",
    "      condition: service_healthy",
    "  networks: [brainmux]",
    '  command: ["--config", "/app/config.yaml"]',
    "  logging:",
    "    driver: json-file",
    '    options: { max-size: "10m", max-file: "3" }',
    "  healthcheck:",
    `    test: ["CMD-SHELL", "python3 -c \\"import urllib.request; urllib.request.urlopen('http://localhost:4000/health/liveliness')\\""]`,
    "    interval: 15s",
    "    timeout: 5s",
    "    retries: 5",
    "    start_period: 30s",
    "",
    "services:",
    "  postgres:",
    "    image: postgres:16-alpine",
    "    container_name: brainmux-postgres",
    "    restart: unless-stopped",
    "    networks: [brainmux]",
    "    logging:",
    "      driver: json-file",
    '      options: { max-size: "10m", max-file: "3" }',
    "    environment:",
    "      POSTGRES_USER: litellm",
    "      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}",
    "      POSTGRES_DB: litellm",
    "    volumes:",
    "      - ../data/postgres:/var/lib/postgresql/data",
    "      - ./init:/docker-entrypoint-initdb.d:ro",
    "    healthcheck:",
    '      test: ["CMD-SHELL", "pg_isready -U litellm"]',
    "      interval: 5s",
    "      timeout: 5s",
    "      retries: 10",
    "",
  ].join("\n");

  const services = names.map((n) => serviceBlock(n, cfg.brains[n].port, cfg.brains[n].providerKey)).join("");

  const footer = ["networks:", "  brainmux:", "    name: brainmux", ""].join("\n");

  const compose = header + services + footer;

  const configs: Record<string, string> = {};
  for (const n of names) configs[n] = brainConfig(cfg.brains[n].model);

  const initSql =
    "-- GENERATED by bmux — one database per brain.\n" +
    names.map((n) => `CREATE DATABASE ${dbName(n)};`).join("\n") +
    "\n";

  return { compose, configs, initSql };
}
```

- [ ] **Step 4: Generate the golden fixtures from the implementation, then eyeball them.** The fixtures ARE the intended output; create them by running the generator once and saving, then manually confirm each against the parity target above.

```bash
cd ~/Development/Projects/brainmux/plugins/llmproxy && npm run build
mkdir -p test/fixtures/three-brains/init
node --input-type=module -e '
import { parseBrains } from "./dist/src/core/manifest.js";
import { generate } from "./dist/src/core/generate.js";
import fs from "node:fs";
const cfg = parseBrains(`version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,          providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }`);
const g = generate(cfg);
const d = "test/fixtures/three-brains";
fs.writeFileSync(d+"/compose.yaml", g.compose);
for (const [k,v] of Object.entries(g.configs)) fs.writeFileSync(d+"/"+k+".yaml", v);
fs.writeFileSync(d+"/init/01-databases.sql", g.initSql);
console.log("wrote fixtures");
'
```
Then Read each generated fixture and confirm: three services with the right ports/DBs/master-key vars, `IMAGE_REF` on the anchor, `model_name: "*"` + right model per brain, and `CREATE DATABASE litellm_{chat,deep,coder};`. **Compare env keys + ports + models against `~/Development/Projects/claude-proxy/compose.yaml` and `config/*.yaml` to confirm semantic parity** (differences must be only the two intentional deviations: image ref + relative volume paths).

- [ ] **Step 5: Run the golden test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: all generate tests pass (helpers + compose + configs + init).

- [ ] **Step 6: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/core/generate.ts plugins/llmproxy/test/generate.test.ts plugins/llmproxy/test/fixtures/three-brains
git commit -m "feat(llmproxy): add core/generate — brains.yaml → compose/config/init (golden)"
```

---

### Task 8: `core/docker.ts` — compose wrapper, health, docker detection

**Files:**
- Create: `plugins/llmproxy/src/core/docker.ts`
- Test: `plugins/llmproxy/test/docker.test.ts`

**Interfaces:**
- Consumes: `node:child_process`, `Paths` (Task 4).
- Produces:
  ```ts
  export function composeArgs(paths: Paths): string[];   // ["compose","-f",<composeYaml>]
  export function ensureDocker(): void;                   // throws readable error if absent/down
  export function runCompose(paths: Paths, args: string[]): number; // spawnSync, inherit stdio, returns exit code
  export function liveliness(port: number, timeoutMs?: number): boolean; // GET /health/liveliness
  ```

- [ ] **Step 1: Write the failing test** (pure parts only — no Docker needed). Create `plugins/llmproxy/test/docker.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeArgs } from "../src/core/docker.js";
import { resolvePaths } from "../src/core/paths.js";

test("composeArgs points -f at the generated compose file", () => {
  const p = resolvePaths({ BRAINMUX_HOME: "/x" });
  assert.deepEqual(composeArgs(p), ["compose", "-f", "/x/generated/compose.yaml"]);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/core/docker.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/core/docker.ts`:

```ts
import { spawnSync } from "node:child_process";
import http from "node:http";
import type { Paths } from "./paths.js";

export function composeArgs(paths: Paths): string[] {
  return ["compose", "-f", paths.composeYaml];
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
```

> Signature note: `liveliness` returns `Promise<boolean>` (async HTTP). The interface block above is corrected by this — callers `await` it. Keep this version.

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: `composeArgs` test passes.

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/core/docker.ts plugins/llmproxy/test/docker.test.ts
git commit -m "feat(llmproxy): add core/docker — compose wrapper + liveliness probe"
```

---

### Task 9: `commands/init.ts` — scaffold `~/.brainmux`, keys, generate

**Files:**
- Create: `plugins/llmproxy/src/commands/init.ts`
- Create: `plugins/llmproxy/templates/brains.default.yaml`
- Create: `plugins/llmproxy/.env.example`
- Test: `plugins/llmproxy/test/init.test.ts`

**Interfaces:**
- Consumes: `resolvePaths`, `loadBrains`/`parseBrains`, `generate`, `env` helpers, `masterKeyVar`.
- Produces:
  ```ts
  export function runInit(env?: NodeJS.ProcessEnv): number; // idempotent scaffold; returns 0
  export function writeGenerated(paths: Paths, cfg: BrainsConfig): void; // (re)write generated/*
  export function ensureSecrets(paths: Paths, cfg: BrainsConfig): void;  // fill missing keys in .env
  ```
  `writeGenerated` + `ensureSecrets` are reused by `stack.up` and `config.*`.

- [ ] **Step 1: Create the default manifest template.** Create `plugins/llmproxy/templates/brains.default.yaml`:

```yaml
version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,          providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }
```

- [ ] **Step 2: Create `.env.example`.** Create `plugins/llmproxy/.env.example`:

```bash
# brainmux/llmproxy secrets — managed by `bmux`. Real secrets live in ~/.brainmux/.env (chmod 600).
# `bmux init` auto-generates POSTGRES_PASSWORD, LITELLM_SALT_KEY, and <BRAIN>_MASTER_KEY per brain.
# You supply provider keys (e.g. OPENROUTER_API_KEY) via `bmux config add-key OPENROUTER_API_KEY <value>`.
POSTGRES_PASSWORD=change-me
LITELLM_SALT_KEY=sk-salt-change-me
OPENROUTER_API_KEY=your-openrouter-api-key
CHAT_MASTER_KEY=sk-chat-change-me
DEEP_MASTER_KEY=sk-deep-change-me
CODER_MASTER_KEY=sk-coder-change-me
```

- [ ] **Step 3: Write the failing test.** Create `plugins/llmproxy/test/init.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInit } from "../src/commands/init.js";
import { readEnv } from "../src/core/env.js";

function home(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bmux-home-"));
}

test("init scaffolds state, keys, and generated artifacts", () => {
  const h = home();
  const code = runInit({ BRAINMUX_HOME: h });
  assert.equal(code, 0);
  assert.ok(fs.existsSync(path.join(h, "brains.yaml")));
  assert.ok(fs.existsSync(path.join(h, "generated", "compose.yaml")));
  assert.ok(fs.existsSync(path.join(h, "generated", "chat.yaml")));
  assert.ok(fs.existsSync(path.join(h, "generated", "init", "01-databases.sql")));
  assert.ok(fs.existsSync(path.join(h, "data", "postgres")));
  const env = readEnv(path.join(h, ".env"));
  for (const k of ["POSTGRES_PASSWORD", "LITELLM_SALT_KEY", "CHAT_MASTER_KEY", "DEEP_MASTER_KEY", "CODER_MASTER_KEY"]) {
    assert.ok((env.get(k) ?? "").length > 0, `${k} generated`);
  }
});

test("init is idempotent — second run keeps existing keys", () => {
  const h = home();
  runInit({ BRAINMUX_HOME: h });
  const first = readEnv(path.join(h, ".env")).get("LITELLM_SALT_KEY");
  runInit({ BRAINMUX_HOME: h });
  const second = readEnv(path.join(h, ".env")).get("LITELLM_SALT_KEY");
  assert.equal(first, second);
});
```

- [ ] **Step 4: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/commands/init.js'`.

- [ ] **Step 5: Write minimal implementation.** Create `plugins/llmproxy/src/commands/init.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePaths, type Paths } from "../core/paths.js";
import { parseBrains, type BrainsConfig } from "../core/manifest.js";
import { generate, masterKeyVar } from "../core/generate.js";
import { readEnv, writeEnv, genSecret } from "../core/env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/src/commands -> package root -> templates/
const templatesDir = path.resolve(here, "../../../templates");

export function writeGenerated(paths: Paths, cfg: BrainsConfig): void {
  const g = generate(cfg);
  fs.mkdirSync(paths.initDir, { recursive: true });
  fs.writeFileSync(paths.composeYaml, g.compose);
  for (const [brain, cfgText] of Object.entries(g.configs)) {
    fs.writeFileSync(paths.brainConfig(brain), cfgText);
  }
  fs.writeFileSync(path.join(paths.initDir, "01-databases.sql"), g.initSql);
}

export function ensureSecrets(paths: Paths, cfg: BrainsConfig): void {
  const env = readEnv(paths.envFile);
  const putIfAbsent = (k: string, v: () => string) => { if (!env.get(k)) env.set(k, v()); };
  putIfAbsent("POSTGRES_PASSWORD", () => genSecret());
  putIfAbsent("LITELLM_SALT_KEY", () => "sk-salt-" + genSecret());
  for (const brain of Object.keys(cfg.brains)) {
    putIfAbsent(masterKeyVar(brain), () => `sk-${brain}-` + genSecret());
    // provider keys are user-supplied; leave a placeholder only if absent
    putIfAbsent(cfg.brains[brain].providerKey, () => "");
  }
  writeEnv(paths.envFile, env);
}

export function runInit(env: NodeJS.ProcessEnv = process.env): number {
  const paths = resolvePaths(env);
  fs.mkdirSync(paths.home, { recursive: true });
  fs.mkdirSync(paths.dataDir, { recursive: true });

  if (!fs.existsSync(paths.brainsYaml)) {
    fs.copyFileSync(path.join(templatesDir, "brains.default.yaml"), paths.brainsYaml);
  }
  const cfg = parseBrains(fs.readFileSync(paths.brainsYaml, "utf8"));
  ensureSecrets(paths, cfg);
  writeGenerated(paths, cfg);

  console.log(`bmux: initialized ${paths.home}`);
  console.log(`  brains.yaml, .env (chmod 600), generated/ written.`);
  const missing = Object.values(cfg.brains).map((b) => b.providerKey)
    .filter((k, i, a) => a.indexOf(k) === i)
    .filter((k) => !readEnv(paths.envFile).get(k));
  if (missing.length) {
    console.log(`  next: add provider key(s): ${missing.map((k) => `bmux config add-key ${k} <value>`).join("  ")}`);
  }
  return 0;
}
```

- [ ] **Step 6: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: both init tests pass. (If the templates path resolves wrong from `dist/`, fix `templatesDir` depth and re-run.)

- [ ] **Step 7: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/commands/init.ts plugins/llmproxy/templates/brains.default.yaml plugins/llmproxy/.env.example plugins/llmproxy/test/init.test.ts
git commit -m "feat(llmproxy): add init — scaffold ~/.brainmux, gen keys + artifacts"
```

---

### Task 10: `commands/stack.ts` — up/down/restart/ps/logs/health

**Files:**
- Create: `plugins/llmproxy/src/commands/stack.ts`
- Test: (covered by build + Task 16 live smoke; no pure-unit surface beyond `health` formatting)

**Interfaces:**
- Consumes: `resolvePaths`, `loadBrains`, `ensureDocker`, `runCompose`, `liveliness`, `writeGenerated`.
- Produces:
  ```ts
  export function runStack(sub: string, rest: string[], env?: NodeJS.ProcessEnv): Promise<number>;
  ```
  `sub` ∈ `up|down|restart|ps|logs|health`.

- [ ] **Step 1: Write the implementation.** Create `plugins/llmproxy/src/commands/stack.ts`:

```ts
import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { ensureDocker, runCompose, liveliness } from "../core/docker.js";
import { writeGenerated } from "./init.js";

export async function runStack(sub: string, rest: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const paths = resolvePaths(env);
  if (sub === "up" || sub === "restart") {
    ensureDocker();
    const cfg = loadBrains(paths.brainsYaml);
    writeGenerated(paths, cfg); // regenerate from SSOT before (re)starting
    const args = sub === "restart" ? ["up", "-d", "--force-recreate"] : ["up", "-d"];
    return runCompose(paths, args);
  }
  if (sub === "down") { ensureDocker(); return runCompose(paths, ["down"]); }
  if (sub === "ps") { ensureDocker(); return runCompose(paths, ["ps"]); }
  if (sub === "logs") { ensureDocker(); return runCompose(paths, ["logs", "-f", ...rest]); }
  if (sub === "health") {
    const cfg = loadBrains(paths.brainsYaml);
    let fail = 0;
    for (const [name, b] of Object.entries(cfg.brains)) {
      const ok = await liveliness(b.port);
      process.stdout.write(`${name.padEnd(8)} ${ok ? "UP  " : "DOWN"} (:${b.port})\n`);
      if (!ok) fail = 1;
    }
    return fail;
  }
  process.stderr.write(`bmux: unknown stack command '${sub}'\n`);
  return 1;
}
```

- [ ] **Step 2: Verify it builds.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/commands/stack.ts
git commit -m "feat(llmproxy): add stack — up/down/restart/ps/logs/health"
```

---

### Task 11: `commands/launch.ts` — chat/deep/coder (exec claude with brain env)

**Files:**
- Create: `plugins/llmproxy/src/commands/launch.ts`
- Test: `plugins/llmproxy/test/launch.test.ts`

**Interfaces:**
- Consumes: `resolvePaths`, `loadBrains`, `getKey`, `masterKeyVar`.
- Produces:
  ```ts
  export interface LaunchPlan { base: string; apiKey: string; }
  export function planLaunch(brain: string, env?: NodeJS.ProcessEnv): LaunchPlan; // throws if brain/key missing
  export function runLaunch(brain: string, claudeArgs: string[], env?: NodeJS.ProcessEnv): number; // execs claude
  ```

- [ ] **Step 1: Write the failing test** (pure `planLaunch`, no exec). Create `plugins/llmproxy/test/launch.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInit } from "../src/commands/init.js";
import { setKey } from "../src/core/env.js";
import { planLaunch } from "../src/commands/launch.js";

test("planLaunch resolves base url + master key for a brain", () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-launch-"));
  runInit({ BRAINMUX_HOME: h });
  const plan = planLaunch("deep", { BRAINMUX_HOME: h });
  assert.equal(plan.base, "http://127.0.0.1:4568");
  assert.match(plan.apiKey, /^sk-deep-/);
});

test("planLaunch throws for an unknown brain", () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-launch2-"));
  runInit({ BRAINMUX_HOME: h });
  assert.throws(() => planLaunch("nope", { BRAINMUX_HOME: h }), /unknown brain/i);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/commands/launch.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/commands/launch.ts`:

```ts
import { spawnSync } from "node:child_process";
import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";

export interface LaunchPlan { base: string; apiKey: string; }

export function planLaunch(brain: string, env: NodeJS.ProcessEnv = process.env): LaunchPlan {
  const paths = resolvePaths(env);
  const cfg = loadBrains(paths.brainsYaml);
  const b = cfg.brains[brain];
  if (!b) throw new Error(`unknown brain '${brain}' (have: ${Object.keys(cfg.brains).join(", ")})`);
  const apiKey = getKey(paths.envFile, masterKeyVar(brain));
  if (!apiKey) throw new Error(`${masterKeyVar(brain)} missing in ${paths.envFile} — run \`bmux init\`.`);
  return { base: `http://127.0.0.1:${b.port}`, apiKey };
}

export function runLaunch(brain: string, claudeArgs: string[], env: NodeJS.ProcessEnv = process.env): number {
  const plan = planLaunch(brain, env);
  const r = spawnSync("claude", claudeArgs, {
    stdio: "inherit",
    env: { ...env, ANTHROPIC_BASE_URL: plan.base, ANTHROPIC_API_KEY: plan.apiKey },
  });
  return r.status ?? 1;
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: both launch tests pass.

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/commands/launch.ts plugins/llmproxy/test/launch.test.ts
git commit -m "feat(llmproxy): add launch — run claude on a brain (port + master key)"
```

---

### Task 12: `commands/delegate.ts` — headless delegation with modes + recursion guard

**Files:**
- Create: `plugins/llmproxy/src/commands/delegate.ts`
- Test: `plugins/llmproxy/test/delegate.test.ts`

**Interfaces:**
- Consumes: `planLaunch` (Task 11), `node:child_process`.
- Produces:
  ```ts
  export interface DelegateOpts { mode: "analyze" | "write" | "yolo"; workdir: string; outfmt: "text" | "json"; task: string; }
  export function parseDelegateArgs(argv: string[], stdin?: string): { brain: string; opts: DelegateOpts };
  export function buildClaudeArgs(opts: DelegateOpts): string[]; // the `claude -p ...` arg vector
  export function runDelegate(argv: string[], env?: NodeJS.ProcessEnv): number;
  ```
- Behavior parity with prototype `bin/delegate`: default `analyze` = `--permission-mode default --allowedTools Read Grep Glob`; `--write` = `--permission-mode acceptEdits`; `--yolo` = `--dangerously-skip-permissions`. Always `--append-system-prompt <guard>`. Recursion guard via `DELEGATE_DEPTH`. `-C <dir>`, `--json`, stdin task via `-`.

- [ ] **Step 1: Write the failing test** (pure arg building — no claude exec). Create `plugins/llmproxy/test/delegate.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDelegateArgs, buildClaudeArgs } from "../src/commands/delegate.js";

test("default mode = analyze, read-only tools", () => {
  const { brain, opts } = parseDelegateArgs(["coder", "find the bug"]);
  assert.equal(brain, "coder");
  assert.equal(opts.mode, "analyze");
  const args = buildClaudeArgs(opts);
  assert.ok(args.includes("-p"));
  assert.ok(args.includes("find the bug"));
  assert.ok(args.includes("--allowedTools"));
  assert.deepEqual(args.slice(args.indexOf("--allowedTools") + 1, args.indexOf("--allowedTools") + 4), ["Read", "Grep", "Glob"]);
});

test("--write flips to acceptEdits and drops the read-only allowlist", () => {
  const { opts } = parseDelegateArgs(["coder", "--write", "do it"]);
  assert.equal(opts.mode, "write");
  const args = buildClaudeArgs(opts);
  assert.ok(args.includes("acceptEdits"));
  assert.ok(!args.includes("--allowedTools"));
});

test("--yolo uses dangerously-skip-permissions", () => {
  const { opts } = parseDelegateArgs(["coder", "--yolo", "go"]);
  assert.equal(opts.mode, "yolo");
  assert.ok(buildClaudeArgs(opts).includes("--dangerously-skip-permissions"));
});

test("--json sets output format; -C sets workdir", () => {
  const { opts } = parseDelegateArgs(["chat", "--json", "-C", "/tmp/x", "sum"]);
  assert.equal(opts.outfmt, "json");
  assert.equal(opts.workdir, "/tmp/x");
  assert.ok(buildClaudeArgs(opts).includes("json"));
});

test("stdin task via '-'", () => {
  const { opts } = parseDelegateArgs(["deep", "-"], "big task from stdin");
  assert.equal(opts.task, "big task from stdin");
});

test("rejects a missing brain (flag-first or empty)", () => {
  assert.throws(() => parseDelegateArgs(["--write", "x"]), /missing brain/i);
  assert.throws(() => parseDelegateArgs([]), /missing brain/i);
});
```

> Drift note: brain-name validity is NOT hardcoded here. `brains.yaml` is the SSOT for which brains exist; `runDelegate`→`planLaunch` validates the name against the live manifest. `parseDelegateArgs` only ensures a brain token is present, so `bmux delegate <any-custom-brain>` works after `config add-brain`.

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/commands/delegate.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/commands/delegate.ts`:

```ts
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { planLaunch } from "./launch.js";

const GUARD =
  "You are a DELEGATED worker brain invoked by an orchestrator. Do EXACTLY the task, " +
  "nothing more. Never delegate further. Be concise; return ONLY the result the " +
  "orchestrator asked for (no preamble, no sign-off).";

export interface DelegateOpts {
  mode: "analyze" | "write" | "yolo";
  workdir: string;
  outfmt: "text" | "json";
  task: string;
}

export function parseDelegateArgs(argv: string[], stdin?: string): { brain: string; opts: DelegateOpts } {
  const brain = argv[0];
  if (!brain || brain.startsWith("-")) throw new Error("delegate: missing brain (chat|deep|coder|...)");
  const opts: DelegateOpts = { mode: "analyze", workdir: ".", outfmt: "text", task: "" };
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--write") opts.mode = "write";
    else if (a === "--yolo") opts.mode = "yolo";
    else if (a === "--json") opts.outfmt = "json";
    else if (a === "-C") { opts.workdir = rest[++i] ?? "."; }
    else if (a === "-") { opts.task = stdin ?? ""; }
    else if (a === "--") { opts.task = rest.slice(i + 1).join(" "); break; }
    else if (a.startsWith("-")) throw new Error(`delegate: unknown option '${a}'`);
    else opts.task = a;
  }
  // Brain validity is the manifest's call (SSOT = brains.yaml); runDelegate/planLaunch
  // validate it against the live config. Here we only require a task.
  if (!opts.task) throw new Error("delegate: no task given");
  return { brain, opts };
}

export function buildClaudeArgs(opts: DelegateOpts): string[] {
  const args = ["-p", opts.task, "--output-format", opts.outfmt, "--append-system-prompt", GUARD];
  if (opts.mode === "analyze") args.push("--permission-mode", "default", "--allowedTools", "Read", "Grep", "Glob");
  else if (opts.mode === "write") args.push("--permission-mode", "acceptEdits");
  else args.push("--dangerously-skip-permissions");
  return args;
}

export function runDelegate(argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  if (env.DELEGATE_DEPTH) {
    process.stderr.write("delegate: refusing to nest (a delegated worker cannot delegate).\n");
    return 2;
  }
  const wantsStdin = argv.includes("-");
  const stdin = wantsStdin ? readFileSync(0, "utf8") : undefined;
  const { brain, opts } = parseDelegateArgs(argv, stdin);
  if (!fs.existsSync(opts.workdir)) { process.stderr.write(`delegate: -C dir '${opts.workdir}' not found\n`); return 1; }
  const plan = planLaunch(brain, env); // validates brain against manifest + resolves key/port
  if (opts.mode === "yolo") process.stderr.write(`delegate: ⚠ --yolo — '${brain}' runs with NO permission checks in '${opts.workdir}'.\n`);
  const r = spawnSync("claude", buildClaudeArgs(opts), {
    cwd: opts.workdir,
    stdio: wantsStdin ? ["inherit", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
    env: { ...env, DELEGATE_DEPTH: "1", ANTHROPIC_BASE_URL: plan.base, ANTHROPIC_API_KEY: plan.apiKey },
  });
  return r.status ?? 1;
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: all 6 delegate tests pass.

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/commands/delegate.ts plugins/llmproxy/test/delegate.test.ts
git commit -m "feat(llmproxy): add delegate — headless brain tasks, modes + recursion guard"
```

---

### Task 13: `commands/config.ts` — add-brain/remove-brain/set-model/add-key/list

**Files:**
- Create: `plugins/llmproxy/src/commands/config.ts`
- Test: `plugins/llmproxy/test/config.test.ts`

**Interfaces:**
- Consumes: `resolvePaths`, `loadBrains`, `parseBrains`, `writeGenerated`, `ensureSecrets`, `env` helpers, `YAML`.
- Produces:
  ```ts
  export function runConfig(sub: string, rest: string[], env?: NodeJS.ProcessEnv): number;
  export function addBrain(paths: Paths, name: string, port: number, model: string, providerKey: string): void; // throws on dup name/port
  ```
  Subcommands: `add-brain <name> <port> <model> [providerKey=OPENROUTER_API_KEY]`, `remove-brain <name>`, `set-model <name> <model>`, `add-key <ENV_VAR> <value>`, `list`.
  Every mutation rewrites `brains.yaml`, regenerates artifacts, and (for secret-bearing changes) tops up `.env`.

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/config.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInit } from "../src/commands/init.js";
import { runConfig } from "../src/commands/config.js";
import { loadBrains } from "../src/core/manifest.js";
import { getKey } from "../src/core/env.js";

function freshHome(): string {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-config-"));
  runInit({ BRAINMUX_HOME: h });
  return h;
}

test("add-brain appends to brains.yaml, regenerates, mints a master key", () => {
  const h = freshHome();
  const env = { BRAINMUX_HOME: h };
  assert.equal(runConfig("add-brain", ["fast", "4570", "openrouter/x/y"], env), 0);
  const cfg = loadBrains(path.join(h, "brains.yaml"));
  assert.equal(cfg.brains.fast.port, 4570);
  assert.ok(fs.readFileSync(path.join(h, "generated", "compose.yaml"), "utf8").includes("brainmux-fast"));
  assert.ok((getKey(path.join(h, ".env"), "FAST_MASTER_KEY") ?? "").length > 0);
});

test("add-brain rejects a duplicate port", () => {
  const h = freshHome();
  assert.notEqual(runConfig("add-brain", ["dup", "4567", "openrouter/x/y"], { BRAINMUX_HOME: h }), 0);
});

test("set-model rewrites the brain model + its generated config", () => {
  const h = freshHome();
  runConfig("set-model", ["chat", "openrouter/new/model"], { BRAINMUX_HOME: h });
  assert.ok(fs.readFileSync(path.join(h, "generated", "chat.yaml"), "utf8").includes("openrouter/new/model"));
});

test("remove-brain drops it from manifest + generated compose", () => {
  const h = freshHome();
  runConfig("remove-brain", ["coder"], { BRAINMUX_HOME: h });
  const cfg = loadBrains(path.join(h, "brains.yaml"));
  assert.ok(!("coder" in cfg.brains));
  assert.ok(!fs.readFileSync(path.join(h, "generated", "compose.yaml"), "utf8").includes("brainmux-coder"));
});

test("add-key writes a provider key to .env", () => {
  const h = freshHome();
  runConfig("add-key", ["OPENROUTER_API_KEY", "sk-or-123"], { BRAINMUX_HOME: h });
  assert.equal(getKey(path.join(h, ".env"), "OPENROUTER_API_KEY"), "sk-or-123");
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/commands/config.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/commands/config.ts`:

```ts
import fs from "node:fs";
import YAML from "yaml";
import { resolvePaths, type Paths } from "../core/paths.js";
import { parseBrains, type BrainsConfig } from "../core/manifest.js";
import { writeGenerated, ensureSecrets } from "./init.js";
import { setKey } from "../core/env.js";

function load(paths: Paths): BrainsConfig {
  return parseBrains(fs.readFileSync(paths.brainsYaml, "utf8"));
}

function save(paths: Paths, cfg: BrainsConfig): void {
  // validate the mutated object before persisting, then regenerate
  const validated = parseBrains(YAML.stringify(cfg));
  fs.writeFileSync(paths.brainsYaml, YAML.stringify(validated));
  ensureSecrets(paths, validated);
  writeGenerated(paths, validated);
}

export function addBrain(paths: Paths, name: string, port: number, model: string, providerKey: string): void {
  const cfg = load(paths);
  if (cfg.brains[name]) throw new Error(`brain '${name}' already exists`);
  for (const [n, b] of Object.entries(cfg.brains)) {
    if (b.port === port) throw new Error(`port ${port} already used by '${n}'`);
  }
  cfg.brains[name] = { port, model, providerKey };
  save(paths, cfg);
}

export function runConfig(sub: string, rest: string[], env: NodeJS.ProcessEnv = process.env): number {
  const paths = resolvePaths(env);
  try {
    switch (sub) {
      case "add-brain": {
        const [name, portStr, model, providerKey = "OPENROUTER_API_KEY"] = rest;
        if (!name || !portStr || !model) throw new Error("usage: bmux config add-brain <name> <port> <model> [providerKey]");
        addBrain(paths, name, Number(portStr), model, providerKey);
        console.log(`added brain '${name}' on :${portStr}`);
        return 0;
      }
      case "remove-brain": {
        const [name] = rest;
        const cfg = load(paths);
        if (!cfg.brains[name]) throw new Error(`no such brain '${name}'`);
        delete cfg.brains[name];
        save(paths, cfg);
        console.log(`removed brain '${name}' (its DB + master key remain in .env / data)`);
        return 0;
      }
      case "set-model": {
        const [name, model] = rest;
        const cfg = load(paths);
        if (!cfg.brains[name]) throw new Error(`no such brain '${name}'`);
        cfg.brains[name].model = model;
        save(paths, cfg);
        console.log(`set '${name}' model = ${model}`);
        return 0;
      }
      case "add-key": {
        const [key, value] = rest;
        if (!key || value === undefined) throw new Error("usage: bmux config add-key <ENV_VAR> <value>");
        setKey(paths.envFile, key, value);
        console.log(`set ${key} in .env`);
        return 0;
      }
      case "list": {
        const cfg = load(paths);
        for (const [name, b] of Object.entries(cfg.brains)) {
          console.log(`${name.padEnd(8)} :${b.port}  ${b.model}  (${b.providerKey})`);
        }
        return 0;
      }
      default:
        process.stderr.write(`bmux config: unknown subcommand '${sub}'\n`);
        return 1;
    }
  } catch (e) {
    process.stderr.write(`bmux config: ${(e as Error).message}\n`);
    return 1;
  }
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: all 5 config tests pass.

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/commands/config.ts plugins/llmproxy/test/config.test.ts
git commit -m "feat(llmproxy): add config — add/remove-brain, set-model, add-key, list"
```

---

### Task 14: `commands/test.ts` — smoke each brain via `/v1/messages`

**Files:**
- Create: `plugins/llmproxy/src/commands/test.ts`
- Test: (logic covered by `parseAssistant` unit; live path exercised in Task 16)

**Interfaces:**
- Consumes: `resolvePaths`, `loadBrains`, `getKey`, `masterKeyVar`, `node:http`.
- Produces:
  ```ts
  export function isAlive(responseJson: string): boolean; // true if a valid assistant message (text OR thinking-only)
  export function runTest(env?: NodeJS.ProcessEnv): Promise<number>; // 0 if all brains alive
  ```

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/smoke-logic.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAlive } from "../src/commands/test.js";

test("accepts an assistant text response", () => {
  assert.equal(isAlive('{"role":"assistant","content":[{"type":"text","text":"OK"}]}'), true);
});
test("accepts a thinking-only assistant response", () => {
  assert.equal(isAlive('{"role":"assistant","content":[{"type":"thinking","thinking":"..."}]}'), true);
});
test("rejects an error body", () => {
  assert.equal(isAlive('{"error":{"message":"bad key"}}'), false);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `Cannot find module '../src/commands/test.js'`.

- [ ] **Step 3: Write minimal implementation.** Create `plugins/llmproxy/src/commands/test.ts`:

```ts
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
        host: "127.0.0.1", port, path: "/v1/messages", method: "POST", timeout: 60000,
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
    req.on("timeout", () => { req.destroy(); resolve('{"error":"timeout"}'); });
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
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: 3 smoke-logic tests pass.

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/commands/test.ts plugins/llmproxy/test/smoke-logic.test.ts
git commit -m "feat(llmproxy): add test — /v1/messages smoke (text or thinking = alive)"
```

---

### Task 15: `cli.ts` — arg parse + dispatch + help

**Files:**
- Modify: `plugins/llmproxy/src/cli.ts` (replace the stub)
- Test: `plugins/llmproxy/test/cli.test.ts`

**Interfaces:**
- Consumes: every command module.
- Produces: `export async function main(argv: string[], env?): Promise<number>;` and CLI dispatch matching design spec §10 (minus `ui`, deferred to Plan 2).

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/cli.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { main } from "../src/cli.js";

test("help returns 0", async () => {
  assert.equal(await main(["--help"], {}), 0);
});
test("no command prints help and returns 0", async () => {
  assert.equal(await main([], {}), 0);
});
test("unknown command returns 1", async () => {
  assert.equal(await main(["frobnicate"], {}), 1);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fails — `main` not exported / old stub.

- [ ] **Step 3: Replace the stub.** Overwrite `plugins/llmproxy/src/cli.ts`:

```ts
#!/usr/bin/env node
import { runInit } from "./commands/init.js";
import { runStack } from "./commands/stack.js";
import { runLaunch } from "./commands/launch.js";
import { runDelegate } from "./commands/delegate.js";
import { runConfig } from "./commands/config.js";
import { runTest } from "./commands/test.js";
import { loadBrains } from "./core/manifest.js";
import { resolvePaths } from "./core/paths.js";

const HELP = `bmux — brainmux/llmproxy CLI

  bmux init                       scaffold ~/.brainmux (brains.yaml, .env, generated/)
  bmux up | down | restart        manage the brain stack (regenerates from brains.yaml)
  bmux ps | logs [svc] | health   inspect the stack
  bmux <brain> [claude args...]   launch Claude Code on a brain (e.g. bmux chat)
  bmux delegate <brain> [--write|--yolo] [-C dir] [--json] "<task>"
  bmux config add-brain <name> <port> <model> [providerKey]
  bmux config remove-brain <name> | set-model <name> <model>
  bmux config add-key <ENV_VAR> <value> | list
  bmux test                       smoke every brain via /v1/messages
`;

const STACK = new Set(["up", "down", "restart", "ps", "logs", "health"]);

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (!cmd || cmd === "-h" || cmd === "--help") { process.stdout.write(HELP); return 0; }

  try {
    if (cmd === "init") return runInit(env);
    if (cmd === "test") return await runTest(env);
    if (cmd === "delegate") return runDelegate(rest, env);
    if (cmd === "config") return runConfig(rest[0] ?? "", rest.slice(1), env);
    if (STACK.has(cmd)) return await runStack(cmd, rest, env);

    // otherwise: treat cmd as a brain name to launch (chat/deep/coder/...)
    const cfg = loadBrains(resolvePaths(env).brainsYaml);
    if (cfg.brains[cmd]) return runLaunch(cmd, rest, env);

    process.stderr.write(`bmux: unknown command '${cmd}'\n\n${HELP}`);
    return 1;
  } catch (e) {
    process.stderr.write(`bmux: ${(e as Error).message}\n`);
    return 1;
  }
}

// Executed directly (via bin/bmux -> dist/src/cli.js)
main(process.argv.slice(2)).then((code) => process.exit(code));
```

> Note: the trailing `main(process.argv.slice(2))...` runs on import. In tests we import `main` and it will ALSO fire this line with the test runner's argv. Guard it: only auto-run when invoked as the entry. Replace the last line with:
> ```ts
> import { fileURLToPath } from "node:url";
> if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
>   main(process.argv.slice(2)).then((code) => process.exit(code));
> }
> ```

- [ ] **Step 4: Apply the entry guard** shown in the note above so importing `main` in tests does not call `process.exit`.

- [ ] **Step 5: Run test to verify it passes.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -30`
Expected: cli tests pass AND the whole suite is green (paths, manifest, env, generate, docker, init, launch, delegate, config, smoke-logic, cli).

- [ ] **Step 6: Smoke the built CLI help (no Docker).**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && node bin/bmux --help`
Expected: prints the help block, exit 0.

- [ ] **Step 7: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/cli.ts plugins/llmproxy/test/cli.test.ts
git commit -m "feat(llmproxy): wire cli.ts — dispatch init/stack/launch/delegate/config/test"
```

---

### Task 16: Live integration smoke (Docker-gated)

**Files:**
- Create: `plugins/llmproxy/test/smoke.sh`

**Interfaces:**
- Consumes: the built CLI, Docker, a real `OPENROUTER_API_KEY`.
- Produces: proof the migrated stack boots and every brain answers `/v1/messages`.

> This task requires Docker running and a funded `OPENROUTER_API_KEY`. It cannot be headless-faked. Run it in a scratch `BRAINMUX_HOME` so it never clobbers a real one.

- [ ] **Step 1: Write the driver.** Create `plugins/llmproxy/test/smoke.sh`:

```sh
#!/usr/bin/env sh
# Live smoke: init a scratch BRAINMUX_HOME, add the OpenRouter key, up the stack, test.
set -eu
HOME_DIR="$(mktemp -d)"
export BRAINMUX_HOME="$HOME_DIR"
CLI="node $(cd "$(dirname "$0")/.." && pwd)/bin/bmux"

cleanup() { $CLI down || true; rm -rf "$HOME_DIR"; }
trap cleanup EXIT

$CLI init
[ -n "${OPENROUTER_API_KEY:-}" ] || { echo "set OPENROUTER_API_KEY to run the live smoke" >&2; exit 2; }
$CLI config add-key OPENROUTER_API_KEY "$OPENROUTER_API_KEY"
$CLI up
echo "waiting for brains to come up..."
i=0; while [ $i -lt 30 ]; do $CLI health && break; i=$((i+1)); sleep 5; done
$CLI test
```

- [ ] **Step 2: Build, then run the live smoke.**

Run:
```bash
cd ~/Development/Projects/brainmux/plugins/llmproxy && npm run build
chmod +x test/smoke.sh
OPENROUTER_API_KEY="<real key>" sh test/smoke.sh
```
Expected: `bmux init` scaffolds a temp home; stack comes up; `bmux health` shows all brains UP; `bmux test` prints `OK` (or thinking-only alive) for chat, deep, coder; script exits 0; cleanup tears the stack down.

- [ ] **Step 3: If a brain FAILs, debug before proceeding.** Check `BRAINMUX_HOME=<temp> node bin/bmux logs <brain>`; the most likely causes are a missing `OPENROUTER_API_KEY` in `.env`, the image digest not pullable (Task 3 mirror not public → `docker login` first), or a port already bound. Fix and re-run until green. **Do not mark this task done on a partial pass.**

- [ ] **Step 4: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/test/smoke.sh
git commit -m "test(llmproxy): add Docker-gated live smoke driver"
```

---

### Task 17: Cleanup — remove `claude-proxy`, fix known residue, update handoff

> Gated on Task 16 passing green. Per the user's explicit instruction ("o klasörle işimiz bitince kaldıralım"), the prototype folder is removed now — this overrides the earlier `CLAUDE.md` "DOKUNMA ad" note, which is also updated.

**Files:**
- Delete: `~/Development/Projects/claude-proxy/` (entire prototype)
- Modify: `~/.config/fish/functions/claude-{chat,deep,coder}.fish` (broken — point to removed bins)
- Modify: `~/.claude/settings.json` (allow rule referencing the old delegate path)
- Modify: `CLAUDE.md` (handoff section — mark migration done, drop stale residue notes)

- [ ] **Step 1: Confirm the migration is green first.** Re-run `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test` — expect all unit/golden tests pass. Confirm Task 16 was run green. Only then delete the prototype.

- [ ] **Step 2: Remove the broken fish functions** (they reference deleted `bin/claude-*`):

Run: `rm -f ~/.config/fish/functions/claude-chat.fish ~/.config/fish/functions/claude-deep.fish ~/.config/fish/functions/claude-coder.fish`
(If the user wants shell shortcuts, they now use `bmux chat|deep|coder`.)

- [ ] **Step 3: Fix the stale allow rule in `~/.claude/settings.json`.** Read it, find the `Bash(.../claude-proxy/bin/delegate:*)` allow entry, and either remove it or repoint to the plugin CLI. Since delegation now runs via `bmux delegate` (which shells `claude`), remove the prototype-path rule. Apply the minimal edit.

- [ ] **Step 4: Delete the prototype folder.**

Run: `rm -rf ~/Development/Projects/claude-proxy`
Expected: gone. (Its Postgres data under `data/postgres` is root-owned; if `rm` hits permission denied, run `sudo rm -rf ~/Development/Projects/claude-proxy` — ask the user to run it via `! sudo ...` since it needs a password.)

- [ ] **Step 5: Update the `CLAUDE.md` handoff section.** Edit the "Durum & sıradaki adımlar" block: mark the core migration (brains.yaml + generator + Node CLI + state + smoke) DONE with today's date; remove the "Bilinen kalıntı" bullets now resolved; remove the "Çalışan prototip (kaynak, DOKUNMA ad)" block (folder deleted); leave Plan 2 items (skills move, slash commands, image-mirror hardening/public, `bmux ui`) as the next steps.

- [ ] **Step 6: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add CLAUDE.md
git commit -m "chore: retire claude-proxy prototype, update handoff to post-migration state"
```

---

## Plan 2 (out of scope here — next plan)

Recorded so nothing is lost: (1) move `~/.claude/skills/delegate` → `plugins/llmproxy/skills/delegate/` and update it to reference `bmux delegate` (not `bin/delegate`); add `skills/brainmux` config skill. (2) Slash commands in `plugins/llmproxy/commands/` wrapping the CLI. (3) `bmux ui [brain]` (print LiteLLM UI URL). (4) Harden the GHCR mirror: make the package public, add an offline `docker save` backup tarball, document the pin-bump procedure. (5) Publish the marketplace entry (bump versions off `0.0.0`). (6) **OpenRouter model picker:** `bmux models [--use-case <c>] [query]` fetches the public OpenRouter catalog (`GET https://openrouter.ai/api/v1/models`, no key) and prints `id · ctx · $prompt/$completion · name`; the `brainmux` skill teaches Claude to present picks by use-case (chat/coding/cheap/long-ctx), the user chooses, and Claude wires the choice via `bmux config set-model <brain> <id>` or `add-brain`. The skill also makes Claude fluent in the OpenRouter API so it answers pricing/capability/context questions from the **live** catalog (not memory). **SSOT:** OpenRouter endpoints + the use-case catalog live in ONE file `templates/openrouter.yaml` (`api:` + `useCases:`), zod-loaded via `src/core/openrouter.ts` (mirrors the brains.yaml→zod pattern); both the CLI and the skill read it, nothing else hardcodes URLs/use-cases. This sub-feature deserves its own brainstorm+plan. CLI fetch part may be pulled forward into Plan 1 if the user wants it now.

## Self-Review

**Spec coverage (design spec §§1–16):** §4 state layout → Tasks 4, 9. §6 brains.yaml SSOT → Task 5. §7 generator + golden → Task 7. §8 runtime/port routing → Tasks 7, 10. §10 CLI surface → Tasks 9–15 (`ui` explicitly deferred to Plan 2, noted). §11 error handling → manifest zod messages (Task 5), missing-key/docker messages (Tasks 8, 11), port-in-use (Task 13). §12 mirror → Task 3. §13 migration steps 1–5 → Tasks 1–17; step 6 (skills/commands/publish) → Plan 2. §14 testing → unit (Tasks 4–14) + Docker-gated smoke (Task 16). §15 non-goals respected (no web UI, no MCP, no CC bundling). User directives: WeCodeApps scrub → Task 1; remove claude-proxy → Task 17; fresh Postgres → Global Constraints + Task 9; mirror-now → Task 3.

**Placeholder scan:** the only intentional deferred value is `IMAGE_REF`'s `<MIRROR_DIGEST>`, explicitly produced by Task 3 and consumed by Task 7 (documented in both Interfaces blocks) — not a plan gap. No "TODO/handle edge cases/similar to Task N" placeholders remain; every code step carries full code.

**Type consistency:** `BrainsConfig`/`Brain` (Task 5) used identically in Tasks 7, 9, 11, 13. `Paths` (Task 4) consumed unchanged in Tasks 8, 9, 13. `masterKeyVar`/`dbName` (Task 7) reused in Tasks 9, 11, 14. `planLaunch` returns `{base, apiKey}` (Task 11) consumed in Task 12. `liveliness` corrected to `Promise<boolean>` (Task 8) and `await`ed in Task 10. `runStack`/`runTest`/`main` are async (`Promise<number>`); `runInit`/`runDelegate`/`runConfig` are sync (`number`) — dispatch in Task 15 awaits only the async ones. All relative imports use `.js` (NodeNext) per Task 4 note.
