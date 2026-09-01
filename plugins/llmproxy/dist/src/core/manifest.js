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
    brains: z.record(z.string().regex(/^[a-z][a-z0-9]*$/, "brain name must be lowercase alphanumeric, starting with a letter"), BrainSchema),
})
    .superRefine((cfg, ctx) => {
    const seen = new Map();
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
export function parseBrains(text) {
    let raw;
    try {
        raw = YAML.parse(text);
    }
    catch (e) {
        throw new Error(`brains.yaml is not valid YAML: ${e.message}`);
    }
    const result = BrainsConfigSchema.safeParse(raw);
    if (!result.success) {
        const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
        throw new Error(`brains.yaml is invalid:\n${lines.join("\n")}`);
    }
    return result.data;
}
export function loadBrains(file) {
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    }
    catch {
        throw new Error(`brains.yaml not found at ${file} — run \`bmux init\` first.`);
    }
    return parseBrains(text);
}
