import * as d from '../../declarations';
export declare function copyTasks(config: d.Config, compilerCtx: d.CompilerCtx, diagnostics: d.Diagnostic[], commit: boolean): Promise<void>;
export declare function processCopyTasks(config: d.Config, compilerCtx: d.CompilerCtx, allCopyTasks: d.CopyTask[], copyTask: d.CopyTask): Promise<any>;
export declare function createGlobCopyTask(config: d.Config, copyTask: d.CopyTask, destDir: string, globRelPath: string): d.CopyTask;
export declare function processCopyTask(config: d.Config, copyTask: d.CopyTask, destAbsPath: string): d.CopyTask;
export declare function getSrcAbsPath(config: d.Config, src: string): string;
export declare function getDestAbsPath(config: d.Config, src: string, destAbsPath: string, destRelPath: string): string;
export declare function isCopyTaskFile(config: d.Config, filePath: string): boolean;
