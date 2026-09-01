import { getUseCases, fetchModels, formatModels } from "../core/openrouter.js";

export async function runModels(rest: string[], _env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (rest.includes("--use-cases")) {
    console.log("Use-cases (guidance for picking a model from `bmux models`):");
    for (const uc of getUseCases()) console.log(`  ${uc.id.padEnd(8)} ${uc.label.padEnd(16)} ${uc.guidance}`);
    return 0;
  }
  const wantJson = rest.includes("--json");
  const query = rest.find((a) => !a.startsWith("-"));
  try {
    const rows = await fetchModels();
    if (wantJson) {
      const q = query?.toLowerCase();
      const out = q ? rows.filter((r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : rows;
      console.log(JSON.stringify(out.map((r) => r.raw), null, 2));
    } else {
      console.log("Live from OpenRouter · prices per 1M tokens · sorted by input price\n");
      console.log(formatModels(rows, { query }));
    }
    return 0;
  } catch (e) {
    process.stderr.write(`bmux models: ${(e as Error).message}\n`);
    return 1;
  }
}
