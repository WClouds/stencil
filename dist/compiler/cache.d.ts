import * as d from '../declarations';
export declare class Cache implements d.Cache {
    private config;
    private cacheFs;
    private tmpDir;
    private failed;
    private skip;
    constructor(config: d.Config, cacheFs: d.InMemoryFileSystem, tmpDir: string);
    get(key: string): Promise<string>;
    put(key: string, value: string): Promise<boolean>;
    createKey(domain: string, ...args: any[]): string;
    commit(): Promise<void>;
    clear(): void;
    clearDiskCache(): Promise<void>;
    private getCacheFilePath(key);
    getMemoryStats(): string;
}
