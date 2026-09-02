import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { Paths } from "./paths.js";

// Named, reusable delegate task prompts. Built-ins are shipped (embedded, versioned); the user
// stores their own in ~/.brainmux/templates.yaml (the record store), which override/extend the
// built-ins. Same SSOT pattern as brains.yaml: data in state, resolved by a thin core loader.
export const BUILTIN_TEMPLATES: Record<string, string> = {
  audit:
    "Audit the code in scope for correctness bugs, edge cases, and error handling. Report each real issue as 'file:line — issue — why'. No praise, no restating code. If none, output NONE.",
  "drift-scan":
    "Compare the docs (README / skills / comments) against the ACTUAL code in scope. Report drift only: documented behavior/flags/paths that don't match code, as 'file:line — claim vs reality'. If none, output NONE.",
  review:
    "Review the code/diff in scope for real defects (bugs, security, resource leaks) and clear simplifications. One line per finding: 'file:line — problem — fix'. No nits, no praise. If none, output NONE.",
  "todo-scan":
    "Find every TODO / FIXME / HACK / XXX marker in scope. Output one line each: 'file:line — the note'. Nothing else.",
};

const TemplatesSchema = z.record(z.string().min(1), z.string().min(1));

export function templatesPath(paths: Paths): string {
  return path.join(paths.home, "templates.yaml");
}

// User-defined templates from ~/.brainmux/templates.yaml ({} if the file is absent).
export function loadUserTemplates(paths: Paths): Record<string, string> {
  const f = templatesPath(paths);
  if (!fs.existsSync(f)) return {};
  const raw = YAML.parse(fs.readFileSync(f, "utf8")) ?? {};
  return TemplatesSchema.parse(raw);
}

// Built-ins + user templates (user wins on name clash).
export function allTemplates(paths: Paths): Record<string, string> {
  return { ...BUILTIN_TEMPLATES, ...loadUserTemplates(paths) };
}

export function resolveTemplate(name: string, paths: Paths): string {
  const all = allTemplates(paths);
  const t = all[name];
  if (!t) throw new Error(`no template '${name}' (have: ${Object.keys(all).join(", ")})`);
  return t;
}

export function saveUserTemplate(paths: Paths, name: string, prompt: string): void {
  const cur = loadUserTemplates(paths);
  cur[name] = prompt;
  fs.mkdirSync(paths.home, { recursive: true });
  fs.writeFileSync(templatesPath(paths), YAML.stringify(cur));
}
