import { type Paths } from "../core/paths.js";
import { type BrainsConfig } from "../core/manifest.js";
export declare function writeGenerated(paths: Paths, cfg: BrainsConfig): void;
export declare function ensureSecrets(paths: Paths, cfg: BrainsConfig): void;
export declare function runInit(env?: NodeJS.ProcessEnv): number;
