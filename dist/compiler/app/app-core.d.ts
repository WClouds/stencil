import { BuildConditionals, BuildCtx, CompilerCtx, Config, OutputTarget } from '../../declarations';
export declare function generateCore(config: Config, compilerCtx: CompilerCtx, buildCtx: BuildCtx, outputTarget: OutputTarget, globalJsContent: string, buildConditionals: BuildConditionals): Promise<string>;
export declare function wrapCoreJs(config: Config, jsContent: string): string;
export declare const APP_NAMESPACE_PLACEHOLDER = "__APPNAMESPACE__";
