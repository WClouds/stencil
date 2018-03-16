import { BuildResults, CompilerCtx, Config, WatcherResults } from '../../declarations';
export declare function rebuild(config: Config, compilerCtx: CompilerCtx, watcher: WatcherResults): Promise<BuildResults>;
