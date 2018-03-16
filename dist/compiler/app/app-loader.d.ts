import * as d from '../../declarations';
export declare function generateLoader(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTarget, appRegistry: d.AppRegistry, cmpRegistry: d.ComponentRegistry): Promise<string>;
export declare function injectAppIntoLoader(config: d.Config, outputTarget: d.OutputTargetWww, appCoreFileName: string, appCorePolyfilledFileName: string, hydratedCssClass: string, cmpRegistry: d.ComponentRegistry, loaderContent: string): string;
