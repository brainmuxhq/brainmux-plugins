import type { Paths } from "./paths.js";
export declare function composeArgs(paths: Paths): string[];
export declare function ensureDocker(): void;
export declare function runCompose(paths: Paths, args: string[]): number;
export declare function liveliness(port: number, timeoutMs?: number): Promise<boolean>;
