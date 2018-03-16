import * as d from '../declarations';
export declare function createPlatformServer(config: d.Config, outputTarget: d.OutputTargetWww, win: any, doc: any, cmpRegistry: d.ComponentRegistry, diagnostics: d.Diagnostic[], isPrerender: boolean, compilerCtx?: d.CompilerCtx): d.PlatformApi;
export declare function getComponentBundleFilename(cmpMeta: d.ComponentMeta, modeName: string): string;
