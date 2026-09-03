import fs from "node:fs";
import path from "node:path";

// Read-only queries over the CodeGraph index that `gmux index` builds at <repo>/.codegraph/codegraph.db.
// Node's built-in node:sqlite (>=22) keeps the bundle dependency-free — no better-sqlite3, no shelling
// to a `sqlite3` CLI. The index is treated as a stable read model (nodes + edges); future graph queries
// (audit, unused-exports) reuse this layer instead of re-opening the DB ad hoc.

/** One code symbol as stored in the index. */
export interface GraphNode {
  file: string;
  line: number;
  name: string;
  kind: string;
  exported: boolean;
  language: string;
}

/** The index has not been built yet — the caller should suggest `gmux index`. */
export class IndexNotFoundError extends Error {
  constructor(public readonly dbPath: string) {
    super(`index not found at ${dbPath}`);
    this.name = "IndexNotFoundError";
  }
}

/** The runtime lacks built-in node:sqlite (Node < 22). */
export class SqliteUnavailableError extends Error {
  constructor() {
    super("node:sqlite unavailable (needs Node >= 22)");
    this.name = "SqliteUnavailableError";
  }
}

export function indexDbPath(projectPath: string): string {
  return path.join(projectPath, ".codegraph", "codegraph.db");
}

// Edge kinds that count as real "usage". `contains` (file→symbol) and `imports` are structural,
// not usage — including them would make every symbol look referenced.
const USAGE_EDGE_KINDS = ["calls", "references"] as const;

// Symbol kinds worth orphan analysis. Constants/vars/types/interfaces are noisy (ambient public
// API, member-access) so v1 stays on the callable/renderable set.
export const ORPHAN_SYMBOL_KINDS = ["function", "method", "component", "class"] as const;

function coerceNode(row: Record<string, unknown>): GraphNode {
  return {
    file: String(row.file ?? ""),
    line: Number(row.line ?? 0),
    name: String(row.name ?? ""),
    kind: String(row.kind ?? ""),
    exported: Number(row.exported ?? 0) === 1,
    language: String(row.language ?? ""),
  };
}

/**
 * Symbols with no incoming usage edge (calls/references) — orphan candidates straight from the index.
 * Throws {@link IndexNotFoundError} / {@link SqliteUnavailableError}; the caller maps these to
 * friendly CLI messages. Read-only: never mutates the index.
 */
export async function queryOrphanNodes(projectPath: string): Promise<GraphNode[]> {
  const dbPath = indexDbPath(projectPath);
  if (!fs.existsSync(dbPath)) throw new IndexNotFoundError(dbPath);

  let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    throw new SqliteUnavailableError();
  }

  const kindPlaceholders = ORPHAN_SYMBOL_KINDS.map(() => "?").join(",");
  const usageList = USAGE_EDGE_KINDS.map((k) => `'${k}'`).join(",");
  const sql =
    `SELECT n.file_path AS file, n.start_line AS line, n.name AS name, n.kind AS kind,
            COALESCE(n.is_exported, 0) AS exported, n.language AS language
     FROM nodes n
     WHERE n.kind IN (${kindPlaceholders})
       AND NOT EXISTS (
         SELECT 1 FROM edges e WHERE e.target = n.id AND e.kind IN (${usageList})
       )
     ORDER BY n.file_path, n.start_line`;

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare(sql).all(...ORPHAN_SYMBOL_KINDS) as Record<string, unknown>[];
    return rows.map(coerceNode);
  } finally {
    db.close();
  }
}
