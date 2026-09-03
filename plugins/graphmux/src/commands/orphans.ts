import path from "node:path";
import {
  queryOrphanNodes,
  IndexNotFoundError,
  SqliteUnavailableError,
  type GraphNode,
} from "../core/graph-db.js";

// `gmux orphans` — bulk dead/orphan symbol detection from the local CodeGraph index. Lists
// function/method/component/class symbols with NO incoming call/reference edge, minus framework
// entrypoints. These are CANDIDATES, not proof: dynamic dispatch, member-access (obj.method),
// same-file JSX and reflective/framework use are invisible to the graph — verify before deleting.
// Layering: core/graph-db reads the index; this file only parses args, filters (pure), and prints.

// Files whose top-level symbols are invoked by the framework/runtime, not by repo code → never orphans.
export function isEntrypointFile(file: string): boolean {
  const base = path.basename(file).toLowerCase();
  if (/^(page|layout|route|loading|error|not-found|global-error|template|default|middleware)\.[tj]sx?$/.test(base)) return true;
  if (/^(robots|sitemap|opengraph-image|twitter-image|icon|apple-icon|manifest)\.[tj]sx?$/.test(base)) return true;
  if (/\.config\.([tj]sx?|mjs|cjs)$/.test(base)) return true;
  if (base.endsWith(".d.ts")) return true;
  if (/\.(test|spec|stories)\.[tj]sx?$/.test(base)) return true;
  if (base === "index.ts" || base === "index.tsx" || base === "index.js" || base === "index.jsx") return true;
  if (/(^|\/)scripts\//.test(file)) return true;
  // Python roots
  if (base === "conftest.py" || base === "setup.py" || base === "__main__.py") return true;
  if (base.startsWith("test_") && base.endsWith(".py")) return true;
  if (base.endsWith("_test.py")) return true;
  return false;
}

// Symbol names invoked reflexively by frameworks (Next route handlers, metadata hooks, default export).
export const FRAMEWORK_SYMBOLS = new Set([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
  "generateMetadata", "generateStaticParams", "generateViewport", "metadata", "viewport", "default",
  "robots", "sitemap", "middleware",
]);

export interface OrphanOptions {
  all: boolean;         // skip entrypoint/framework filtering (raw 0-in-degree list)
  exportsOnly: boolean; // only exported-but-unused symbols (public surface with no in-repo caller)
  langs: Set<string> | null;
}

export interface ParsedArgs {
  projectPath: string;
  json: boolean;
  options: OrphanOptions;
}

export function parseArgs(argv: string[], cwd: string = process.cwd()): ParsedArgs {
  const json = argv.includes("--json");
  const all = argv.includes("--all");
  const exportsOnly = argv.includes("--exports");

  let langCsv: string | undefined;
  const eqForm = argv.find((a) => a.startsWith("--lang="));
  if (eqForm) langCsv = eqForm.slice("--lang=".length);
  else if (argv.includes("--lang")) langCsv = argv[argv.indexOf("--lang") + 1];
  const langs = langCsv
    ? new Set(langCsv.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  // First positional that isn't a flag and isn't the space-separated value of --lang.
  const positional = argv.find((a, i) => !a.startsWith("-") && argv[i - 1] !== "--lang");
  const projectPath = path.resolve(cwd, positional ?? ".");

  return { projectPath, json, options: { all, exportsOnly, langs } };
}

// Pure filter (unit-testable, no IO). Returns the kept candidates + how many roots were dropped.
export function filterOrphans(
  nodes: GraphNode[],
  options: OrphanOptions,
): { kept: GraphNode[]; excluded: number } {
  let out = nodes;
  if (options.langs) out = out.filter((n) => options.langs!.has(n.language));
  if (options.exportsOnly) out = out.filter((n) => n.exported);
  const beforeHeuristics = out.length;
  if (!options.all) {
    out = out.filter((n) => !isEntrypointFile(n.file) && !FRAMEWORK_SYMBOLS.has(n.name));
  }
  return { kept: out, excluded: beforeHeuristics - out.length };
}

function renderText(kept: GraphNode[], excluded: number, options: OrphanOptions): string {
  const dropped = options.all ? "" : ` (${excluded} entrypoint/root elendi)`;
  const label = options.exportsOnly ? "kullanılmayan export" : "orphan aday";
  if (kept.length === 0) return `gmux orphans → 0 ${label}${dropped}\n`;

  const lines = kept.map(
    (n) => `  ${n.file}:${n.line}  ${n.name}  ${n.kind}/${n.exported ? "export" : "yerel"} — 0 çağıran`,
  );
  return (
    `gmux orphans → ${kept.length} ${label}${dropped}\n\n` +
    lines.join("\n") +
    "\n\n  ⚠ Aday listesi — SİLMEDEN doğrula. Dinamik dispatch, member-access (obj.method), same-file\n" +
    "    JSX ve reflektif/framework kullanımı graph'ta görünmez.\n" +
    "    elenen root'lar: --all · sadece export: --exports · dil: --lang=ts,py · makine: --json\n"
  );
}

function renderJson(kept: GraphNode[]): string {
  return (
    JSON.stringify(
      kept.map((n) => ({
        file: n.file,
        line: n.line,
        symbol: n.name,
        kind: n.kind,
        exported: n.exported,
        callers: 0,
      })),
      null,
      2,
    ) + "\n"
  );
}

export async function runOrphans(argv: string[], _env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const { projectPath, json, options } = parseArgs(argv);

  let nodes: GraphNode[];
  try {
    nodes = await queryOrphanNodes(projectPath);
  } catch (e) {
    if (e instanceof IndexNotFoundError) {
      const hint = projectPath === process.cwd() ? "" : ` ${projectPath}`;
      process.stderr.write(`gmux orphans: no index at ${e.dbPath}\n  run: gmux index${hint}\n`);
      return 1;
    }
    if (e instanceof SqliteUnavailableError) {
      process.stderr.write("gmux orphans: needs Node >= 22 (built-in node:sqlite). Upgrade Node and retry.\n");
      return 1;
    }
    throw e;
  }

  const { kept, excluded } = filterOrphans(nodes, options);
  process.stdout.write(json ? renderJson(kept) : renderText(kept, excluded, options));
  return 0;
}
