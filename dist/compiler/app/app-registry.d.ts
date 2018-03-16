import { AppRegistry, AppRegistryComponents, CompilerCtx, ComponentRegistry, Config, OutputTarget } from '../../declarations';
export declare function createAppRegistry(config: Config): AppRegistry;
export declare function getAppRegistry(config: Config, compilerCtx: CompilerCtx, outputTarget: OutputTarget): AppRegistry;
export declare function serializeComponentRegistry(cmpRegistry: ComponentRegistry): AppRegistryComponents;
export declare function writeAppRegistry(config: Config, compilerCtx: CompilerCtx, outputTarget: OutputTarget, appRegistry: AppRegistry, cmpRegistry: ComponentRegistry): Promise<void>;
