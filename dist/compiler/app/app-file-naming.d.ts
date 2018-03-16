import { Config, SourceTarget } from '../../util/interfaces';
export declare function getAppWWWBuildDir(config: Config): string;
export declare function getAppDistDir(config: Config): string;
export declare function getRegistryJsonWWW(config: Config): string;
export declare function getLoaderFileName(config: Config): string;
export declare function getLoaderWWW(config: Config): string;
export declare function getLoaderDist(config: Config): string;
export declare function getGlobalFileName(config: Config): string;
export declare function getGlobalWWW(config: Config): string;
export declare function getGlobalDist(config: Config): string;
export declare function getCoreFilename(config: Config, coreId: string, jsContent: string): string;
export declare function getGlobalStyleFilename(config: Config): string;
export declare function getBundleFilename(bundleId: string, isScopedStyles: boolean, sourceTarget?: SourceTarget): string;
export declare function getAppPublicPath(config: Config): string;
