import { BuildCtx, CompilerCtx, ModuleFiles, ModuleGraph } from '../../declarations';
export declare function calcModuleGraphImportPaths(compilerCtx: CompilerCtx, moduleGraphs: ModuleGraph[]): void;
export declare function calcComponentDependencies(allModuleFiles: ModuleFiles, buildCtx: BuildCtx): void;
