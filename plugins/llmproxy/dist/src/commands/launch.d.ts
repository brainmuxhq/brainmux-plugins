export interface LaunchPlan {
    base: string;
    apiKey: string;
}
export declare function planLaunch(brain: string, env?: NodeJS.ProcessEnv): LaunchPlan;
export declare function runLaunch(brain: string, claudeArgs: string[], env?: NodeJS.ProcessEnv): number;
