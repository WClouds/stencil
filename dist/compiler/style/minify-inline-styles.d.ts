import * as d from '../../declarations';
export declare function minifyInlineStyles(config: d.Config, compilerCtx: d.CompilerCtx, doc: Document, diagnostics: d.Diagnostic[]): Promise<void>;
export declare function minifyInlineStyle(config: d.Config, compilerCtx: d.CompilerCtx, diagnostics: d.Diagnostic[], style: HTMLStyleElement): Promise<void>;
