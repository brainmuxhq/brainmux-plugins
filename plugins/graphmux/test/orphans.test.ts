import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isEntrypointFile,
  FRAMEWORK_SYMBOLS,
  filterOrphans,
  parseArgs,
  type OrphanOptions,
} from "../src/commands/orphans.js";
import type { GraphNode } from "../src/core/graph-db.js";

const OPTS = (o: Partial<OrphanOptions> = {}): OrphanOptions => ({
  all: false,
  exportsOnly: false,
  langs: null,
  ...o,
});

const node = (file: string, name: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  file,
  line: 1,
  name,
  kind: "function",
  exported: false,
  language: "typescript",
  ...extra,
});

test("isEntrypointFile flags Next app-router + SEO + config + tests + scripts + index", () => {
  for (const f of [
    "apps/app/app/page.tsx",
    "apps/app/app/console/layout.tsx",
    "apps/app/app/api/health/route.ts",
    "apps/site/app/robots.ts",
    "apps/site/app/sitemap.ts",
    "apps/site/app/opengraph-image.tsx",
    "apps/x/next.config.ts",
    "apps/x/tailwind.config.ts",
    "packages/ui/src/index.ts",
    "scripts/guards/brand-guard.mjs",
    "x/foo.test.ts",
    "x/foo.spec.tsx",
    "apps/core/tests/test_smoke.py",
    "apps/core/conftest.py",
    "types/global.d.ts",
  ]) {
    assert.equal(isEntrypointFile(f), true, `${f} should be an entrypoint`);
  }
});

test("isEntrypointFile leaves ordinary source files alone", () => {
  for (const f of [
    "apps/app/src/lib/audio.ts",
    "packages/ui/src/tokens.ts",
    "apps/app/src/components/chat/Sidebar/Sidebar.tsx",
    "apps/core/src/brainmux_core/agents.py",
  ]) {
    assert.equal(isEntrypointFile(f), false, `${f} should NOT be an entrypoint`);
  }
});

test("FRAMEWORK_SYMBOLS covers Next route handlers + metadata + default", () => {
  for (const s of ["GET", "POST", "generateMetadata", "metadata", "default"]) {
    assert.equal(FRAMEWORK_SYMBOLS.has(s), true, `${s} should be a framework symbol`);
  }
  assert.equal(FRAMEWORK_SYMBOLS.has("myHelper"), false);
});

test("filterOrphans drops entrypoints + framework symbols, keeps real orphans, counts excluded", () => {
  const nodes: GraphNode[] = [
    node("apps/app/app/page.tsx", "Home", { exported: true }), // entrypoint → drop
    node("apps/app/app/api/x/route.ts", "GET", { exported: true }), // framework symbol → drop
    node("packages/ui/src/tokens.ts", "space", { exported: true }), // real candidate → keep
    node("apps/app/src/lib/audio.ts", "playAudio"), // real candidate → keep
  ];
  const { kept, excluded } = filterOrphans(nodes, OPTS());
  assert.deepEqual(kept.map((n) => n.name).sort(), ["playAudio", "space"]);
  assert.equal(excluded, 2);
});

test("filterOrphans --all keeps everything (no heuristics)", () => {
  const nodes = [node("apps/app/app/page.tsx", "Home"), node("x/util.ts", "helper")];
  const { kept, excluded } = filterOrphans(nodes, OPTS({ all: true }));
  assert.equal(kept.length, 2);
  assert.equal(excluded, 0);
});

test("filterOrphans --exports keeps only exported symbols", () => {
  const nodes = [
    node("x/util.ts", "publicFn", { exported: true }),
    node("x/util.ts", "privateFn", { exported: false }),
  ];
  const { kept } = filterOrphans(nodes, OPTS({ exportsOnly: true }));
  assert.deepEqual(kept.map((n) => n.name), ["publicFn"]);
});

test("filterOrphans --lang filters by language", () => {
  const nodes = [
    node("a.ts", "tsFn", { language: "typescript" }),
    node("b.py", "pyFn", { language: "python" }),
  ];
  const { kept } = filterOrphans(nodes, OPTS({ langs: new Set(["python"]) }));
  assert.deepEqual(kept.map((n) => n.name), ["pyFn"]);
});

test("parseArgs reads flags, --lang= and --lang x, positional path, default cwd", () => {
  const cwd = "/repo";
  assert.deepEqual(parseArgs([], cwd), {
    projectPath: "/repo",
    json: false,
    options: { all: false, exportsOnly: false, langs: null },
  });

  const a = parseArgs(["--json", "--all", "--exports", "--lang=ts,py"], cwd);
  assert.equal(a.json, true);
  assert.equal(a.options.all, true);
  assert.equal(a.options.exportsOnly, true);
  assert.deepEqual([...a.options.langs!].sort(), ["py", "ts"]);
  assert.equal(a.projectPath, "/repo");

  // space-separated --lang value must not be taken as the path
  const b = parseArgs(["--lang", "ts", "packages/ui"], cwd);
  assert.deepEqual([...b.options.langs!], ["ts"]);
  assert.equal(b.projectPath, "/repo/packages/ui");

  // absolute positional path is respected
  const c = parseArgs(["/other/repo"], cwd);
  assert.equal(c.projectPath, "/other/repo");
});
