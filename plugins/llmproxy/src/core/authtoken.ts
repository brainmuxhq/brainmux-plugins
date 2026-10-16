import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Expand a leading `~` / `~/` to the home directory (brains.yaml paths are written by hand). */
export function expandHome(p: string, home: string = os.homedir()): string {
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.join(home, p.slice(2));
  return p;
}

/**
 * Read a direct brain's Bearer token from its file at run time. Refuses a file that is missing,
 * not a regular file, empty, or readable by group/others (chmod 600 it) — the token is a secret
 * and is never copied anywhere else. Error messages name the file, never its content.
 */
export function readAuthToken(file: string, home?: string): string {
  const p = expandHome(file, home);
  let st: fs.Stats;
  try {
    st = fs.statSync(p);
  } catch {
    throw new Error(`authTokenFile ${p} not found`);
  }
  if (!st.isFile()) throw new Error(`authTokenFile ${p} is not a regular file`);
  if (st.mode & 0o077) {
    throw new Error(`authTokenFile ${p} is readable by group/others (mode ${(st.mode & 0o777).toString(8)}) — run: chmod 600 ${p}`);
  }
  const token = fs.readFileSync(p, "utf8").trim();
  if (!token) throw new Error(`authTokenFile ${p} is empty`);
  if (/\s/.test(token)) throw new Error(`authTokenFile ${p} must contain a single token (found whitespace inside)`);
  return token;
}
