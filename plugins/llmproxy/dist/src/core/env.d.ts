export declare function parseEnv(text: string): Map<string, string>;
export declare function readEnv(file: string): Map<string, string>;
export declare function writeEnv(file: string, map: Map<string, string>): void;
export declare function getKey(file: string, key: string): string | undefined;
export declare function setKey(file: string, key: string, value: string): void;
export declare function genSecret(bytes?: number): string;
