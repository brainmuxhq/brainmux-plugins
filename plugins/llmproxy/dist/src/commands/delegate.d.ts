export interface DelegateOpts {
    mode: "analyze" | "write" | "yolo";
    workdir: string;
    outfmt: "text" | "json";
    task: string;
}
export declare function parseDelegateArgs(argv: string[], stdin?: string): {
    brain: string;
    opts: DelegateOpts;
};
export declare function buildClaudeArgs(opts: DelegateOpts): string[];
export declare function runDelegate(argv: string[], env?: NodeJS.ProcessEnv): number;
