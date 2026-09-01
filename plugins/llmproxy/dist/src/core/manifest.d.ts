import { z } from "zod";
declare const BrainsConfigSchema: z.ZodEffects<z.ZodObject<{
    version: z.ZodLiteral<1>;
    brains: z.ZodRecord<z.ZodString, z.ZodObject<{
        port: z.ZodNumber;
        model: z.ZodString;
        providerKey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        port: number;
        model: string;
        providerKey: string;
    }, {
        port: number;
        model: string;
        providerKey: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    version: 1;
    brains: Record<string, {
        port: number;
        model: string;
        providerKey: string;
    }>;
}, {
    version: 1;
    brains: Record<string, {
        port: number;
        model: string;
        providerKey: string;
    }>;
}>, {
    version: 1;
    brains: Record<string, {
        port: number;
        model: string;
        providerKey: string;
    }>;
}, {
    version: 1;
    brains: Record<string, {
        port: number;
        model: string;
        providerKey: string;
    }>;
}>;
export interface Brain {
    port: number;
    model: string;
    providerKey: string;
}
export type BrainsConfig = z.infer<typeof BrainsConfigSchema>;
export declare function parseBrains(text: string): BrainsConfig;
export declare function loadBrains(file: string): BrainsConfig;
export {};
