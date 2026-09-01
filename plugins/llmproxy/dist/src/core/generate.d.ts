import type { BrainsConfig } from "./manifest.js";
export declare const IMAGE_REF = "ghcr.io/brainmuxhq/brainmux-litellm@sha256:e53c8f4f012fe1286fcfd78b6a108cdf0865af21f735dd10cff47df93bf9f23f";
export declare function dbName(brain: string): string;
export declare function masterKeyVar(brain: string): string;
export interface Generated {
    compose: string;
    configs: Record<string, string>;
    initSql: string;
}
export declare function generate(cfg: BrainsConfig): Generated;
