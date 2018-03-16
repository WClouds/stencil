import * as d from '../../declarations';
import * as ts from 'typescript';
export declare function getUserTsConfig(config: d.Config, compilerCtx: d.CompilerCtx): Promise<ts.CompilerOptions>;
export declare const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions;
