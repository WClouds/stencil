import * as d from '../../declarations';
import { ENCAPSULATION } from '../../util/constants';
export declare function generateStyles(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, entryModules: d.EntryModule[]): Promise<void>;
export declare function generateComponentStyles(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, moduleFile: d.ModuleFile): Promise<void>;
export declare function setStyleText(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, cmpMeta: d.ComponentMeta, styleMeta: d.StyleMeta, styles: string[]): Promise<void>;
export declare function escapeCssForJs(style: string): string;
export declare function requiresScopedStyles(encapsulation: ENCAPSULATION): boolean;
