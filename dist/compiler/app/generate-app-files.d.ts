import { BuildCtx, CompilerCtx, ComponentRegistry, Config, EntryModule, OutputTarget } from '../../declarations';
export declare function generateAppFiles(config: Config, compilerCtx: CompilerCtx, buildCtx: BuildCtx, entryModules: EntryModule[], cmpRegistry: ComponentRegistry): Promise<void[]>;
export declare function generateAppFilesOutputTarget(config: Config, compilerCtx: CompilerCtx, buildCtx: BuildCtx, outputTarget: OutputTarget, entryModules: EntryModule[], cmpRegistry: ComponentRegistry): Promise<void>;
