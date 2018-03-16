import { BuildResults, CompilerCtx, Config, InMemoryFileSystem } from '../declarations';
export declare class Compiler {
    protected ctx: CompilerCtx;
    isValid: boolean;
    config: Config;
    constructor(rawConfig: Config);
    build(): Promise<BuildResults>;
    on(eventName: 'build', cb: (buildResults: BuildResults) => void): Function;
    on(eventName: 'rebuild', cb: (buildResults: BuildResults) => void): Function;
    once(eventName: 'build'): Promise<BuildResults>;
    once(eventName: 'rebuild'): Promise<BuildResults>;
    off(eventName: string, cb: Function): void;
    trigger(eventName: 'fileUpdate', path: string): void;
    trigger(eventName: 'fileAdd', path: string): void;
    trigger(eventName: 'fileDelete', path: string): void;
    trigger(eventName: 'dirAdd', path: string): void;
    trigger(eventName: 'dirDelete', path: string): void;
    docs(): Promise<void>;
    readonly fs: InMemoryFileSystem;
    readonly name: string;
    readonly version: string;
}
