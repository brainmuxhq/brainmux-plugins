export interface Paths {
    home: string;
    brainsYaml: string;
    envFile: string;
    generatedDir: string;
    composeYaml: string;
    initDir: string;
    dataDir: string;
    brainConfig(name: string): string;
}
export declare function resolvePaths(env?: NodeJS.ProcessEnv): Paths;
