import * as d from '../../declarations';
export declare function getAppBuildDir(config: d.Config, outputTarget: d.OutputTargetWww): string;
export declare function getRegistryFileName(config: d.Config): string;
export declare function getRegistryJson(config: d.Config, outputTarget: d.OutputTargetWww): string;
export declare function getLoaderFileName(config: d.Config): string;
export declare function getLoaderPath(config: d.Config, outputTarget: d.OutputTargetWww): string;
export declare function getGlobalFileName(config: d.Config): string;
export declare function getGlobalBuildPath(config: d.Config, outputTarget: d.OutputTargetWww): string;
export declare function getCoreFilename(config: d.Config, coreId: string, jsContent: string): string;
export declare function getGlobalStyleFilename(config: d.Config): string;
export declare function getBundleFilename(bundleId: string, isScopedStyles: boolean, sourceTarget?: d.SourceTarget): string;
