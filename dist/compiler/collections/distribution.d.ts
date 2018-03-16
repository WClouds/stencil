import * as d from '../../declarations';
export declare function generateDistributions(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx): Promise<any>;
export declare function validatePackageJson(config: d.Config, outputTarget: d.OutputTargetDist, diagnostics: d.Diagnostic[], pkgData: d.PackageJsonData): void;
export declare function validatePackageFiles(config: d.Config, outputTarget: d.OutputTargetDist, diagnostics: d.Diagnostic[], pkgData: d.PackageJsonData): void;
export declare function getComponentsDtsSrcFilePath(config: d.Config): string;
export declare function getComponentsDtsTypesFilePath(config: d.Config, outputTarget: d.OutputTargetDist): string;
export declare const COMPONENTS_DTS = "components.d.ts";
