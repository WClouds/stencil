'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var rollupPluginutils = require('rollup-pluginutils');
var ts = require('typescript');
var rollup = require('rollup');

/**
 * SSR Attribute Names
 */
const SSR_VNODE_ID = 'data-ssrv';
const SSR_CHILD_ID = 'data-ssrc';
/**
 * Default style mode id
 */
const DEFAULT_STYLE_MODE = '$';
/**
 * Reusable empty obj/array
 * Don't add values to these!!
 */
const EMPTY_OBJ = {};
const EMPTY_ARR = [];
/**
 * Key Name to Key Code Map
 */
const KEY_CODE_MAP = {
    'enter': 13,
    'escape': 27,
    'space': 32,
    'tab': 9,
    'left': 37,
    'up': 38,
    'right': 39,
    'down': 40
};
/**
 * File names and value
 */
const BANNER = `Built with http://stenciljs.com`;
const COLLECTION_MANIFEST_FILE_NAME = 'collection-manifest.json';
const APP_NAMESPACE_REGEX = /["']__APP__['"]/g;

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * Test if a file is a typescript source file, such as .ts or .tsx.
 * However, d.ts files and spec.ts files return false.
 * @param filePath
 */
function isTsFile(filePath) {
    const parts = filePath.toLowerCase().split('.');
    if (parts.length > 1) {
        if (parts[parts.length - 1] === 'ts' || parts[parts.length - 1] === 'tsx') {
            if (parts.length > 2 && (parts[parts.length - 2] === 'd' || parts[parts.length - 2] === 'spec')) {
                return false;
            }
            return true;
        }
    }
    return false;
}
function isDtsFile(filePath) {
    const parts = filePath.toLowerCase().split('.');
    if (parts.length > 2) {
        return (parts[parts.length - 2] === 'd' && parts[parts.length - 1] === 'ts');
    }
    return false;
}
function isJsFile(filePath) {
    const parts = filePath.toLowerCase().split('.');
    if (parts.length > 1) {
        if (parts[parts.length - 1] === 'js') {
            if (parts.length > 2 && parts[parts.length - 2] === 'spec') {
                return false;
            }
            return true;
        }
    }
    return false;
}
function hasFileExtension(filePath, extensions) {
    filePath = filePath.toLowerCase();
    return extensions.some(ext => filePath.endsWith('.' + ext));
}
/**
 * Only web development text files, like ts, tsx,
 * js, html, css, scss, etc.
 * @param filePath
 */
function isWebDevFile(filePath) {
    return (hasFileExtension(filePath, WEB_DEV_EXT) || isTsFile(filePath));
}
const WEB_DEV_EXT = ['js', 'jsx', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'styl', 'pcss'];
function minifyJs(config, compilerCtx, jsText, sourceTarget, preamble) {
    return __awaiter(this, void 0, void 0, function* () {
        const opts = { output: {}, compress: {}, mangle: true };
        if (sourceTarget === 'es5') {
            opts.ecma = 5;
            opts.output.ecma = 5;
            opts.compress.ecma = 5;
            opts.compress.arrows = false;
            opts.output.beautify = false;
        }
        else {
            opts.ecma = 6;
            opts.output.ecma = 6;
            opts.compress.ecma = 6;
            opts.toplevel = true;
            opts.compress.arrows = true;
            opts.output.beautify = false;
        }
        if (config.logLevel === 'debug') {
            opts.mangle = {};
            opts.mangle.keep_fnames = true;
            opts.compress.drop_console = false;
            opts.compress.drop_debugger = false;
            opts.output.beautify = true;
            opts.output.bracketize = true;
            opts.output.indent_level = 2;
            opts.output.comments = 'all';
            opts.output.preserve_line = true;
        }
        else {
            opts.compress.pure_funcs = ['assert', 'console.debug'];
        }
        opts.compress.passes = 2;
        if (preamble) {
            opts.output.preamble = generatePreamble(config);
        }
        const cacheKey = compilerCtx.cache.createKey('minifyJs', opts, jsText);
        const cachedContent = yield compilerCtx.cache.get(cacheKey);
        if (cachedContent != null) {
            return {
                output: cachedContent,
                diagnostics: []
            };
        }
        const r = config.sys.minifyJs(jsText, opts);
        if (r && r.diagnostics.length === 0 && typeof r.output === 'string') {
            yield compilerCtx.cache.put(cacheKey, r.output);
        }
        return r;
    });
}
function generatePreamble(config) {
    let preamble = [];
    if (config.preamble) {
        preamble = config.preamble.split('\n');
    }
    preamble.push(BANNER);
    if (preamble.length > 1) {
        preamble = preamble.map(l => ` * ${l}`);
        preamble.unshift(`/*!`);
        preamble.push(` */`);
        return preamble.join('\n');
    }
    return `/*! ${BANNER} */`;
}
function buildError(diagnostics) {
    const d = {
        level: 'error',
        type: 'build',
        header: 'build error',
        messageText: 'build error',
        relFilePath: null,
        absFilePath: null,
        lines: []
    };
    diagnostics.push(d);
    return d;
}
function buildWarn(diagnostics) {
    const d = {
        level: 'warn',
        type: 'build',
        header: 'build warn',
        messageText: 'build warn',
        relFilePath: null,
        absFilePath: null,
        lines: []
    };
    diagnostics.push(d);
    return d;
}
function catchError(diagnostics, err) {
    const d = {
        level: 'error',
        type: 'build',
        header: 'build error',
        messageText: 'build error',
        relFilePath: null,
        absFilePath: null,
        lines: []
    };
    if (err) {
        if (err.stack) {
            d.messageText = err.stack.toString();
        }
        else {
            if (err.message) {
                d.messageText = err.message.toString();
            }
            else {
                d.messageText = err.toString();
            }
        }
    }
    diagnostics.push(d);
    return d;
}
function hasError(diagnostics) {
    if (!diagnostics) {
        return false;
    }
    return diagnostics.some(d => d.level === 'error' && d.type !== 'runtime');
}
function pathJoin(config, ...paths) {
    return normalizePath(config.sys.path.join.apply(config.sys.path, paths));
}
function normalizePath(str) {
    // Convert Windows backslash paths to slash paths: foo\\bar ➔ foo/bar
    // https://github.com/sindresorhus/slash MIT
    // By Sindre Sorhus
    if (typeof str !== 'string') {
        throw new Error(`invalid path to normalize`);
    }
    str = str.trim();
    if (EXTENDED_PATH_REGEX.test(str) || NON_ASCII_REGEX.test(str)) {
        return str;
    }
    str = str.replace(SLASH_REGEX, '/');
    // always remove the trailing /
    // this makes our file cache look ups consistent
    if (str.charAt(str.length - 1) === '/') {
        const colonIndex = str.indexOf(':');
        if (colonIndex > -1) {
            if (colonIndex < str.length - 2) {
                str = str.substring(0, str.length - 1);
            }
        }
        else if (str.length > 1) {
            str = str.substring(0, str.length - 1);
        }
    }
    return str;
}
const EXTENDED_PATH_REGEX = /^\\\\\?\\/;
const NON_ASCII_REGEX = /[^\x00-\x80]+/;
const SLASH_REGEX = /\\/g;

const isDef = (v) => v !== undefined && v !== null;
const isUndef = (v) => v === undefined || v === null;
const toLowerCase = (str) => str.toLowerCase();
const toDashCase = (str) => toLowerCase(str.replace(/([A-Z])/g, g => ' ' + g[0]).trim().replace(/ /g, '-'));
const dashToPascalCase = (str) => toLowerCase(str).split('-').map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('');
const noop = () => { };

function bundleEntryFile(config, entryModules) {
    return {
        name: 'bundleEntryFilePlugin',
        resolveId(importee) {
            const bundle = entryModules.find(b => b.entryKey === importee);
            if (bundle) {
                return bundle.entryKey;
            }
            return null;
        },
        load(id) {
            const bundle = entryModules.find(b => b.entryKey === id);
            if (bundle) {
                return createEntryPointString(config, bundle);
            }
            return null;
        }
    };
}
function createEntryPointString(config, entryModule) {
    const path = config.sys.path;
    return entryModule.moduleFiles
        .map(moduleFile => {
        const originalClassName = moduleFile.cmpMeta.componentClass;
        const pascalCasedClassName = dashToPascalCase(moduleFile.cmpMeta.tagNameMeta);
        const filePath = normalizePath(path.relative(path.dirname(entryModule.entryKey), moduleFile.jsFilePath));
        return `export { ${originalClassName} as ${pascalCasedClassName} } from './${filePath}';`;
    })
        .join('\n');
}

function bundleJson(config, options = {}) {
    const path = config.sys.path;
    const filter = rollupPluginutils.createFilter(options.include, options.exclude);
    return {
        name: 'json',
        resolveId(importee, importer) {
            if (importer && importer.startsWith(config.collectionDir) && importee.endsWith('.json')) {
                return path.resolve(path.dirname(importer).replace(config.collectionDir, config.srcDir), importee);
            }
            return null;
        },
        transform(json, id) {
            if (id.slice(-5) !== '.json')
                return null;
            if (!filter(id))
                return null;
            const data = JSON.parse(json);
            let code = '';
            const ast = {
                type: 'Program',
                sourceType: 'module',
                start: 0,
                end: null,
                body: []
            };
            if (Object.prototype.toString.call(data) !== '[object Object]') {
                code = `export default ${json};`;
                ast.body.push({
                    type: 'ExportDefaultDeclaration',
                    start: 0,
                    end: code.length,
                    declaration: {
                        type: 'Literal',
                        start: 15,
                        end: code.length - 1,
                        value: null,
                        raw: 'null'
                    }
                });
            }
            else {
                const indent = 'indent' in options ? options.indent : '\t';
                const validKeys = [];
                const invalidKeys = [];
                Object.keys(data).forEach(key => {
                    if (key === rollupPluginutils.makeLegalIdentifier(key)) {
                        validKeys.push(key);
                    }
                    else {
                        invalidKeys.push(key);
                    }
                });
                let char = 0;
                validKeys.forEach(key => {
                    const declarationType = options.preferConst ? 'const' : 'var';
                    const declaration = `export ${declarationType} ${key} = ${JSON.stringify(data[key])};`;
                    const start = char;
                    const end = start + declaration.length;
                    // generate fake AST node while we're here
                    ast.body.push({
                        type: 'ExportNamedDeclaration',
                        start: char,
                        end: char + declaration.length,
                        declaration: {
                            type: 'VariableDeclaration',
                            start: start + 7,
                            end,
                            declarations: [
                                {
                                    type: 'VariableDeclarator',
                                    start: start + 7 + declarationType.length + 1,
                                    end: end - 1,
                                    id: {
                                        type: 'Identifier',
                                        start: start + 7 + declarationType.length + 1,
                                        end: start + 7 + declarationType.length + 1 + key.length,
                                        name: key
                                    },
                                    init: {
                                        type: 'Literal',
                                        start: start +
                                            7 +
                                            declarationType.length +
                                            1 +
                                            key.length +
                                            3,
                                        end: end - 1,
                                        value: null,
                                        raw: 'null'
                                    }
                                }
                            ],
                            kind: declarationType
                        },
                        specifiers: [],
                        source: null
                    });
                    char = end + 1;
                    code += `${declaration}\n`;
                });
                const defaultExportNode = {
                    type: 'ExportDefaultDeclaration',
                    start: char,
                    end: null,
                    declaration: {
                        type: 'ObjectExpression',
                        start: char + 15,
                        end: null,
                        properties: []
                    }
                };
                char += 17 + indent.length; // 'export default {\n\t'.length'
                const defaultExportRows = validKeys
                    .map(key => {
                    const row = `${key}: ${key}`;
                    const start = char;
                    const end = start + row.length;
                    defaultExportNode.declaration.properties.push({
                        type: 'Property',
                        start,
                        end,
                        method: false,
                        shorthand: false,
                        computed: false,
                        key: {
                            type: 'Identifier',
                            start,
                            end: start + key.length,
                            name: key
                        },
                        value: {
                            type: 'Identifier',
                            start: start + key.length + 2,
                            end,
                            name: key
                        },
                        kind: 'init'
                    });
                    char += row.length + (2 + indent.length); // ',\n\t'.length
                    return row;
                })
                    .concat(invalidKeys.map(key => `"${key}": ${JSON.stringify(data[key])}`));
                code += `export default {\n${indent}${defaultExportRows.join(`,\n${indent}`)}\n};`;
                ast.body.push(defaultExportNode);
                const end = code.length;
                defaultExportNode.declaration.end = end - 1;
                defaultExportNode.end = end;
            }
            ast.end = code.length;
            return { ast, code, map: { mappings: '' } };
        }
    };
}

function cleanDiagnostics(diagnostics) {
    const cleaned = [];
    const maxErrors = Math.min(diagnostics.length, MAX_ERRORS);
    const dups = {};
    for (var i = 0; i < maxErrors; i++) {
        var d = diagnostics[i];
        var key = d.absFilePath + d.code + d.messageText + d.type;
        if (dups[key]) {
            continue;
        }
        dups[key] = true;
        if (d.messageText) {
            if (typeof d.messageText.message === 'string') {
                d.messageText = d.messageText.message;
            }
            else if (typeof d.messageText === 'string' && d.messageText.indexOf('Error: ') === 0) {
                d.messageText = d.messageText.substr(7);
            }
        }
        cleaned.push(d);
    }
    return cleaned;
}
function formatFileName(rootDir, fileName) {
    if (!rootDir || !fileName)
        return '';
    fileName = fileName.replace(rootDir, '');
    if (/\/|\\/.test(fileName.charAt(0))) {
        fileName = fileName.substr(1);
    }
    if (fileName.length > 80) {
        fileName = '...' + fileName.substr(fileName.length - 80);
    }
    return fileName;
}
function formatHeader(type, fileName, rootDir, startLineNumber = null, endLineNumber = null) {
    let header = `${type}: ${formatFileName(rootDir, fileName)}`;
    if (startLineNumber !== null && startLineNumber > 0) {
        if (endLineNumber !== null && endLineNumber > startLineNumber) {
            header += `, lines: ${startLineNumber} - ${endLineNumber}`;
        }
        else {
            header += `, line: ${startLineNumber}`;
        }
    }
    return header;
}
function splitLineBreaks(sourceText) {
    if (!sourceText)
        return [];
    sourceText = sourceText.replace(/\\r/g, '\n');
    return sourceText.split('\n');
}
const MAX_ERRORS = 15;

/**
 * Ported from highlight.js
 * Syntax highlighting with language autodetection.
 * https://highlightjs.org/
 * Copyright (c) 2006, Ivan Sagalaev
 * https://github.com/isagalaev/highlight.js/blob/master/LICENSE
 */
var hljs = {};
// Convenience variables for build-in objects
var objectKeys = Object.keys;
// Global internal variables used within the highlight.js library.
var languages = {}, aliases = {};
var spanEndTag = '</span>';
// Global options used when within external APIs. This is modified when
// calling the `hljs.configure` function.
var options = {
    classPrefix: 'hljs-',
    tabReplace: null,
    useBR: false,
    languages: undefined
};
// Object map that is used to escape some common HTML characters.
var escapeRegexMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};
/* Utility functions */
function escape(value) {
    return value.replace(/[&<>]/gm, function (character) {
        return escapeRegexMap[character];
    });
}
function testRe(re, lexeme) {
    var match = re && re.exec(lexeme);
    return match && match.index === 0;
}
function inherit(parent, obj) {
    var key;
    var result = {};
    for (key in parent)
        result[key] = parent[key];
    if (obj)
        for (key in obj)
            result[key] = obj[key];
    return result;
}
/* Initialization */
function compileLanguage(language) {
    function reStr(re) {
        return (re && re.source) || re;
    }
    function langRe(value, global) {
        return new RegExp(reStr(value), 'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : ''));
    }
    function compileMode(mode, parent) {
        if (mode.compiled)
            return;
        mode.compiled = true;
        mode.keywords = mode.keywords || mode.beginKeywords;
        if (mode.keywords) {
            var compiled_keywords = {};
            var flatten = function (className, str) {
                if (language.case_insensitive) {
                    str = str.toLowerCase();
                }
                str.split(' ').forEach(function (kw) {
                    var pair = kw.split('|');
                    compiled_keywords[pair[0]] = [className, pair[1] ? Number(pair[1]) : 1];
                });
            };
            if (typeof mode.keywords === 'string') {
                flatten('keyword', mode.keywords);
            }
            else {
                objectKeys(mode.keywords).forEach(function (className) {
                    flatten(className, mode.keywords[className]);
                });
            }
            mode.keywords = compiled_keywords;
        }
        mode.lexemesRe = langRe(mode.lexemes || /\w+/, true);
        if (parent) {
            if (mode.beginKeywords) {
                mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')\\b';
            }
            if (!mode.begin)
                mode.begin = /\B|\b/;
            mode.beginRe = langRe(mode.begin);
            if (!mode.end && !mode.endsWithParent)
                mode.end = /\B|\b/;
            if (mode.end)
                mode.endRe = langRe(mode.end);
            mode.terminator_end = reStr(mode.end) || '';
            if (mode.endsWithParent && parent.terminator_end)
                mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
        }
        if (mode.illegal)
            mode.illegalRe = langRe(mode.illegal);
        if (mode.relevance == null)
            mode.relevance = 1;
        if (!mode.contains) {
            mode.contains = [];
        }
        var expanded_contains = [];
        mode.contains.forEach(function (c) {
            if (c.variants) {
                c.variants.forEach(function (v) { expanded_contains.push(inherit(c, v)); });
            }
            else {
                expanded_contains.push(c === 'self' ? mode : c);
            }
        });
        mode.contains = expanded_contains;
        mode.contains.forEach(function (c) { compileMode(c, mode); });
        if (mode.starts) {
            compileMode(mode.starts, parent);
        }
        var terminators = mode.contains.map(function (c) {
            return c.beginKeywords ? '\\.?(' + c.begin + ')\\.?' : c.begin;
        })
            .concat([mode.terminator_end, mode.illegal])
            .map(reStr)
            .filter(Boolean);
        mode.terminators = terminators.length ? langRe(terminators.join('|'), true) : { exec: function () { return null; } };
    }
    compileMode(language);
}
/*
Core highlighting function. Accepts a language name, or an alias, and a
string with the code to highlight. Returns an object with the following
properties:

- relevance (int)
- value (an HTML string with highlighting markup)

*/
function highlight(name, value, ignore_illegals, continuation) {
    function subMode(lexeme, mode) {
        var i, length;
        for (i = 0, length = mode.contains.length; i < length; i++) {
            if (testRe(mode.contains[i].beginRe, lexeme)) {
                return mode.contains[i];
            }
        }
    }
    function endOfMode(mode, lexeme) {
        if (testRe(mode.endRe, lexeme)) {
            while (mode.endsParent && mode.parent) {
                mode = mode.parent;
            }
            return mode;
        }
        if (mode.endsWithParent) {
            return endOfMode(mode.parent, lexeme);
        }
    }
    function isIllegal(lexeme, mode) {
        return !ignore_illegals && testRe(mode.illegalRe, lexeme);
    }
    function keywordMatch(mode, match) {
        var match_str = language.case_insensitive ? match[0].toLowerCase() : match[0];
        return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
    }
    function buildSpan(classname, insideSpan, leaveOpen, noPrefix) {
        var classPrefix = noPrefix ? '' : options.classPrefix, openSpan = '<span class="' + classPrefix, closeSpan = leaveOpen ? '' : spanEndTag;
        openSpan += classname + '">';
        return openSpan + insideSpan + closeSpan;
    }
    function processKeywords() {
        var keyword_match, last_index, match, result;
        if (!top.keywords)
            return escape(mode_buffer);
        result = '';
        last_index = 0;
        top.lexemesRe.lastIndex = 0;
        match = top.lexemesRe.exec(mode_buffer);
        while (match) {
            result += escape(mode_buffer.substr(last_index, match.index - last_index));
            keyword_match = keywordMatch(top, match);
            if (keyword_match) {
                relevance += keyword_match[1];
                result += buildSpan(keyword_match[0], escape(match[0]));
            }
            else {
                result += escape(match[0]);
            }
            last_index = top.lexemesRe.lastIndex;
            match = top.lexemesRe.exec(mode_buffer);
        }
        return result + escape(mode_buffer.substr(last_index));
    }
    function processSubLanguage() {
        var explicit = typeof top.subLanguage === 'string';
        if (explicit && !languages[top.subLanguage]) {
            return escape(mode_buffer);
        }
        var result = explicit ?
            highlight(top.subLanguage, mode_buffer, true, continuations[top.subLanguage]) :
            highlightAuto(mode_buffer, top.subLanguage.length ? top.subLanguage : undefined);
        // Counting embedded language score towards the host language may be disabled
        // with zeroing the containing mode relevance. Usecase in point is Markdown that
        // allows XML everywhere and makes every XML snippet to have a much larger Markdown
        // score.
        if (top.relevance > 0) {
            relevance += result.relevance;
        }
        if (explicit) {
            continuations[top.subLanguage] = result.top;
        }
        return buildSpan(result.language, result.value, false, true);
    }
    function processBuffer() {
        result += (top.subLanguage != null ? processSubLanguage() : processKeywords());
        mode_buffer = '';
    }
    function startNewMode(mode) {
        result += mode.className ? buildSpan(mode.className, '', true) : '';
        top = Object.create(mode, { parent: { value: top } });
    }
    function processLexeme(buffer, lexeme) {
        mode_buffer += buffer;
        if (lexeme == null) {
            processBuffer();
            return 0;
        }
        var new_mode = subMode(lexeme, top);
        if (new_mode) {
            if (new_mode.skip) {
                mode_buffer += lexeme;
            }
            else {
                if (new_mode.excludeBegin) {
                    mode_buffer += lexeme;
                }
                processBuffer();
                if (!new_mode.returnBegin && !new_mode.excludeBegin) {
                    mode_buffer = lexeme;
                }
            }
            startNewMode(new_mode);
            return new_mode.returnBegin ? 0 : lexeme.length;
        }
        var end_mode = endOfMode(top, lexeme);
        if (end_mode) {
            var origin = top;
            if (origin.skip) {
                mode_buffer += lexeme;
            }
            else {
                if (!(origin.returnEnd || origin.excludeEnd)) {
                    mode_buffer += lexeme;
                }
                processBuffer();
                if (origin.excludeEnd) {
                    mode_buffer = lexeme;
                }
            }
            do {
                if (top.className) {
                    result += spanEndTag;
                }
                if (!top.skip) {
                    relevance += top.relevance;
                }
                top = top.parent;
            } while (top !== end_mode.parent);
            if (end_mode.starts) {
                startNewMode(end_mode.starts);
            }
            return origin.returnEnd ? 0 : lexeme.length;
        }
        if (isIllegal(lexeme, top))
            throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');
        /*
        Parser should not reach this point as all types of lexemes should be caught
        earlier, but if it does due to some bug make sure it advances at least one
        character forward to prevent infinite looping.
        */
        mode_buffer += lexeme;
        return lexeme.length || 1;
    }
    var language = getLanguage(name);
    if (!language) {
        throw new Error('Unknown language: "' + name + '"');
    }
    compileLanguage(language);
    var top = continuation || language;
    var continuations = {}; // keep continuations for sub-languages
    var result = '', current;
    for (current = top; current !== language; current = current.parent) {
        if (current.className) {
            result = buildSpan(current.className, '', true) + result;
        }
    }
    var mode_buffer = '';
    var relevance = 0;
    try {
        var match, count, index = 0;
        while (true) {
            top.terminators.lastIndex = index;
            match = top.terminators.exec(value);
            if (!match)
                break;
            count = processLexeme(value.substr(index, match.index - index), match[0]);
            index = match.index + count;
        }
        processLexeme(value.substr(index));
        for (current = top; current.parent; current = current.parent) {
            if (current.className) {
                result += spanEndTag;
            }
        }
        return {
            relevance: relevance,
            value: result,
            language: name,
            top: top
        };
    }
    catch (e) {
        if (e.message && e.message.indexOf('Illegal') !== -1) {
            return {
                relevance: 0,
                value: escape(value)
            };
        }
        else {
            throw e;
        }
    }
}
/*
Highlighting with language detection. Accepts a string with the code to
highlight. Returns an object with the following properties:

- language (detected language)
- relevance (int)
- value (an HTML string with highlighting markup)
- second_best (object with the same structure for second-best heuristically
  detected language, may be absent)

*/
function highlightAuto(text, languageSubset) {
    languageSubset = languageSubset || options.languages || objectKeys(languages);
    var result = {
        relevance: 0,
        value: escape(text)
    };
    var second_best = result;
    languageSubset.filter(getLanguage).forEach(function (name) {
        var current = highlight(name, text, false);
        current.language = name;
        if (current.relevance > second_best.relevance) {
            second_best = current;
        }
        if (current.relevance > result.relevance) {
            second_best = result;
            result = current;
        }
    });
    if (second_best.language) {
        result.second_best = second_best;
    }
    return result;
}
/*
Updates highlight.js global options with values passed in the form of an object.
*/
function configure(user_options) {
    options = inherit(options, user_options);
}
function registerLanguage(name, language) {
    var lang = languages[name] = language(hljs);
    if (lang.aliases) {
        lang.aliases.forEach(function (alias) { aliases[alias] = name; });
    }
}
function listLanguages() {
    return objectKeys(languages);
}
function getLanguage(name) {
    name = (name || '').toLowerCase();
    return languages[name] || languages[aliases[name]];
}
/* Interface definition */
hljs.highlight = highlight;
hljs.highlightAuto = highlightAuto;
hljs.configure = configure;
hljs.registerLanguage = registerLanguage;
hljs.listLanguages = listLanguages;
hljs.getLanguage = getLanguage;
hljs.inherit = inherit;
// Common regexps
hljs.IDENT_RE = '[a-zA-Z]\\w*';
hljs.UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
hljs.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
hljs.C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
hljs.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
hljs.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';
// Common modes
hljs.BACKSLASH_ESCAPE = {
    begin: '\\\\[\\s\\S]', relevance: 0
};
hljs.APOS_STRING_MODE = {
    className: 'string',
    begin: '\'', end: '\'',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
};
hljs.QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"', end: '"',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
};
hljs.PHRASAL_WORDS_MODE = {
    begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|like)\b/
};
hljs.COMMENT = function (begin, end, inherits) {
    var mode = hljs.inherit({
        className: 'comment',
        begin: begin, end: end,
        contains: []
    }, inherits || {});
    mode.contains.push(hljs.PHRASAL_WORDS_MODE);
    mode.contains.push({
        className: 'doctag',
        begin: '(?:TODO|FIXME|NOTE|BUG|XXX):',
        relevance: 0
    });
    return mode;
};
hljs.C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$');
hljs.C_BLOCK_COMMENT_MODE = hljs.COMMENT('/\\*', '\\*/');
hljs.HASH_COMMENT_MODE = hljs.COMMENT('#', '$');
hljs.NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE,
    relevance: 0
};
hljs.C_NUMBER_MODE = {
    className: 'number',
    begin: hljs.C_NUMBER_RE,
    relevance: 0
};
hljs.BINARY_NUMBER_MODE = {
    className: 'number',
    begin: hljs.BINARY_NUMBER_RE,
    relevance: 0
};
hljs.CSS_NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE + '(' +
        '%|em|ex|ch|rem' +
        '|vw|vh|vmin|vmax' +
        '|cm|mm|in|pt|pc|px' +
        '|deg|grad|rad|turn' +
        '|s|ms' +
        '|Hz|kHz' +
        '|dpi|dpcm|dppx' +
        ')?',
    relevance: 0
};
hljs.REGEXP_MODE = {
    className: 'regexp',
    begin: /\//, end: /\/[gimuy]*/,
    illegal: /\n/,
    contains: [
        hljs.BACKSLASH_ESCAPE,
        {
            begin: /\[/, end: /\]/,
            relevance: 0,
            contains: [hljs.BACKSLASH_ESCAPE]
        }
    ]
};
hljs.TITLE_MODE = {
    className: 'title',
    begin: hljs.IDENT_RE,
    relevance: 0
};
hljs.UNDERSCORE_TITLE_MODE = {
    className: 'title',
    begin: hljs.UNDERSCORE_IDENT_RE,
    relevance: 0
};
hljs.METHOD_GUARD = {
    // excludes method names from keyword processing
    begin: '\\.\\s*' + hljs.UNDERSCORE_IDENT_RE,
    relevance: 0
};
hljs.registerLanguage('typescript', typescript);
function typescript(hljs) {
    var KEYWORDS = {
        keyword: 'in if for while finally var new function do return void else break catch ' +
            'instanceof with throw case default try this switch continue typeof delete ' +
            'let yield const class public private protected get set super ' +
            'static implements enum export import declare type namespace abstract',
        literal: 'true false null undefined NaN Infinity',
        built_in: 'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
            'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
            'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
            'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
            'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
            'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
            'module console window document any number boolean string void'
    };
    return {
        aliases: ['ts'],
        keywords: KEYWORDS,
        contains: [
            {
                className: 'meta',
                begin: /^\s*['"]use strict['"]/
            },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            {
                className: 'string',
                begin: '`', end: '`',
                contains: [
                    hljs.BACKSLASH_ESCAPE,
                    {
                        className: 'subst',
                        begin: '\\$\\{', end: '\\}'
                    }
                ]
            },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            {
                className: 'number',
                variants: [
                    { begin: '\\b(0[bB][01]+)' },
                    { begin: '\\b(0[oO][0-7]+)' },
                    { begin: hljs.C_NUMBER_RE }
                ],
                relevance: 0
            },
            {
                begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
                keywords: 'return throw case',
                contains: [
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE,
                    hljs.REGEXP_MODE
                ],
                relevance: 0
            },
            {
                className: 'function',
                begin: 'function', end: /[\{;]/, excludeEnd: true,
                keywords: KEYWORDS,
                contains: [
                    'self',
                    hljs.inherit(hljs.TITLE_MODE, { begin: /[A-Za-z$_][0-9A-Za-z$_]*/ }),
                    {
                        className: 'params',
                        begin: /\(/, end: /\)/,
                        excludeBegin: true,
                        excludeEnd: true,
                        keywords: KEYWORDS,
                        contains: [
                            hljs.C_LINE_COMMENT_MODE,
                            hljs.C_BLOCK_COMMENT_MODE
                        ],
                        illegal: /["'\(]/
                    }
                ],
                illegal: /%/,
                relevance: 0 // () => {} is more typical in TypeScript
            },
            {
                beginKeywords: 'constructor', end: /\{/, excludeEnd: true
            },
            {
                begin: /module\./,
                keywords: { built_in: 'module' },
                relevance: 0
            },
            {
                beginKeywords: 'module', end: /\{/, excludeEnd: true
            },
            {
                beginKeywords: 'interface', end: /\{/, excludeEnd: true,
                keywords: 'interface extends'
            },
            {
                begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
            },
            {
                begin: '\\.' + hljs.IDENT_RE, relevance: 0 // hack: prevents detection of keywords after dots
            }
        ]
    };
}
hljs.registerLanguage('scss', scss);
function scss(hljs) {
    var IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
    var VARIABLE = {
        className: 'variable',
        begin: '(\\$' + IDENT_RE + ')\\b'
    };
    var HEXCOLOR = {
        className: 'number', begin: '#[0-9A-Fa-f]+'
    };
    // var DEF_INTERNALS = {
    //   className: 'attribute',
    //   begin: '[A-Z\\_\\.\\-]+', end: ':',
    //   excludeEnd: true,
    //   illegal: '[^\\s]',
    //   starts: {
    //     endsWithParent: true, excludeEnd: true,
    //     contains: [
    //       HEXCOLOR,
    //       hljs.CSS_NUMBER_MODE,
    //       hljs.QUOTE_STRING_MODE,
    //       hljs.APOS_STRING_MODE,
    //       hljs.C_BLOCK_COMMENT_MODE,
    //       {
    //         className: 'meta', begin: '!important'
    //       }
    //     ]
    //   }
    // };
    return {
        case_insensitive: true,
        illegal: '[=/|\']',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            {
                className: 'selector-id', begin: '\\#[A-Za-z0-9_-]+',
                relevance: 0
            },
            {
                className: 'selector-class', begin: '\\.[A-Za-z0-9_-]+',
                relevance: 0
            },
            {
                className: 'selector-attr', begin: '\\[', end: '\\]',
                illegal: '$'
            },
            {
                className: 'selector-tag',
                begin: '\\b(a|abbr|acronym|address|area|article|aside|audio|b|base|big|blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|command|datalist|dd|del|details|dfn|div|dl|dt|em|embed|fieldset|figcaption|figure|footer|form|frame|frameset|(h[1-6])|head|header|hgroup|hr|html|i|iframe|img|input|ins|kbd|keygen|label|legend|li|link|map|mark|meta|meter|nav|noframes|noscript|object|ol|optgroup|option|output|p|param|pre|progress|q|rp|rt|ruby|samp|script|section|select|small|span|strike|strong|style|sub|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|tt|ul|var|video)\\b',
                relevance: 0
            },
            {
                begin: ':(visited|valid|root|right|required|read-write|read-only|out-range|optional|only-of-type|only-child|nth-of-type|nth-last-of-type|nth-last-child|nth-child|not|link|left|last-of-type|last-child|lang|invalid|indeterminate|in-range|hover|focus|first-of-type|first-line|first-letter|first-child|first|enabled|empty|disabled|default|checked|before|after|active)'
            },
            {
                begin: '::(after|before|choices|first-letter|first-line|repeat-index|repeat-item|selection|value)'
            },
            VARIABLE,
            {
                className: 'attribute',
                begin: '\\b(z-index|word-wrap|word-spacing|word-break|width|widows|white-space|visibility|vertical-align|unicode-bidi|transition-timing-function|transition-property|transition-duration|transition-delay|transition|transform-style|transform-origin|transform|top|text-underline-position|text-transform|text-shadow|text-rendering|text-overflow|text-indent|text-decoration-style|text-decoration-line|text-decoration-color|text-decoration|text-align-last|text-align|tab-size|table-layout|right|resize|quotes|position|pointer-events|perspective-origin|perspective|page-break-inside|page-break-before|page-break-after|padding-top|padding-right|padding-left|padding-bottom|padding|overflow-y|overflow-x|overflow-wrap|overflow|outline-width|outline-style|outline-offset|outline-color|outline|orphans|order|opacity|object-position|object-fit|normal|none|nav-up|nav-right|nav-left|nav-index|nav-down|min-width|min-height|max-width|max-height|mask|marks|margin-top|margin-right|margin-left|margin-bottom|margin|list-style-type|list-style-position|list-style-image|list-style|line-height|letter-spacing|left|justify-content|initial|inherit|ime-mode|image-orientation|image-resolution|image-rendering|icon|hyphens|height|font-weight|font-variant-ligatures|font-variant|font-style|font-stretch|font-size-adjust|font-size|font-language-override|font-kerning|font-feature-settings|font-family|font|float|flex-wrap|flex-shrink|flex-grow|flex-flow|flex-direction|flex-basis|flex|filter|empty-cells|display|direction|cursor|counter-reset|counter-increment|content|column-width|column-span|column-rule-width|column-rule-style|column-rule-color|column-rule|column-gap|column-fill|column-count|columns|color|clip-path|clip|clear|caption-side|break-inside|break-before|break-after|box-sizing|box-shadow|box-decoration-break|bottom|border-width|border-top-width|border-top-style|border-top-right-radius|border-top-left-radius|border-top-color|border-top|border-style|border-spacing|border-right-width|border-right-style|border-right-color|border-right|border-radius|border-left-width|border-left-style|border-left-color|border-left|border-image-width|border-image-source|border-image-slice|border-image-repeat|border-image-outset|border-image|border-color|border-collapse|border-bottom-width|border-bottom-style|border-bottom-right-radius|border-bottom-left-radius|border-bottom-color|border-bottom|border|background-size|background-repeat|background-position|background-origin|background-image|background-color|background-clip|background-attachment|background-blend-mode|background|backface-visibility|auto|animation-timing-function|animation-play-state|animation-name|animation-iteration-count|animation-fill-mode|animation-duration|animation-direction|animation-delay|animation|align-self|align-items|align-content)\\b',
                illegal: '[^\\s]'
            },
            {
                begin: '\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b'
            },
            {
                begin: ':', end: ';',
                contains: [
                    VARIABLE,
                    HEXCOLOR,
                    hljs.CSS_NUMBER_MODE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.APOS_STRING_MODE,
                    {
                        className: 'meta', begin: '!important'
                    }
                ]
            },
            {
                begin: '@', end: '[{;]',
                keywords: 'mixin include extend for if else each while charset import debug media page content font-face namespace warn',
                contains: [
                    VARIABLE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.APOS_STRING_MODE,
                    HEXCOLOR,
                    hljs.CSS_NUMBER_MODE,
                    {
                        begin: '\\s[A-Za-z0-9_.-]+',
                        relevance: 0
                    }
                ]
            }
        ]
    };
}
hljs.registerLanguage('xml', xml);
function xml(hljs) {
    var XML_IDENT_RE = '[A-Za-z0-9\\._:-]+';
    var TAG_INTERNALS = {
        endsWithParent: true,
        illegal: /</,
        relevance: 0,
        contains: [
            {
                className: 'attr',
                begin: XML_IDENT_RE,
                relevance: 0
            },
            {
                begin: /=\s*/,
                relevance: 0,
                contains: [
                    {
                        className: 'string',
                        endsParent: true,
                        variants: [
                            { begin: /"/, end: /"/ },
                            { begin: /'/, end: /'/ },
                            { begin: /[^\s"'=<>`]+/ }
                        ]
                    }
                ]
            }
        ]
    };
    return {
        aliases: ['html', 'xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist'],
        case_insensitive: true,
        contains: [
            {
                className: 'meta',
                begin: '<!DOCTYPE', end: '>',
                relevance: 10,
                contains: [{ begin: '\\[', end: '\\]' }]
            },
            hljs.COMMENT('<!--', '-->', {
                relevance: 10
            }),
            {
                begin: '<\\!\\[CDATA\\[', end: '\\]\\]>',
                relevance: 10
            },
            {
                begin: /<\?(php)?/, end: /\?>/,
                subLanguage: 'php',
                contains: [{ begin: '/\\*', end: '\\*/', skip: true }]
            },
            {
                className: 'tag',
                /*
                The lookahead pattern (?=...) ensures that 'begin' only matches
                '<style' as a single word, followed by a whitespace or an
                ending braket. The '$' is needed for the lexeme to be recognized
                by hljs.subMode() that tests lexemes outside the stream.
                */
                begin: '<style(?=\\s|>|$)', end: '>',
                keywords: { name: 'style' },
                contains: [TAG_INTERNALS],
                starts: {
                    end: '</style>', returnEnd: true,
                    subLanguage: ['css', 'xml']
                }
            },
            {
                className: 'tag',
                // See the comment in the <style tag about the lookahead pattern
                begin: '<script(?=\\s|>|$)', end: '>',
                keywords: { name: 'script' },
                contains: [TAG_INTERNALS],
                starts: {
                    end: '\<\/script\>', returnEnd: true,
                    subLanguage: ['actionscript', 'javascript', 'handlebars', 'xml']
                }
            },
            {
                className: 'meta',
                variants: [
                    { begin: /<\?xml/, end: /\?>/, relevance: 10 },
                    { begin: /<\?\w+/, end: /\?>/ }
                ]
            },
            {
                className: 'tag',
                begin: '</?', end: '/?>',
                contains: [
                    {
                        className: 'name', begin: /[^\/><\s]+/, relevance: 0
                    },
                    TAG_INTERNALS
                ]
            }
        ]
    };
}

function loadRollupDiagnostics(config, compilerCtx, buildCtx, rollupError) {
    const d = {
        level: 'error',
        type: 'build',
        language: 'javascript',
        header: 'build error',
        code: rollupError.code,
        messageText: rollupError.message,
        relFilePath: null,
        absFilePath: null,
        lines: []
    };
    if (rollupError.loc && rollupError.loc.file) {
        d.absFilePath = rollupError.loc.file;
        d.relFilePath = formatFileName(config.rootDir, d.absFilePath);
        try {
            const sourceText = compilerCtx.fs.readFileSync(d.absFilePath);
            const srcLines = splitLineBreaks(sourceText);
            let htmlLines = srcLines;
            try {
                htmlLines = splitLineBreaks(highlight(d.language, sourceText, true).value);
            }
            catch (e) { }
            const errorLine = {
                lineIndex: rollupError.loc.line - 1,
                lineNumber: rollupError.loc.line,
                text: srcLines[rollupError.loc.line - 1],
                html: htmlLines[rollupError.loc.line - 1],
                errorCharStart: rollupError.loc.column,
                errorLength: 0
            };
            const highlightLine = errorLine.text.substr(rollupError.loc.column);
            for (var i = 0; i < highlightLine.length; i++) {
                if (CHAR_BREAK.indexOf(highlightLine.charAt(i)) > -1) {
                    break;
                }
                errorLine.errorLength++;
            }
            if (errorLine.html && errorLine.html.indexOf('class="hljs') === -1) {
                try {
                    errorLine.html = highlight(d.language, errorLine.text, true).value;
                }
                catch (e) { }
            }
            d.lines.push(errorLine);
            if (errorLine.errorLength === 0 && errorLine.errorCharStart > 0) {
                errorLine.errorLength = 1;
                errorLine.errorCharStart--;
            }
            d.header = formatHeader('bundling', d.absFilePath, config.rootDir, errorLine.lineNumber);
            if (errorLine.lineIndex > 0) {
                const previousLine = {
                    lineIndex: errorLine.lineIndex - 1,
                    lineNumber: errorLine.lineNumber - 1,
                    text: srcLines[errorLine.lineIndex - 1],
                    html: htmlLines[errorLine.lineIndex - 1],
                    errorCharStart: -1,
                    errorLength: -1
                };
                if (previousLine.html && previousLine.html.indexOf('class="hljs') === -1) {
                    try {
                        previousLine.html = highlight(d.language, previousLine.text, true).value;
                    }
                    catch (e) { }
                }
                d.lines.unshift(previousLine);
            }
            if (errorLine.lineIndex + 1 < srcLines.length) {
                const nextLine = {
                    lineIndex: errorLine.lineIndex + 1,
                    lineNumber: errorLine.lineNumber + 1,
                    text: srcLines[errorLine.lineIndex + 1],
                    html: htmlLines[errorLine.lineIndex + 1],
                    errorCharStart: -1,
                    errorLength: -1
                };
                if (nextLine.html && nextLine.html.indexOf('class="hljs') === -1) {
                    try {
                        nextLine.html = highlight(d.language, nextLine.text, true).value;
                    }
                    catch (e) { }
                }
                d.lines.push(nextLine);
            }
        }
        catch (e) {
            d.messageText = `Error parsing: ${rollupError.loc.file}, line: ${rollupError.loc.line}, column: ${rollupError.loc.column}`;
        }
    }
    buildCtx.diagnostics.push(d);
}
const CHAR_BREAK = [' ', '=', '.', ',', '?', ':', ';', '(', ')', '{', '}', '[', ']', '|', `'`, `"`, '`'];
function createOnWarnFn(config, diagnostics, bundleModulesFiles) {
    const previousWarns = {};
    return function onWarningMessage(warning) {
        if (!warning || warning.message in previousWarns) {
            return;
        }
        previousWarns[warning.message] = true;
        if (warning.code) {
            if (INGORE_WARNING_CODES.includes(warning.code)) {
                return;
            }
            if (SUPPRESS_WARNING_CODES.includes(warning.code)) {
                config.logger.debug(warning.message);
                return;
            }
        }
        let label = '';
        if (bundleModulesFiles) {
            label = bundleModulesFiles.map(moduleFile => moduleFile.cmpMeta.tagNameMeta).join(', ').trim();
            if (label.length) {
                label += ': ';
            }
        }
        buildWarn(diagnostics).messageText = label + (warning.message || warning);
    };
}
const INGORE_WARNING_CODES = [
    `THIS_IS_UNDEFINED`, `NON_EXISTENT_EXPORT`
];
const SUPPRESS_WARNING_CODES = [
    `CIRCULAR_DEPENDENCY`
];

function formatComponentLoaderRegistry(cmpRegistry) {
    // ensure we've got a standard order of the components
    return Object.keys(cmpRegistry).sort().map(tag => {
        const cmpMeta = cmpRegistry[tag];
        cmpMeta.tagNameMeta = tag.toLowerCase().trim();
        return formatComponentLoader(cmpMeta);
    });
}
function formatComponentLoader(cmpMeta) {
    const d = [
        /* 0 */ cmpMeta.tagNameMeta,
        /* 1 */ formatLoaderBundleIds(cmpMeta.bundleIds),
        /* 2 */ formatHasStyles(cmpMeta.stylesMeta),
        /* 3 */ formatMembers(cmpMeta.membersMeta),
        /* 4 */ formatEncapsulation(cmpMeta.encapsulation),
        /* 5 */ formatListeners(cmpMeta.listenersMeta)
    ];
    return trimFalsyData(d);
}
function formatLoaderBundleIds(bundleIds) {
    if (!bundleIds) {
        return `invalid-bundle-id`;
    }
    if (typeof bundleIds === 'string') {
        return bundleIds;
    }
    const modes = Object.keys(bundleIds).sort();
    if (!modes.length) {
        return `invalid-bundle-id`;
    }
    if (modes.length === 1) {
        return bundleIds[modes[0]];
    }
    const bundleIdObj = {};
    modes.forEach(modeName => {
        bundleIdObj[modeName] = bundleIds[modeName];
    });
    return bundleIdObj;
}
function formatHasStyles(stylesMeta) {
    if (stylesMeta && Object.keys(stylesMeta).length > 0) {
        return 1;
    }
    return 0;
}
function formatMembers(membersMeta) {
    if (!membersMeta) {
        return 0;
    }
    const observeAttrs = [];
    const memberNames = Object.keys(membersMeta).sort();
    memberNames.forEach(memberName => {
        const memberMeta = membersMeta[memberName];
        const d = [
            memberName,
            memberMeta.memberType
        ];
        if (memberMeta.propType === 3 /* Boolean */ || memberMeta.propType === 4 /* Number */ || memberMeta.propType === 2 /* String */ || memberMeta.propType === 1 /* Any */) {
            // observe the attribute
            if (memberMeta.attribName !== memberName) {
                // property name and attribute name are different
                // ariaDisabled !== aria-disabled
                d.push(memberMeta.attribName);
            }
            else {
                // property name and attribute name are the exact same
                // checked === checked
                d.push(1);
            }
            d.push(memberMeta.propType);
        }
        else {
            // do not observe the attribute
            d.push(0);
            d.push(0 /* Unknown */);
        }
        if (memberMeta.ctrlId) {
            d.push(memberMeta.ctrlId);
        }
        observeAttrs.push(d);
    });
    if (!observeAttrs.length) {
        return 0;
    }
    return observeAttrs.map(p => {
        return trimFalsyData(p);
    });
}
function formatEncapsulation(val) {
    if (val === 1 /* ShadowDom */) {
        return 1 /* ShadowDom */;
    }
    if (val === 2 /* ScopedCss */) {
        return 2 /* ScopedCss */;
    }
    return 0 /* NoEncapsulation */;
}
function formatListeners(listeners) {
    if (!listeners || !listeners.length) {
        return 0;
    }
    return listeners.map(listener => {
        const d = [
            listener.eventName,
            listener.eventMethodName,
            listener.eventDisabled ? 1 : 0,
            listener.eventPassive ? 1 : 0,
            listener.eventCapture ? 1 : 0
        ];
        return trimFalsyData(d);
    });
}
function formatComponentConstructorProperties(membersMeta) {
    if (!membersMeta) {
        return null;
    }
    const memberNames = Object.keys(membersMeta).sort((a, b) => {
        if (a.toLowerCase() < b.toLowerCase())
            return -1;
        if (a.toLowerCase() > b.toLowerCase())
            return 1;
        return 0;
    });
    if (!memberNames.length) {
        return null;
    }
    const properties = {};
    memberNames.forEach(memberName => {
        properties[memberName] = formatComponentConstructorProperty(memberName, membersMeta[memberName]);
    });
    return properties;
}
function formatComponentConstructorProperty(memberName, memberMeta) {
    const property = {};
    if (memberMeta.memberType === 5 /* State */) {
        property.state = true;
    }
    else if (memberMeta.memberType === 7 /* Element */) {
        property.elementRef = true;
    }
    else if (memberMeta.memberType === 6 /* Method */) {
        property.method = true;
    }
    else if (memberMeta.memberType === 4 /* PropConnect */) {
        property.connect = memberMeta.ctrlId;
    }
    else if (memberMeta.memberType === 3 /* PropContext */) {
        property.context = memberMeta.ctrlId;
    }
    else {
        if (memberMeta.propType === 2 /* String */) {
            property.type = String;
            property.attr = toDashCase(memberName);
        }
        else if (memberMeta.propType === 3 /* Boolean */) {
            property.type = Boolean;
            property.attr = toDashCase(memberName);
        }
        else if (memberMeta.propType === 4 /* Number */) {
            property.type = Number;
            property.attr = toDashCase(memberName);
        }
        else if (memberMeta.propType === 1 /* Any */) {
            property.type = 'Any';
            property.attr = toDashCase(memberName);
        }
        else {
            property.type = 'Any';
            property.attr = toDashCase(memberName);
        }
        if (memberMeta.memberType === 2 /* PropMutable */) {
            property.mutable = true;
        }
    }
    if (memberMeta.watchCallbacks && memberMeta.watchCallbacks.length > 0) {
        property.watchCallbacks = memberMeta.watchCallbacks.slice();
    }
    return property;
}
function formatComponentConstructorEvents(eventsMeta) {
    if (!eventsMeta || !eventsMeta.length) {
        return null;
    }
    return eventsMeta.map(ev => formatComponentConstructorEvent(ev));
}
function formatComponentConstructorEvent(eventMeta) {
    const constructorEvent = {
        name: eventMeta.eventName,
        method: eventMeta.eventMethodName,
        bubbles: true,
        cancelable: true,
        composed: true
    };
    // default bubbles true
    if (typeof eventMeta.eventBubbles === 'boolean') {
        constructorEvent.bubbles = eventMeta.eventBubbles;
    }
    // default cancelable true
    if (typeof eventMeta.eventCancelable === 'boolean') {
        constructorEvent.cancelable = eventMeta.eventCancelable;
    }
    // default composed true
    if (typeof eventMeta.eventComposed === 'boolean') {
        constructorEvent.composed = eventMeta.eventComposed;
    }
    return constructorEvent;
}
function trimFalsyData(d) {
    for (var i = d.length - 1; i >= 0; i--) {
        if (d[i]) {
            break;
        }
        // if falsy, safe to pop()
        d.pop();
    }
    return d;
}
function getStylePlaceholder(tagName) {
    return `/**style-placeholder:${tagName}:**/`;
}
function getStyleIdPlaceholder(tagName) {
    return `/**style-id-placeholder:${tagName}:**/`;
}
function getBundleIdPlaceholder() {
    return `/**:bundle-id:**/`;
}
function replaceBundleIdPlaceholder(jsText, bundleId) {
    return jsText.replace(getBundleIdPlaceholder(), bundleId);
}

var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function localResolution(config, compilerCtx) {
    return {
        name: 'localResolution',
        resolveId(importee, importer) {
            return __awaiter$1(this, void 0, void 0, function* () {
                importee = normalizePath(importee);
                importer = normalizePath(importer);
                if (importee.indexOf('./') === -1) {
                    return null;
                }
                if (!importer) {
                    return null;
                }
                if (importee.endsWith('.js')) {
                    return null;
                }
                const basename = config.sys.path.basename(importer);
                const directory = importer.split(basename)[0];
                const dirIndexFile = config.sys.path.join(directory + importee, 'index.js');
                let stats;
                try {
                    stats = yield compilerCtx.fs.stat(dirIndexFile);
                }
                catch (e) {
                    return null;
                }
                if (stats.isFile) {
                    return dirIndexFile;
                }
                return null;
            });
        }
    };
}

var __awaiter$2 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function inMemoryFsRead(config, compilerCtx) {
    const sys = config.sys;
    const assetsCache = {};
    return {
        name: 'inMemoryFsRead',
        resolveId(importee, importer) {
            return __awaiter$2(this, void 0, void 0, function* () {
                if (!sys.path.isAbsolute(importee)) {
                    importee = normalizePath(sys.path.resolve(importer ? sys.path.dirname(importer) : sys.path.resolve(), importee));
                    if (importee.indexOf('.js') === -1) {
                        importee += '.js';
                    }
                }
                // it's possible the importee is a file pointing directly to the source ts file
                // if it is a ts file path, then we're good to go
                var moduleFile = compilerCtx.moduleFiles[importee];
                if (compilerCtx.moduleFiles[importee]) {
                    return moduleFile.jsFilePath;
                }
                const tsFileNames = Object.keys(compilerCtx.moduleFiles);
                for (var i = 0; i < tsFileNames.length; i++) {
                    // see if we can find by importeE
                    moduleFile = compilerCtx.moduleFiles[tsFileNames[i]];
                    if (moduleFile.jsFilePath === importee) {
                        // awesome, there's a module file for this js file, we're good here
                        return importee;
                    }
                    if (moduleFile.jsFilePath === importee + '.js') {
                        return `${importee}.js`;
                    }
                }
                // let's check all of the asset directories for this path
                // think slide's swiper dependency
                for (i = 0; i < tsFileNames.length; i++) {
                    // see if we can find by importeR
                    moduleFile = compilerCtx.moduleFiles[tsFileNames[i]];
                    if (moduleFile.jsFilePath === importer) {
                        // awesome, there's a module file for this js file via importeR
                        // now let's check if this module has an assets directory
                        if (moduleFile.cmpMeta && moduleFile.cmpMeta.assetsDirsMeta) {
                            for (var j = 0; j < moduleFile.cmpMeta.assetsDirsMeta.length; j++) {
                                const assetsAbsPath = moduleFile.cmpMeta.assetsDirsMeta[j].absolutePath;
                                const importeeFileName = sys.path.basename(importee);
                                const assetsFilePath = normalizePath(sys.path.join(assetsAbsPath, importeeFileName));
                                // ok, we've got a potential absolute path where the file "could" be
                                try {
                                    // let's see if it actually exists, but with readFileSync :(
                                    assetsCache[assetsFilePath] = compilerCtx.fs.readFileSync(assetsFilePath);
                                    if (typeof assetsCache[assetsFilePath] === 'string') {
                                        return assetsFilePath;
                                    }
                                }
                                catch (e) {
                                    config.logger.debug(`asset ${assetsFilePath} did not exist`);
                                }
                            }
                        }
                    }
                }
                return null;
            });
        },
        load(sourcePath) {
            return __awaiter$2(this, void 0, void 0, function* () {
                sourcePath = normalizePath(sourcePath);
                if (typeof assetsCache[sourcePath] === 'string') {
                    // awesome, this is one of the cached asset file we already read in resolveId
                    return assetsCache[sourcePath];
                }
                return compilerCtx.fs.readFile(sourcePath);
            });
        }
    };
}

function buildExpressionReplacer(config, input) {
    return input
        .replace(/process.env.NODE_ENV(\s*)(===|==)(\s*)['"`]production['"`]/g, (!config.devMode).toString())
        .replace(/process.env.NODE_ENV(\s*)(!==|!=)(\s*)['"`]development['"`]/g, (!config.devMode).toString())
        .replace(/process.env.NODE_ENV(\s*)(===|==)(\s*)['"`]development['"`]/g, (config.devMode).toString())
        .replace(/process.env.NODE_ENV(\s*)(!==|!=)(\s*)['"`]production['"`]/g, (config.devMode).toString());
}

function nodeEnvVars(config) {
    // replace build time expressions, like process.env.NODE_ENV === 'production'
    return {
        name: 'nodeEnvVarsPlugin',
        transform(sourceText) {
            return Promise.resolve({
                code: buildExpressionReplacer(config, sourceText)
            });
        }
    };
}

var __awaiter$3 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getUserTsConfig(config, compilerCtx) {
    return __awaiter$3(this, void 0, void 0, function* () {
        let compilerOptions = Object.assign({}, DEFAULT_COMPILER_OPTIONS);
        try {
            const normalizedConfigPath = normalizePath(config.tsconfig);
            const sourceText = yield compilerCtx.fs.readFile(normalizedConfigPath);
            try {
                const sourceJson = JSON.parse(sourceText);
                const parsedCompilerOptions = ts.convertCompilerOptionsFromJson(sourceJson.compilerOptions, '.').options;
                compilerOptions = Object.assign({}, compilerOptions, parsedCompilerOptions);
            }
            catch (e) {
                config.logger.warn('tsconfig.json is malformed, using default settings');
            }
        }
        catch (e) {
            config.logger.warn('tsconfig.json is missing, using default settings');
        }
        if (config._isTesting) {
            compilerOptions.module = ts.ModuleKind.CommonJS;
        }
        // apply user config to tsconfig
        compilerOptions.outDir = config.collectionDir;
        compilerOptions.rootDir = config.srcDir;
        // generate .d.ts files when generating a distribution and in prod mode
        compilerOptions.declaration = config.generateDistribution;
        if (config.generateDistribution) {
            compilerOptions.declarationDir = config.typesDir;
        }
        validateCompilerOptions(compilerOptions);
        return compilerOptions;
    });
}
function validateCompilerOptions(compilerOptions) {
    if (compilerOptions.allowJs && compilerOptions.declaration) {
        compilerOptions.allowJs = false;
    }
    // triple stamp a double stamp we've got the required settings
    compilerOptions.jsx = DEFAULT_COMPILER_OPTIONS.jsx;
    compilerOptions.jsxFactory = DEFAULT_COMPILER_OPTIONS.jsxFactory;
    compilerOptions.experimentalDecorators = DEFAULT_COMPILER_OPTIONS.experimentalDecorators;
    compilerOptions.noEmitOnError = DEFAULT_COMPILER_OPTIONS.noEmit;
    compilerOptions.suppressOutputPathCheck = DEFAULT_COMPILER_OPTIONS.suppressOutputPathCheck;
    compilerOptions.module = DEFAULT_COMPILER_OPTIONS.module;
    compilerOptions.moduleResolution = DEFAULT_COMPILER_OPTIONS.moduleResolution;
    if (compilerOptions.target === ts.ScriptTarget.ES3 || compilerOptions.target === ts.ScriptTarget.ES5) {
        compilerOptions.target = DEFAULT_COMPILER_OPTIONS.target;
    }
}
const DEFAULT_COMPILER_OPTIONS = {
    // to allow jsx to work
    jsx: ts.JsxEmit.React,
    // the factory function to use
    jsxFactory: 'h',
    // transpileModule does not write anything to disk so there is no need
    // to verify that there are no conflicts between input and output paths.
    suppressOutputPathCheck: true,
    // // Clear out other settings that would not be used in transpiling this module
    lib: [
        'lib.dom.d.ts',
        'lib.es5.d.ts',
        'lib.es2015.d.ts',
        'lib.es2016.d.ts',
        'lib.es2017.d.ts'
    ],
    // We are not doing a full typecheck, we are not resolving the whole context,
    // so pass --noResolve to avoid reporting missing file errors.
    // noResolve: true,
    allowSyntheticDefaultImports: true,
    // must always allow decorators
    experimentalDecorators: true,
    // transpile down to es2015
    target: ts.ScriptTarget.ES2015,
    // create es2015 modules
    module: ts.ModuleKind.ES2015,
    // resolve using NodeJs style
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    // ensure that we do emit something
    noEmitOnError: false
};

var __awaiter$4 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function pathsResolver(config, compilerCtx, testTsconfig) {
    return __awaiter$4(this, void 0, void 0, function* () {
        const tsconfig = testTsconfig || (yield getUserTsConfig(config, compilerCtx));
        const extensions = [
            'ts',
            'tsx'
        ];
        return {
            name: 'pathsResolverPlugin',
            resolveId(importee, importer) {
                importee = normalizePath(importee);
                importer = normalizePath(importer);
                if (!importer) {
                    return null;
                }
                const paths = tsconfig.paths || {};
                // Parse each rule from tsconfig
                for (const rule in paths) {
                    const normalizedRule = normalizePath(rule);
                    // The rule without the wildcard
                    const standaloneRule = normalizedRule.replace(/\*$/, '');
                    if (importee.indexOf(standaloneRule) === 0) {
                        // Get the wildcard part from importee
                        const wildcard = importee.slice(standaloneRule.length);
                        // Parse each sub-rule of a rule
                        for (const subrule of paths[rule]) {
                            const normalizedSubrule = normalizePath(subrule);
                            // Build the subrule replacing the wildcard with actual path
                            const enrichedSubrule = normalizePath(normalizedSubrule.replace(/\*$/, wildcard));
                            const finalPath = normalizePath(config.sys.path.join(config.rootDir, enrichedSubrule));
                            const moduleFiles = compilerCtx.moduleFiles;
                            for (let i = 0; i < extensions.length; i++) {
                                const moduleFile = moduleFiles[`${finalPath}.${extensions[i]}`];
                                if (moduleFile) {
                                    return moduleFile.jsFilePath;
                                }
                            }
                        }
                    }
                }
                return null;
            },
        };
    });
}

var __awaiter$5 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function resolveCollections(compilerCtx) {
    // and by "resolve collections", we mean
    // completely ignore the entry module for collections
    // basically it's the collection's loader.js file which
    // is useful for npm and cdns, but not useful in this
    // case. Specifically for a stencil build, we can safely
    // ignore the entry module (loader) for a stencil collection
    // because this build comes with its very own freshly built loader
    return {
        name: 'resolveCollections',
        resolveId(importee) {
            const isStencilCollection = compilerCtx.collections.some(c => c.collectionName === importee);
            if (isStencilCollection) {
                return COLLECTION_ID;
            }
            return null;
        },
        load(id) {
            if (id === COLLECTION_ID) {
                // already determined this is a stencil collection
                // we don't want its content, let's clear it out
                return '';
            }
            return null;
        },
        transform(_sourceText, id) {
            return __awaiter$5(this, void 0, void 0, function* () {
                if (id === COLLECTION_ID) {
                    // just to save other plugins from
                    // wasting their time here
                    return '';
                }
                return null;
            });
        }
    };
}
const COLLECTION_ID = '#collection#';

var __awaiter$6 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function createBundle(config, compilerCtx, buildCtx, entryModules) {
    return __awaiter$6(this, void 0, void 0, function* () {
        const builtins = require('rollup-plugin-node-builtins');
        const globals = require('rollup-plugin-node-globals');
        let rollupBundle;
        const rollupConfig = {
            input: entryModules.map(b => b.entryKey),
            experimentalCodeSplitting: true,
            preserveSymlinks: false,
            plugins: [
                resolveCollections(compilerCtx),
                config.sys.rollup.plugins.nodeResolve({
                    jsnext: true,
                    main: true
                }),
                config.sys.rollup.plugins.commonjs({
                    include: 'node_modules/**',
                    sourceMap: false
                }),
                bundleJson(config),
                globals(),
                builtins(),
                bundleEntryFile(config, entryModules),
                inMemoryFsRead(config, compilerCtx),
                yield pathsResolver(config, compilerCtx),
                localResolution(config, compilerCtx),
                nodeEnvVars(config),
                ...config.plugins
            ],
            onwarn: createOnWarnFn(config, buildCtx.diagnostics)
        };
        try {
            rollupBundle = yield rollup.rollup(rollupConfig);
        }
        catch (err) {
            console.log(err);
            loadRollupDiagnostics(config, compilerCtx, buildCtx, err);
        }
        if (hasError(buildCtx.diagnostics) || !rollupBundle) {
            throw new Error('rollup died');
        }
        return rollupBundle;
    });
}
function writeEsModules(config, rollupBundle) {
    return __awaiter$6(this, void 0, void 0, function* () {
        const results = yield rollupBundle.generate({
            format: 'es',
            banner: generatePreamble(config),
            intro: `const { h } = window.${config.namespace};`,
        });
        return results;
    });
}
function writeLegacyModules(config, rollupBundle, entryModules) {
    return __awaiter$6(this, void 0, void 0, function* () {
        const { chunks } = rollupBundle;
        Object.keys(chunks).map(key => {
            return [key, chunks[key]];
        }).forEach(([key, value]) => {
            const entryModule = entryModules.find(b => b.entryKey === `./${key}.js`);
            if (entryModule) {
                entryModule.dependencies = value.imports.slice();
            }
        });
        const results = yield rollupBundle.generate({
            format: 'amd',
            amd: {
                id: getBundleIdPlaceholder(),
                define: `${config.namespace}.loadBundle`
            },
            banner: generatePreamble(config),
            intro: `const h = window.${config.namespace}.h;`,
            strict: false,
        });
        return results;
    });
}

var __awaiter$7 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateBundleModules(config, compilerCtx, buildCtx, entryModules) {
    return __awaiter$7(this, void 0, void 0, function* () {
        const results = {};
        try {
            // run rollup, but don't generate yet
            // returned rollup bundle can be reused for es module and legacy
            const rollupBundle = yield createBundle(config, compilerCtx, buildCtx, entryModules);
            // bundle using only es modules and dynamic imports
            results.esm = yield writeEsModules(config, rollupBundle);
            buildCtx.bundleBuildCount = Object.keys(results.esm).length;
            if (config.buildEs5) {
                // only create legacy modules when generating es5 fallbacks
                // bundle using commonjs using jsonp callback
                results.es5 = yield writeLegacyModules(config, rollupBundle, entryModules);
            }
            if (config.minifyJs) {
                yield minifyChunks(config, compilerCtx, buildCtx, results);
            }
        }
        catch (err) {
            catchError(buildCtx.diagnostics, err);
        }
        return results;
    });
}
function minifyChunks(config, compilerCtx, buildCtx, results) {
    return __awaiter$7(this, void 0, void 0, function* () {
        const promises = Object.keys(results).map((moduleType) => {
            const jsModuleList = results[moduleType];
            const promises = Object.keys(jsModuleList)
                .filter(m => m.startsWith('./chunk'))
                .map(chunkKey => jsModuleList[chunkKey])
                .map((chunk) => __awaiter$7(this, void 0, void 0, function* () {
                const sourceTarget = moduleType === 'es5' ? 'es5' : 'es2015';
                const minifyJsResults = yield minifyJs(config, compilerCtx, chunk.code, sourceTarget, true);
                if (minifyJsResults.diagnostics.length) {
                    minifyJsResults.diagnostics.forEach(d => {
                        buildCtx.diagnostics.push(d);
                    });
                }
                else {
                    chunk.code = minifyJsResults.output;
                }
            }));
            return Promise.all(promises);
        });
        return Promise.all(promises);
    });
}

var __awaiter$8 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function bundle(config, compilerCtx, buildCtx, entryModules) {
    return __awaiter$8(this, void 0, void 0, function* () {
        if (config.generateWWW) {
            config.logger.debug(`bundle, buildDir: ${config.buildDir}`);
        }
        if (config.generateDistribution) {
            config.logger.debug(`bundle, distDir: ${config.distDir}`);
        }
        const timeSpan = config.logger.createTimeSpan(`bundle started`, true);
        let jsModules;
        try {
            // kick off style and module bundling at the same time
            jsModules = yield generateBundleModules(config, compilerCtx, buildCtx, entryModules);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
        timeSpan.finish(`bundling finished`);
        return jsModules;
    });
}

var __awaiter$9 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function copyTasks(config, compilerCtx, diagnostics, commit) {
    return __awaiter$9(this, void 0, void 0, function* () {
        if (!config.copy) {
            config.logger.debug(`copy tasks disabled`);
            return;
        }
        if (!config.generateWWW && !config.generateDistribution) {
            return;
        }
        const timeSpan = config.logger.createTimeSpan(`copy task started`, true);
        try {
            const allCopyTasks = [];
            const copyTasks = Object.keys(config.copy).map(copyTaskName => config.copy[copyTaskName]);
            yield Promise.all(copyTasks.map((copyTask) => __awaiter$9(this, void 0, void 0, function* () {
                yield processCopyTasks(config, compilerCtx, allCopyTasks, copyTask);
            })));
            yield Promise.all(allCopyTasks.map((copyTask) => __awaiter$9(this, void 0, void 0, function* () {
                yield compilerCtx.fs.copy(copyTask.src, copyTask.dest, { filter: copyTask.filter });
            })));
            if (commit && allCopyTasks.length > 0) {
                config.logger.debug(`copy task commit, tasks: ${allCopyTasks.length}`);
                yield compilerCtx.fs.commit();
            }
        }
        catch (e) {
            catchError(diagnostics, e);
        }
        timeSpan.finish(`copy task finished`);
    });
}
function processCopyTasks(config, compilerCtx, allCopyTasks, copyTask) {
    return __awaiter$9(this, void 0, void 0, function* () {
        if (!copyTask) {
            // possible null was set, which is fine, just skip over this one
            return;
        }
        if (!copyTask.src) {
            throw new Error(`copy missing "src" property`);
        }
        if (copyTask.dest && config.sys.isGlob(copyTask.dest)) {
            throw new Error(`copy "dest" property cannot be a glob: ${copyTask.dest}`);
        }
        if (config.sys.isGlob(copyTask.src)) {
            const copyTasks = yield processGlob(config, copyTask);
            allCopyTasks.push(...copyTasks);
            return;
        }
        if (config.generateWWW) {
            yield processCopyTaskDestDir(config, compilerCtx, allCopyTasks, copyTask, config.wwwDir);
        }
        if (config.generateDistribution) {
            yield processCopyTaskDestDir(config, compilerCtx, allCopyTasks, copyTask, config.collectionDir);
        }
    });
}
function processCopyTaskDestDir(config, compilerCtx, allCopyTasks, copyTask, destAbsDir) {
    return __awaiter$9(this, void 0, void 0, function* () {
        const processedCopyTask = processCopyTask(config, copyTask, destAbsDir);
        try {
            const stats = yield compilerCtx.fs.stat(processedCopyTask.src);
            processedCopyTask.isDirectory = stats.isDirectory;
            config.logger.debug(`copy, ${processedCopyTask.src} to ${processedCopyTask.dest}, isDirectory: ${processedCopyTask.isDirectory}`);
            allCopyTasks.push(processedCopyTask);
        }
        catch (e) {
            if (copyTask.warn !== false) {
                config.logger.warn(`copy, ${processedCopyTask.src}: ${e}`);
            }
        }
    });
}
function processGlob(config, copyTask) {
    return __awaiter$9(this, void 0, void 0, function* () {
        const globCopyTasks = [];
        const globOpts = {
            cwd: config.srcDir,
            nodir: true
        };
        const files = yield config.sys.glob(copyTask.src, globOpts);
        files.forEach(globRelPath => {
            if (config.generateWWW) {
                globCopyTasks.push(createGlobCopyTask(config, copyTask, config.wwwDir, globRelPath));
            }
            if (config.generateDistribution) {
                globCopyTasks.push(createGlobCopyTask(config, copyTask, config.collectionDir, globRelPath));
            }
        });
        return globCopyTasks;
    });
}
function createGlobCopyTask(config, copyTask, destDir, globRelPath) {
    const processedCopyTask = {
        src: config.sys.path.join(config.srcDir, globRelPath),
        filter: copyTask.filter
    };
    if (copyTask.dest) {
        if (config.sys.path.isAbsolute(copyTask.dest)) {
            processedCopyTask.dest = config.sys.path.join(copyTask.dest, config.sys.path.basename(globRelPath));
        }
        else {
            processedCopyTask.dest = config.sys.path.join(destDir, copyTask.dest, config.sys.path.basename(globRelPath));
        }
    }
    else {
        processedCopyTask.dest = config.sys.path.join(destDir, globRelPath);
    }
    return processedCopyTask;
}
function processCopyTask(config, copyTask, destAbsPath) {
    const processedCopyTask = {
        src: getSrcAbsPath(config, copyTask.src),
        dest: getDestAbsPath(config, copyTask.src, destAbsPath, copyTask.dest),
        filter: copyTask.filter
    };
    return processedCopyTask;
}
function getSrcAbsPath(config, src) {
    if (config.sys.path.isAbsolute(src)) {
        return src;
    }
    return config.sys.path.join(config.srcDir, src);
}
function getDestAbsPath(config, src, destAbsPath, destRelPath) {
    if (destRelPath) {
        if (config.sys.path.isAbsolute(destRelPath)) {
            return destRelPath;
        }
        else {
            return config.sys.path.join(destAbsPath, destRelPath);
        }
    }
    if (config.sys.path.isAbsolute(src)) {
        throw new Error(`copy task, "to" property must exist if "from" property is an absolute path: ${src}`);
    }
    return config.sys.path.join(destAbsPath, src);
}
function isCopyTaskFile(config, filePath) {
    if (!config.copy) {
        // there is no copy config
        return false;
    }
    const copyTaskNames = Object.keys(config.copy);
    if (!copyTaskNames.length) {
        // there are no copy tasks
        return false;
    }
    filePath = normalizePath(filePath);
    // go through all the copy tasks and see if this path matches
    for (var i = 0; i < copyTaskNames.length; i++) {
        var copySrc = config.copy[copyTaskNames[i]].src;
        if (config.sys.isGlob(copySrc)) {
            // test the glob
            copySrc = config.sys.path.join(config.srcDir, copySrc);
            if (config.sys.minimatch(filePath, copySrc)) {
                return true;
            }
        }
        else {
            copySrc = normalizePath(getSrcAbsPath(config, copySrc));
            if (!config.sys.path.relative(copySrc, filePath).startsWith('.')) {
                return true;
            }
        }
    }
    return false;
}

function getAppWWWBuildDir(config) {
    return pathJoin(config, config.buildDir, config.fsNamespace);
}
function getAppDistDir(config) {
    return pathJoin(config, config.distDir, config.fsNamespace);
}
function getRegistryFileName(config) {
    return `${config.fsNamespace}.registry.json`;
}
function getRegistryJsonWWW(config) {
    return pathJoin(config, getAppWWWBuildDir(config), getRegistryFileName(config));
}
function getLoaderFileName(config) {
    return `${config.fsNamespace}.js`;
}
function getLoaderWWW(config) {
    return pathJoin(config, config.buildDir, getLoaderFileName(config));
}
function getLoaderDist(config) {
    return pathJoin(config, config.distDir, getLoaderFileName(config));
}
function getGlobalFileName(config) {
    return `${config.fsNamespace}.global.js`;
}
function getGlobalWWW(config) {
    return pathJoin(config, getAppWWWBuildDir(config), getGlobalFileName(config));
}
function getGlobalDist(config) {
    return pathJoin(config, getAppDistDir(config), getGlobalFileName(config));
}
function getCoreFilename(config, coreId, jsContent) {
    if (config.hashFileNames) {
        // prod mode renames the core file with its hashed content
        const contentHash = config.sys.generateContentHash(jsContent, config.hashedFileNameLength);
        return `${config.fsNamespace}.${contentHash}.js`;
    }
    // dev file name
    return `${config.fsNamespace}.${coreId}.js`;
}
function getGlobalStyleFilename(config) {
    return `${config.fsNamespace}.css`;
}
function getBundleFilename(bundleId, isScopedStyles, sourceTarget) {
    return `${bundleId}${isScopedStyles ? '.sc' : ''}${sourceTarget === 'es5' ? '.es5' : ''}.js`;
}
function getAppPublicPath(config) {
    if (config.discoverPublicPath !== false) {
        return pathJoin(config, config.publicPath, config.fsNamespace) + '/';
    }
    return config.publicPath;
}

var __awaiter$10 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function copyComponentAssets(config, compilerCtx, buildCtx) {
    return __awaiter$10(this, void 0, void 0, function* () {
        if (canSkipAssetsCopy(config, compilerCtx, buildCtx)) {
            // no need to recopy all assets again
            return;
        }
        config.logger.debug(`copy assets`);
        try {
            // get a list of all the directories to copy
            // these paths should be absolute
            const copyToBuildDir = [];
            const copyToCollectionDir = [];
            const copyTasks = [];
            buildCtx.entryModules.forEach(entryModule => {
                const moduleFiles = entryModule.moduleFiles.filter(m => {
                    return m.cmpMeta.assetsDirsMeta && m.cmpMeta.assetsDirsMeta.length;
                });
                moduleFiles.forEach(moduleFile => {
                    moduleFile.cmpMeta.assetsDirsMeta.forEach(assetsMeta => {
                        copyToBuildDir.push(assetsMeta);
                        if (!moduleFile.excludeFromCollection && !moduleFile.isCollectionDependency) {
                            copyToCollectionDir.push(assetsMeta);
                        }
                    });
                });
            });
            // copy all of the files in asset directories to the app's build and/or dist directory
            copyToBuildDir.forEach(assetsMeta => {
                // figure out what the path is to the component directory
                if (config.generateWWW) {
                    const wwwBuildDirDestination = pathJoin(config, getAppWWWBuildDir(config), assetsMeta.cmpRelativePath);
                    copyTasks.push({
                        src: assetsMeta.absolutePath,
                        dest: wwwBuildDirDestination
                    });
                }
                if (config.generateDistribution) {
                    const distDirDestination = pathJoin(config, getAppDistDir(config), assetsMeta.cmpRelativePath);
                    copyTasks.push({
                        src: assetsMeta.absolutePath,
                        dest: distDirDestination
                    });
                }
            });
            // copy all of the files in asset directories to the dist/collection directory
            // but only do this copy when the generateCollection flag is set to true
            if (config.generateDistribution) {
                // copy all of the files in asset directories to the app's collection directory
                copyToCollectionDir.forEach(assetsMeta => {
                    // figure out what the path is to the component directory
                    const collectionDirDestination = pathJoin(config, config.collectionDir, config.sys.path.relative(config.srcDir, assetsMeta.absolutePath));
                    copyTasks.push({
                        src: assetsMeta.absolutePath,
                        dest: collectionDirDestination
                    });
                });
            }
            // queue up all the asset copy tasks
            yield Promise.all(copyTasks.map((copyTask) => __awaiter$10(this, void 0, void 0, function* () {
                yield compilerCtx.fs.copy(copyTask.src, copyTask.dest);
            })));
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
    });
}
function canSkipAssetsCopy(config, compilerCtx, buildCtx) {
    if (!compilerCtx.hasSuccessfulBuild) {
        // always copy assets if we haven't had a successful build yet
        // cannot skip build
        return false;
    }
    // assume we want to skip copying assets again
    let shouldSkipAssetsCopy = true;
    // loop through each of the changed files
    buildCtx.filesChanged.forEach(changedFile => {
        // get the directory of where the changed file is in
        const changedFileDirPath = normalizePath(config.sys.path.dirname(changedFile));
        // loop through all the possible asset directories
        buildCtx.entryModules.forEach(entryModule => {
            entryModule.moduleFiles.forEach(moduleFile => {
                if (moduleFile.cmpMeta && moduleFile.cmpMeta.assetsDirsMeta) {
                    // loop through each of the asset directories of each component
                    moduleFile.cmpMeta.assetsDirsMeta.forEach(assetsDir => {
                        // get the absolute of the asset directory
                        const assetDirPath = normalizePath(assetsDir.absolutePath);
                        // if the changed file directory is this asset directory
                        // then we should recopy everything over again
                        if (changedFileDirPath === assetDirPath) {
                            shouldSkipAssetsCopy = false;
                            return;
                        }
                    });
                }
            });
        });
    });
    return shouldSkipAssetsCopy;
}

var __awaiter$11 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function copyComponentStyles(config, compilerCtx, buildCtx) {
    return __awaiter$11(this, void 0, void 0, function* () {
        config.logger.debug(`copy styles`);
        try {
            const absSrcStylePaths = [];
            buildCtx.entryModules.forEach(entryModule => {
                const cmps = entryModule.moduleFiles.filter(m => m.cmpMeta.stylesMeta);
                cmps.forEach(c => {
                    if (c.isCollectionDependency) {
                        return;
                    }
                    Object.keys(c.cmpMeta.stylesMeta).forEach(modeName => {
                        const styleMeta = c.cmpMeta.stylesMeta[modeName];
                        if (styleMeta.externalStyles) {
                            styleMeta.externalStyles.forEach(externalStyle => {
                                absSrcStylePaths.push(externalStyle.absolutePath);
                            });
                        }
                    });
                });
            });
            yield Promise.all(absSrcStylePaths.map((absSrcStylePath) => __awaiter$11(this, void 0, void 0, function* () {
                const relPath = config.sys.path.relative(config.srcDir, absSrcStylePath);
                const dest = config.sys.path.join(config.collectionDir, relPath);
                yield compilerCtx.fs.copy(absSrcStylePath, dest);
            })));
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
    });
}

var __awaiter$12 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateTypes(config, compilerCtx, buildCtx, pkgData) {
    return __awaiter$12(this, void 0, void 0, function* () {
        const srcDirItems = yield compilerCtx.fs.readdir(config.srcDir, { recursive: false });
        const srcDtsFiles = srcDirItems.filter(srcItem => srcItem.isFile && isDtsFile(srcItem.absPath));
        const distTypesDir = config.sys.path.dirname(pkgData.types);
        yield Promise.all(srcDtsFiles.map((srcDtsFile) => __awaiter$12(this, void 0, void 0, function* () {
            const relPath = config.sys.path.relative(config.srcDir, srcDtsFile.absPath);
            const distPath = pathJoin(config, config.rootDir, distTypesDir, relPath);
            const dtsContent = yield compilerCtx.fs.readFile(srcDtsFile.absPath);
            yield compilerCtx.fs.writeFile(distPath, dtsContent);
        })));
        const dtsEntryFilePath = config.sys.path.join(config.rootDir, pkgData.types);
        const dtsFileExists = yield compilerCtx.fs.access(dtsEntryFilePath);
        if (!dtsFileExists) {
            const err = buildError(buildCtx.diagnostics);
            err.header = `package.json error`;
            err.messageText = `package.json "types" file does not exist: ${dtsEntryFilePath}`;
        }
        yield updateTypes(config, compilerCtx);
    });
}
function updateTypes(config, compilerCtx) {
    return __awaiter$12(this, void 0, void 0, function* () {
        const typeDirItems = yield compilerCtx.fs.readdir(config.typesDir, { inMemoryOnly: true, recursive: true });
        const dtsFiles = typeDirItems.filter(dtsItem => dtsItem.isFile && isDtsFile(dtsItem.absPath));
        const updates = yield Promise.all(dtsFiles.map(dtsFile => {
            return updateDtsContent(config, compilerCtx, dtsFile.absPath);
        }));
        if (updates.some(u => u)) {
            yield copyCoreDts(config, compilerCtx);
        }
    });
}
function updateDtsContent(config, compilerCtx, dtsFilePath) {
    return __awaiter$12(this, void 0, void 0, function* () {
        let content = yield compilerCtx.fs.readFile(dtsFilePath);
        let madeChanges = false;
        const relPath = config.sys.path.relative(config.sys.path.dirname(dtsFilePath), config.typesDir);
        let coreDtsPath = pathJoin(config, relPath, CORE_FILENAME);
        if (!coreDtsPath.startsWith('.')) {
            coreDtsPath = `./${coreDtsPath}`;
        }
        if (content.includes('JSX')) {
            content = `import '${coreDtsPath}';\n${content}`;
            madeChanges = true;
        }
        if (content.includes('@stencil/core')) {
            content = content.replace(/\@stencil\/core/g, coreDtsPath);
            madeChanges = true;
        }
        if (madeChanges) {
            yield compilerCtx.fs.writeFile(dtsFilePath, content);
        }
        return madeChanges;
    });
}
function copyCoreDts(config, compilerCtx) {
    return __awaiter$12(this, void 0, void 0, function* () {
        const srcDts = yield config.sys.getClientCoreFile({
            staticName: 'declarations/stencil.core.d.ts'
        });
        const coreDtsFilePath = config.sys.path.join(config.typesDir, CORE_DTS);
        yield compilerCtx.fs.writeFile(coreDtsFilePath, srcDts);
    });
}
const CORE_FILENAME = `stencil.core`;
const CORE_DTS = `${CORE_FILENAME}.d.ts`;

var __awaiter$13 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateDistribution(config, compilerCtx, buildCtx) {
    return __awaiter$13(this, void 0, void 0, function* () {
        if (!config.generateDistribution) {
            // don't bother
            return;
        }
        const pkgData = yield readPackageJson(config, compilerCtx);
        validatePackageJson(config, buildCtx.diagnostics, pkgData);
        if (hasError(buildCtx.diagnostics)) {
            return;
        }
        yield Promise.all([
            copyComponentStyles(config, compilerCtx, buildCtx),
            generateTypes(config, compilerCtx, buildCtx, pkgData)
        ]);
    });
}
function readPackageJson(config, compilerCtx) {
    return __awaiter$13(this, void 0, void 0, function* () {
        const pkgJsonPath = config.sys.path.join(config.rootDir, 'package.json');
        let pkgJson;
        try {
            pkgJson = yield compilerCtx.fs.readFile(pkgJsonPath);
        }
        catch (e) {
            throw new Error(`Missing "package.json" file for distribution: ${pkgJsonPath}`);
        }
        let pkgData;
        try {
            pkgData = JSON.parse(pkgJson);
        }
        catch (e) {
            throw new Error(`Error parsing package.json: ${pkgJsonPath}, ${e}`);
        }
        return pkgData;
    });
}
function validatePackageJson(config, diagnostics, pkgData) {
    validatePackageFiles(config, diagnostics, pkgData);
    const mainFileName = getLoaderFileName(config);
    const main = pathJoin(config, config.sys.path.relative(config.rootDir, config.distDir), mainFileName);
    if (!pkgData.main || normalizePath(pkgData.main) !== main) {
        const err = buildError(diagnostics);
        err.header = `package.json error`;
        err.messageText = `package.json "main" property is required when generating a distribution and must be set to: ${main}`;
    }
    if (typeof pkgData.types !== 'string' || pkgData.types === '') {
        const componentsDtsFileAbsPath = config.sys.path.join(config.typesDir, COMPONENTS_DTS);
        const componentsDtsFileRelPath = pathJoin(config, config.sys.path.relative(config.rootDir, componentsDtsFileAbsPath));
        const err = buildError(diagnostics);
        err.header = `package.json error`;
        err.messageText = `package.json "types" property is required when generating a distribution. Recommended entry d.ts file is: ${componentsDtsFileRelPath}`;
    }
    else if (!pkgData.types.endsWith('.d.ts')) {
        const err = buildError(diagnostics);
        err.header = `package.json error`;
        err.messageText = `package.json "types" file must have a ".d.ts" extension: ${pkgData.types}`;
    }
    const collection = pathJoin(config, config.sys.path.relative(config.rootDir, config.collectionDir), COLLECTION_MANIFEST_FILE_NAME);
    if (!pkgData.collection || normalizePath(pkgData.collection) !== collection) {
        const err = buildError(diagnostics);
        err.header = `package.json error`;
        err.messageText = `package.json "collection" property is required when generating a distribution and must be set to: ${collection}`;
    }
    if (typeof config.namespace !== 'string' || config.fsNamespace === 'app') {
        const err = buildWarn(diagnostics);
        err.header = `config warning`;
        err.messageText = `When generating a distribution it is recommended to choose a unique namespace, which can be updated using the "namespace" config property within the stencil.config.js file.`;
    }
}
function validatePackageFiles(config, diagnostics, pkgData) {
    if (pkgData.files) {
        const actualDistDir = normalizePath(config.sys.path.relative(config.rootDir, config.distDir));
        const validPaths = [
            `${actualDistDir}`,
            `${actualDistDir}/`,
            `./${actualDistDir}`,
            `./${actualDistDir}/`
        ];
        const containsDistDir = pkgData.files
            .some(userPath => validPaths.some(validPath => normalizePath(userPath) === validPath));
        if (!containsDistDir) {
            const err = buildError(diagnostics);
            err.header = `package.json error`;
            err.messageText = `package.json "files" array must contain the distribution directory "${actualDistDir}/" when generating a distribution.`;
        }
    }
}
function getComponentsDtsSrcFilePath(config) {
    return pathJoin(config, config.srcDir, COMPONENTS_DTS);
}
const COMPONENTS_DTS = 'components.d.ts';

var __awaiter$14 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateServiceWorker(config, compilerCtx, buildCtx) {
    return __awaiter$14(this, void 0, void 0, function* () {
        const shouldSkipSW = yield canSkipGenerateSW(config, compilerCtx, buildCtx);
        if (shouldSkipSW) {
            return;
        }
        if (hasSrcConfig(config)) {
            copyLib(config, buildCtx);
            yield injectManifest(config, buildCtx);
        }
        else {
            yield generateSW(config, buildCtx);
        }
    });
}
function copyLib(config, buildCtx) {
    return __awaiter$14(this, void 0, void 0, function* () {
        const timeSpan = config.logger.createTimeSpan(`copy service worker library started`, true);
        try {
            yield config.sys.workbox.copyWorkboxLibraries(config.wwwDir);
        }
        catch (e) {
            // workaround for workbox issue in the latest alpha
            const d = buildWarn(buildCtx.diagnostics);
            d.messageText = 'Service worker library already exists';
        }
        timeSpan.finish(`copy service worker library finished`);
    });
}
function generateSW(config, buildCtx) {
    return __awaiter$14(this, void 0, void 0, function* () {
        const timeSpan = config.logger.createTimeSpan(`generate service worker started`);
        try {
            yield config.sys.workbox.generateSW(config.serviceWorker);
            timeSpan.finish(`generate service worker finished`);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
    });
}
function injectManifest(config, buildCtx) {
    return __awaiter$14(this, void 0, void 0, function* () {
        const timeSpan = config.logger.createTimeSpan(`inject manifest into service worker started`);
        try {
            yield config.sys.workbox.injectManifest(config.serviceWorker);
            timeSpan.finish('inject manifest into service worker finished');
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
    });
}
function hasSrcConfig(config) {
    const serviceWorkerConfig = config.serviceWorker;
    return !!serviceWorkerConfig.swSrc;
}
function canSkipGenerateSW(config, compilerCtx, buildCtx) {
    return __awaiter$14(this, void 0, void 0, function* () {
        if (!config.generateWWW) {
            config.logger.debug(`generateServiceWorker, not generating www`);
            return true;
        }
        const hasSrcIndexHtml = yield compilerCtx.fs.access(config.srcIndexHtml);
        if (!hasSrcIndexHtml) {
            config.logger.debug(`generateServiceWorker, no index.html, so skipping sw build`);
            return true;
        }
        if (!config.serviceWorker) {
            // no sw config, let's not continue
            return true;
        }
        if ((compilerCtx.hasSuccessfulBuild && buildCtx.appFileBuildCount === 0) || hasError(buildCtx.diagnostics) || !config.generateWWW) {
            // no need to rebuild index.html if there were no app file changes
            return true;
        }
        // let's build us some service workerz
        return false;
    });
}

var __awaiter$15 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// this maps the json data to our internal data structure
// apping is so that the internal data structure "could"
// change, but the external user data will always use the same api
// over the top lame mapping functions is basically so we can loosly
// couple core component meta data between specific versions of the compiler
function writeAppCollection(config, compilerCtx, buildCtx) {
    return __awaiter$15(this, void 0, void 0, function* () {
        // get the absolute path to the directory where the collection will be saved
        const collectionDir = normalizePath(config.collectionDir);
        // create an absolute file path to the actual collection json file
        const collectionFilePath = normalizePath(config.sys.path.join(collectionDir, COLLECTION_MANIFEST_FILE_NAME));
        config.logger.debug(`collection, serialize: ${collectionFilePath}`);
        // serialize the collection into a json string and
        // add it to the list of files we need to write when we're ready
        const collectionData = serializeAppCollection(config, compilerCtx, collectionDir, buildCtx.entryModules, buildCtx.global);
        if (config.generateDistribution) {
            // don't bother serializing/writing the collection if we're not creating a distribution
            yield compilerCtx.fs.writeFile(collectionFilePath, JSON.stringify(collectionData, null, 2));
        }
        return collectionData;
    });
}
function serializeAppCollection(config, compilerCtx, collectionDir, entryModules, globalModule) {
    // create the single collection we're going to fill up with data
    const collectionData = {
        components: [],
        collections: serializeCollectionDependencies(compilerCtx),
        compiler: {
            name: config.sys.compiler.name,
            version: config.sys.compiler.version,
            typescriptVersion: config.sys.compiler.typescriptVersion
        },
        bundles: []
    };
    // add component data for each of the collection files
    entryModules.forEach(entryModule => {
        entryModule.moduleFiles.forEach(moduleFile => {
            const cmpData = serializeComponent(config, collectionDir, moduleFile);
            if (cmpData) {
                collectionData.components.push(cmpData);
            }
        });
    });
    // sort it alphabetically, cuz
    collectionData.components.sort((a, b) => {
        if (a.tag < b.tag)
            return -1;
        if (a.tag > b.tag)
            return 1;
        return 0;
    });
    // set the global path if it exists
    serializeAppGlobal(config, collectionDir, collectionData, globalModule);
    serializeBundles(config, collectionData);
    // success!
    return collectionData;
}
function serializeCollectionDependencies(compilerCtx) {
    const collectionDeps = compilerCtx.collections.map(c => {
        const collectionDeps = {
            name: c.collectionName,
            tags: c.moduleFiles.filter(m => {
                return !!m.cmpMeta;
            }).map(m => m.cmpMeta.tagNameMeta).sort()
        };
        return collectionDeps;
    });
    return collectionDeps.sort((a, b) => {
        if (a.name < b.name)
            return -1;
        if (a.name > b.name)
            return 1;
        return 0;
    });
}
function parseCollectionData(config, collectionName, collectionDir, collectionJsonStr) {
    const collectionData = JSON.parse(collectionJsonStr);
    const collection = {
        collectionName: collectionName,
        dependencies: parseCollectionDependencies(collectionData),
        compiler: {
            name: collectionData.compiler.name,
            version: collectionData.compiler.version,
            typescriptVersion: collectionData.compiler.typescriptVersion
        },
        bundles: []
    };
    parseComponents(config, collectionDir, collectionData, collection);
    parseGlobal(config, collectionDir, collectionData, collection);
    parseBundles(collectionData, collection);
    return collection;
}
function parseComponents(config, collectionDir, collectionData, collection) {
    const componentsData = collectionData.components;
    if (!componentsData || !Array.isArray(componentsData)) {
        collection.moduleFiles = [];
        return;
    }
    collection.moduleFiles = componentsData.map(cmpData => {
        return parseComponentDataToModuleFile(config, collection, collectionDir, cmpData);
    });
}
function parseCollectionDependencies(collectionData) {
    const dependencies = [];
    if (Array.isArray(collectionData.collections)) {
        collectionData.collections.forEach(c => {
            dependencies.push(c.name);
        });
    }
    return dependencies;
}
function excludeFromCollection(config, cmpData) {
    // this is a component from a collection dependency
    // however, this project may also become a collection
    // for example, "ionicons" is a dependency of "ionic"
    // and "ionic" is it's own stand-alone collection, so within
    // ionic's collection we want ionicons to just work
    // cmpData is a component from a collection dependency
    // if this component is listed in this config's bundles
    // then we'll need to ensure it also becomes apart of this collection
    const isInBundle = config.bundles && config.bundles.some(bundle => {
        return bundle.components && bundle.components.some(tag => tag === cmpData.tag);
    });
    // if it's not in the config bundle then it's safe to exclude
    // this component from going into this build's collection
    return !isInBundle;
}
function serializeComponent(config, collectionDir, moduleFile) {
    if (!moduleFile || !moduleFile.cmpMeta || moduleFile.isCollectionDependency || moduleFile.excludeFromCollection) {
        return null;
    }
    const cmpData = {};
    const cmpMeta = moduleFile.cmpMeta;
    // get the absolute path to the compiled component's output javascript file
    const compiledComponentAbsoluteFilePath = normalizePath(moduleFile.jsFilePath);
    // create a relative path from the collection file to the compiled component's output javascript file
    const compiledComponentRelativeFilePath = normalizePath(config.sys.path.relative(collectionDir, compiledComponentAbsoluteFilePath));
    // create a relative path to the directory where the compiled component's output javascript is sitting in
    const compiledComponentRelativeDirPath = normalizePath(config.sys.path.dirname(compiledComponentRelativeFilePath));
    serializeTag(cmpData, cmpMeta);
    serializeComponentDependencies(cmpData, cmpMeta);
    serializeComponentClass(cmpData, cmpMeta);
    serializeComponentPath(config, collectionDir, compiledComponentAbsoluteFilePath, cmpData);
    serializeStyles(config, compiledComponentRelativeDirPath, cmpData, cmpMeta);
    serializeAssetsDir(config, compiledComponentRelativeDirPath, cmpData, cmpMeta);
    serializeProps(cmpData, cmpMeta);
    serializeStates(cmpData, cmpMeta);
    serializeListeners(cmpData, cmpMeta);
    serializeMethods(cmpData, cmpMeta);
    serializeContextMember(cmpData, cmpMeta);
    serializeConnectMember(cmpData, cmpMeta);
    serializeHostElementMember(cmpData, cmpMeta);
    serializeEvents(cmpData, cmpMeta);
    serializeHost(cmpData, cmpMeta);
    serializeEncapsulation(cmpData, cmpMeta);
    return cmpData;
}
function parseComponentDataToModuleFile(config, collection, collectionDir, cmpData) {
    const moduleFile = {
        cmpMeta: {},
        isCollectionDependency: true,
        excludeFromCollection: excludeFromCollection(config, cmpData)
    };
    const cmpMeta = moduleFile.cmpMeta;
    parseTag(cmpData, cmpMeta);
    parseComponentDependencies(cmpData, cmpMeta);
    parseComponentClass(cmpData, cmpMeta);
    parseModuleJsFilePath(config, collectionDir, cmpData, moduleFile);
    parseStyles(config, collectionDir, cmpData, cmpMeta);
    parseAssetsDir(config, collectionDir, cmpData, cmpMeta);
    parseProps(config, collection, cmpData, cmpMeta);
    parseStates(cmpData, cmpMeta);
    parseListeners(cmpData, cmpMeta);
    parseMethods(cmpData, cmpMeta);
    parseContextMember(cmpData, cmpMeta);
    parseConnectMember(cmpData, cmpMeta);
    parseHostElementMember(cmpData, cmpMeta);
    parseEvents(cmpData, cmpMeta);
    parseHost(cmpData, cmpMeta);
    parseEncapsulation(cmpData, cmpMeta);
    // DEPRECATED: 2017-12-27
    parseWillChangeDeprecated(cmpData, cmpMeta);
    parseDidChangeDeprecated(cmpData, cmpMeta);
    return moduleFile;
}
function serializeTag(cmpData, cmpMeta) {
    cmpData.tag = cmpMeta.tagNameMeta;
}
function parseTag(cmpData, cmpMeta) {
    cmpMeta.tagNameMeta = cmpData.tag;
}
function serializeComponentPath(config, collectionDir, compiledComponentAbsoluteFilePath, cmpData) {
    // convert absolute path into a path that's relative to the collection file
    cmpData.componentPath = normalizePath(config.sys.path.relative(collectionDir, compiledComponentAbsoluteFilePath));
}
function parseModuleJsFilePath(config, collectionDir, cmpData, moduleFile) {
    // convert the path that's relative to the collection file
    // into an absolute path to the component's js file path
    if (typeof cmpData.componentPath !== 'string') {
        throw new Error(`parseModuleJsFilePath, "componentPath" missing on cmpData: ${cmpData.tag}`);
    }
    moduleFile.jsFilePath = normalizePath(config.sys.path.join(collectionDir, cmpData.componentPath));
    // remember the original component path from its collection
    moduleFile.originalCollectionComponentPath = cmpData.componentPath;
}
function serializeComponentDependencies(cmpData, cmpMeta) {
    cmpData.dependencies = (cmpMeta.dependencies || []).sort();
}
function parseComponentDependencies(cmpData, cmpMeta) {
    if (invalidArrayData(cmpData.dependencies)) {
        cmpMeta.dependencies = [];
    }
    else {
        cmpMeta.dependencies = cmpData.dependencies.sort();
    }
}
function serializeComponentClass(cmpData, cmpMeta) {
    cmpData.componentClass = cmpMeta.componentClass;
}
function parseComponentClass(cmpData, cmpMeta) {
    cmpMeta.componentClass = cmpData.componentClass;
}
function serializeStyles(config, compiledComponentRelativeDirPath, cmpData, cmpMeta) {
    if (cmpMeta.stylesMeta) {
        cmpData.styles = {};
        const modeNames = Object.keys(cmpMeta.stylesMeta).map(m => m.toLowerCase()).sort();
        modeNames.forEach(modeName => {
            cmpData.styles[modeName] = serializeStyle(config, compiledComponentRelativeDirPath, cmpMeta.stylesMeta[modeName]);
        });
    }
}
function parseStyles(config, collectionDir, cmpData, cmpMeta) {
    const stylesData = cmpData.styles;
    cmpMeta.stylesMeta = {};
    if (stylesData) {
        Object.keys(stylesData).forEach(modeName => {
            modeName = modeName.toLowerCase();
            cmpMeta.stylesMeta[modeName] = parseStyle(config, collectionDir, cmpData, stylesData[modeName]);
        });
    }
}
function serializeStyle(config, compiledComponentRelativeDirPath, modeStyleMeta) {
    const modeStyleData = {};
    if (modeStyleMeta.externalStyles && modeStyleMeta.externalStyles.length > 0) {
        modeStyleData.stylePaths = modeStyleMeta.externalStyles.map(externalStyle => {
            // convert style paths which are relative to the component file
            // to be style paths that are relative to the collection file
            // we've already figured out the component's relative path from the collection file
            // use the value we already created in serializeComponentPath()
            // create a relative path from the collection file to the style path
            return normalizePath(config.sys.path.join(compiledComponentRelativeDirPath, externalStyle.cmpRelativePath));
        });
        modeStyleData.stylePaths.sort();
    }
    if (typeof modeStyleMeta.styleStr === 'string') {
        modeStyleData.style = modeStyleMeta.styleStr;
    }
    return modeStyleData;
}
function parseStyle(config, collectionDir, cmpData, modeStyleData) {
    const modeStyle = {
        styleStr: modeStyleData.style
    };
    if (modeStyleData.stylePaths) {
        modeStyle.externalStyles = modeStyleData.stylePaths.map(stylePath => {
            const externalStyle = {};
            externalStyle.absolutePath = normalizePath(config.sys.path.join(collectionDir, stylePath));
            externalStyle.cmpRelativePath = normalizePath(config.sys.path.relative(config.sys.path.dirname(cmpData.componentPath), stylePath));
            externalStyle.originalCollectionPath = normalizePath(stylePath);
            return externalStyle;
        });
    }
    return modeStyle;
}
function serializeAssetsDir(config, compiledComponentRelativeDirPath, cmpData, cmpMeta) {
    if (invalidArrayData(cmpMeta.assetsDirsMeta)) {
        return;
    }
    // convert asset paths which are relative to the component file
    // to be asset paths that are relative to the collection file
    // we've already figured out the component's relative path from the collection file
    // use the value we already created in serializeComponentPath()
    // create a relative path from the collection file to the asset path
    cmpData.assetPaths = cmpMeta.assetsDirsMeta.map(assetMeta => {
        return normalizePath(config.sys.path.join(compiledComponentRelativeDirPath, assetMeta.cmpRelativePath));
    }).sort();
}
function parseAssetsDir(config, collectionDir, cmpData, cmpMeta) {
    if (invalidArrayData(cmpData.assetPaths)) {
        return;
    }
    cmpMeta.assetsDirsMeta = cmpData.assetPaths.map(assetsPath => {
        const assetsMeta = {
            absolutePath: normalizePath(config.sys.path.join(collectionDir, assetsPath)),
            cmpRelativePath: normalizePath(config.sys.path.relative(config.sys.path.dirname(cmpData.componentPath), assetsPath)),
            originalCollectionPath: normalizePath(assetsPath)
        };
        return assetsMeta;
    }).sort((a, b) => {
        if (a.cmpRelativePath < b.cmpRelativePath)
            return -1;
        if (a.cmpRelativePath > b.cmpRelativePath)
            return 1;
        return 0;
    });
}
function serializeProps(cmpData, cmpMeta) {
    if (!cmpMeta.membersMeta)
        return;
    Object.keys(cmpMeta.membersMeta).sort(nameSort).forEach(memberName => {
        const memberMeta = cmpMeta.membersMeta[memberName];
        if (memberMeta.memberType === 1 /* Prop */ || memberMeta.memberType === 2 /* PropMutable */) {
            cmpData.props = cmpData.props || [];
            const propData = {
                name: memberName
            };
            if (memberMeta.propType === 3 /* Boolean */) {
                propData.type = BOOLEAN_KEY;
            }
            else if (memberMeta.propType === 4 /* Number */) {
                propData.type = NUMBER_KEY;
            }
            else if (memberMeta.propType === 2 /* String */) {
                propData.type = STRING_KEY;
            }
            else if (memberMeta.propType === 1 /* Any */) {
                propData.type = ANY_KEY;
            }
            if (memberMeta.memberType === 2 /* PropMutable */) {
                propData.mutable = true;
            }
            if (memberMeta.watchCallbacks && memberMeta.watchCallbacks.length) {
                propData.watch = memberMeta.watchCallbacks.slice();
            }
            cmpData.props.push(propData);
        }
    });
}
function parseProps(config, collection, cmpData, cmpMeta) {
    const propsData = cmpData.props;
    if (invalidArrayData(propsData)) {
        return;
    }
    cmpMeta.membersMeta = cmpMeta.membersMeta || {};
    propsData.forEach(propData => {
        cmpMeta.membersMeta[propData.name] = {};
        if (propData.mutable) {
            cmpMeta.membersMeta[propData.name].memberType = 2 /* PropMutable */;
        }
        else {
            cmpMeta.membersMeta[propData.name].memberType = 1 /* Prop */;
        }
        // the standard is the first character of the type is capitalized
        // however, lowercase and normalize for good measure
        const type = typeof propData.type === 'string' ? propData.type.toLowerCase().trim() : null;
        if (type === BOOLEAN_KEY.toLowerCase()) {
            cmpMeta.membersMeta[propData.name].propType = 3 /* Boolean */;
        }
        else if (type === NUMBER_KEY.toLowerCase()) {
            cmpMeta.membersMeta[propData.name].propType = 4 /* Number */;
        }
        else if (type === STRING_KEY.toLowerCase()) {
            cmpMeta.membersMeta[propData.name].propType = 2 /* String */;
        }
        else if (type === ANY_KEY.toLowerCase()) {
            cmpMeta.membersMeta[propData.name].propType = 1 /* Any */;
        }
        else if (!collection.compiler || !collection.compiler.version || config.sys.semver.lt(collection.compiler.version, '0.0.6-23')) {
            // older compilers didn't remember "any" type
            cmpMeta.membersMeta[propData.name].propType = 1 /* Any */;
        }
        if (cmpMeta.membersMeta[propData.name].propType) {
            cmpMeta.membersMeta[propData.name].attribName = propData.name;
        }
        if (!invalidArrayData(propData.watch)) {
            cmpMeta.membersMeta[propData.name].watchCallbacks = propData.watch.slice().sort();
        }
    });
}
function parseWillChangeDeprecated(cmpData, cmpMeta) {
    // DEPRECATED: 2017-12-27
    // previous way of storing change, 0.1.0 and below
    const propWillChangeData = cmpData.propsWillChange;
    if (invalidArrayData(propWillChangeData)) {
        return;
    }
    propWillChangeData.forEach((willChangeData) => {
        const propName = willChangeData.name;
        const methodName = willChangeData.method;
        cmpMeta.membersMeta = cmpMeta.membersMeta || {};
        cmpMeta.membersMeta[propName] = cmpMeta.membersMeta[propName] || {};
        cmpMeta.membersMeta[propName].watchCallbacks = cmpMeta.membersMeta[propName].watchCallbacks || [];
        cmpMeta.membersMeta[propName].watchCallbacks.push(methodName);
    });
}
function parseDidChangeDeprecated(cmpData, cmpMeta) {
    // DEPRECATED: 2017-12-27
    // previous way of storing change, 0.1.0 and below
    const propDidChangeData = cmpData.propsDidChange;
    if (invalidArrayData(propDidChangeData)) {
        return;
    }
    propDidChangeData.forEach((didChangeData) => {
        const propName = didChangeData.name;
        const methodName = didChangeData.method;
        cmpMeta.membersMeta = cmpMeta.membersMeta || {};
        cmpMeta.membersMeta[propName] = cmpMeta.membersMeta[propName] || {};
        cmpMeta.membersMeta[propName].watchCallbacks = cmpMeta.membersMeta[propName].watchCallbacks || [];
        cmpMeta.membersMeta[propName].watchCallbacks.push(methodName);
    });
}
function serializeStates(cmpData, cmpMeta) {
    if (!cmpMeta.membersMeta)
        return;
    Object.keys(cmpMeta.membersMeta).sort(nameSort).forEach(memberName => {
        const member = cmpMeta.membersMeta[memberName];
        if (member.memberType === 5 /* State */) {
            cmpData.states = cmpData.states || [];
            cmpData.states.push({
                name: memberName
            });
        }
    });
}
function parseStates(cmpData, cmpMeta) {
    if (invalidArrayData(cmpData.states)) {
        return;
    }
    cmpMeta.membersMeta = cmpMeta.membersMeta || {};
    cmpData.states.forEach(stateData => {
        cmpMeta.membersMeta[stateData.name] = {
            memberType: 5 /* State */
        };
    });
}
function serializeListeners(cmpData, cmpMeta) {
    if (invalidArrayData(cmpMeta.listenersMeta)) {
        return;
    }
    cmpData.listeners = cmpMeta.listenersMeta.map(listenerMeta => {
        const listenerData = {
            event: listenerMeta.eventName,
            method: listenerMeta.eventMethodName
        };
        if (listenerMeta.eventPassive === false) {
            listenerData.passive = false;
        }
        if (listenerMeta.eventDisabled === true) {
            listenerData.enabled = false;
        }
        if (listenerMeta.eventCapture === false) {
            listenerData.capture = false;
        }
        return listenerData;
    }).sort((a, b) => {
        if (a.event.toLowerCase() < b.event.toLowerCase())
            return -1;
        if (a.event.toLowerCase() > b.event.toLowerCase())
            return 1;
        return 0;
    });
}
function parseListeners(cmpData, cmpMeta) {
    const listenersData = cmpData.listeners;
    if (invalidArrayData(listenersData)) {
        return;
    }
    cmpMeta.listenersMeta = listenersData.map(listenerData => {
        const listener = {
            eventName: listenerData.event,
            eventMethodName: listenerData.method,
            eventPassive: (listenerData.passive !== false),
            eventDisabled: (listenerData.enabled === false),
            eventCapture: (listenerData.capture !== false)
        };
        return listener;
    });
}
function serializeMethods(cmpData, cmpMeta) {
    if (!cmpMeta.membersMeta)
        return;
    Object.keys(cmpMeta.membersMeta).sort(nameSort).forEach(memberName => {
        const member = cmpMeta.membersMeta[memberName];
        if (member.memberType === 6 /* Method */) {
            cmpData.methods = cmpData.methods || [];
            cmpData.methods.push({
                name: memberName
            });
        }
    });
}
function parseMethods(cmpData, cmpMeta) {
    if (invalidArrayData(cmpData.methods)) {
        return;
    }
    cmpMeta.membersMeta = cmpMeta.membersMeta || {};
    cmpData.methods.forEach(methodData => {
        cmpMeta.membersMeta[methodData.name] = {
            memberType: 6 /* Method */
        };
    });
}
function serializeContextMember(cmpData, cmpMeta) {
    if (!cmpMeta.membersMeta)
        return;
    Object.keys(cmpMeta.membersMeta).forEach(memberName => {
        const member = cmpMeta.membersMeta[memberName];
        if (member.ctrlId && member.memberType === 3 /* PropContext */) {
            cmpData.context = cmpData.context || [];
            cmpData.context.push({
                name: memberName,
                id: member.ctrlId
            });
        }
    });
}
function parseContextMember(cmpData, cmpMeta) {
    if (invalidArrayData(cmpData.context)) {
        return;
    }
    cmpData.context.forEach(methodData => {
        if (methodData.id) {
            cmpMeta.membersMeta = cmpMeta.membersMeta || {};
            cmpMeta.membersMeta[methodData.name] = {
                memberType: 3 /* PropContext */,
                ctrlId: methodData.id
            };
        }
    });
}
function serializeConnectMember(cmpData, cmpMeta) {
    if (!cmpMeta.membersMeta)
        return;
    Object.keys(cmpMeta.membersMeta).forEach(memberName => {
        const member = cmpMeta.membersMeta[memberName];
        if (member.ctrlId && member.memberType === 4 /* PropConnect */) {
            cmpData.connect = cmpData.connect || [];
            cmpData.connect.push({
                name: memberName,
                tag: member.ctrlId
            });
        }
    });
}
function parseConnectMember(cmpData, cmpMeta) {
    if (invalidArrayData(cmpData.connect)) {
        return;
    }
    cmpData.connect.forEach(methodData => {
        if (methodData.tag) {
            cmpMeta.membersMeta = cmpMeta.membersMeta || {};
            cmpMeta.membersMeta[methodData.name] = {
                memberType: 4 /* PropConnect */,
                ctrlId: methodData.tag
            };
        }
    });
}
function serializeHostElementMember(cmpData, cmpMeta) {
    if (!cmpMeta.membersMeta)
        return;
    Object.keys(cmpMeta.membersMeta).forEach(memberName => {
        const member = cmpMeta.membersMeta[memberName];
        if (member.memberType === 7 /* Element */) {
            cmpData.hostElement = {
                name: memberName
            };
        }
    });
}
function parseHostElementMember(cmpData, cmpMeta) {
    if (!cmpData.hostElement) {
        return;
    }
    cmpMeta.membersMeta = cmpMeta.membersMeta || {};
    cmpMeta.membersMeta[cmpData.hostElement.name] = {
        memberType: 7 /* Element */
    };
}
function serializeEvents(cmpData, cmpMeta) {
    if (invalidArrayData(cmpMeta.eventsMeta)) {
        return;
    }
    cmpData.events = cmpMeta.eventsMeta.map(eventMeta => {
        const eventData = {
            event: eventMeta.eventName
        };
        if (eventMeta.eventMethodName !== eventMeta.eventName) {
            eventData.method = eventMeta.eventMethodName;
        }
        if (eventMeta.eventBubbles === false) {
            eventData.bubbles = false;
        }
        if (eventMeta.eventCancelable === false) {
            eventData.cancelable = false;
        }
        if (eventMeta.eventComposed === false) {
            eventData.composed = false;
        }
        return eventData;
    }).sort((a, b) => {
        if (a.event.toLowerCase() < b.event.toLowerCase())
            return -1;
        if (a.event.toLowerCase() > b.event.toLowerCase())
            return 1;
        return 0;
    });
}
function parseEvents(cmpData, cmpMeta) {
    const eventsData = cmpData.events;
    if (invalidArrayData(eventsData)) {
        return;
    }
    cmpMeta.eventsMeta = eventsData.map(eventData => ({
        eventName: eventData.event,
        eventMethodName: (eventData.method) ? eventData.method : eventData.event,
        eventBubbles: (eventData.bubbles !== false),
        eventCancelable: (eventData.cancelable !== false),
        eventComposed: (eventData.composed !== false)
    }));
}
function serializeHost(cmpData, cmpMeta) {
    if (!cmpMeta.hostMeta || Array.isArray(cmpMeta.hostMeta) || !Object.keys(cmpMeta.hostMeta).length) {
        return;
    }
    cmpData.host = cmpMeta.hostMeta;
}
function parseHost(cmpData, cmpMeta) {
    if (!cmpData.host) {
        return;
    }
    cmpMeta.hostMeta = cmpData.host;
}
function serializeEncapsulation(cmpData, cmpMeta) {
    if (cmpMeta.encapsulation === 1 /* ShadowDom */) {
        cmpData.shadow = true;
    }
    else if (cmpMeta.encapsulation === 2 /* ScopedCss */) {
        cmpData.scoped = true;
    }
}
function parseEncapsulation(cmpData, cmpMeta) {
    if (cmpData.shadow === true) {
        cmpMeta.encapsulation = 1 /* ShadowDom */;
    }
    else if (cmpData.scoped === true) {
        cmpMeta.encapsulation = 2 /* ScopedCss */;
    }
    else {
        cmpMeta.encapsulation = 0 /* NoEncapsulation */;
    }
}
function serializeAppGlobal(config, collectionDir, collectionData, globalModule) {
    if (!globalModule) {
        return;
    }
    collectionData.global = normalizePath(config.sys.path.relative(collectionDir, globalModule.jsFilePath));
}
function parseGlobal(config, collectionDir, collectionData, collection) {
    if (typeof collectionData.global !== 'string')
        return;
    collection.global = {
        jsFilePath: normalizePath(config.sys.path.join(collectionDir, collectionData.global))
    };
}
function serializeBundles(config, collectionData) {
    collectionData.bundles = config.bundles.map(b => {
        return {
            components: b.components.slice().sort()
        };
    });
}
function parseBundles(collectionData, collection) {
    if (invalidArrayData(collectionData.bundles)) {
        collection.bundles = [];
        return;
    }
    collection.bundles = collectionData.bundles.map(b => {
        return {
            components: b.components.slice().sort()
        };
    });
}
function invalidArrayData(arr) {
    return (!arr || !Array.isArray(arr) || arr.length === 0);
}
function nameSort(a, b) {
    if (a.toLowerCase() < b.toLowerCase())
        return -1;
    if (a.toLowerCase() > b.toLowerCase())
        return 1;
    return 0;
}
const BOOLEAN_KEY = 'Boolean';
const NUMBER_KEY = 'Number';
const STRING_KEY = 'String';
const ANY_KEY = 'Any';

var __awaiter$16 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function writeBuildFiles(config, compilerCtx, buildCtx) {
    return __awaiter$16(this, void 0, void 0, function* () {
        // serialize and write the manifest file if need be
        yield writeAppCollection(config, compilerCtx, buildCtx);
        const timeSpan = config.logger.createTimeSpan(`writeBuildFiles started`, true);
        // kick off copying component assets
        // and copy www/build to dist/ if generateDistribution is enabled
        yield Promise.all([
            copyComponentAssets(config, compilerCtx, buildCtx),
            generateDistribution(config, compilerCtx, buildCtx)
        ]);
        let totalFilesWrote = 0;
        try {
            // commit all the writeFiles, mkdirs, rmdirs and unlinks to disk
            const commitResults = yield compilerCtx.fs.commit();
            // get the results from the write to disk commit
            buildCtx.filesWritten = commitResults.filesWritten;
            buildCtx.filesDeleted = commitResults.filesDeleted;
            buildCtx.dirsDeleted = commitResults.dirsDeleted;
            buildCtx.dirsAdded = commitResults.dirsAdded;
            totalFilesWrote = commitResults.filesWritten.length;
            // successful write
            // kick off writing the cached file stuff
            // no need to wait on it finishing
            compilerCtx.cache.commit();
            // generate the service worker
            yield generateServiceWorker(config, compilerCtx, buildCtx);
            config.logger.debug(`in-memory-fs: ${compilerCtx.fs.getMemoryStats()}`);
            config.logger.debug(`cache: ${compilerCtx.cache.getMemoryStats()}`);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
        timeSpan.finish(`writeBuildFiles finished, files wrote: ${totalFilesWrote}`);
    });
}
function emptyDestDir(config, compilerCtx) {
    return __awaiter$16(this, void 0, void 0, function* () {
        if (compilerCtx.isRebuild) {
            // only empty the directories on the first build
            return;
        }
        // empty promises :(
        const emptyPromises = [];
        if (config.generateWWW && config.emptyWWW) {
            config.logger.debug(`empty wwwDir: ${config.wwwDir}`);
            emptyPromises.push(compilerCtx.fs.emptyDir(config.wwwDir));
        }
        if (config.generateDistribution && config.emptyDist) {
            config.logger.debug(`empty distDir: ${config.distDir}`);
            emptyPromises.push(compilerCtx.fs.emptyDir(config.distDir));
        }
        // let's empty out the build dest directory
        yield Promise.all(emptyPromises);
    });
}

var __awaiter$17 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateBuildResults(config, compilerCtx, buildCtx) {
    // create the build results that get returned
    const buildResults = {
        buildId: buildCtx.buildId,
        diagnostics: cleanDiagnostics(buildCtx.diagnostics),
        hasError: hasError(buildCtx.diagnostics),
        aborted: buildCtx.aborted,
        duration: Date.now() - buildCtx.startTime,
        isRebuild: compilerCtx.isRebuild,
        transpileBuildCount: buildCtx.transpileBuildCount,
        bundleBuildCount: buildCtx.bundleBuildCount,
        hasChangedJsText: buildCtx.hasChangedJsText,
        filesWritten: buildCtx.filesWritten.sort(),
        filesChanged: buildCtx.filesChanged.slice().sort(),
        filesUpdated: buildCtx.filesUpdated.slice().sort(),
        filesAdded: buildCtx.filesAdded.slice().sort(),
        filesDeleted: buildCtx.filesDeleted.slice().sort(),
        dirsAdded: buildCtx.dirsAdded.slice().sort(),
        dirsDeleted: buildCtx.dirsDeleted.slice().sort(),
        components: [],
        entries: buildCtx.entryModules.map(en => {
            en.modeNames = en.modeNames || [];
            en.entryBundles = en.entryBundles || [];
            en.moduleFiles = en.moduleFiles || [];
            const entryCmps = [];
            buildCtx.entryPoints.forEach(ep => {
                entryCmps.push(...ep);
            });
            const buildEntry = {
                entryId: en.entryKey,
                components: en.moduleFiles.map(m => {
                    const entryCmp = entryCmps.find(ec => {
                        return ec.tag === m.cmpMeta.tagNameMeta;
                    });
                    const dependencyOf = ((entryCmp && entryCmp.dependencyOf) || []).slice().sort();
                    const buildCmp = {
                        tag: m.cmpMeta.tagNameMeta,
                        dependencies: m.cmpMeta.dependencies.slice(),
                        dependencyOf: dependencyOf
                    };
                    return buildCmp;
                }),
                bundles: en.entryBundles.map(entryBundle => {
                    const buildBundle = {
                        fileName: entryBundle.fileName,
                        size: entryBundle.text.length,
                        outputs: entryBundle.outputs.map(filePath => {
                            return normalizePath(config.sys.path.relative(config.rootDir, filePath));
                        }).sort()
                    };
                    if (typeof entryBundle.sourceTarget === 'string') {
                        buildBundle.target = entryBundle.sourceTarget;
                    }
                    if (entryBundle.modeName !== DEFAULT_STYLE_MODE) {
                        buildBundle.mode = entryBundle.modeName;
                    }
                    if (entryBundle.isScopedStyles) {
                        buildBundle.scopedStyles = entryBundle.isScopedStyles;
                    }
                    return buildBundle;
                }),
                inputs: en.moduleFiles.map(m => {
                    return normalizePath(config.sys.path.relative(config.rootDir, m.jsFilePath));
                }).sort(),
                encapsulations: []
            };
            const modes = en.modeNames.slice();
            if (modes.length > 1 || (modes.length === 1 && modes[0] !== DEFAULT_STYLE_MODE)) {
                buildEntry.modes = modes.sort();
            }
            en.moduleFiles.forEach(m => {
                const encap = m.cmpMeta.encapsulation === 2 /* ScopedCss */ ? 'scoped' : m.cmpMeta.encapsulation === 1 /* ShadowDom */ ? 'shadow' : 'none';
                if (!buildEntry.encapsulations.includes(encap)) {
                    buildEntry.encapsulations.push(encap);
                }
            });
            buildEntry.encapsulations.sort();
            return buildEntry;
        })
    };
    buildResults.entries.forEach(en => {
        buildResults.components.push(...en.components);
    });
    return buildResults;
}
function generateBuildStats(config, compilerCtx, buildCtx, buildResults) {
    return __awaiter$17(this, void 0, void 0, function* () {
        if (!config.writeStats || buildCtx.aborted) {
            return;
        }
        try {
            let jsonData;
            if (buildResults.hasError) {
                jsonData = {
                    diagnostics: buildResults.diagnostics
                };
            }
            else {
                const stats = {
                    compiler: {
                        name: config.sys.compiler.name,
                        version: config.sys.compiler.version
                    },
                    app: {
                        namespace: config.namespace,
                        fsNamespace: config.fsNamespace,
                        components: buildResults.components.length,
                        entries: buildResults.entries.length,
                        bundles: buildResults.entries.reduce((total, en) => {
                            total += en.bundles.length;
                            return total;
                        }, 0)
                    },
                    options: {
                        generateWWW: config.generateWWW,
                        generateDistribution: config.generateDistribution,
                        minifyJs: config.minifyJs,
                        minifyCss: config.minifyCss,
                        hashFileNames: config.hashFileNames,
                        hashedFileNameLength: config.hashedFileNameLength,
                        buildEs5: config.buildEs5
                    },
                    components: buildResults.components,
                    entries: buildResults.entries,
                    sourceGraph: {},
                    collections: buildCtx.collections.map(c => {
                        return {
                            name: c.collectionName,
                            source: normalizePath(config.sys.path.relative(config.rootDir, c.moduleDir)),
                            tags: c.moduleFiles.map(m => m.cmpMeta.tagNameMeta).sort()
                        };
                    }).sort((a, b) => {
                        if (a.name < b.name)
                            return -1;
                        if (a.name > b.name)
                            return 1;
                        return 0;
                    })
                };
                buildCtx.moduleGraphs
                    .sort((a, b) => {
                    if (a.filePath < b.filePath)
                        return -1;
                    if (a.filePath > b.filePath)
                        return 1;
                    return 0;
                }).forEach(mg => {
                    const key = normalizePath(config.sys.path.relative(config.rootDir, mg.filePath));
                    stats.sourceGraph[key] = mg.importPaths.map(importPath => {
                        return normalizePath(config.sys.path.relative(config.rootDir, importPath));
                    }).sort();
                });
                jsonData = stats;
            }
            yield compilerCtx.fs.writeFile(config.buildStatsFilePath, JSON.stringify(jsonData, null, 2));
            yield compilerCtx.fs.commit();
        }
        catch (e) { }
    });
}

class BuildEvents {
    constructor(config) {
        this.config = config;
        this.evCallbacks = {};
    }
    subscribe(eventName, cb) {
        const evName = getEventName(eventName);
        if (eventName === 'rebuild' && !this.config.watch) {
            throw new Error(`config must set "watch" to "true" in order to enable "rebuild" events`);
        }
        if (!this.evCallbacks[evName]) {
            this.evCallbacks[evName] = [];
        }
        this.evCallbacks[evName].push(cb);
        return () => {
            this.unsubscribe(evName, cb);
        };
    }
    unsubscribe(eventName, cb) {
        const evName = getEventName(eventName);
        if (this.evCallbacks[evName]) {
            const index = this.evCallbacks[evName].indexOf(cb);
            if (index > -1) {
                this.evCallbacks[evName].splice(index, 1);
            }
        }
    }
    unsubscribeAll() {
        this.evCallbacks = {};
    }
    emit(eventName, ...args) {
        const evName = getEventName(eventName);
        const evCallbacks = this.evCallbacks[evName];
        if (evCallbacks) {
            evCallbacks.forEach(cb => {
                try {
                    cb.apply(this, args);
                }
                catch (e) {
                    console.log(e);
                }
            });
        }
    }
}
function getEventName(evName) {
    return evName.trim().toLowerCase();
}

var __awaiter$18 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Cache {
    constructor(config, cacheFs, tmpDir) {
        this.config = config;
        this.cacheFs = cacheFs;
        this.tmpDir = tmpDir;
        this.failed = 0;
        this.skip = false;
        if (config.enableCache) {
            config.logger.debug(`cache enabled, tmpdir: ${tmpDir}`);
        }
        else {
            config.logger.debug(`cache disabled, empty tmpdir: ${tmpDir}`);
            this.clearDiskCache();
        }
    }
    get(key) {
        return __awaiter$18(this, void 0, void 0, function* () {
            if (!this.config.enableCache || this.skip) {
                return null;
            }
            if (this.failed >= MAX_FAILED) {
                if (!this.skip) {
                    this.skip = true;
                    this.config.logger.debug(`cache had ${this.failed} failed ops, skip disk ops for remander of build`);
                }
                return null;
            }
            let result;
            try {
                result = yield this.cacheFs.readFile(this.getCacheFilePath(key));
                this.failed = 0;
                this.skip = false;
            }
            catch (e) {
                this.failed++;
                result = null;
            }
            return result;
        });
    }
    put(key, value) {
        return __awaiter$18(this, void 0, void 0, function* () {
            if (!this.config.enableCache) {
                return false;
            }
            let result;
            try {
                yield this.cacheFs.writeFile(this.getCacheFilePath(key), value);
                result = true;
            }
            catch (e) {
                this.failed++;
                result = false;
            }
            return result;
        });
    }
    createKey(domain, ...args) {
        if (!this.config.enableCache) {
            return '';
        }
        return domain + '_' + this.config.sys.generateContentHash(JSON.stringify(args), 32);
    }
    commit() {
        return __awaiter$18(this, void 0, void 0, function* () {
            if (this.config.enableCache) {
                this.skip = false;
                this.failed = 0;
                yield this.cacheFs.commit();
            }
        });
    }
    clear() {
        this.cacheFs.clearCache();
    }
    clearDiskCache() {
        return __awaiter$18(this, void 0, void 0, function* () {
            yield this.cacheFs.emptyDir(this.tmpDir);
            yield this.cacheFs.commit();
        });
    }
    getCacheFilePath(key) {
        return this.config.sys.path.join(this.tmpDir, key);
    }
    getMemoryStats() {
        return this.cacheFs.getMemoryStats();
    }
}
const MAX_FAILED = 20;

var __awaiter$19 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class InMemoryFileSystem {
    constructor(disk, path) {
        this.disk = disk;
        this.path = path;
        this.d = {};
    }
    access(filePath) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const item = this.getItem(filePath);
            if (typeof item.exists === 'boolean') {
                return item.exists;
            }
            let hasAccess = false;
            try {
                const s = yield this.stat(filePath);
                item.exists = true;
                item.isDirectory = s.isDirectory;
                item.isFile = s.isFile;
                hasAccess = true;
            }
            catch (e) {
                item.exists = false;
            }
            return hasAccess;
        });
    }
    /**
     * Synchronous!!! Do not use!!!
     * (Only typescript transpiling is allowed to use)
     * @param filePath
     */
    accessSync(filePath) {
        const item = this.getItem(filePath);
        if (typeof item.exists === 'boolean') {
            return item.exists;
        }
        let hasAccess = false;
        try {
            const s = this.statSync(filePath);
            item.exists = true;
            item.isDirectory = s.isDirectory;
            item.isFile = s.isFile;
            hasAccess = true;
        }
        catch (e) {
            item.exists = false;
        }
        return hasAccess;
    }
    copy(src, dest, opts) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const stats = yield this.stat(src);
            if (stats.isDirectory) {
                yield this.copyDir(src, dest, opts);
            }
            else if (stats.isFile) {
                yield this.copyFile(src, dest, opts);
            }
        });
    }
    copyDir(src, dest, opts) {
        return __awaiter$19(this, void 0, void 0, function* () {
            src = normalizePath(src);
            dest = normalizePath(dest);
            const dirItems = yield this.readdir(src, { recursive: true });
            yield Promise.all(dirItems.map((dirItem) => __awaiter$19(this, void 0, void 0, function* () {
                const srcPath = dirItem.absPath;
                const destPath = normalizePath(this.path.join(dest, dirItem.relPath));
                if (dirItem.isDirectory) {
                    yield this.copyDir(srcPath, destPath, opts);
                }
                else if (dirItem.isFile) {
                    yield this.copyFile(srcPath, destPath, opts);
                }
            })));
        });
    }
    copyFile(src, dest, opts) {
        return __awaiter$19(this, void 0, void 0, function* () {
            src = normalizePath(src);
            dest = normalizePath(dest);
            if (opts && typeof opts.filter === 'function' && !opts.filter(src, dest)) {
                return;
            }
            if (shouldIgnore(src)) {
                return;
            }
            const srcItem = this.getItem(src);
            srcItem.isFile = true;
            srcItem.isDirectory = false;
            const destItem = this.getItem(dest);
            destItem.isFile = true;
            destItem.isDirectory = false;
            destItem.queueDeleteFromDisk = false;
            if (isTextFile(src)) {
                const srcFileText = yield this.readFile(src);
                if (srcFileText !== destItem.fileText) {
                    destItem.fileText = srcFileText;
                    destItem.queueWriteToDisk = true;
                }
            }
            else {
                destItem.fileSrc = src;
                destItem.queueWriteToDisk = true;
            }
        });
    }
    emptyDir(dirPath) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const item = this.getItem(dirPath);
            yield this.removeDir(dirPath);
            item.isFile = false;
            item.isDirectory = true;
            item.queueWriteToDisk = true;
            item.queueDeleteFromDisk = false;
        });
    }
    readdir(dirPath, opts = {}) {
        return __awaiter$19(this, void 0, void 0, function* () {
            dirPath = normalizePath(dirPath);
            const collectedPaths = [];
            if (opts.inMemoryOnly) {
                let inMemoryDir = dirPath;
                if (!inMemoryDir.endsWith('/')) {
                    inMemoryDir += '/';
                }
                const inMemoryDirs = dirPath.split('/');
                const filePaths = Object.keys(this.d);
                filePaths.forEach(filePath => {
                    if (!filePath.startsWith(dirPath)) {
                        return;
                    }
                    const parts = filePath.split('/');
                    if (parts.length === inMemoryDirs.length + 1 || (opts.recursive && parts.length > inMemoryDirs.length)) {
                        const d = this.d[filePath];
                        if (d.exists) {
                            // console.log(filePath, d)
                            const item = {
                                absPath: filePath,
                                relPath: parts[inMemoryDirs.length],
                                isDirectory: d.isDirectory,
                                isFile: d.isFile
                            };
                            collectedPaths.push(item);
                        }
                    }
                });
            }
            else {
                // always a disk read
                yield this.readDirectory(dirPath, dirPath, opts, collectedPaths);
            }
            return collectedPaths.sort((a, b) => {
                if (a.absPath < b.absPath)
                    return -1;
                if (a.absPath > b.absPath)
                    return 1;
                return 0;
            });
        });
    }
    readDirectory(initPath, dirPath, opts, collectedPaths) {
        return __awaiter$19(this, void 0, void 0, function* () {
            // used internally only so we could easily recursively drill down
            // loop through this directory and sub directories
            // always a disk read!!
            const dirItems = yield this.disk.readdir(dirPath);
            // cache some facts about this path
            const item = this.getItem(dirPath);
            item.exists = true;
            item.isFile = false;
            item.isDirectory = true;
            yield Promise.all(dirItems.map((dirItem) => __awaiter$19(this, void 0, void 0, function* () {
                // let's loop through each of the files we've found so far
                // create an absolute path of the item inside of this directory
                const absPath = normalizePath(this.path.join(dirPath, dirItem));
                const relPath = normalizePath(this.path.relative(initPath, absPath));
                // get the fs stats for the item, could be either a file or directory
                const stats = yield this.stat(absPath);
                // cache some stats about this path
                const subItem = this.getItem(absPath);
                subItem.exists = true;
                subItem.isDirectory = stats.isDirectory;
                subItem.isFile = stats.isFile;
                collectedPaths.push({
                    absPath: absPath,
                    relPath: relPath,
                    isDirectory: stats.isDirectory,
                    isFile: stats.isFile
                });
                if (opts.recursive && stats.isDirectory) {
                    // looks like it's yet another directory
                    // let's keep drilling down
                    yield this.readDirectory(initPath, absPath, opts, collectedPaths);
                }
            })));
        });
    }
    readFile(filePath, opts) {
        return __awaiter$19(this, void 0, void 0, function* () {
            if (!opts || (opts.useCache === true || opts.useCache === undefined)) {
                const item = this.getItem(filePath);
                if (item.exists && typeof item.fileText === 'string') {
                    return item.fileText;
                }
            }
            const fileContent = yield this.disk.readFile(filePath, 'utf-8');
            if (fileContent.length < MAX_TEXT_CACHE) {
                const item = this.getItem(filePath);
                item.exists = true;
                item.isFile = true;
                item.isDirectory = false;
                item.fileText = fileContent;
            }
            return fileContent;
        });
    }
    /**
     * Synchronous!!! Do not use!!!
     * (Only typescript transpiling is allowed to use)
     * @param filePath
     */
    readFileSync(filePath) {
        const item = this.getItem(filePath);
        if (item.exists && typeof item.fileText === 'string') {
            return item.fileText;
        }
        const fileContent = this.disk.readFileSync(filePath, 'utf-8');
        if (fileContent.length < MAX_TEXT_CACHE) {
            item.exists = true;
            item.isFile = true;
            item.isDirectory = false;
            item.fileText = fileContent;
        }
        return fileContent;
    }
    remove(itemPath) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const stats = yield this.stat(itemPath);
            if (stats.isDirectory) {
                yield this.removeDir(itemPath);
            }
            else if (stats.isFile) {
                yield this.removeItem(itemPath);
            }
        });
    }
    removeDir(dirPath) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const item = this.getItem(dirPath);
            item.isFile = false;
            item.isDirectory = true;
            if (!item.queueWriteToDisk) {
                item.queueDeleteFromDisk = true;
            }
            try {
                const dirItems = yield this.readdir(dirPath, { recursive: true });
                yield Promise.all(dirItems.map((item) => __awaiter$19(this, void 0, void 0, function* () {
                    yield this.removeItem(item.absPath);
                })));
            }
            catch (e) {
                // do not throw error if the directory never existed
            }
        });
    }
    removeItem(filePath) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const item = this.getItem(filePath);
            if (!item.queueWriteToDisk) {
                item.queueDeleteFromDisk = true;
            }
        });
    }
    stat(itemPath) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const item = this.getItem(itemPath);
            if (typeof item.isDirectory !== 'boolean' || typeof item.isFile !== 'boolean') {
                const s = yield this.disk.stat(itemPath);
                item.exists = true;
                item.isDirectory = s.isDirectory();
                item.isFile = s.isFile();
            }
            return {
                isFile: item.isFile,
                isDirectory: item.isDirectory
            };
        });
    }
    /**
     * Synchronous!!! Do not use!!!
     * (Only typescript transpiling is allowed to use)
     * @param itemPath
     */
    statSync(itemPath) {
        const item = this.getItem(itemPath);
        if (typeof item.isDirectory !== 'boolean' || typeof item.isFile !== 'boolean') {
            const s = this.disk.statSync(itemPath);
            item.exists = true;
            item.isDirectory = s.isDirectory();
            item.isFile = s.isFile();
        }
        return {
            isFile: item.isFile,
            isDirectory: item.isDirectory
        };
    }
    writeFile(filePath, content, opts) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const results = {};
            if (typeof filePath !== 'string') {
                throw new Error(`writeFile, invalid filePath: ${filePath}`);
            }
            if (typeof content !== 'string') {
                throw new Error(`writeFile, invalid content: ${filePath}`);
            }
            if (shouldIgnore(filePath)) {
                results.ignored = true;
                return results;
            }
            const item = this.getItem(filePath);
            item.exists = true;
            item.isFile = true;
            item.isDirectory = false;
            item.queueDeleteFromDisk = false;
            results.changedContent = item.fileText !== content;
            results.queuedWrite = false;
            item.fileText = content;
            if (opts && opts.inMemoryOnly) {
                // we don't want to actually write this to disk
                // just keep it in memory
                if (item.queueWriteToDisk) {
                    // we already queued this file to write to disk
                    // in that case we still need to do it
                    results.queuedWrite = true;
                }
                else {
                    // we only want this in memory and
                    // it wasn't already queued to be written
                    item.queueWriteToDisk = false;
                }
            }
            else {
                // we want to write this to disk (eventually)
                // but only if the content is different
                // from our existing cached content
                if (!item.queueWriteToDisk && results.changedContent) {
                    // not already queued to be written
                    // and the content is different
                    item.queueWriteToDisk = true;
                    results.queuedWrite = true;
                }
            }
            return results;
        });
    }
    writeFiles(files, opts) {
        return Promise.all(Object.keys(files).map(filePath => {
            return this.writeFile(filePath, files[filePath], opts);
        }));
    }
    commit() {
        return __awaiter$19(this, void 0, void 0, function* () {
            const instructions = getCommitInstructions(this.path, this.d);
            // ensure directories we need exist
            const dirsAdded = yield this.commitEnsureDirs(instructions.dirsToEnsure);
            // write all queued the files
            const filesWritten = yield this.commitWriteFiles(instructions.filesToWrite);
            // remove all the queued files to be deleted
            const filesDeleted = yield this.commitDeleteFiles(instructions.filesToDelete);
            // remove all the queued dirs to be deleted
            const dirsDeleted = yield this.commitDeleteDirs(instructions.dirsToDelete);
            instructions.filesToDelete.forEach(fileToDelete => {
                this.clearFileCache(fileToDelete);
            });
            instructions.dirsToDelete.forEach(dirToDelete => {
                this.clearDirCache(dirToDelete);
            });
            // return only the files that were
            return {
                filesWritten: filesWritten,
                filesDeleted: filesDeleted,
                dirsDeleted: dirsDeleted,
                dirsAdded: dirsAdded
            };
        });
    }
    commitEnsureDirs(dirsToEnsure) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const dirsAdded = [];
            for (const dirPath of dirsToEnsure) {
                const item = this.getItem(dirPath);
                if (item.exists && item.isDirectory) {
                    // already cached that this path is indeed an existing directory
                    continue;
                }
                try {
                    // cache that we know this is a directory on disk
                    item.exists = true;
                    item.isDirectory = true;
                    item.isFile = false;
                    yield this.disk.mkdir(dirPath);
                    dirsAdded.push(dirPath);
                }
                catch (e) { }
            }
            return dirsAdded;
        });
    }
    commitWriteFiles(filesToWrite) {
        return Promise.all(filesToWrite.map((filePath) => __awaiter$19(this, void 0, void 0, function* () {
            if (typeof filePath !== 'string') {
                throw new Error(`unable to writeFile without filePath`);
            }
            return this.commitWriteFile(filePath);
        })));
    }
    commitWriteFile(filePath) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const item = this.getItem(filePath);
            if (typeof item.fileSrc === 'string') {
                yield this.disk.copyFile(item.fileSrc, filePath);
                return filePath;
            }
            if (item.fileText == null) {
                throw new Error(`unable to find item fileText to write: ${filePath}`);
            }
            yield this.disk.writeFile(filePath, item.fileText);
            return filePath;
        });
    }
    commitDeleteFiles(filesToDelete) {
        return Promise.all(filesToDelete.map((filePath) => __awaiter$19(this, void 0, void 0, function* () {
            if (typeof filePath !== 'string') {
                throw new Error(`unable to unlink without filePath`);
            }
            yield this.disk.unlink(filePath);
            return filePath;
        })));
    }
    commitDeleteDirs(dirsToDelete) {
        return __awaiter$19(this, void 0, void 0, function* () {
            const dirsDeleted = [];
            for (const dirPath of dirsToDelete) {
                try {
                    yield this.disk.rmdir(dirPath);
                }
                catch (e) { }
                dirsDeleted.push(dirPath);
            }
            return dirsDeleted;
        });
    }
    clearDirCache(dirPath) {
        dirPath = normalizePath(dirPath);
        const filePaths = Object.keys(this.d);
        filePaths.forEach(f => {
            const filePath = this.path.relative(dirPath, f).split('/')[0];
            if (!filePath.startsWith('.') && !filePath.startsWith('/')) {
                this.clearFileCache(f);
            }
        });
    }
    clearFileCache(filePath) {
        filePath = normalizePath(filePath);
        const item = this.d[filePath];
        if (item && !item.queueWriteToDisk) {
            delete this.d[filePath];
        }
    }
    getItem(itemPath) {
        itemPath = normalizePath(itemPath);
        const item = this.d[itemPath];
        if (item) {
            return item;
        }
        return this.d[itemPath] = {};
    }
    clearCache() {
        this.d = {};
    }
    getMemoryStats() {
        return `data length: ${Object.keys(this.d).length}`;
    }
}
function getCommitInstructions(path, d) {
    const instructions = {
        filesToDelete: [],
        filesToWrite: [],
        dirsToDelete: [],
        dirsToEnsure: []
    };
    Object.keys(d).forEach(itemPath => {
        const item = d[itemPath];
        if (item.queueWriteToDisk) {
            if (item.isFile) {
                instructions.filesToWrite.push(itemPath);
                const dir = normalizePath(path.dirname(itemPath));
                if (!instructions.dirsToEnsure.includes(dir)) {
                    instructions.dirsToEnsure.push(dir);
                }
                const dirDeleteIndex = instructions.dirsToDelete.indexOf(dir);
                if (dirDeleteIndex > -1) {
                    instructions.dirsToDelete.splice(dirDeleteIndex, 1);
                }
                const fileDeleteIndex = instructions.filesToDelete.indexOf(itemPath);
                if (fileDeleteIndex > -1) {
                    instructions.filesToDelete.splice(fileDeleteIndex, 1);
                }
            }
            else if (item.isDirectory) {
                if (!instructions.dirsToEnsure.includes(itemPath)) {
                    instructions.dirsToEnsure.push(itemPath);
                }
                const dirDeleteIndex = instructions.dirsToDelete.indexOf(itemPath);
                if (dirDeleteIndex > -1) {
                    instructions.dirsToDelete.splice(dirDeleteIndex, 1);
                }
            }
        }
        else if (item.queueDeleteFromDisk) {
            if (item.isDirectory && !instructions.dirsToEnsure.includes(itemPath)) {
                instructions.dirsToDelete.push(itemPath);
            }
            else if (item.isFile && !instructions.filesToWrite.includes(itemPath)) {
                instructions.filesToDelete.push(itemPath);
            }
        }
        item.queueDeleteFromDisk = false;
        item.queueWriteToDisk = false;
    });
    // add all the ancestor directories for each directory too
    for (let i = 0, ilen = instructions.dirsToEnsure.length; i < ilen; i++) {
        const segments = instructions.dirsToEnsure[i].split('/');
        for (let j = 2; j < segments.length; j++) {
            const dir = segments.slice(0, j).join('/');
            if (!instructions.dirsToEnsure.includes(dir)) {
                instructions.dirsToEnsure.push(dir);
            }
        }
    }
    // sort directories so shortest paths are ensured first
    instructions.dirsToEnsure.sort((a, b) => {
        const segmentsA = a.split('/').length;
        const segmentsB = b.split('/').length;
        if (segmentsA < segmentsB)
            return -1;
        if (segmentsA > segmentsB)
            return 1;
        if (a.length < b.length)
            return -1;
        if (a.length > b.length)
            return 1;
        return 0;
    });
    // sort directories so longest paths are removed first
    instructions.dirsToDelete.sort((a, b) => {
        const segmentsA = a.split('/').length;
        const segmentsB = b.split('/').length;
        if (segmentsA < segmentsB)
            return 1;
        if (segmentsA > segmentsB)
            return -1;
        if (a.length < b.length)
            return 1;
        if (a.length > b.length)
            return -1;
        return 0;
    });
    instructions.dirsToEnsure.forEach(dirToEnsure => {
        const i = instructions.dirsToDelete.indexOf(dirToEnsure);
        if (i > -1) {
            instructions.dirsToDelete.splice(i, 1);
        }
    });
    instructions.dirsToDelete = instructions.dirsToDelete.filter(dir => {
        if (dir === '/' || dir.endsWith(':/')) {
            return false;
        }
        return true;
    });
    instructions.dirsToEnsure = instructions.dirsToEnsure.filter(dir => {
        if (d[dir] && d[dir].exists && d[dir].isDirectory) {
            return false;
        }
        if (dir === '/' || dir.endsWith(':/')) {
            return false;
        }
        return true;
    });
    return instructions;
}
function isTextFile(filePath) {
    filePath = filePath.toLowerCase().trim();
    return TXT_EXT.some(ext => filePath.endsWith(ext));
}
const TXT_EXT = [
    '.ts', '.tsx', '.js', '.jsx', '.svg',
    '.html', '.txt', '.md', '.markdown', '.json',
    '.css', '.scss', '.sass', '.less', '.styl'
];
function shouldIgnore(filePath) {
    filePath = filePath.trim().toLowerCase();
    return IGNORE.some(ignoreFile => filePath.endsWith(ignoreFile));
}
const IGNORE = [
    '.ds_store',
    '.gitignore',
    'desktop.ini',
    'thumbs.db'
];
// only cache if it's less than 5MB-ish (using .length as a rough guess)
// why 5MB? idk, seems like a good number for source text
// it's pretty darn large to cover almost ALL legitimate source files
// and anything larger is probably a REALLY large file and a rare case
// which we don't need to eat up memory for
const MAX_TEXT_CACHE = 5242880;

function getCompilerCtx(config, compilerCtx) {
    // reusable data between builds
    compilerCtx = compilerCtx || {};
    compilerCtx.fs = compilerCtx.fs || new InMemoryFileSystem(config.sys.fs, config.sys.path);
    compilerCtx.cache = compilerCtx.cache || new Cache(config, new InMemoryFileSystem(config.sys.fs, config.sys.path), config.sys.tmpdir());
    compilerCtx.events = compilerCtx.events || new BuildEvents(config);
    compilerCtx.appFiles = compilerCtx.appFiles || {};
    compilerCtx.moduleFiles = compilerCtx.moduleFiles || {};
    compilerCtx.collections = compilerCtx.collections || [];
    compilerCtx.resolvedCollections = compilerCtx.resolvedCollections || [];
    compilerCtx.compiledModuleJsText = compilerCtx.compiledModuleJsText || {};
    compilerCtx.compiledModuleLegacyJsText = compilerCtx.compiledModuleLegacyJsText || {};
    if (typeof compilerCtx.activeBuildId !== 'number') {
        compilerCtx.activeBuildId = -1;
    }
    return compilerCtx;
}
function resetCompilerCtx(compilerCtx) {
    compilerCtx.fs.clearCache();
    compilerCtx.cache.clear();
    compilerCtx.appFiles = {};
    compilerCtx.moduleFiles = {};
    compilerCtx.collections.length = 0;
    compilerCtx.resolvedCollections.length = 0;
    compilerCtx.compiledModuleJsText = {};
    compilerCtx.compiledModuleLegacyJsText = {};
    // do NOT reset 'hasSuccessfulBuild'
}

function setBooleanConfig(config, configName, defaultValue) {
    const userConfigName = getUserConfigName(config, configName);
    if (typeof config[userConfigName] === 'function') {
        config[userConfigName] = !!config[userConfigName]();
    }
    if (typeof config[userConfigName] === 'boolean') {
        config[configName] = config[userConfigName];
    }
    else {
        config[configName] = defaultValue;
    }
}
function setNumberConfig(config, configName, defaultValue) {
    const userConfigName = getUserConfigName(config, configName);
    if (typeof config[userConfigName] === 'function') {
        config[userConfigName] = config[userConfigName]();
    }
    if (typeof config[userConfigName] === 'number') {
        config[configName] = config[userConfigName];
    }
    else {
        config[configName] = defaultValue;
    }
}
function setStringConfig(config, configName, defaultValue) {
    const userConfigName = getUserConfigName(config, configName);
    if (typeof config[userConfigName] === 'function') {
        config[userConfigName] = config[userConfigName]();
    }
    if (typeof config[userConfigName] === 'string') {
        config[configName] = config[userConfigName];
    }
    else {
        config[configName] = defaultValue;
    }
}
function setArrayConfig(config, configName, defaultValue) {
    const userConfigName = getUserConfigName(config, configName);
    if (typeof config[userConfigName] === 'function') {
        config[userConfigName] = config[userConfigName]();
    }
    if (!Array.isArray(config[configName])) {
        if (Array.isArray(defaultValue)) {
            config[configName] = defaultValue.slice();
        }
        else {
            config[configName] = [];
        }
    }
}
function getUserConfigName(config, correctConfigName) {
    const userConfigNames = Object.keys(config);
    for (const userConfigName of userConfigNames) {
        if (userConfigName.toLowerCase() === correctConfigName.toLowerCase()) {
            if (userConfigName !== correctConfigName) {
                config.logger.warn(`config "${userConfigName}" should be "${correctConfigName}"`);
                return userConfigName;
            }
            break;
        }
    }
    return correctConfigName;
}

function validateAssetVerioning(config) {
    if (!config.assetVersioning) {
        config.assetVersioning = null;
        return;
    }
    if ((config.assetVersioning) === true) {
        config.assetVersioning = {};
    }
    const hashLength = config.hashedFileNameLength > 3 ? config.hashedFileNameLength : DEFAULTS.hashLength;
    setArrayConfig(config.assetVersioning, 'cssProperties', DEFAULTS.cssProperties);
    setNumberConfig(config.assetVersioning, 'hashLength', hashLength);
    setBooleanConfig(config.assetVersioning, 'queryMode', DEFAULTS.queryMode);
    setStringConfig(config.assetVersioning, 'prefix', DEFAULTS.separator);
    setStringConfig(config.assetVersioning, 'separator', DEFAULTS.separator);
    setBooleanConfig(config.assetVersioning, 'versionHtml', DEFAULTS.versionHtml);
    setBooleanConfig(config.assetVersioning, 'versionCssProperties', DEFAULTS.versionCssProperties);
}
const DEFAULTS = {
    cssProperties: ['background', 'background-url', 'url'],
    hashLength: 8,
    queryMode: false,
    pattern: '**/*.{css,js,png,jpg,jpeg,gif,svg,json,woff,woff2,ttf,eot}',
    prefix: '',
    separator: '.',
    versionHtml: true,
    versionCssProperties: true,
};

function validateCopy(config) {
    if (config.copy) {
        // merge user copy tasks into the default
        config.copy = Object.assign({}, DEFAULT_COPY_TASKS, config.copy);
    }
    else if (config.copy === null || config.copy === false) {
        // manually forcing to skip the copy task
        config.copy = null;
    }
    else {
        // use the default copy tasks
        config.copy = Object.assign({}, DEFAULT_COPY_TASKS);
    }
}
const DEFAULT_COPY_TASKS = {
    assets: { src: 'assets', warn: false },
    manifestJson: { src: 'manifest.json', warn: false }
};

function validateNamespace(config) {
    setStringConfig(config, 'namespace', DEFAULT_NAMESPACE);
    config.namespace = config.namespace.trim();
    const invalidNamespaceChars = config.namespace.replace(/(\w)|(\-)|(\$)/g, '');
    if (invalidNamespaceChars !== '') {
        throw new Error(`Namespace "${config.namespace}" contains invalid characters: ${invalidNamespaceChars}`);
    }
    if (config.namespace.length < 3) {
        throw new Error(`Namespace "${config.namespace}" must be at least 3 characters`);
    }
    if (/^\d+$/.test(config.namespace.charAt(0))) {
        throw new Error(`Namespace "${config.namespace}" cannot have a number for the first character`);
    }
    if (config.namespace.charAt(0) === '-') {
        throw new Error(`Namespace "${config.namespace}" cannot have a dash for the first character`);
    }
    if (config.namespace.charAt(config.namespace.length - 1) === '-') {
        throw new Error(`Namespace "${config.namespace}" cannot have a dash for the last character`);
    }
    // the file system namespace is the one
    // used in filenames and seen in the url
    setStringConfig(config, 'fsNamespace', config.namespace.toLowerCase());
    if (config.namespace.includes('-')) {
        // convert to PascalCase
        // this is the same namespace that gets put on "window"
        config.namespace = dashToPascalCase(config.namespace);
    }
}
const DEFAULT_NAMESPACE = 'App';

function validatePaths(config) {
    const path = config.sys.path;
    if (typeof config.global === 'string') {
        // deprecated: 2017-12-12
        config.logger.warn(`stencil config property "global" has been renamed to "globalScript"`);
        config.globalScript = config.global;
    }
    if (typeof config.globalScript === 'string' && !path.isAbsolute(config.globalScript)) {
        config.globalScript = normalizePath(path.join(config.rootDir, config.globalScript));
    }
    if (typeof config.globalStyle === 'string') {
        config.globalStyle = [config.globalStyle];
    }
    if (Array.isArray(config.globalStyle)) {
        config.globalStyle = config.globalStyle.filter(globalStyle => typeof globalStyle === 'string');
        config.globalStyle = config.globalStyle.map(globalStyle => {
            if (path.isAbsolute(globalStyle)) {
                return normalizePath(globalStyle);
            }
            return normalizePath(path.join(config.rootDir, globalStyle));
        });
    }
    if (typeof config.src === 'string') {
        // deprecated: 2017-08-14
        config.logger.warn(`stencil config property "src" has been renamed to "srcDir"`);
        config.srcDir = config.src;
    }
    setStringConfig(config, 'srcDir', DEFAULT_SRC_DIR);
    if (!path.isAbsolute(config.srcDir)) {
        config.srcDir = normalizePath(path.join(config.rootDir, config.srcDir));
    }
    setStringConfig(config, 'wwwDir', DEFAULT_WWW_DIR);
    if (!path.isAbsolute(config.wwwDir)) {
        config.wwwDir = normalizePath(path.join(config.rootDir, config.wwwDir));
    }
    setStringConfig(config, 'buildDir', DEFAULT_BUILD_DIR);
    if (!path.isAbsolute(config.buildDir)) {
        config.buildDir = normalizePath(path.join(config.wwwDir, config.buildDir));
    }
    setStringConfig(config, 'distDir', DEFAULT_DIST_DIR);
    if (!path.isAbsolute(config.distDir)) {
        config.distDir = normalizePath(path.join(config.rootDir, config.distDir));
    }
    setStringConfig(config, 'collectionDir', DEFAULT_COLLECTION_DIR);
    if (!path.isAbsolute(config.collectionDir)) {
        config.collectionDir = normalizePath(path.join(config.distDir, config.collectionDir));
    }
    setStringConfig(config, 'tsconfig', DEFAULT_TSCONFIG);
    if (!path.isAbsolute(config.tsconfig)) {
        config.tsconfig = normalizePath(path.join(config.rootDir, config.tsconfig));
    }
    setStringConfig(config, 'typesDir', DEFAULT_TYPES_DIR);
    if (!path.isAbsolute(config.typesDir)) {
        config.typesDir = normalizePath(path.join(config.distDir, config.typesDir));
    }
    setStringConfig(config, 'srcIndexHtml', normalizePath(path.join(config.srcDir, DEFAULT_INDEX_HTML)));
    if (!path.isAbsolute(config.srcIndexHtml)) {
        config.srcIndexHtml = normalizePath(path.join(config.rootDir, config.srcIndexHtml));
    }
    setStringConfig(config, 'wwwIndexHtml', normalizePath(path.join(config.wwwDir, DEFAULT_INDEX_HTML)));
    if (!path.isAbsolute(config.wwwIndexHtml)) {
        config.wwwIndexHtml = normalizePath(path.join(config.wwwDir, config.wwwIndexHtml));
    }
    if (config.writeLog) {
        setStringConfig(config, 'buildLogFilePath', DEFAULT_BUILD_LOG_FILE_NAME);
        if (!path.isAbsolute(config.buildLogFilePath)) {
            config.buildLogFilePath = normalizePath(path.join(config.rootDir, config.buildLogFilePath));
        }
        config.logger.buildLogFilePath = config.buildLogFilePath;
    }
    if (config.writeStats) {
        setStringConfig(config, 'buildStatsFilePath', DEFAULT_STATS_JSON_FILE_NAME);
        if (!path.isAbsolute(config.buildStatsFilePath)) {
            config.buildStatsFilePath = normalizePath(path.join(config.rootDir, config.buildStatsFilePath));
        }
    }
}
const DEFAULT_SRC_DIR = 'src';
const DEFAULT_WWW_DIR = 'www';
const DEFAULT_BUILD_DIR = 'build';
const DEFAULT_INDEX_HTML = 'index.html';
const DEFAULT_DIST_DIR = 'dist';
const DEFAULT_COLLECTION_DIR = 'collection';
const DEFAULT_TYPES_DIR = 'types';
const DEFAULT_TSCONFIG = 'tsconfig.json';
const DEFAULT_BUILD_LOG_FILE_NAME = 'stencil-build.log';
const DEFAULT_STATS_JSON_FILE_NAME = 'stencil-stats.json';

function validatePlugins(config) {
    config.plugins = (config.plugins || []).filter(p => !!p);
}

function validatePublicPath(config) {
    if (typeof config.discoverPublicPath !== 'boolean') {
        // only do this check if the config hasn't been fully validated yet
        // if the config has a publicPath, then let's remember it was a custom one
        config.discoverPublicPath = (typeof config.publicPath !== 'string');
    }
    if (typeof config.publicPath !== 'string') {
        // CLIENT SIDE ONLY! Do not use this for server-side file read/writes
        // this is a reference to the public static directory from the index.html running from a browser
        // in most cases it's just "build", as in index page would request scripts from `/build/`
        config.publicPath = normalizePath(config.sys.path.relative(config.wwwDir, config.buildDir));
        if (config.publicPath.charAt(0) !== '/') {
            // ensure prefix / by default
            config.publicPath = '/' + config.publicPath;
        }
    }
    config.publicPath = config.publicPath.trim();
    if (config.publicPath.charAt(config.publicPath.length - 1) !== '/') {
        // ensure there's a trailing /
        config.publicPath += '/';
    }
}

/**
 * DEPRECATED "config.collections" since 0.6.0, 2018-02-13
 */
function _deprecatedValidateConfigCollections(config) {
    if (Array.isArray(config.collections)) {
        config._deprecatedCollections = config.collections;
    }
    else {
        config._deprecatedCollections = [];
    }
    config._deprecatedCollections = config._deprecatedCollections.map(_deprecatedValidateConfigCollection);
    if (config._deprecatedCollections.length > 0) {
        const warningMsg = [
            `As of v0.6.0, "config.collections" has been deprecated in favor of standard ES module imports. `,
            `Instead of listing collections within the stencil config, collections should now be `,
            `imported by the app's root component or module. The benefit of this is to not only simplify `,
            `the config by using a standards approach for imports, but to also automatically import the `,
            `collection's types to improve development. Please remove "config.collections" `,
            `from the "stencil.config.js" file, and add `,
            config._deprecatedCollections.length === 1 ? `this import ` : `these imports `,
            `to your root component or root module:  `
        ];
        config._deprecatedCollections.forEach(collection => {
            warningMsg.push(`import '${collection.name}';  `);
        });
        config.logger.warn(warningMsg.join(''));
    }
}
function _deprecatedValidateConfigCollection(userInput) {
    if (!userInput || Array.isArray(userInput) || typeof userInput === 'number' || typeof userInput === 'boolean') {
        throw new Error(`invalid collection: ${userInput}`);
    }
    let configCollection;
    if (typeof userInput === 'string') {
        configCollection = {
            name: userInput
        };
    }
    else {
        configCollection = userInput;
    }
    if (!configCollection.name || typeof configCollection.name !== 'string' || configCollection.name.trim() === '') {
        throw new Error(`missing collection name`);
    }
    configCollection.name = configCollection.name.trim();
    return configCollection;
}

function validateBuildConfig(config, setEnvVariables) {
    if (!config) {
        throw new Error(`invalid build config`);
    }
    if (config._isValidated) {
        // don't bother if we've already validated this config
        return config;
    }
    if (!config.logger) {
        throw new Error(`config.logger required`);
    }
    if (!config.rootDir) {
        throw new Error('config.rootDir required');
    }
    if (!config.sys) {
        throw new Error('config.sys required');
    }
    if (typeof config.logLevel === 'string') {
        config.logger.level = config.logLevel;
    }
    else if (typeof config.logger.level === 'string') {
        config.logLevel = config.logger.level;
    }
    setBooleanConfig(config, 'writeLog', false);
    setBooleanConfig(config, 'writeStats', false);
    setBooleanConfig(config, 'buildAppCore', true);
    // get a good namespace
    validateNamespace(config);
    // figure out all of the config paths and absolute paths
    validatePaths(config);
    // figure out the client-side public path
    validatePublicPath(config);
    // default devMode false
    config.devMode = !!config.devMode;
    // default watch false
    config.watch = !!config.watch;
    setBooleanConfig(config, 'minifyCss', !config.devMode);
    setBooleanConfig(config, 'minifyJs', !config.devMode);
    config.logger.debug(`minifyJs: ${config.minifyJs}, minifyCss: ${config.minifyCss}`);
    setBooleanConfig(config, 'buildEs5', !config.devMode);
    setBooleanConfig(config, 'hashFileNames', !(config.devMode || config.watch));
    setNumberConfig(config, 'hashedFileNameLength', DEFAULT_HASHED_FILENAME_LENTH);
    if (config.hashFileNames) {
        if (config.hashedFileNameLength < MIN_HASHED_FILENAME_LENTH) {
            throw new Error(`config.hashedFileNameLength must be at least ${MIN_HASHED_FILENAME_LENTH} characters`);
        }
        if (config.hashedFileNameLength > MAX_HASHED_FILENAME_LENTH) {
            throw new Error(`config.hashedFileNameLength cannot be more than ${MAX_HASHED_FILENAME_LENTH} characters`);
        }
    }
    config.logger.debug(`hashFileNames: ${config.hashFileNames}, hashedFileNameLength: ${config.hashedFileNameLength}`);
    config.generateDistribution = !!config.generateDistribution;
    setBooleanConfig(config, 'generateWWW', true);
    validateCopy(config);
    validatePlugins(config);
    validateAssetVerioning(config);
    if (!config.watchIgnoredRegex) {
        config.watchIgnoredRegex = DEFAULT_WATCH_IGNORED_REGEX;
    }
    setStringConfig(config, 'hydratedCssClass', DEFAULT_HYDRATED_CSS_CLASS);
    setBooleanConfig(config, 'emptyDist', true);
    setBooleanConfig(config, 'emptyWWW', true);
    setBooleanConfig(config, 'generateDocs', false);
    setBooleanConfig(config, 'enableCache', true);
    if (!Array.isArray(config.includeSrc)) {
        config.includeSrc = DEFAULT_INCLUDES.map(include => {
            return config.sys.path.join(config.srcDir, include);
        });
    }
    if (!Array.isArray(config.excludeSrc)) {
        config.excludeSrc = DEFAULT_EXCLUDES.slice();
    }
    /**
     * DEPRECATED "config.collections" since 0.6.0, 2018-02-13
     */
    _deprecatedValidateConfigCollections(config);
    setArrayConfig(config, 'plugins');
    setArrayConfig(config, 'bundles');
    // set to true so it doesn't bother going through all this again on rebuilds
    config._isValidated = true;
    config.logger.debug(`validated build config`);
    if (setEnvVariables !== false) {
        setProcessEnvironment(config);
    }
    return config;
}
function setProcessEnvironment(config) {
    process.env.NODE_ENV = config.devMode ? 'development' : 'production';
}
const DEFAULT_HASHED_FILENAME_LENTH = 8;
const MIN_HASHED_FILENAME_LENTH = 4;
const MAX_HASHED_FILENAME_LENTH = 32;
const DEFAULT_INCLUDES = ['**/*.ts', '**/*.tsx'];
const DEFAULT_EXCLUDES = ['**/test/**', '**/*.spec.*'];
const DEFAULT_WATCH_IGNORED_REGEX = /(?:^|[\\\/])(\.(?!\.)[^\\\/]+)$/i;
const DEFAULT_HYDRATED_CSS_CLASS = 'hydrated';

function configFileReload(config, compilerCtx) {
    config.logger.debug(`reload config file: ${config.configPath}`);
    try {
        const updatedConfig = config.sys.loadConfigFile(config.configPath);
        // empty it out cuz we're gonna use the same object
        // but don't remove our keepers, we still need them
        for (const key in config) {
            if (!CONFIG_RELOAD_KEEPER_KEYS.includes(key)) {
                delete config[key];
            }
        }
        // fill it up with the newly loaded config
        // but don't touch our "keepers"
        for (const key in updatedConfig) {
            if (!CONFIG_RELOAD_KEEPER_KEYS.includes(key)) {
                config[key] = updatedConfig[key];
            }
        }
        // validate our new config data
        validateBuildConfig(config);
        // reset the compiler context cache
        resetCompilerCtx(compilerCtx);
    }
    catch (e) {
        config.logger.error(e);
    }
}
// stuff that should be constant between config updates
// implementing the Config interface to make sure we're
// using the correct keys, but the value doesn't matter here
const CONFIG_RELOAD_KEEPERS = {
    sys: null,
    logger: null,
    devMode: null,
    watch: null,
    generateDocs: null
};
const CONFIG_RELOAD_KEEPER_KEYS = Object.keys(CONFIG_RELOAD_KEEPERS);

function rebuild(config, compilerCtx, watcher) {
    // print out a pretty message about the changed files
    printWatcherMessage(config, watcher);
    if (watcher.configUpdated) {
        configFileReload(config, compilerCtx);
    }
    // kick off the rebuild
    return build(config, compilerCtx, watcher);
}
function printWatcherMessage(config, watcherResults) {
    const changedFiles = watcherResults.filesChanged;
    const totalChangedFiles = changedFiles.length;
    let msg = null;
    if (totalChangedFiles > 6) {
        const trimmedChangedFiles = changedFiles.slice(0, 5);
        const otherFilesTotal = totalChangedFiles - trimmedChangedFiles.length;
        msg = `changed files: ${trimmedChangedFiles.map(f => config.sys.path.basename(f)).join(', ')}`;
        if (otherFilesTotal > 0) {
            msg += `, +${otherFilesTotal} other${otherFilesTotal > 1 ? 's' : ''}`;
        }
    }
    else if (totalChangedFiles > 1) {
        msg = `changed files: ${changedFiles.map(f => config.sys.path.basename(f)).join(', ')}`;
    }
    else if (totalChangedFiles > 0) {
        msg = `changed file: ${changedFiles.map(f => config.sys.path.basename(f)).join(', ')}`;
    }
    else if (watcherResults.dirsAdded.length > 1) {
        msg = `added directories: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;
    }
    else if (watcherResults.dirsAdded.length > 0) {
        msg = `added directory: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;
    }
    else if (watcherResults.dirsDeleted.length > 1) {
        msg = `deleted directories: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;
    }
    else if (watcherResults.dirsDeleted.length > 0) {
        msg = `deleted directory: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;
    }
    if (msg != null) {
        config.logger.info(config.logger.cyan(msg));
    }
}

var __awaiter$20 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class WatcherListener {
    constructor(config, compilerCtx) {
        this.config = config;
        this.compilerCtx = compilerCtx;
        this.configUpdated = false;
        this.recentChanges = [];
        this.resetWatcher();
    }
    subscribe() {
        this.compilerCtx.events.subscribe('fileUpdate', this.fileUpdate.bind(this));
        this.compilerCtx.events.subscribe('fileAdd', this.fileAdd.bind(this));
        this.compilerCtx.events.subscribe('fileDelete', this.fileDelete.bind(this));
        this.compilerCtx.events.subscribe('dirAdd', this.dirAdd.bind(this));
        this.compilerCtx.events.subscribe('dirDelete', this.dirDelete.bind(this));
    }
    fileUpdate(path) {
        return __awaiter$20(this, void 0, void 0, function* () {
            try {
                path = normalizePath(path);
                this.config.logger.debug(`watcher, fileUpdate: ${path}, ${Date.now()}`);
                if (path === this.config.configPath) {
                    // the actual stencil config file changed
                    // this is a big deal, so do a full rebuild
                    this.configUpdated = true;
                    if (!this.filesUpdated.includes(path)) {
                        this.filesUpdated.push(path);
                    }
                    this.queue(path);
                }
                else if (isCopyTaskFile(this.config, path)) {
                    this.queueCopyTasks();
                }
                if (isWebDevFileToWatch(path)) {
                    // read the file, but without using
                    // the cache so we get the latest change
                    yield this.compilerCtx.fs.readFile(path, { useCache: false });
                    // web dev file was updaed
                    // queue change build
                    if (!this.filesUpdated.includes(path)) {
                        this.filesUpdated.push(path);
                    }
                    this.queue(path);
                }
                else {
                    // always clear the cache if it wasn't a web dev file
                    this.compilerCtx.fs.clearFileCache(path);
                    this.config.logger.debug(`clear file cache: ${path}`);
                }
            }
            catch (e) {
                this.config.logger.error(`watcher, fileUpdate`, e);
            }
        });
    }
    fileAdd(path) {
        return __awaiter$20(this, void 0, void 0, function* () {
            try {
                path = normalizePath(path);
                this.config.logger.debug(`watcher, fileAdd: ${path}, ${Date.now()}`);
                if (isCopyTaskFile(this.config, path)) {
                    this.queueCopyTasks();
                }
                if (isWebDevFileToWatch(path)) {
                    // read the file, but without using
                    // the cache so we get the latest change
                    yield this.compilerCtx.fs.readFile(path, { useCache: false });
                    // new web dev file was added
                    if (!this.filesAdded.includes(path)) {
                        this.filesAdded.push(path);
                    }
                    this.queue(path);
                }
                else {
                    // always clear the cache if it wasn't a web dev file
                    this.compilerCtx.fs.clearFileCache(path);
                    this.config.logger.debug(`clear file cache: ${path}`);
                }
            }
            catch (e) {
                this.config.logger.error(`watcher, fileAdd`, e);
            }
        });
    }
    fileDelete(path) {
        try {
            path = normalizePath(path);
            this.config.logger.debug(`watcher, fileDelete: ${path}, ${Date.now()}`);
            // clear this file's cache
            this.compilerCtx.fs.clearFileCache(path);
            if (isCopyTaskFile(this.config, path)) {
                this.queueCopyTasks();
            }
            if (isWebDevFileToWatch(path)) {
                // web dev file was delete
                if (!this.filesDeleted.includes(path)) {
                    this.filesDeleted.push(path);
                }
                this.queue(path);
            }
        }
        catch (e) {
            this.config.logger.error(`watcher, fileDelete`, e);
        }
    }
    dirAdd(path) {
        return __awaiter$20(this, void 0, void 0, function* () {
            try {
                path = normalizePath(path);
                this.config.logger.debug(`watcher, dirAdd: ${path}, ${Date.now()}`);
                // clear this directory's cache for good measure
                this.compilerCtx.fs.clearDirCache(path);
                if (isCopyTaskFile(this.config, path)) {
                    this.queueCopyTasks();
                }
                else {
                    // recursively drill down and get all of the
                    // files paths that were just added
                    const addedItems = yield this.compilerCtx.fs.readdir(path, { recursive: true });
                    addedItems.forEach(item => {
                        if (!this.filesAdded.includes(item.absPath)) {
                            this.filesAdded.push(item.absPath);
                        }
                    });
                    this.dirsAdded.push(path);
                    this.queue(path);
                }
            }
            catch (e) {
                this.config.logger.error(`watcher, dirAdd`, e);
            }
        });
    }
    dirDelete(path) {
        return __awaiter$20(this, void 0, void 0, function* () {
            try {
                path = normalizePath(path);
                this.config.logger.debug(`watcher, dirDelete: ${path}, ${Date.now()}`);
                // clear this directory's cache
                this.compilerCtx.fs.clearDirCache(path);
                if (isCopyTaskFile(this.config, path)) {
                    this.queueCopyTasks();
                }
                else {
                    if (!this.dirsDeleted.includes(path)) {
                        this.dirsDeleted.push(path);
                    }
                    this.queue(path);
                }
            }
            catch (e) {
                this.config.logger.error(`watcher, dirDelete`, e);
            }
        });
    }
    startRebuild() {
        try {
            // create a copy of all that we've learned today
            const watcher = this.generateWatcherResults();
            // reset the watcher data for next time
            this.resetWatcher();
            if (shouldRebuild(watcher)) {
                // kick off the rebuild
                rebuild(this.config, this.compilerCtx, watcher);
            }
        }
        catch (e) {
            this.config.logger.error(`watcher, startRebuild`, e);
        }
    }
    generateWatcherResults() {
        const watcher = {
            dirsAdded: this.dirsAdded.slice(),
            dirsDeleted: this.dirsDeleted.slice(),
            filesAdded: this.filesAdded.slice(),
            filesDeleted: this.filesDeleted.slice(),
            filesUpdated: this.filesUpdated.slice(),
            filesChanged: this.filesUpdated.concat(this.filesAdded, this.filesDeleted),
            configUpdated: this.configUpdated
        };
        return watcher;
    }
    queue(path) {
        this.recentChanges = this.recentChanges.filter(rc => {
            // only keep changes that happened in the last XX milliseconds
            return (Date.now() - 2000) < rc.timestamp;
        });
        if (this.recentChanges.some(rc => rc.filePath === path)) {
            // we already kicked off a build for this path
            // within the last XX milliseconds, let's just ignore the subsequent changes
            this.config.logger.debug(`skipping recent subsequent file change: ${path}`);
            return;
        }
        // debounce builds
        clearTimeout(this.watchTmr);
        this.recentChanges.push({
            filePath: path,
            timestamp: Date.now()
        });
        this.watchTmr = setTimeout(() => {
            this.startRebuild();
        }, 20);
    }
    queueCopyTasks() {
        clearTimeout(this.copyTaskTmr);
        this.copyTaskTmr = setTimeout(() => __awaiter$20(this, void 0, void 0, function* () {
            yield copyTasks(this.config, this.compilerCtx, [], true);
        }), 100);
    }
    resetWatcher() {
        this.dirsAdded = [];
        this.dirsDeleted = [];
        this.filesAdded = [];
        this.filesDeleted = [];
        this.filesUpdated = [];
        this.configUpdated = false;
    }
}
function shouldRebuild(watcher) {
    return watcher.configUpdated ||
        watcher.dirsAdded.length > 0 ||
        watcher.dirsDeleted.length > 0 ||
        watcher.filesAdded.length > 0 ||
        watcher.filesDeleted.length > 0 ||
        watcher.filesUpdated.length > 0;
}
function isWebDevFileToWatch(filePath) {
    // ts, tsx, css, scss, js, html
    // but don't worry about jpg, png, gif, svgs
    // also don't bother rebuilds when the components.d.ts file gets updated
    return isWebDevFile(filePath) || (isDtsFile(filePath) && filePath.indexOf(COMPONENTS_DTS) === -1);
}

function initWatcher(config, compilerCtx) {
    // only create the watcher if this is a watch build
    // and we haven't created a watch listener already
    if (compilerCtx.hasWatcher || !config.watch) {
        return false;
    }
    config.logger.debug(`initWatcher: ${config.srcDir}`);
    const watcherListener = new WatcherListener(config, compilerCtx);
    watcherListener.subscribe();
    compilerCtx.hasWatcher = true;
    if (config.sys.createWatcher) {
        const watcher = config.sys.createWatcher(compilerCtx.events, config.srcDir, {
            ignored: config.watchIgnoredRegex,
            ignoreInitial: true
        });
        if (watcher && config.configPath) {
            config.configPath = normalizePath(config.configPath);
            config.logger.debug(`watch configPath: ${config.configPath}`);
            watcher.add(config.configPath);
        }
    }
    return true;
}

var __awaiter$21 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getBuildContext(config, compilerCtx, watcher) {
    // do a full build if there is no watcher
    // or the watcher said the config has updated
    // or we've never had a successful build yet
    const requiresFullBuild = !watcher || watcher.configUpdated || !compilerCtx.hasSuccessfulBuild;
    const isRebuild = !!watcher;
    compilerCtx.isRebuild = isRebuild;
    const msg = `${isRebuild ? 'rebuild' : 'build'}, ${config.fsNamespace}, ${config.devMode ? 'dev' : 'prod'} mode, started`;
    // increment the active build id
    compilerCtx.activeBuildId++;
    // data for one build
    const buildCtx = {
        requiresFullBuild: requiresFullBuild,
        buildId: compilerCtx.activeBuildId,
        componentRefs: [],
        collections: [],
        moduleGraphs: [],
        diagnostics: [],
        entryPoints: [],
        entryModules: [],
        components: [],
        data: {},
        transpileBuildCount: 0,
        bundleBuildCount: 0,
        appFileBuildCount: 0,
        indexBuildCount: 0,
        aborted: false,
        startTime: Date.now(),
        timeSpan: config.logger.createTimeSpan(msg),
        hasChangedJsText: false,
        filesWritten: [],
        filesChanged: watcher ? watcher.filesChanged : [],
        filesUpdated: watcher ? watcher.filesUpdated : [],
        filesAdded: watcher ? watcher.filesAdded : [],
        filesDeleted: watcher ? watcher.filesDeleted : [],
        dirsDeleted: watcher ? watcher.dirsDeleted : [],
        dirsAdded: watcher ? watcher.dirsAdded : []
    };
    buildCtx.shouldAbort = () => {
        return shouldAbort(compilerCtx, buildCtx);
    };
    buildCtx.finish = () => __awaiter$21(this, void 0, void 0, function* () {
        try {
            // setup watcher if need be
            initWatcher(config, compilerCtx);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
        return finishBuild(config, compilerCtx, buildCtx);
    });
    if (watcher) {
        Object.keys(watcher).forEach(key => {
            watcher[key] = {};
        });
    }
    return buildCtx;
}
function finishBuild(config, compilerCtx, buildCtx) {
    return __awaiter$21(this, void 0, void 0, function* () {
        const buildResults = generateBuildResults(config, compilerCtx, buildCtx);
        // log any errors/warnings
        config.logger.printDiagnostics(buildResults.diagnostics);
        // create a nice pretty message stating what happend
        const buildText = compilerCtx.isRebuild ? 'rebuild' : 'build';
        let watchText = config.watch ? ', watching for changes...' : '';
        let buildStatus = 'finished';
        let statusColor = 'green';
        let bold = true;
        if (buildResults.hasError) {
            compilerCtx.lastBuildHadError = true;
            buildStatus = 'failed';
            statusColor = 'red';
        }
        else if (buildResults.aborted) {
            buildStatus = 'aborted';
            watchText = '';
            statusColor = 'dim';
            bold = false;
        }
        else {
            compilerCtx.hasSuccessfulBuild = true;
            compilerCtx.lastBuildHadError = false;
        }
        // print out the time it took to build
        // and add the duration to the build results
        buildCtx.timeSpan.finish(`${buildText} ${buildStatus}${watchText}`, statusColor, bold, true);
        // write the build stats
        yield generateBuildStats(config, compilerCtx, buildCtx, buildResults);
        // clear it all out for good measure
        for (const k in buildCtx) {
            buildCtx[k] = null;
        }
        // write all of our logs to disk if config'd to do so
        config.logger.writeLogs(compilerCtx.isRebuild);
        // emit a build event, which happens for inital build and rebuilds
        compilerCtx.events.emit('build', buildResults);
        if (compilerCtx.isRebuild) {
            // emit a rebuild event, which happens only for rebuilds
            compilerCtx.events.emit('rebuild', buildResults);
        }
        return buildResults;
    });
}
function shouldAbort(ctx, buildCtx) {
    if (ctx.activeBuildId > buildCtx.buildId || buildCtx.aborted) {
        buildCtx.aborted = true;
        return true;
    }
    if (hasError(buildCtx.diagnostics)) {
        // remember if the last build had an error or not
        // this is useful if the next build should do a full build or not
        ctx.lastBuildHadError = true;
        buildCtx.aborted = true;
        return true;
    }
    return false;
}

var __awaiter$22 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function createAppRegistry(config) {
    // create the shared app registry object
    const appRegistry = {
        namespace: config.namespace,
        fsNamespace: config.fsNamespace,
        loader: `../${getLoaderFileName(config)}`
    };
    return appRegistry;
}
function getAppRegistry(config, ctx) {
    const registryJsonFilePath = getRegistryJsonWWW(config);
    let appRegistry;
    try {
        // open up the app registry json file
        const appRegistryJson = ctx.fs.readFileSync(registryJsonFilePath);
        // parse the json into app registry data
        appRegistry = JSON.parse(appRegistryJson);
        config.logger.debug(`parsed app registry: ${registryJsonFilePath}`);
    }
    catch (e) {
        throw new Error(`Error parsing app registry, ${registryJsonFilePath}: ${e}`);
    }
    return appRegistry;
}
function serializeComponentRegistry(cmpRegistry) {
    const appRegistryComponents = {};
    Object.keys(cmpRegistry).sort().forEach(tagName => {
        appRegistryComponents[tagName] = cmpRegistry[tagName].bundleIds;
    });
    return appRegistryComponents;
}
function writeAppRegistry(config, ctx, appRegistry, cmpRegistry) {
    return __awaiter$22(this, void 0, void 0, function* () {
        if (!config.generateWWW) {
            // only create a registry for www builds
            return;
        }
        appRegistry.components = serializeComponentRegistry(cmpRegistry);
        const registryJson = JSON.stringify(appRegistry, null, 2);
        // cache so we can check if it changed on rebuilds
        ctx.appFiles.registryJson = registryJson;
        const appRegistryWWW = getRegistryJsonWWW(config);
        config.logger.debug(`build, app www registry: ${appRegistryWWW}`);
        yield ctx.fs.writeFile(appRegistryWWW, registryJson);
    });
}

function buildConditionalsTransform(coreBuild) {
    return (transformContext) => {
        function visitPropertyAccessExpression(node) {
            let variableName = node.getText();
            if (!variableName.startsWith('Build.')) {
                return node;
            }
            variableName = variableName.split('.')[1];
            if (!variableName) {
                return node;
            }
            if (coreBuild[variableName]) {
                return ts.createTrue();
            }
            return ts.createFalse();
        }
        function visit(node) {
            switch (node.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                    return visitPropertyAccessExpression(node);
                default:
                    return ts.visitEachChild(node, (node) => {
                        return visit(node);
                    }, transformContext);
            }
        }
        return (tsSourceFile) => {
            return visit(tsSourceFile);
        };
    };
}

/**
 * Ok, so formatting overkill, we know. But whatever, it makes for great
 * error reporting within a terminal. So, yeah, let's code it up, shall we?
 */
function loadTypeScriptDiagnostics(rootDir, resultsDiagnostics, tsDiagnostics) {
    const maxErrors = Math.min(tsDiagnostics.length, MAX_ERRORS);
    for (var i = 0; i < maxErrors; i++) {
        resultsDiagnostics.push(loadDiagnostic(rootDir, tsDiagnostics[i]));
    }
}
function loadDiagnostic(rootDir, tsDiagnostic) {
    const d = {
        level: 'error',
        type: 'typescript',
        language: 'typescript',
        header: 'typescript error',
        code: tsDiagnostic.code.toString(),
        messageText: ts.flattenDiagnosticMessageText(tsDiagnostic.messageText, '\n'),
        relFilePath: null,
        absFilePath: null,
        lines: []
    };
    if (tsDiagnostic.file) {
        d.absFilePath = tsDiagnostic.file.fileName;
        d.relFilePath = formatFileName(rootDir, d.absFilePath);
        let sourceText = tsDiagnostic.file.getText();
        let srcLines = splitLineBreaks(sourceText);
        let htmlLines = srcLines;
        try {
            htmlLines = splitLineBreaks(highlight(d.language, sourceText, true).value);
        }
        catch (e) { }
        const posData = tsDiagnostic.file.getLineAndCharacterOfPosition(tsDiagnostic.start);
        const errorLine = {
            lineIndex: posData.line,
            lineNumber: posData.line + 1,
            text: srcLines[posData.line],
            html: htmlLines[posData.line],
            errorCharStart: posData.character,
            errorLength: Math.max(tsDiagnostic.length, 1)
        };
        if (errorLine.html && errorLine.html.indexOf('class="hljs') === -1) {
            try {
                errorLine.html = highlight(d.language, errorLine.text, true).value;
            }
            catch (e) { }
        }
        d.lines.push(errorLine);
        if (errorLine.errorLength === 0 && errorLine.errorCharStart > 0) {
            errorLine.errorLength = 1;
            errorLine.errorCharStart--;
        }
        d.header = formatHeader('typescript', tsDiagnostic.file.fileName, rootDir, errorLine.lineNumber);
        if (errorLine.lineIndex > 0) {
            const previousLine = {
                lineIndex: errorLine.lineIndex - 1,
                lineNumber: errorLine.lineNumber - 1,
                text: srcLines[errorLine.lineIndex - 1],
                html: htmlLines[errorLine.lineIndex - 1],
                errorCharStart: -1,
                errorLength: -1
            };
            if (previousLine.html && previousLine.html.indexOf('class="hljs') === -1) {
                try {
                    previousLine.html = highlight(d.language, previousLine.text, true).value;
                }
                catch (e) { }
            }
            d.lines.unshift(previousLine);
        }
        if (errorLine.lineIndex + 1 < srcLines.length) {
            const nextLine = {
                lineIndex: errorLine.lineIndex + 1,
                lineNumber: errorLine.lineNumber + 1,
                text: srcLines[errorLine.lineIndex + 1],
                html: htmlLines[errorLine.lineIndex + 1],
                errorCharStart: -1,
                errorLength: -1
            };
            if (nextLine.html && nextLine.html.indexOf('class="hljs') === -1) {
                try {
                    nextLine.html = highlight(d.language, nextLine.text, true).value;
                }
                catch (e) { }
            }
            d.lines.push(nextLine);
        }
    }
    return d;
}

var __awaiter$23 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function transpileCoreBuild(compilerCtx, coreBuild, input) {
    return __awaiter$23(this, void 0, void 0, function* () {
        const results = {
            code: null,
            diagnostics: null
        };
        const cacheKey = compilerCtx.cache.createKey('transpileCoreBuild', coreBuild, input);
        const cachedContent = yield compilerCtx.cache.get(cacheKey);
        if (cachedContent != null) {
            results.code = cachedContent;
            results.diagnostics = [];
            return results;
        }
        const diagnostics = [];
        const transpileOpts = {
            compilerOptions: getCompilerOptions(coreBuild),
            transformers: {
                before: [
                    buildConditionalsTransform(coreBuild)
                ]
            }
        };
        const tsResults = ts.transpileModule(input, transpileOpts);
        loadTypeScriptDiagnostics('', diagnostics, tsResults.diagnostics);
        if (diagnostics.length) {
            results.diagnostics = diagnostics;
            results.code = input;
            return results;
        }
        results.code = tsResults.outputText;
        yield compilerCtx.cache.put(cacheKey, results.code);
        return results;
    });
}
function transpileToEs5(compilerCtx, input) {
    return __awaiter$23(this, void 0, void 0, function* () {
        const diagnostics = [];
        const results = {
            code: null,
            diagnostics: null
        };
        const cacheKey = compilerCtx.cache.createKey('transpileToEs5', input);
        const cachedContent = yield compilerCtx.cache.get(cacheKey);
        if (cachedContent != null) {
            results.code = cachedContent;
            results.diagnostics = [];
            return results;
        }
        const transpileOpts = {
            compilerOptions: {
                allowJs: true,
                declaration: false,
                target: ts.ScriptTarget.ES5
            }
        };
        const tsResults = ts.transpileModule(input, transpileOpts);
        loadTypeScriptDiagnostics('', diagnostics, tsResults.diagnostics);
        if (diagnostics.length > 0) {
            results.diagnostics = diagnostics;
            results.code = input;
            return results;
        }
        results.code = tsResults.outputText;
        yield compilerCtx.cache.put(cacheKey, results.code);
        return results;
    });
}
function getCompilerOptions(coreBuild) {
    const opts = {
        allowJs: true,
        declaration: false
    };
    if (coreBuild.es5) {
        opts.target = ts.ScriptTarget.ES5;
    }
    else {
        opts.target = ts.ScriptTarget.ES2015;
    }
    return opts;
}

var __awaiter$24 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateAppGlobalScript(config, compilerCtx, buildCtx, appRegistry, sourceTarget) {
    return __awaiter$24(this, void 0, void 0, function* () {
        const globalJsContents = yield generateAppGlobalContents(config, compilerCtx, buildCtx, sourceTarget);
        if (globalJsContents.length) {
            appRegistry.global = getGlobalFileName(config);
            const globalJsContent = generateGlobalJs(config, globalJsContents);
            compilerCtx.appFiles.global = globalJsContent;
            if (config.generateWWW) {
                const appGlobalWWWFilePath = getGlobalWWW(config);
                config.logger.debug(`build, app global www: ${appGlobalWWWFilePath}`);
                yield compilerCtx.fs.writeFile(appGlobalWWWFilePath, globalJsContent);
            }
            if (config.generateDistribution) {
                const appGlobalDistFilePath = getGlobalDist(config);
                config.logger.debug(`build, app global dist: ${appGlobalDistFilePath}`);
                yield compilerCtx.fs.writeFile(appGlobalDistFilePath, globalJsContent);
            }
        }
        return globalJsContents.join('\n').trim();
    });
}
function generateAppGlobalContents(config, compilerCtx, buildCtx, sourceTarget) {
    return __awaiter$24(this, void 0, void 0, function* () {
        let globalJsContents = [];
        const results = yield Promise.all([
            loadDependentGlobalJsContents(config, compilerCtx, buildCtx, sourceTarget),
            bundleProjectGlobal(config, compilerCtx, buildCtx, sourceTarget, config.namespace, config.globalScript)
        ]);
        const dependentGlobalJsContents = results[0];
        const projectGlobalJsContent = results[1];
        globalJsContents = globalJsContents.concat(dependentGlobalJsContents);
        if (projectGlobalJsContent) {
            globalJsContents.push(projectGlobalJsContent);
        }
        return globalJsContents;
    });
}
function loadDependentGlobalJsContents(config, compilerCtx, buildCtx, sourceTarget) {
    return __awaiter$24(this, void 0, void 0, function* () {
        const collections = compilerCtx.collections.filter(m => m.global && m.global.jsFilePath);
        return Promise.all(collections.map(collectionManifest => {
            return bundleProjectGlobal(config, compilerCtx, buildCtx, sourceTarget, collectionManifest.collectionName, collectionManifest.global.jsFilePath);
        }));
    });
}
function bundleProjectGlobal(config, compilerCtx, buildCtx, sourceTarget, namespace, entry) {
    return __awaiter$24(this, void 0, void 0, function* () {
        // stencil by itself does not have a global file
        // however, other collections can provide a global js
        // which will bundle whatever is in the global, and then
        // prepend the output content on top of the core js
        // this way external collections can provide a shared global at runtime
        if (!entry) {
            // looks like they never provided an entry file, which is fine, so let's skip this
            return null;
        }
        const cacheKey = compilerCtx.cache.createKey('bundleProjectGlobal', namespace, entry, sourceTarget);
        const cachedContent = yield compilerCtx.cache.get(cacheKey);
        if (cachedContent != null) {
            buildCtx.global = compilerCtx.moduleFiles[config.globalScript];
            return cachedContent;
        }
        // ok, so the project also provided an entry file, so let's bundle it up and
        // the output from this can be tacked onto the top of the project's core file
        // start the bundler on our temporary file
        let output = '';
        try {
            const rollup$$1 = yield config.sys.rollup.rollup({
                input: entry,
                plugins: [
                    resolveCollections(compilerCtx),
                    config.sys.rollup.plugins.nodeResolve({
                        jsnext: true,
                        main: true
                    }),
                    config.sys.rollup.plugins.commonjs({
                        include: 'node_modules/**',
                        sourceMap: false
                    }),
                    inMemoryFsRead(config, compilerCtx),
                    ...config.plugins
                ],
                onwarn: createOnWarnFn(config, buildCtx.diagnostics)
            });
            const results = yield rollup$$1.generate({ format: 'es' });
            // cool, so we balled up all of the globals into one string
            // replace build time expressions, like process.env.NODE_ENV === 'production'
            // with a hard coded boolean
            results.code = buildExpressionReplacer(config, results.code);
            // wrap our globals code with our own iife
            output = yield wrapGlobalJs(config, compilerCtx, buildCtx, sourceTarget, namespace, results.code);
            yield compilerCtx.cache.put(cacheKey, output);
            buildCtx.global = compilerCtx.moduleFiles[config.globalScript];
        }
        catch (e) {
            loadRollupDiagnostics(config, compilerCtx, buildCtx, e);
        }
        return output;
    });
}
function wrapGlobalJs(config, compilerCtx, buildCtx, sourceTarget, globalJsName, jsContent) {
    return __awaiter$24(this, void 0, void 0, function* () {
        jsContent = (jsContent || '').trim();
        // just format it a touch better in dev mode
        jsContent = `\n/** ${globalJsName || ''} global **/\n\n${jsContent}`;
        const lines = jsContent.split(/\r?\n/);
        jsContent = lines.map(line => {
            if (line.length) {
                return '    ' + line;
            }
            return line;
        }).join('\n');
        if (sourceTarget === 'es5') {
            // global could already be in es2015
            // transpile it down to es5
            config.logger.debug(`transpile global to es5: ${globalJsName}`);
            const transpileResults = yield transpileToEs5(compilerCtx, jsContent);
            if (transpileResults.diagnostics && transpileResults.diagnostics.length) {
                buildCtx.diagnostics.push(...transpileResults.diagnostics);
            }
            else {
                jsContent = transpileResults.code;
            }
        }
        if (config.minifyJs) {
            const minifyResults = yield minifyJs(config, compilerCtx, jsContent, sourceTarget, false);
            if (minifyResults.diagnostics && minifyResults.diagnostics.length) {
                buildCtx.diagnostics.push(...minifyResults.diagnostics);
            }
            else {
                jsContent = minifyResults.output;
            }
        }
        return `\n(function(publicPath){${jsContent}\n})(publicPath);\n`;
    });
}
function generateGlobalJs(config, globalJsContents) {
    const publicPath = getAppPublicPath(config);
    const output = [
        generatePreamble(config) + '\n',
        `(function(appNamespace,publicPath){`,
        `"use strict";\n`,
        globalJsContents.join('\n').trim(),
        `\n})("${config.namespace}","${publicPath}");`
    ].join('');
    return output;
}

/**
 * Properties which must not be property renamed during minification
 */
const RESERVED_PROPERTIES = [
    'addListener',
    'attr',
    'color',
    'Context',
    'dom',
    'emit',
    'enableListener',
    'eventNameFn',
    'h',
    'initialized',
    'isClient',
    'isPrerender',
    'isServer',
    'loaded',
    'mode',
    'namespace',
    'publicPath',
    'raf',
    'read',
    'ref',
    'write',
    '$definedCmps',
    /**
     * App Global - window.App
     * Properties which get added to the app's global
     */
    'components',
    'loadBundle',
    'loadStyles',
    /**
     * Host Element
     * Properties set on the host element
     */
    '$activeLoading',
    '$defaultHolder',
    '$initLoad',
    '$rendered',
    '$onRender',
    '$',
    'componentOnReady',
    /**
     * Component Constructor static properties
     */
    'attr',
    'connect',
    'context',
    'elementRef',
    'encapsulation',
    'events',
    'host',
    'is',
    'method',
    'mutable',
    'properties',
    'state',
    'style',
    'styleMode',
    'type',
    'watchCallbacks',
    /**
     * Component Instance
     * Methods set on the user's component
     */
    'componentWillLoad',
    'componentDidLoad',
    'componentWillUpdate',
    'componentDidUpdate',
    'componentDidUnload',
    'forceUpdate',
    'hostData',
    'render',
    /**
     * Web Standards / DOM
     */
    'add',
    'addEventListener',
    'appendChild',
    'async',
    'attachShadow',
    'attributeChangedCallback',
    'body',
    'bubbles',
    'cancelable',
    'capture',
    'charset',
    'childNodes',
    'class',
    'classList',
    'className',
    'cloneNode',
    'composed',
    'connectedCallback',
    'content',
    'createComment',
    'createElement',
    'createElementNS',
    'createEvent',
    'createTextNode',
    'CSS',
    'customElements',
    'CustomEvent',
    'defaultView',
    'define',
    'detail',
    'didTimeout',
    'disconnect',
    'disconnectedCallback',
    'dispatchEvent',
    'document',
    'documentElement',
    'Element',
    'error',
    'Event',
    'fetch',
    'firstElementChild',
    'getAttribute',
    'getAttributeNS',
    'getRootNode',
    'getStyle',
    'head',
    'host',
    'href',
    'id',
    'initCustomEvent',
    'innerHTML',
    'insertBefore',
    'location',
    'log',
    'keyCode',
    'match',
    'matches',
    'matchesSelector',
    'matchMedia',
    'mozMatchesSelector',
    'msMatchesSelector',
    'navigator',
    'nextSibling',
    'nodeType',
    'now',
    'observe',
    'observedAttributes',
    'onerror',
    'onload',
    'ownerDocument',
    'parentElement',
    'parentNode',
    'passive',
    'pathname',
    'performance',
    'previousSibling',
    'querySelector',
    'querySelectorAll',
    'remove',
    'removeAttribute',
    'removeAttributeNS',
    'removeChild',
    'removeEventListener',
    'requestAnimationFrame',
    'requestIdleCallback',
    'search',
    'setAttribute',
    'setAttributeNS',
    'shadowRoot',
    'src',
    'style',
    'supports',
    'tagName',
    'text',
    'textContent',
    'timeRemaining',
    'warn',
    'webkitMatchesSelector',
    'window'
];

var __awaiter$25 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function buildCoreContent(config, compilerCtx, buildCtx, coreBuild, coreContent) {
    return __awaiter$25(this, void 0, void 0, function* () {
        const timespan = config.logger.createTimeSpan(`buildCoreContent ${coreBuild.coreId} start`, true);
        const transpileResults = yield transpileCoreBuild(compilerCtx, coreBuild, coreContent);
        if (transpileResults.diagnostics && transpileResults.diagnostics.length) {
            buildCtx.diagnostics.push(...transpileResults.diagnostics);
            return coreContent;
        }
        coreContent = transpileResults.code;
        const sourceTarget = coreBuild.es5 ? 'es5' : 'es2015';
        const minifyResults = yield minifyCore(config, compilerCtx, sourceTarget, coreContent);
        if (minifyResults.diagnostics && minifyResults.diagnostics.length) {
            buildCtx.diagnostics.push(...minifyResults.diagnostics);
            return coreContent;
        }
        timespan.finish(`buildCoreContent ${coreBuild.coreId} finished`);
        return minifyResults.output;
    });
}
function minifyCore(config, compilerCtx, sourceTarget, input) {
    return __awaiter$25(this, void 0, void 0, function* () {
        const opts = Object.assign({}, config.minifyJs ? PROD_MINIFY_OPTS : DEV_MINIFY_OPTS);
        if (sourceTarget === 'es5') {
            opts.ecma = 5;
            opts.output.ecma = 5;
            opts.compress.ecma = 5;
            opts.compress.arrows = false;
        }
        opts.compress.toplevel = true;
        if (config.minifyJs) {
            if (sourceTarget !== 'es5') {
                opts.compress.arrows = true;
            }
            // reserved properties is a list of properties to NOT rename
            // if something works in dev, but a runtime error in prod
            // chances are we need to add a property to this list
            opts.mangle.properties.reserved = RESERVED_PROPERTIES.slice();
            if (config.logLevel === 'debug') {
                // if in debug mode, still mangle the property names
                // but at least make them readable of what the
                // properties originally were named
                opts.mangle.properties.debug = true;
                opts.mangle.keep_fnames = true;
                opts.compress.drop_console = false;
                opts.compress.drop_debugger = false;
                opts.output.beautify = true;
                opts.output.bracketize = true;
                opts.output.indent_level = 2;
                opts.output.comments = 'all';
                opts.output.preserve_line = true;
            }
        }
        const cacheKey = compilerCtx.cache.createKey('minifyCore', opts, input);
        const cachedContent = yield compilerCtx.cache.get(cacheKey);
        if (cachedContent != null) {
            return {
                output: cachedContent,
                diagnostics: []
            };
        }
        const results = config.sys.minifyJs(input, opts);
        if (results && results.diagnostics.length === 0) {
            yield compilerCtx.cache.put(cacheKey, results.output);
        }
        return results;
    });
}
// Documentation of uglify options: https://github.com/mishoo/UglifyJS2
const DEV_MINIFY_OPTS = {
    compress: {
        arrows: false,
        booleans: false,
        collapse_vars: false,
        comparisons: false,
        conditionals: true,
        dead_code: true,
        drop_console: false,
        drop_debugger: false,
        evaluate: true,
        expression: false,
        hoist_funs: false,
        hoist_vars: false,
        ie8: false,
        if_return: false,
        inline: false,
        join_vars: false,
        keep_fargs: true,
        keep_fnames: true,
        keep_infinity: true,
        loops: false,
        negate_iife: false,
        passes: 1,
        properties: true,
        pure_funcs: null,
        pure_getters: false,
        reduce_vars: false,
        sequences: false,
        side_effects: false,
        switches: false,
        typeofs: false,
        top_retain: false,
        unsafe: false,
        unsafe_arrows: false,
        unsafe_comps: false,
        unsafe_Function: false,
        unsafe_math: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        unused: true,
        warnings: false
    },
    mangle: false,
    output: {
        ascii_only: false,
        beautify: true,
        bracketize: true,
        comments: 'all',
        ie8: false,
        indent_level: 2,
        indent_start: 0,
        inline_script: true,
        keep_quoted_props: true,
        max_line_len: false,
        preamble: null,
        preserve_line: true,
        quote_keys: false,
        quote_style: 1,
        semicolons: true,
        shebang: true,
        source_map: null,
        webkit: false,
        width: 80,
        wrap_iife: false
    }
};
const PROD_MINIFY_OPTS = {
    compress: {
        arrows: false,
        booleans: true,
        collapse_vars: true,
        comparisons: true,
        conditionals: true,
        dead_code: true,
        drop_console: true,
        drop_debugger: true,
        evaluate: true,
        expression: true,
        hoist_funs: true,
        hoist_vars: false,
        ie8: false,
        if_return: true,
        inline: true,
        join_vars: true,
        keep_fargs: true,
        keep_fnames: true,
        keep_infinity: true,
        loops: true,
        negate_iife: false,
        passes: 2,
        properties: true,
        pure_funcs: null,
        pure_getters: false,
        reduce_vars: true,
        sequences: true,
        side_effects: true,
        switches: true,
        typeofs: true,
        unsafe: false,
        unsafe_arrows: false,
        unsafe_comps: false,
        unsafe_Function: false,
        unsafe_math: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        unused: true,
        warnings: false
    },
    mangle: {
        properties: {
            builtins: false,
            debug: false,
            keep_quoted: true
        }
    },
    output: {
        ascii_only: false,
        beautify: false,
        bracketize: false,
        comments: false,
        ie8: false,
        indent_level: 0,
        indent_start: 0,
        inline_script: false,
        keep_quoted_props: false,
        max_line_len: false,
        preamble: null,
        preserve_line: false,
        quote_keys: false,
        quote_style: 0,
        semicolons: true,
        shebang: true,
        source_map: null,
        webkit: false,
        width: 80,
        wrap_iife: false
    }
};

var __awaiter$26 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getAppCorePolyfills(config) {
    return __awaiter$26(this, void 0, void 0, function* () {
        // first load up all of the polyfill content
        const readFilePromises = POLYFILLS.map(polyfillFile => {
            const staticName = config.sys.path.join('polyfills', polyfillFile);
            return config.sys.getClientCoreFile({ staticName: staticName });
        });
        // read all the polyfill content, in this particular order
        const results = yield Promise.all(readFilePromises);
        // concat the polyfills
        return results.join('\n').trim();
    });
}
// order of the polyfills matters!! test test test
// actual source of the polyfills are found in /scripts/polyfills/
// during the end user's app build they're read from /dist/client/polyfills/
const POLYFILLS = [
    'template.js',
    'document-register-element.js',
    'array-find.js',
    'array-includes.js',
    'object-assign.js',
    'string-startswith.js',
    'string-endswith.js',
    'promise.js',
    'fetch.js',
    'request-animation-frame.js',
    'closest.js',
    'performance-now.js',
    'remove-element.js'
];

var __awaiter$27 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateCore(config, compilerCtx, buildCtx, globalJsContent, buildConditionals) {
    return __awaiter$27(this, void 0, void 0, function* () {
        // mega-minify the core w/ property renaming, but not the user's globals
        // hardcode which features should and should not go in the core builds
        // process the transpiled code by removing unused code and minify when configured to do so
        let jsContent = yield config.sys.getClientCoreFile({ staticName: 'core.build.js' });
        jsContent = yield buildCoreContent(config, compilerCtx, buildCtx, buildConditionals, jsContent);
        if (globalJsContent) {
            // we've got global js to put in the core build too
            // concat the global js and transpiled code together
            jsContent = `${globalJsContent}\n${jsContent}`;
        }
        // wrap the core js code together
        jsContent = wrapCoreJs(config, jsContent);
        if (buildConditionals.polyfills) {
            // this build wants polyfills so let's
            // add the polyfills to the top of the core content
            // the polyfilled code is already es5/minified ready to go
            const polyfillsContent = yield getAppCorePolyfills(config);
            jsContent = polyfillsContent + '\n' + jsContent;
        }
        const coreFilename = getCoreFilename(config, buildConditionals.coreId, jsContent);
        // update the app core filename within the content
        jsContent = jsContent.replace(APP_NAMESPACE_PLACEHOLDER, config.fsNamespace);
        if (config.generateWWW) {
            // write the www/build/ app core file
            const appCoreWWW = pathJoin(config, getAppWWWBuildDir(config), coreFilename);
            yield compilerCtx.fs.writeFile(appCoreWWW, jsContent);
        }
        if (config.generateDistribution) {
            // write the dist/ app core file
            const appCoreDist = pathJoin(config, getAppDistDir(config), coreFilename);
            yield compilerCtx.fs.writeFile(appCoreDist, jsContent);
        }
        return coreFilename;
    });
}
function wrapCoreJs(config, jsContent) {
    const publicPath = getAppPublicPath(config);
    const output = [
        generatePreamble(config) + '\n',
        `(function(Context,appNamespace,hydratedCssClass,publicPath){`,
        `"use strict";\n`,
        `var s=document.querySelector("script[data-namespace='${APP_NAMESPACE_PLACEHOLDER}']");`,
        `if(s){publicPath=s.getAttribute('data-path');}\n`,
        jsContent.trim(),
        `\n})({},"${config.namespace}","${config.hydratedCssClass}","${publicPath}");`
    ].join('');
    return output;
}
const APP_NAMESPACE_PLACEHOLDER = '__APPNAMESPACE__';

var __awaiter$28 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateEs5DisabledMessage(config, compilerCtx) {
    return __awaiter$28(this, void 0, void 0, function* () {
        // not doing an es5 right now
        // but it's possible during development the user
        // tests on a browser that doesn't support es2015
        const fileName = 'es5-build-disabled.js';
        if (config.generateWWW) {
            const filePath = pathJoin(config, getAppWWWBuildDir(config), fileName);
            yield compilerCtx.fs.writeFile(filePath, getDisabledMessageScript());
        }
        if (config.generateDistribution) {
            const filePath = pathJoin(config, getAppDistDir(config), fileName);
            yield compilerCtx.fs.writeFile(filePath, getDisabledMessageScript());
        }
        return fileName;
    });
}
function getDisabledMessageScript() {
    const html = `
  <style>
  body {
    font-family: sans-serif;
    padding: 20px;
    line-height:22px;
  }
  h1 {
    font-size: 18px;
  }
  h2 {
    font-size: 14px;
    margin-top: 40px;
  }
  </style>

  <h1>This Stencil app is disabled for this browser.</h1>

  <h2>Developers:</h2>
  <ul>
    <li>ES5 builds are disabled <strong>during development</strong> to take advantage of 2x faster build times.</li>
    <li>Please see the example below or our <a href="https://stenciljs.com/docs/stencil-config" target="_blank">config docs</a> if you would like to develop on a browser that does not fully support ES2015 and custom elements.</li>
    <li>Note that by default, ES5 builds and polyfills are enabled during production builds.</li>
    <li>When testing browsers it is recommended to always test in production mode, and ES5 builds should always be enabled during production builds.</li>
    <li><em>This is only an experiement and if it slows down app development then we will revert this and enable ES5 builds during dev.</em></li>
  </ul>


  <h2>Enabling ES5 builds during development:</h2>
  <pre>
    <code>npm run dev --es5</code>
  </pre>


  <h2>Enabling full production builds during development:</h2>
  <pre>
    <code>npm run dev --prod</code>
  </pre>

  <h2>Current Browser's Support:</h2>
  <ul>
    <li>ES Module Imports: <span id="esModules"></span></li>
    <li>Custom Elements: <span id="customElements"></span></li>
    <li>fetch(): <span id="fetch"></span></li>
    <li>CSS Variables: <span id="cssVariables"></span></li>
  </ul>

  <h2>Current Browser:</h2>
  <pre>
    <code id="currentBrowser"></code>
  </pre>
  `;
    const script = `
    document.body.innerHTML = '${html.replace(/\r\n|\r|\n/g, '').replace(/\'/g, `\\'`).trim()}';

    document.getElementById('currentBrowser').textContent = window.navigator.userAgent;
    document.getElementById('esModules').textContent = !!('noModule' in document.createElement('script'));
    document.getElementById('customElements').textContent = !!(window.customElements);
    document.getElementById('fetch').textContent = !!(window.fetch);
    document.getElementById('cssVariables').textContent = !!(window.CSS && window.CSS.supports && window.CSS.supports('color', 'var(--c)'));
  `;
    // timeout just to ensure <body> is ready
    return `setTimeout(function(){ ${script} }, 10)`;
}

var __awaiter$29 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function runPluginResolveId(pluginCtx, importee) {
    return __awaiter$29(this, void 0, void 0, function* () {
        for (const plugin of pluginCtx.config.plugins) {
            if (typeof plugin.resolveId === 'function') {
                try {
                    const results = plugin.resolveId(importee, null, pluginCtx);
                    if (results != null) {
                        if (typeof results.then === 'function') {
                            const promiseResults = yield results;
                            if (promiseResults != null) {
                                return promiseResults;
                            }
                        }
                        else if (typeof results === 'string') {
                            return results;
                        }
                    }
                }
                catch (e) {
                    const d = catchError(pluginCtx.diagnostics, e);
                    d.header = `${plugin.name} resolveId error`;
                }
            }
        }
        // default resolvedId
        return importee;
    });
}
function runPluginLoad(pluginCtx, id) {
    return __awaiter$29(this, void 0, void 0, function* () {
        for (const plugin of pluginCtx.config.plugins) {
            if (typeof plugin.load === 'function') {
                try {
                    const results = plugin.load(id, pluginCtx);
                    if (results != null) {
                        if (typeof results.then === 'function') {
                            const promiseResults = yield results;
                            if (promiseResults != null) {
                                return promiseResults;
                            }
                        }
                        else if (typeof results === 'string') {
                            return results;
                        }
                    }
                }
                catch (e) {
                    const d = catchError(pluginCtx.diagnostics, e);
                    d.header = `${plugin.name} load error`;
                }
            }
        }
        // default load()
        return pluginCtx.fs.readFile(id);
    });
}
function runPluginTransforms(config, compilerCtx, buildCtx, id) {
    return __awaiter$29(this, void 0, void 0, function* () {
        const pluginCtx = {
            config: config,
            sys: config.sys,
            fs: compilerCtx.fs,
            cache: compilerCtx.cache,
            diagnostics: []
        };
        const resolvedId = yield runPluginResolveId(pluginCtx, id);
        const sourceText = yield runPluginLoad(pluginCtx, resolvedId);
        const transformResults = {
            code: sourceText,
            id: id
        };
        for (const plugin of pluginCtx.config.plugins) {
            if (typeof plugin.transform === 'function') {
                try {
                    let pluginTransformResults;
                    const results = plugin.transform(transformResults.code, transformResults.id, pluginCtx);
                    if (results != null) {
                        if (typeof results.then === 'function') {
                            pluginTransformResults = yield results;
                        }
                        else {
                            pluginTransformResults = results;
                        }
                        if (pluginTransformResults != null) {
                            if (typeof pluginTransformResults === 'string') {
                                transformResults.code = pluginTransformResults;
                            }
                            else {
                                if (typeof pluginTransformResults.code === 'string') {
                                    transformResults.code = pluginTransformResults.code;
                                }
                                if (typeof pluginTransformResults.id === 'string') {
                                    transformResults.id = pluginTransformResults.id;
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    const d = catchError(buildCtx.diagnostics, e);
                    d.header = `${plugin.name} transform error: ${id}`;
                }
            }
        }
        buildCtx.diagnostics.push(...pluginCtx.diagnostics);
        return transformResults;
    });
}

var __awaiter$30 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateGlobalStyles(config, compilerCtx, buildCtx) {
    return __awaiter$30(this, void 0, void 0, function* () {
        const filePaths = config.globalStyle;
        if (!filePaths || !filePaths.length) {
            config.logger.debug(`"config.globalStyle" not found`);
            return;
        }
        const timeSpan = config.logger.createTimeSpan(`compile global style start`);
        try {
            const styles = yield Promise.all(filePaths.map((filePath) => __awaiter$30(this, void 0, void 0, function* () {
                filePath = normalizePath(filePath);
                const transformResults = yield runPluginTransforms(config, compilerCtx, buildCtx, filePath);
                return transformResults.code;
            })));
            const styleText = styles.join('\n').trim();
            const fileName = getGlobalStyleFilename(config);
            if (config.generateWWW) {
                const wwwFilePath = pathJoin(config, config.buildDir, fileName);
                config.logger.debug(`www global style: ${wwwFilePath}`);
                yield compilerCtx.fs.writeFile(wwwFilePath, styleText);
            }
            if (config.generateDistribution) {
                const distFilePath = pathJoin(config, config.distDir, fileName);
                config.logger.debug(`dist global style: ${distFilePath}`);
                yield compilerCtx.fs.writeFile(distFilePath, styleText);
            }
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
        timeSpan.finish(`compile global style finish`);
    });
}

var __awaiter$31 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateLoader(config, compilerCtx, appRegistry, cmpRegistry) {
    return __awaiter$31(this, void 0, void 0, function* () {
        const appLoaderFileName = getLoaderFileName(config);
        const clientLoaderSource = `loader.js`;
        let loaderContent = yield config.sys.getClientCoreFile({ staticName: clientLoaderSource });
        loaderContent = injectAppIntoLoader(config, appRegistry.core, appRegistry.corePolyfilled, config.hydratedCssClass, cmpRegistry, loaderContent);
        // write the app loader file
        if (compilerCtx.appFiles.loaderContent !== loaderContent) {
            // app loader file is actually different from our last saved version
            config.logger.debug(`build, app loader: ${appLoaderFileName}`);
            compilerCtx.appFiles.loaderContent = loaderContent;
            if (config.minifyJs) {
                // minify the loader
                const minifyJsResults = yield minifyJs(config, compilerCtx, loaderContent, 'es5', true);
                minifyJsResults.diagnostics.forEach(d => {
                    config.logger[d.level](d.messageText);
                });
                if (!minifyJsResults.diagnostics.length) {
                    loaderContent = minifyJsResults.output;
                }
            }
            else {
                // dev
                loaderContent = generatePreamble(config) + '\n' + loaderContent;
            }
            compilerCtx.appFiles.loader = loaderContent;
            if (config.generateWWW) {
                const appLoaderWWW = getLoaderWWW(config);
                yield compilerCtx.fs.writeFile(appLoaderWWW, loaderContent);
            }
            if (config.generateDistribution) {
                const appLoaderDist = getLoaderDist(config);
                yield compilerCtx.fs.writeFile(appLoaderDist, loaderContent);
            }
        }
        return loaderContent;
    });
}
function injectAppIntoLoader(config, appCoreFileName, appCorePolyfilledFileName, hydratedCssClass, cmpRegistry, loaderContent) {
    const cmpLoaderRegistry = formatComponentLoaderRegistry(cmpRegistry);
    const cmpLoaderRegistryStr = JSON.stringify(cmpLoaderRegistry);
    const publicPath = getAppPublicPath(config);
    const discoverPublicPath = (config.discoverPublicPath !== false);
    const loaderArgs = [
        `"${config.namespace}"`,
        `"${config.fsNamespace}"`,
        `"${publicPath}"`,
        `${discoverPublicPath}`,
        `"${appCoreFileName}"`,
        `"${appCorePolyfilledFileName}"`,
        `"${hydratedCssClass}"`,
        cmpLoaderRegistryStr
    ].join(',');
    return loaderContent.replace(APP_NAMESPACE_REGEX, loaderArgs);
}

var __awaiter$32 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function setBuildConditionals(config, ctx, entryModules) {
    return __awaiter$32(this, void 0, void 0, function* () {
        // figure out which sections of the core code this build doesn't even need
        const coreBuild = {};
        coreBuild.clientSide = true;
        coreBuild.isDev = !!config.devMode;
        const promises = [];
        entryModules.forEach(bundle => {
            bundle.moduleFiles.forEach(moduleFile => {
                if (moduleFile.cmpMeta) {
                    promises.push(setBuildFromComponent(config, ctx, coreBuild, moduleFile));
                }
            });
        });
        yield Promise.all(promises);
        return coreBuild;
    });
}
function setBuildFromComponent(config, ctx, coreBuild, moduleFile) {
    return __awaiter$32(this, void 0, void 0, function* () {
        setBuildFromComponentMeta(coreBuild, moduleFile.cmpMeta);
        if (moduleFile.jsFilePath) {
            try {
                const jsText = yield ctx.fs.readFile(moduleFile.jsFilePath);
                setBuildFromComponentContent(coreBuild, jsText);
            }
            catch (e) {
                config.logger.debug(`setBuildFromComponent: ${moduleFile.jsFilePath}: ${e}`);
            }
        }
    });
}
function setBuildFromComponentMeta(coreBuild, cmpMeta) {
    if (!cmpMeta)
        return;
    if (cmpMeta.encapsulation === 1 /* ShadowDom */) {
        coreBuild.shadowDom = true;
    }
    if (cmpMeta.membersMeta) {
        const memberNames = Object.keys(cmpMeta.membersMeta);
        memberNames.forEach(memberName => {
            const memberMeta = cmpMeta.membersMeta[memberName];
            const memberType = memberMeta.memberType;
            const propType = memberMeta.propType;
            if (memberType === 1 /* Prop */ || memberType === 2 /* PropMutable */) {
                if (propType === 2 /* String */ || propType === 4 /* Number */ || propType === 3 /* Boolean */ || propType === 1 /* Any */) {
                    coreBuild.observeAttr = true;
                }
            }
            else if (memberType === 4 /* PropConnect */) {
                coreBuild.propConnect = true;
            }
            else if (memberType === 3 /* PropContext */) {
                coreBuild.propContext = true;
            }
            else if (memberType === 6 /* Method */) {
                coreBuild.method = true;
            }
            else if (memberType === 7 /* Element */) {
                coreBuild.element = true;
            }
            if (memberMeta.watchCallbacks && memberMeta.watchCallbacks.length > 0) {
                coreBuild.watchCallback = true;
            }
        });
    }
    if (cmpMeta.eventsMeta && cmpMeta.eventsMeta.length) {
        coreBuild.event = true;
    }
    if (cmpMeta.listenersMeta && cmpMeta.listenersMeta.length) {
        coreBuild.listener = true;
    }
    if (cmpMeta.stylesMeta) {
        coreBuild.styles = true;
    }
    if (cmpMeta.hostMeta && cmpMeta.hostMeta.theme) {
        coreBuild.hostTheme = true;
    }
}
function setBuildFromComponentContent(coreBuild, jsText) {
    if (typeof jsText !== 'string')
        return;
    // hacky to do it this way...yeah
    // but with collections the components may have been
    // built many moons ago, so we don't want to lock ourselves
    // into a very certain way that components can be parsed
    // so here we're just doing raw string checks, and there
    // wouldn't be any harm if a build section was included when it
    // wasn't needed, but these keywords are all pretty unique already
    if (!coreBuild.cmpWillLoad) {
        coreBuild.cmpWillLoad = (jsText.indexOf('componentWillLoad') > -1);
    }
    if (!coreBuild.cmpDidLoad) {
        coreBuild.cmpDidLoad = (jsText.indexOf('componentDidLoad') > -1);
    }
    if (!coreBuild.cmpWillUpdate) {
        coreBuild.cmpWillUpdate = (jsText.indexOf('componentWillUpdate') > -1);
    }
    if (!coreBuild.cmpDidUpdate) {
        coreBuild.cmpDidUpdate = (jsText.indexOf('componentDidUpdate') > -1);
    }
    if (!coreBuild.cmpDidUnload) {
        coreBuild.cmpDidUnload = (jsText.indexOf('componentDidUnload') > -1);
    }
    if (!coreBuild.hostData) {
        coreBuild.hostData = (jsText.indexOf('hostData') > -1);
    }
    if (!coreBuild.svg) {
        jsText = jsText.toLowerCase();
        coreBuild.svg = (jsText.indexOf('svg') > -1);
    }
}

var __awaiter$33 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateAppFiles(config, compilerCtx, buildCtx, entryModules, cmpRegistry) {
    return __awaiter$33(this, void 0, void 0, function* () {
        if (!config.buildAppCore) {
            config.logger.createTimeSpan(`generate app files skipped`, true);
            return;
        }
        const timespan = config.logger.createTimeSpan(`generate app files started`);
        try {
            // generate the shared app registry object
            const appRegistry = createAppRegistry(config);
            // normal es2015 build
            const globalJsContentsEs2015 = yield generateAppGlobalScript(config, compilerCtx, buildCtx, appRegistry);
            // figure out which sections should be included in the core build
            const buildConditionals = yield setBuildConditionals(config, compilerCtx, entryModules);
            buildConditionals.coreId = 'core';
            const coreFilename = yield generateCore(config, compilerCtx, buildCtx, globalJsContentsEs2015, buildConditionals);
            appRegistry.core = coreFilename;
            compilerCtx.appCoreWWWPath = pathJoin(config, getAppWWWBuildDir(config), coreFilename);
            if (config.buildEs5) {
                // es5 build (if needed)
                const globalJsContentsEs5 = yield generateAppGlobalScript(config, compilerCtx, buildCtx, appRegistry, 'es5');
                const buildConditionalsEs5 = yield setBuildConditionals(config, compilerCtx, entryModules);
                buildConditionalsEs5.coreId = 'core.pf';
                buildConditionalsEs5.es5 = true;
                buildConditionalsEs5.polyfills = true;
                buildConditionalsEs5.cssVarShim = true;
                const coreFilenameEs5 = yield generateCore(config, compilerCtx, buildCtx, globalJsContentsEs5, buildConditionalsEs5);
                appRegistry.corePolyfilled = coreFilenameEs5;
            }
            else {
                // not doing an es5, probably in dev mode
                appRegistry.corePolyfilled = yield generateEs5DisabledMessage(config, compilerCtx);
            }
            // create a json file for the app registry
            yield writeAppRegistry(config, compilerCtx, appRegistry, cmpRegistry);
            // create the loader after creating the loader file name
            yield generateLoader(config, compilerCtx, appRegistry, cmpRegistry);
            // create the global styles
            yield generateGlobalStyles(config, compilerCtx, buildCtx);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
        timespan.finish(`generate app files finished`);
    });
}

var __awaiter$34 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateBundles(config, compilerCtx, buildCtx, entryModules, jsModules) {
    return __awaiter$34(this, void 0, void 0, function* () {
        // both styles and modules are done bundling
        // combine the styles and modules together
        // generate the actual files to write
        const timeSpan = config.logger.createTimeSpan(`generate bundles started`);
        const bundleKeys = {};
        yield Promise.all(entryModules.map((entryModule) => __awaiter$34(this, void 0, void 0, function* () {
            const bundleKeyPath = `./${entryModule.entryKey}.js`;
            bundleKeys[bundleKeyPath] = entryModule.entryKey;
            entryModule.modeNames = entryModule.modeNames || [];
            return Promise.all(entryModule.modeNames.map((modeName) => __awaiter$34(this, void 0, void 0, function* () {
                const jsCode = Object.keys(jsModules).reduce((all, moduleType) => {
                    return Object.assign({}, all, { [moduleType]: jsModules[moduleType][bundleKeyPath].code });
                }, {});
                return yield generateBundleMode(config, compilerCtx, buildCtx, entryModule, modeName, jsCode);
            })));
        })));
        const esmModules = jsModules.esm;
        const esmPromises = Object.keys(esmModules)
            .filter(key => !bundleKeys[key])
            .map(key => { return [key, esmModules[key]]; })
            .map(([key, value]) => __awaiter$34(this, void 0, void 0, function* () {
            const fileName = getBundleFilename(key.replace('.js', ''), false, 'es2015');
            const jsText = replaceBundleIdPlaceholder(value.code, key);
            yield writeBundleJSFile(config, compilerCtx, fileName, jsText);
        }));
        yield Promise.all(esmPromises);
        if (config.buildEs5) {
            const es5Modules = jsModules.es5;
            const es5Promises = Object.keys(es5Modules)
                .filter(key => !bundleKeys[key])
                .map(key => { return [key, es5Modules[key]]; })
                .map(([key, value]) => __awaiter$34(this, void 0, void 0, function* () {
                const fileName = getBundleFilename(key.replace('.js', ''), false, 'es5');
                let jsText = replaceBundleIdPlaceholder(value.code, key);
                jsText = yield transpileEs5Bundle(compilerCtx, buildCtx, jsText);
                yield writeBundleJSFile(config, compilerCtx, fileName, jsText);
            }));
            yield Promise.all(es5Promises);
        }
        // create the registry of all the components
        const cmpRegistry = createComponentRegistry(entryModules);
        timeSpan.finish(`generate bundles finished`);
        return cmpRegistry;
    });
}
function writeBundleJSFile(config, compilerCtx, fileName, jsText) {
    return __awaiter$34(this, void 0, void 0, function* () {
        // get the absolute path to where it'll be saved in www
        const wwwBuildPath = pathJoin(config, getAppWWWBuildDir(config), fileName);
        // get the absolute path to where it'll be saved in dist
        const distPath = pathJoin(config, getAppDistDir(config), fileName);
        if (config.generateWWW) {
            // write to the www build
            yield compilerCtx.fs.writeFile(wwwBuildPath, jsText);
        }
        if (config.generateDistribution) {
            // write to the dist build
            yield compilerCtx.fs.writeFile(distPath, jsText);
        }
    });
}
function generateBundleMode(config, compilerCtx, buildCtx, entryModule, modeName, jsCode) {
    return __awaiter$34(this, void 0, void 0, function* () {
        // create js text for: mode, no scoped styles and esm
        let jsText = yield createBundleJsText(config, compilerCtx, buildCtx, entryModule, jsCode['esm'], modeName, false);
        // the only bundle id comes from mode, no scoped styles and esm
        const bundleId = getBundleId(config, entryModule, modeName, jsText);
        // assign the bundle id build from the
        // mode, no scoped styles and esm to each of the components
        entryModule.moduleFiles.forEach(moduleFile => {
            moduleFile.cmpMeta.bundleIds = moduleFile.cmpMeta.bundleIds || {};
            if (typeof moduleFile.cmpMeta.bundleIds === 'object') {
                moduleFile.cmpMeta.bundleIds[modeName] = bundleId;
            }
        });
        // generate the bundle build for mode, no scoped styles, and esm
        yield generateBundleBuild(config, compilerCtx, entryModule, jsText, bundleId, modeName, false);
        if (entryModule.requiresScopedStyles) {
            // create js text for: mode, scoped styles, esm
            jsText = yield createBundleJsText(config, compilerCtx, buildCtx, entryModule, jsCode['esm'], modeName, true);
            // generate the bundle build for: mode, esm and scoped styles
            yield generateBundleBuild(config, compilerCtx, entryModule, jsText, bundleId, modeName, true);
        }
        if (config.buildEs5) {
            // create js text for: mode, no scoped styles, es5
            jsText = yield createBundleJsText(config, compilerCtx, buildCtx, entryModule, jsCode['es5'], modeName, false, 'es5');
            // generate the bundle build for: mode, no scoped styles and es5
            yield generateBundleBuild(config, compilerCtx, entryModule, jsText, bundleId, modeName, false, 'es5');
            if (entryModule.requiresScopedStyles) {
                // create js text for: mode, scoped styles, es5
                jsText = yield createBundleJsText(config, compilerCtx, buildCtx, entryModule, jsCode['es5'], modeName, true, 'es5');
                // generate the bundle build for: mode, es5 and scoped styles
                yield generateBundleBuild(config, compilerCtx, entryModule, jsText, bundleId, modeName, true, 'es5');
            }
        }
    });
}
function createBundleJsText(config, compilerCtx, buildCtx, entryModules, jsText, modeName, isScopedStyles, sourceTarget) {
    return __awaiter$34(this, void 0, void 0, function* () {
        if (sourceTarget === 'es5') {
            // use legacy bundling with commonjs/jsonp modules
            // and transpile the build to es5
            jsText = yield transpileEs5Bundle(compilerCtx, buildCtx, jsText);
        }
        if (config.minifyJs) {
            // minify the bundle js text
            const minifyJsResults = yield minifyJs(config, compilerCtx, jsText, sourceTarget, true);
            if (minifyJsResults.diagnostics.length) {
                minifyJsResults.diagnostics.forEach(d => {
                    buildCtx.diagnostics.push(d);
                });
            }
            else {
                jsText = minifyJsResults.output;
            }
        }
        return injectStyleMode(entryModules.moduleFiles, jsText, modeName, isScopedStyles);
    });
}
function generateBundleBuild(config, compilerCtx, entryModule, jsText, bundleId, modeName, isScopedStyles, sourceTarget) {
    return __awaiter$34(this, void 0, void 0, function* () {
        // create the file name
        const fileName = getBundleFilename(bundleId, isScopedStyles, sourceTarget);
        // update the bundle id placeholder with the actual bundle id
        // this is used by jsonp callbacks to know which bundle loaded
        jsText = replaceBundleIdPlaceholder(jsText, bundleId);
        const entryBundle = {
            fileName: fileName,
            text: jsText,
            outputs: [],
            modeName: modeName,
            sourceTarget: sourceTarget,
            isScopedStyles: isScopedStyles
        };
        entryModule.entryBundles = entryModule.entryBundles || [];
        entryModule.entryBundles.push(entryBundle);
        // get the absolute path to where it'll be saved in www
        const wwwBuildPath = pathJoin(config, getAppWWWBuildDir(config), fileName);
        // get the absolute path to where it'll be saved in dist
        const distPath = pathJoin(config, getAppDistDir(config), fileName);
        if (config.generateWWW) {
            // write to the www build
            yield compilerCtx.fs.writeFile(wwwBuildPath, jsText);
            entryBundle.outputs.push(wwwBuildPath);
        }
        if (config.generateDistribution) {
            // write to the dist build
            yield compilerCtx.fs.writeFile(distPath, jsText);
            entryBundle.outputs.push(distPath);
        }
    });
}
function injectStyleMode(moduleFiles, jsText, modeName, isScopedStyles) {
    moduleFiles.forEach(moduleFile => {
        jsText = injectComponentStyleMode(moduleFile.cmpMeta, modeName, jsText, isScopedStyles);
    });
    return jsText;
}
function injectComponentStyleMode(cmpMeta, modeName, jsText, isScopedStyles) {
    const stylePlaceholder = getStylePlaceholder(cmpMeta.tagNameMeta);
    const stylePlaceholderId = getStyleIdPlaceholder(cmpMeta.tagNameMeta);
    let styleText = '';
    if (cmpMeta.stylesMeta) {
        let modeStyles = cmpMeta.stylesMeta[modeName];
        if (modeStyles) {
            if (isScopedStyles) {
                // we specifically want scoped css
                styleText = modeStyles.compiledStyleTextScoped;
            }
            if (!styleText) {
                // either we don't want scoped css
                // or we DO want scoped css, but we don't have any
                // use the un-scoped css
                styleText = modeStyles.compiledStyleText || '';
            }
        }
        else {
            modeStyles = cmpMeta.stylesMeta[DEFAULT_STYLE_MODE];
            if (modeStyles) {
                if (isScopedStyles) {
                    // we specifically want scoped css
                    styleText = modeStyles.compiledStyleTextScoped;
                }
                if (!styleText) {
                    // either we don't want scoped css
                    // or we DO want scoped css, but we don't have any
                    // use the un-scoped css
                    styleText = modeStyles.compiledStyleText || '';
                }
            }
        }
    }
    // replace the style placeholder string that's already in the js text
    jsText = jsText.replace(stylePlaceholder, styleText);
    // replace the style id placeholder string that's already in the js text
    jsText = jsText.replace(stylePlaceholderId, modeName);
    // return the js text with the newly inject style
    return jsText;
}
function transpileEs5Bundle(compilerCtx, buildCtx, jsText) {
    return __awaiter$34(this, void 0, void 0, function* () {
        // use typescript to convert this js text into es5
        const transpileResults = yield transpileToEs5(compilerCtx, jsText);
        if (transpileResults.diagnostics && transpileResults.diagnostics.length > 0) {
            buildCtx.diagnostics.push(...transpileResults.diagnostics);
        }
        if (hasError(transpileResults.diagnostics)) {
            return jsText;
        }
        return transpileResults.code;
    });
}
function getBundleId(config, entryModule, modeName, jsText) {
    if (config.hashFileNames) {
        // create style id from hashing the content
        return config.sys.generateContentHash(jsText, config.hashedFileNameLength);
    }
    return getBundleIdDev(entryModule, modeName);
}
function getBundleIdDev(entryModule, modeName) {
    const tags = entryModule.moduleFiles
        .sort((a, b) => {
        if (a.isCollectionDependency && !b.isCollectionDependency) {
            return 1;
        }
        if (!a.isCollectionDependency && b.isCollectionDependency) {
            return -1;
        }
        if (a.cmpMeta.tagNameMeta < b.cmpMeta.tagNameMeta)
            return -1;
        if (a.cmpMeta.tagNameMeta > b.cmpMeta.tagNameMeta)
            return 1;
        return 0;
    })
        .map(m => m.cmpMeta.tagNameMeta);
    if (modeName === DEFAULT_STYLE_MODE || !modeName) {
        return tags[0];
    }
    return `${tags[0]}.${modeName}`;
}
function createComponentRegistry(entryModules) {
    const registryComponents = [];
    const cmpRegistry = {};
    return entryModules
        .reduce((rcs, bundle) => {
        const cmpMetas = bundle.moduleFiles
            .filter(m => m.cmpMeta)
            .map(moduleFile => moduleFile.cmpMeta);
        return rcs.concat(cmpMetas);
    }, registryComponents)
        .sort((a, b) => {
        if (a.tagNameMeta < b.tagNameMeta)
            return -1;
        if (a.tagNameMeta > b.tagNameMeta)
            return 1;
        return 0;
    })
        .reduce((registry, cmpMeta) => {
        return Object.assign({}, registry, { [cmpMeta.tagNameMeta]: cmpMeta });
    }, cmpRegistry);
}

function getComponentRefsFromSourceStrings(allModuleFiles, sourceStrings) {
    const componentRefs = [];
    const tags = Object.keys(allModuleFiles)
        .map(filePath => allModuleFiles[filePath].cmpMeta)
        .filter(cmpMeta => cmpMeta && cmpMeta.tagNameMeta)
        .map(cmpMeta => cmpMeta.tagNameMeta);
    sourceStrings.forEach(src => {
        if (typeof src.tag === 'string') {
            src.tag = src.tag.toLowerCase();
            if (tags.some(tag => src.tag === tag)) {
                // exact match, we're good
                // probably something like h('ion-button') or
                // document.createElement('ion-toggle');
                componentRefs.push({
                    tag: src.tag,
                    filePath: src.filePath
                });
            }
        }
        else if (typeof src.html === 'string') {
            // string could be HTML
            // could be something like elm.innerHTML = '<ion-button>';
            // replace any whitespace with a ~ character
            // this is especially important for newlines and tabs
            // for tag with attributes and has a newline in the tag
            src.html = src.html.toLowerCase().replace(/\s/g, '~');
            const foundTags = tags.filter(tag => {
                return src.html.includes('<' + tag + '>') ||
                    src.html.includes('</' + tag + '>') ||
                    src.html.includes('<' + tag + '~');
            });
            foundTags.forEach(foundTag => {
                componentRefs.push({
                    tag: foundTag,
                    filePath: src.filePath
                });
            });
        }
    });
    sourceStrings.length = 0;
    return componentRefs;
}

function calcModuleGraphImportPaths(compilerCtx, moduleGraphs) {
    // figure out the actual source's file path
    // cuz right now the import paths probably don't have the extension on them
    moduleGraphs.forEach(mg => {
        mg.importPaths = mg.importPaths.map(importPath => {
            if (importPath.startsWith('.') || importPath.startsWith('/')) {
                for (const srcExt of SRC_EXTS) {
                    const srcFilePath = importPath + srcExt;
                    if (compilerCtx.moduleFiles[srcFilePath]) {
                        return srcFilePath;
                    }
                }
            }
            return importPath;
        });
    });
}
const SRC_EXTS = ['.tsx', '.ts', '.js'];
function calcComponentDependencies(allModuleFiles, moduleGraphs, sourceStrings) {
    // figure out all the component references seen in each file
    const componentRefs = getComponentRefsFromSourceStrings(allModuleFiles, sourceStrings);
    Object.keys(allModuleFiles).forEach(filePath => {
        const moduleFile = allModuleFiles[filePath];
        if (moduleFile.cmpMeta) {
            getComponentDependencies(moduleGraphs, componentRefs, filePath, moduleFile.cmpMeta);
        }
    });
}
function getComponentDependencies(moduleGraphs, componentRefs, filePath, cmpMeta) {
    // we may have already figured out some dependencies (collections aready have this info)
    cmpMeta.dependencies = cmpMeta.dependencies || [];
    // figure out if this file has any components in it
    const refTags = componentRefs.filter(cr => cr.filePath === filePath).map(cr => cr.tag);
    refTags.forEach(tag => {
        if (tag !== cmpMeta.tagNameMeta && !cmpMeta.dependencies.includes(tag)) {
            cmpMeta.dependencies.push(tag);
        }
    });
    const importsInspected = [];
    const moduleGraph = moduleGraphs.find(mg => mg.filePath === filePath);
    if (moduleGraph) {
        getComponentDepsFromImports(moduleGraphs, componentRefs, importsInspected, moduleGraph, cmpMeta);
    }
    cmpMeta.dependencies.sort();
}
function getComponentDepsFromImports(moduleGraphs, componentRefs, importsInspected, moduleGraph, cmpMeta) {
    moduleGraph.importPaths.forEach(importPath => {
        if (importsInspected.includes(importPath)) {
            return;
        }
        importsInspected.push(importPath);
        const subModuleGraph = moduleGraphs.find(mg => {
            return (mg.filePath === importPath) ||
                (mg.filePath === importPath + '.ts') ||
                (mg.filePath === importPath + '.tsx') ||
                (mg.filePath === importPath + '.js');
        });
        if (subModuleGraph) {
            const tags = componentRefs.filter(cr => cr.filePath === subModuleGraph.filePath).map(cr => cr.tag);
            tags.forEach(tag => {
                if (!cmpMeta.dependencies.includes(tag)) {
                    cmpMeta.dependencies.push(tag);
                }
            });
            getComponentDepsFromImports(moduleGraphs, componentRefs, importsInspected, subModuleGraph, cmpMeta);
        }
    });
}

function processAppGraph(allModules, entryTags) {
    const graph = getGraph(allModules, entryTags);
    const entryPoints = [];
    for (const graphEntry of graph) {
        if (entryPoints.some(en => en.some(ec => ec.tag === graphEntry.tag))) {
            // already handled this one
            continue;
        }
        const depsOf = graph.filter(d => d.dependencies.includes(graphEntry.tag));
        if (depsOf.length > 1) {
            const commonEntryCmps = [];
            depsOf.forEach(depOf => {
                depOf.dependencies.forEach(depTag => {
                    if (depsOf.every(d => d.dependencies.includes(depTag))) {
                        const existingCommonEntryCmp = commonEntryCmps.find(ec => {
                            return ec.tag === depTag;
                        });
                        if (existingCommonEntryCmp) {
                            existingCommonEntryCmp.dependencyOf.push(depOf.tag);
                        }
                        else {
                            commonEntryCmps.push({
                                tag: depTag,
                                dependencyOf: [depOf.tag]
                            });
                        }
                    }
                });
            });
            const existingEntryPoint = entryPoints.find(ep => {
                return ep.some(ec => commonEntryCmps.some(cec => cec.tag === ec.tag));
            });
            if (existingEntryPoint) {
                const depsOf = graph.filter(d => d.dependencies.includes(graphEntry.tag));
                if (depsOf.length > 0) {
                    const existingEntryPointDepOf = entryPoints.find(ep => ep.some(ec => depsOf.some(d => d.dependencies.includes(ec.tag))));
                    if (existingEntryPointDepOf) {
                        existingEntryPointDepOf.push({
                            tag: graphEntry.tag,
                            dependencyOf: depsOf.map(d => d.tag)
                        });
                    }
                    else {
                        entryPoints.push([
                            {
                                tag: graphEntry.tag,
                                dependencyOf: []
                            }
                        ]);
                    }
                }
                else {
                    entryPoints.push([
                        {
                            tag: graphEntry.tag,
                            dependencyOf: []
                        }
                    ]);
                }
            }
            else {
                entryPoints.push(commonEntryCmps);
            }
        }
        else if (depsOf.length === 1) {
            const existingEntryPoint = entryPoints.find(ep => ep.some(ec => ec.tag === depsOf[0].tag));
            if (existingEntryPoint) {
                existingEntryPoint.push({
                    tag: graphEntry.tag,
                    dependencyOf: [depsOf[0].tag]
                });
            }
            else {
                entryPoints.push([
                    {
                        tag: depsOf[0].tag,
                        dependencyOf: []
                    },
                    {
                        tag: graphEntry.tag,
                        dependencyOf: [depsOf[0].tag]
                    }
                ]);
            }
        }
        else {
            entryPoints.push([
                {
                    tag: graphEntry.tag,
                    dependencyOf: []
                }
            ]);
        }
    }
    entryPoints.forEach(entryPoint => {
        entryPoint.forEach(entryCmp => {
            entryCmp.dependencyOf.sort();
        });
        entryPoint.sort((a, b) => {
            if (a.tag < b.tag)
                return -1;
            if (a.tag > b.tag)
                return 1;
            return 0;
        });
    });
    entryPoints.sort((a, b) => {
        if (a[0].tag < b[0].tag)
            return -1;
        if (a[0].tag > b[0].tag)
            return 1;
        return 0;
    });
    return entryPoints;
}
function getGraph(allModules, entryTags) {
    const graph = [];
    function addDeps(tag) {
        if (graph.some(d => d.tag === tag)) {
            return;
        }
        const m = allModules.find(m => m.cmpMeta && m.cmpMeta.tagNameMeta === tag);
        if (!m) {
            throw new Error(`processAppGraph, unable to find tag: ${tag}`);
        }
        m.cmpMeta.dependencies = (m.cmpMeta.dependencies || []);
        const dependencies = m.cmpMeta.dependencies.filter(t => t !== tag).sort();
        graph.push({
            tag: tag,
            dependencies: dependencies
        });
        dependencies.forEach(addDeps);
    }
    entryTags.forEach(addDeps);
    return graph;
}

function generateComponentEntries(allModules, userConfigEntryTags, appEntryTags) {
    // user config entry modules you leave as is
    // whatever the user put in the bundle is how it goes
    const entryPoints = [];
    const userConfigEntryPoints = processUserConfigBundles(userConfigEntryTags);
    entryPoints.push(...userConfigEntryPoints);
    // process all of the app's components not already found
    // in the config or the root html
    const appEntries = processAppComponentEntryTags(allModules, entryPoints, appEntryTags);
    entryPoints.push(...appEntries);
    return entryPoints;
}
function processAppComponentEntryTags(allModules, entryPoints, appEntryTags) {
    // remove any tags already found in user config
    appEntryTags = appEntryTags.filter(tag => !entryPoints.some(ep => ep.some(em => em.tag === tag)));
    return processAppGraph(allModules, appEntryTags);
}
function processUserConfigBundles(userConfigEntryTags) {
    return userConfigEntryTags.map(entryTags => {
        return entryTags.map(entryTag => {
            const entryComponent = {
                tag: entryTag,
                dependencyOf: ['#config']
            };
            return entryComponent;
        });
    });
}

var __awaiter$35 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function minifyStyle(config, compilerCtx, diagnostics, styleText) {
    return __awaiter$35(this, void 0, void 0, function* () {
        const cacheKey = compilerCtx.cache.createKey('minifyStyle', styleText);
        const cachedContent = yield compilerCtx.cache.get(cacheKey);
        if (cachedContent != null) {
            return cachedContent;
        }
        const minifyResults = config.sys.minifyCss(styleText);
        minifyResults.diagnostics.forEach(d => {
            diagnostics.push(d);
        });
        if (typeof minifyResults.output === 'string') {
            yield compilerCtx.cache.put(cacheKey, minifyResults.output);
            return minifyResults.output;
        }
        return styleText;
    });
}

/**
 * This file is a port of shadow_css.ts from Angular,
 * which is a port of shadowCSS from webcomponents.js to TypeScript.
 * https://github.com/angular/angular/blob/master/packages/compiler/src/shadow_css.ts
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * This file is a port of shadowCSS from webcomponents.js to TypeScript.
 *
 * Please make sure to keep to edits in sync with the source file.
 *
 * Source:
 * https://github.com/webcomponents/webcomponentsjs/blob/4efecd7e0e/src/ShadowCSS/ShadowCSS.js
 *
 * The original file level comment is reproduced below
 */
/*
  This is a limited shim for ShadowDOM css styling.
  https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#styles

  The intention here is to support only the styling features which can be
  relatively simply implemented. The goal is to allow users to avoid the
  most obvious pitfalls and do so without compromising performance significantly.
  For ShadowDOM styling that's not covered here, a set of best practices
  can be provided that should allow users to accomplish more complex styling.

  The following is a list of specific ShadowDOM styling features and a brief
  discussion of the approach used to shim.

  Shimmed features:

  * :host, :host-context: ShadowDOM allows styling of the shadowRoot's host
  element using the :host rule. To shim this feature, the :host styles are
  reformatted and prefixed with a given scope name and promoted to a
  document level stylesheet.
  For example, given a scope name of .foo, a rule like this:

    :host {
        background: red;
      }
    }

  becomes:

    .foo {
      background: red;
    }

  * encapsulation: Styles defined within ShadowDOM, apply only to
  dom inside the ShadowDOM. Polymer uses one of two techniques to implement
  this feature.

  By default, rules are prefixed with the host element tag name
  as a descendant selector. This ensures styling does not leak out of the 'top'
  of the element's ShadowDOM. For example,

  div {
      font-weight: bold;
    }

  becomes:

  x-foo div {
      font-weight: bold;
    }

  becomes:


  Alternatively, if WebComponents.ShadowCSS.strictStyling is set to true then
  selectors are scoped by adding an attribute selector suffix to each
  simple selector that contains the host element tag name. Each element
  in the element's ShadowDOM template is also given the scope attribute.
  Thus, these rules match only elements that have the scope attribute.
  For example, given a scope name of x-foo, a rule like this:

    div {
      font-weight: bold;
    }

  becomes:

    div[x-foo] {
      font-weight: bold;
    }

  Note that elements that are dynamically added to a scope must have the scope
  selector added to them manually.

  * upper/lower bound encapsulation: Styles which are defined outside a
  shadowRoot should not cross the ShadowDOM boundary and should not apply
  inside a shadowRoot.

  This styling behavior is not emulated. Some possible ways to do this that
  were rejected due to complexity and/or performance concerns include: (1) reset
  every possible property for every possible selector for a given scope name;
  (2) re-implement css in javascript.

  As an alternative, users should make sure to use selectors
  specific to the scope in which they are working.

  * ::distributed: This behavior is not emulated. It's often not necessary
  to style the contents of a specific insertion point and instead, descendants
  of the host element can be styled selectively. Users can also create an
  extra node around an insertion point and style that node's contents
  via descendent selectors. For example, with a shadowRoot like this:

    <style>
      ::content(div) {
        background: red;
      }
    </style>
    <content></content>

  could become:

    <style>
      / *@polyfill .content-container div * /
      ::content(div) {
        background: red;
      }
    </style>
    <div class="content-container">
      <content></content>
    </div>

  Note the use of @polyfill in the comment above a ShadowDOM specific style
  declaration. This is a directive to the styling shim to use the selector
  in comments in lieu of the next selector when running under polyfill.
*/
class ShadowCss {
    constructor() {
        this.strictStyling = true;
    }
    /*
    * Shim some cssText with the given selector. Returns cssText that can
    * be included in the document via WebComponents.ShadowCSS.addCssToDocument(css).
    *
    * When strictStyling is true:
    * - selector is the attribute added to all elements inside the host,
    * - hostSelector is the attribute added to the host itself.
    */
    shimCssText(cssText, selector, hostSelector = '', slotSelector = '') {
        const sourceMappingUrl = extractSourceMappingUrl(cssText);
        cssText = stripComments(cssText);
        cssText = this._insertDirectives(cssText);
        return this._scopeCssText(cssText, selector, hostSelector, slotSelector) + sourceMappingUrl;
    }
    _insertDirectives(cssText) {
        cssText = this._insertPolyfillDirectivesInCssText(cssText);
        return this._insertPolyfillRulesInCssText(cssText);
    }
    /*
     * Process styles to convert native ShadowDOM rules that will trip
     * up the css parser; we rely on decorating the stylesheet with inert rules.
     *
     * For example, we convert this rule:
     *
     * polyfill-next-selector { content: ':host menu-item'; }
     * ::content menu-item {
     *
     * to this:
     *
     * scopeName menu-item {
     *
    **/
    _insertPolyfillDirectivesInCssText(cssText) {
        // Difference with webcomponents.js: does not handle comments
        return cssText.replace(_cssContentNextSelectorRe, function (...m) { return m[2] + '{'; });
    }
    /*
     * Process styles to add rules which will only apply under the polyfill
     *
     * For example, we convert this rule:
     *
     * polyfill-rule {
     *   content: ':host menu-item';
     * ...
     * }
     *
     * to this:
     *
     * scopeName menu-item {...}
     *
    **/
    _insertPolyfillRulesInCssText(cssText) {
        // Difference with webcomponents.js: does not handle comments
        return cssText.replace(_cssContentRuleRe, (...m) => {
            const rule = m[0].replace(m[1], '').replace(m[2], '');
            return m[4] + rule;
        });
    }
    /* Ensure styles are scoped. Pseudo-scoping takes a rule like:
     *
     *  .foo {... }
     *
     *  and converts this to
     *
     *  scopeName .foo { ... }
    */
    _scopeCssText(cssText, scopeSelector, hostSelector, slotSelector) {
        const unscopedRules = this._extractUnscopedRulesFromCssText(cssText);
        // replace :host and :host-context -shadowcsshost and -shadowcsshost respectively
        cssText = this._insertPolyfillHostInCssText(cssText);
        cssText = this._convertColonHost(cssText);
        cssText = this._convertColonHostContext(cssText);
        cssText = this._convertColonSlotted(cssText, slotSelector);
        cssText = this._convertShadowDOMSelectors(cssText);
        if (scopeSelector) {
            cssText = this._scopeSelectors(cssText, scopeSelector, hostSelector, slotSelector);
        }
        cssText = cssText + '\n' + unscopedRules;
        cssText = cssText.replace(/-shadowcsshost-no-combinator/g, `[${hostSelector}]`);
        return cssText.trim();
    }
    /*
     * Process styles to add rules which will only apply under the polyfill
     * and do not process via CSSOM. (CSSOM is destructive to rules on rare
     * occasions, e.g. -webkit-calc on Safari.)
     * For example, we convert this rule:
     *
     * @polyfill-unscoped-rule {
     *   content: 'menu-item';
     * ... }
     *
     * to this:
     *
     * menu-item {...}
     *
    **/
    _extractUnscopedRulesFromCssText(cssText) {
        // Difference with webcomponents.js: does not handle comments
        let r = '';
        let m;
        _cssContentUnscopedRuleRe.lastIndex = 0;
        while ((m = _cssContentUnscopedRuleRe.exec(cssText)) !== null) {
            const rule = m[0].replace(m[2], '').replace(m[1], m[4]);
            r += rule + '\n\n';
        }
        return r;
    }
    /*
     * convert a rule like :host(.foo) > .bar { }
     *
     * to
     *
     * .foo<scopeName> > .bar
    */
    _convertColonHost(cssText) {
        return this._convertColonRule(cssText, _cssColonHostRe, this._colonHostPartReplacer);
    }
    /*
     * convert a rule like ::slotted(.foo) { }
    */
    _convertColonSlotted(cssText, slotAttr) {
        const regExp = _cssColonSlottedRe;
        return cssText.replace(regExp, function (...m) {
            if (m[2]) {
                const compound = m[2].trim();
                const suffix = m[3];
                const sel = '[' + slotAttr + '] > ' + compound + suffix;
                return sel;
            }
            else {
                return _polyfillHostNoCombinator + m[3];
            }
        });
    }
    /*
     * convert a rule like :host-context(.foo) > .bar { }
     *
     * to
     *
     * .foo<scopeName> > .bar, .foo scopeName > .bar { }
     *
     * and
     *
     * :host-context(.foo:host) .bar { ... }
     *
     * to
     *
     * .foo<scopeName> .bar { ... }
    */
    _convertColonHostContext(cssText) {
        return this._convertColonRule(cssText, _cssColonHostContextRe, this._colonHostContextPartReplacer);
    }
    _convertColonRule(cssText, regExp, partReplacer) {
        // m[1] = :host(-context), m[2] = contents of (), m[3] rest of rule
        return cssText.replace(regExp, function (...m) {
            if (m[2]) {
                const parts = m[2].split(',');
                const r = [];
                for (let i = 0; i < parts.length; i++) {
                    const p = parts[i].trim();
                    if (!p)
                        break;
                    r.push(partReplacer(_polyfillHostNoCombinator, p, m[3]));
                }
                return r.join(',');
            }
            else {
                return _polyfillHostNoCombinator + m[3];
            }
        });
    }
    _colonHostContextPartReplacer(host, part, suffix) {
        if (part.indexOf(_polyfillHost) > -1) {
            return this._colonHostPartReplacer(host, part, suffix);
        }
        else {
            return host + part + suffix + ', ' + part + ' ' + host + suffix;
        }
    }
    _colonHostPartReplacer(host, part, suffix) {
        return host + part.replace(_polyfillHost, '') + suffix;
    }
    /*
     * Convert combinators like ::shadow and pseudo-elements like ::content
     * by replacing with space.
    */
    _convertShadowDOMSelectors(cssText) {
        return _shadowDOMSelectorsRe.reduce((result, pattern) => result.replace(pattern, ' '), cssText);
    }
    // change a selector like 'div' to 'name div'
    _scopeSelectors(cssText, scopeSelector, hostSelector, slotSelector) {
        return processRules(cssText, (rule) => {
            let selector = rule.selector;
            let content = rule.content;
            if (rule.selector[0] !== '@') {
                selector =
                    this._scopeSelector(rule.selector, scopeSelector, hostSelector, slotSelector, this.strictStyling);
            }
            else if (rule.selector.startsWith('@media') || rule.selector.startsWith('@supports') ||
                rule.selector.startsWith('@page') || rule.selector.startsWith('@document')) {
                content = this._scopeSelectors(rule.content, scopeSelector, hostSelector, slotSelector);
            }
            return new CssRule(selector, content);
        });
    }
    _scopeSelector(selector, scopeSelector, hostSelector, slotSelector, strict) {
        return selector.split(',')
            .map(part => part.trim().split(_shadowDeepSelectors))
            .map((deepParts) => {
            const [shallowPart, ...otherParts] = deepParts;
            const applyScope = (shallowPart) => {
                if (shallowPart.indexOf('[' + slotSelector + ']') > -1) {
                    return shallowPart;
                }
                if (this._selectorNeedsScoping(shallowPart, scopeSelector)) {
                    return strict ?
                        this._applyStrictSelectorScope(shallowPart, scopeSelector, hostSelector) :
                        this._applySelectorScope(shallowPart, scopeSelector, hostSelector);
                }
                else {
                    return shallowPart;
                }
            };
            return [applyScope(shallowPart), ...otherParts].join(' ');
        })
            .join(', ');
    }
    _selectorNeedsScoping(selector, scopeSelector) {
        const re = this._makeScopeMatcher(scopeSelector);
        return !re.test(selector);
    }
    _makeScopeMatcher(scopeSelector) {
        const lre = /\[/g;
        const rre = /\]/g;
        scopeSelector = scopeSelector.replace(lre, '\\[').replace(rre, '\\]');
        return new RegExp('^(' + scopeSelector + ')' + _selectorReSuffix, 'm');
    }
    _applySelectorScope(selector, scopeSelector, hostSelector) {
        // Difference from webcomponents.js: scopeSelector could not be an array
        return this._applySimpleSelectorScope(selector, scopeSelector, hostSelector);
    }
    // scope via name and [is=name]
    _applySimpleSelectorScope(selector, scopeSelector, hostSelector) {
        // In Android browser, the lastIndex is not reset when the regex is used in String.replace()
        _polyfillHostRe.lastIndex = 0;
        if (_polyfillHostRe.test(selector)) {
            const replaceBy = this.strictStyling ? `[${hostSelector}]` : scopeSelector;
            return selector
                .replace(_polyfillHostNoCombinatorRe, (_, selector) => {
                return selector.replace(/([^:]*)(:*)(.*)/, (_, before, colon, after) => {
                    return before + replaceBy + colon + after;
                });
            })
                .replace(_polyfillHostRe, replaceBy + ' ');
        }
        return scopeSelector + ' ' + selector;
    }
    // return a selector with [name] suffix on each simple selector
    // e.g. .foo.bar > .zot becomes .foo[name].bar[name] > .zot[name]  /** @internal */
    _applyStrictSelectorScope(selector, scopeSelector, hostSelector) {
        const isRe = /\[is=([^\]]*)\]/g;
        scopeSelector = scopeSelector.replace(isRe, (_, ...parts) => parts[0]);
        const attrName = '[' + scopeSelector + ']';
        const _scopeSelectorPart = (p) => {
            let scopedP = p.trim();
            if (!scopedP) {
                return '';
            }
            if (p.indexOf(_polyfillHostNoCombinator) > -1) {
                scopedP = this._applySimpleSelectorScope(p, scopeSelector, hostSelector);
            }
            else {
                // remove :host since it should be unnecessary
                const t = p.replace(_polyfillHostRe, '');
                if (t.length > 0) {
                    const matches = t.match(/([^:]*)(:*)(.*)/);
                    if (matches) {
                        scopedP = matches[1] + attrName + matches[2] + matches[3];
                    }
                }
            }
            return scopedP;
        };
        const safeContent = new SafeSelector(selector);
        selector = safeContent.content();
        let scopedSelector = '';
        let startIndex = 0;
        let res;
        const sep = /( |>|\+|~(?!=))\s*/g;
        const scopeAfter = selector.indexOf(_polyfillHostNoCombinator);
        while ((res = sep.exec(selector)) !== null) {
            const separator = res[1];
            const part = selector.slice(startIndex, res.index).trim();
            // if a selector appears before :host-context it should not be shimmed as it
            // matches on ancestor elements and not on elements in the host's shadow
            const scopedPart = startIndex >= scopeAfter ? _scopeSelectorPart(part) : part;
            scopedSelector += `${scopedPart} ${separator} `;
            startIndex = sep.lastIndex;
        }
        scopedSelector += _scopeSelectorPart(selector.substring(startIndex));
        // replace the placeholders with their original values
        return safeContent.restore(scopedSelector);
    }
    _insertPolyfillHostInCssText(selector) {
        return selector
            .replace(_colonHostContextRe, _polyfillHostContext)
            .replace(_colonHostRe, _polyfillHost)
            .replace(_colonSlottedRe, _polyfillSlotted);
    }
}
class SafeSelector {
    constructor(selector) {
        this.placeholders = [];
        this.index = 0;
        // Replaces attribute selectors with placeholders.
        // The WS in [attr="va lue"] would otherwise be interpreted as a selector separator.
        selector = selector.replace(/(\[[^\]]*\])/g, (_, keep) => {
            const replaceBy = `__ph-${this.index}__`;
            this.placeholders.push(keep);
            this.index++;
            return replaceBy;
        });
        // Replaces the expression in `:nth-child(2n + 1)` with a placeholder.
        // WS and "+" would otherwise be interpreted as selector separators.
        this._content = selector.replace(/(:nth-[-\w]+)(\([^)]+\))/g, (_, pseudo, exp) => {
            const replaceBy = `__ph-${this.index}__`;
            this.placeholders.push(exp);
            this.index++;
            return pseudo + replaceBy;
        });
    }
    restore(content) {
        return content.replace(/__ph-(\d+)__/g, (_, index) => this.placeholders[+index]);
    }
    content() { return this._content; }
}
const _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?(['"])(.*?)\1[;\s]*}([^{]*?){/gim;
const _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _polyfillHost = '-shadowcsshost';
const _polyfillSlotted = '-shadowcssslotted';
// note: :host-context pre-processed to -shadowcsshostcontext.
const _polyfillHostContext = '-shadowcsscontext';
const _parenSuffix = ')(?:\\((' +
    '(?:\\([^)(]*\\)|[^)(]*)+?' +
    ')\\))?([^,{]*)';
const _cssColonHostRe = new RegExp('(' + _polyfillHost + _parenSuffix, 'gim');
const _cssColonHostContextRe = new RegExp('(' + _polyfillHostContext + _parenSuffix, 'gim');
const _cssColonSlottedRe = new RegExp('(' + _polyfillSlotted + _parenSuffix, 'gim');
const _polyfillHostNoCombinator = _polyfillHost + '-no-combinator';
const _polyfillHostNoCombinatorRe = /-shadowcsshost-no-combinator([^\s]*)/;
const _shadowDOMSelectorsRe = [
    /::shadow/g,
    /::content/g,
    // Deprecated selectors
    /\/shadow-deep\//g,
    /\/shadow\//g,
];
// The deep combinator is deprecated in the CSS spec
// Support for `>>>`, `deep`, `::ng-deep` is then also deprecated and will be removed in the future.
// see https://github.com/angular/angular/pull/17677
const _shadowDeepSelectors = /(?:>>>)|(?:\/deep\/)|(?:::ng-deep)/g;
const _selectorReSuffix = '([>\\s~+\[.,{:][\\s\\S]*)?$';
const _polyfillHostRe = /-shadowcsshost/gim;
const _colonHostRe = /:host/gim;
const _colonSlottedRe = /::slotted/gim;
const _colonHostContextRe = /:host-context/gim;
const _commentRe = /\/\*\s*[\s\S]*?\*\//g;
function stripComments(input) {
    return input.replace(_commentRe, '');
}
// all comments except inline source mapping
const _sourceMappingUrlRe = /\/\*\s*#\s*sourceMappingURL=[\s\S]+?\*\//;
function extractSourceMappingUrl(input) {
    const matcher = input.match(_sourceMappingUrlRe);
    return matcher ? matcher[0] : '';
}
const _ruleRe = /(\s*)([^;\{\}]+?)(\s*)((?:{%BLOCK%}?\s*;?)|(?:\s*;))/g;
const _curlyRe = /([{}])/g;
const OPEN_CURLY = '{';
const CLOSE_CURLY = '}';
const BLOCK_PLACEHOLDER = '%BLOCK%';
class CssRule {
    constructor(selector, content) {
        this.selector = selector;
        this.content = content;
    }
}
function processRules(input, ruleCallback) {
    const inputWithEscapedBlocks = escapeBlocks(input);
    let nextBlockIndex = 0;
    return inputWithEscapedBlocks.escapedString.replace(_ruleRe, function (...m) {
        const selector = m[2];
        let content = '';
        let suffix = m[4];
        let contentPrefix = '';
        if (suffix && suffix.startsWith('{' + BLOCK_PLACEHOLDER)) {
            content = inputWithEscapedBlocks.blocks[nextBlockIndex++];
            suffix = suffix.substring(BLOCK_PLACEHOLDER.length + 1);
            contentPrefix = '{';
        }
        const rule = ruleCallback(new CssRule(selector, content));
        return `${m[1]}${rule.selector}${m[3]}${contentPrefix}${rule.content}${suffix}`;
    });
}
class StringWithEscapedBlocks {
    constructor(escapedString, blocks) {
        this.escapedString = escapedString;
        this.blocks = blocks;
    }
}
function escapeBlocks(input) {
    const inputParts = input.split(_curlyRe);
    const resultParts = [];
    const escapedBlocks = [];
    let bracketCount = 0;
    let currentBlockParts = [];
    for (let partIndex = 0; partIndex < inputParts.length; partIndex++) {
        const part = inputParts[partIndex];
        if (part === CLOSE_CURLY) {
            bracketCount--;
        }
        if (bracketCount > 0) {
            currentBlockParts.push(part);
        }
        else {
            if (currentBlockParts.length > 0) {
                escapedBlocks.push(currentBlockParts.join(''));
                resultParts.push(BLOCK_PLACEHOLDER);
                currentBlockParts = [];
            }
            resultParts.push(part);
        }
        if (part === OPEN_CURLY) {
            bracketCount++;
        }
    }
    if (currentBlockParts.length > 0) {
        escapedBlocks.push(currentBlockParts.join(''));
        resultParts.push(BLOCK_PLACEHOLDER);
    }
    return new StringWithEscapedBlocks(resultParts.join(''), escapedBlocks);
}

function scopeComponentCss(buildCtx, cmpMeta, cssText) {
    try {
        const scopeAttribute = getScopeAttribute(cmpMeta);
        const hostScopeAttr = getHostScopeAttribute(cmpMeta);
        const slotScopeAttr = getSlotScopeAttribute(cmpMeta);
        cssText = scopeCss(cssText, scopeAttribute, hostScopeAttr, slotScopeAttr);
    }
    catch (e) {
        catchError(buildCtx.diagnostics, e);
    }
    return cssText;
}
function scopeCss(cssText, scopeAttribute, hostScopeAttr, slotScopeAttr) {
    const sc = new ShadowCss();
    return sc.shimCssText(cssText, scopeAttribute, hostScopeAttr, slotScopeAttr);
}
function getScopeAttribute(cmpMeta) {
    return `data-${cmpMeta.tagNameMeta}`;
}
function getHostScopeAttribute(cmpMeta) {
    return `data-${cmpMeta.tagNameMeta}-host`;
}
function getSlotScopeAttribute(cmpMeta) {
    return `data-${cmpMeta.tagNameMeta}-slot`;
}

var __awaiter$36 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateStyles(config, compilerCtx, buildCtx, entryModules) {
    return __awaiter$36(this, void 0, void 0, function* () {
        yield Promise.all(entryModules.map((bundle) => __awaiter$36(this, void 0, void 0, function* () {
            yield Promise.all(bundle.moduleFiles.map((moduleFile) => __awaiter$36(this, void 0, void 0, function* () {
                yield generateComponentStyles(config, compilerCtx, buildCtx, moduleFile);
            })));
        })));
    });
}
function generateComponentStyles(config, compilerCtx, buildCtx, moduleFile) {
    return __awaiter$36(this, void 0, void 0, function* () {
        const stylesMeta = moduleFile.cmpMeta.stylesMeta = moduleFile.cmpMeta.stylesMeta || {};
        yield Promise.all(Object.keys(stylesMeta).map((modeName) => __awaiter$36(this, void 0, void 0, function* () {
            // compile each style mode's sass/css
            const styles = yield compileStyles(config, compilerCtx, buildCtx, moduleFile, stylesMeta[modeName]);
            // format and set the styles for use later
            yield setStyleText(config, compilerCtx, buildCtx, moduleFile.cmpMeta, stylesMeta[modeName], styles);
        })));
    });
}
function compileStyles(config, compilerCtx, buildCtx, moduleFile, styleMeta) {
    return __awaiter$36(this, void 0, void 0, function* () {
        const extStylePaths = styleMeta.externalStyles.map(extStyle => {
            return extStyle.absolutePath;
        });
        if (typeof styleMeta.styleStr === 'string') {
            // plain styles just in a string
            // let's put these file in an in-memory file
            const inlineAbsPath = moduleFile.jsFilePath + '.css';
            extStylePaths.push(inlineAbsPath);
            yield compilerCtx.fs.writeFile(inlineAbsPath, styleMeta.styleStr, { inMemoryOnly: true });
        }
        const styles = yield Promise.all(extStylePaths.map(extStylePath => {
            return compileExternalStyle(config, compilerCtx, buildCtx, moduleFile, extStylePath);
        }));
        return styles;
    });
}
function compileExternalStyle(config, compilerCtx, buildCtx, moduleFile, extStylePath) {
    return __awaiter$36(this, void 0, void 0, function* () {
        extStylePath = normalizePath(extStylePath);
        if (moduleFile.isCollectionDependency) {
            // if it's a collection dependency and it's a preprocessor file like sass
            // AND we have the correct plugin then let's compile it
            const hasPlugin = hasPluginInstalled(config, extStylePath);
            if (!hasPlugin) {
                // the collection has this style as a preprocessor file, like sass
                // however the user doesn't have this plugin installed, which is file
                // instead of using the preprocessor file (sass) use the vanilla css file
                const parts = extStylePath.split('.');
                parts[parts.length - 1] = 'css';
                extStylePath = parts.join('.');
            }
        }
        else {
            // not a collection dependency
            // check known extensions just for a helpful message
            checkPluginHelpers(config, buildCtx, extStylePath);
        }
        const transformResults = yield runPluginTransforms(config, compilerCtx, buildCtx, extStylePath);
        if (config.generateDistribution && !moduleFile.isCollectionDependency) {
            const relPath = config.sys.path.relative(config.srcDir, transformResults.id);
            const collectionPath = config.sys.path.join(config.collectionDir, relPath);
            yield compilerCtx.fs.writeFile(collectionPath, transformResults.code);
        }
        return transformResults.code;
    });
}
function checkPluginHelpers(config, buildCtx, externalStylePath) {
    PLUGIN_HELPERS.forEach(p => {
        checkPluginHelper(config, buildCtx, externalStylePath, p.pluginExts, p.pluginId, p.pluginName);
    });
}
function checkPluginHelper(config, buildCtx, externalStylePath, pluginExts, pluginId, pluginName) {
    if (!hasFileExtension(externalStylePath, pluginExts)) {
        return;
    }
    if (config.plugins.some(p => p.name === pluginId)) {
        return;
    }
    const errorKey = 'styleError' + pluginId;
    if (buildCtx.data[errorKey]) {
        // already added this key
        return;
    }
    buildCtx.data[errorKey] = true;
    const relPath = config.sys.path.relative(config.rootDir, externalStylePath);
    const msg = [
        `Style "${relPath}" is a ${pluginName} file, however the "${pluginId}" `,
        `plugin has not been installed. Please install the "@stencil/${pluginId}" `,
        `plugin and add it to "config.plugins" within the project's stencil.config.js `,
        `file. For more info please see: https://www.npmjs.com/package/@stencil/${pluginId}`
    ].join('');
    const d = buildError(buildCtx.diagnostics);
    d.header = 'style error';
    d.messageText = msg;
}
function hasPluginInstalled(config, filePath) {
    // TODO: don't hard these
    const plugin = PLUGIN_HELPERS.find(p => hasFileExtension(filePath, p.pluginExts));
    if (plugin) {
        return config.plugins.some(p => p.name === plugin.pluginId);
    }
    return false;
}
function setStyleText(config, compilerCtx, buildCtx, cmpMeta, styleMeta, styles) {
    return __awaiter$36(this, void 0, void 0, function* () {
        // join all the component's styles for this mode together into one line
        if (config.minifyCss) {
            styleMeta.compiledStyleText = yield minifyStyle(config, compilerCtx, buildCtx.diagnostics, styles.join(''));
        }
        else {
            styleMeta.compiledStyleText = styles.join('\n\n').trim();
        }
        if (requiresScopedStyles(cmpMeta.encapsulation)) {
            // only create scoped styles if we need to
            styleMeta.compiledStyleTextScoped = scopeComponentCss(buildCtx, cmpMeta, styleMeta.compiledStyleText);
        }
        styleMeta.compiledStyleText = escapeCssForJs(styleMeta.compiledStyleText);
        if (styleMeta.compiledStyleTextScoped) {
            styleMeta.compiledStyleTextScoped = escapeCssForJs(styleMeta.compiledStyleTextScoped);
        }
    });
}
function escapeCssForJs(style) {
    return style
        .replace(/\\[0-7]/g, (v) => '\\' + v)
        .replace(/\r\n|\r|\n/g, `\\n`)
        .replace(/\"/g, `\\"`)
        .replace(/\@/g, `\\@`);
}
function requiresScopedStyles(encapsulation) {
    return (encapsulation === 2 /* ScopedCss */ || encapsulation === 1 /* ShadowDom */);
}
const PLUGIN_HELPERS = [
    {
        pluginName: 'PostCSS',
        pluginId: 'postcss',
        pluginExts: ['pcss']
    },
    {
        pluginName: 'Sass',
        pluginId: 'sass',
        pluginExts: ['scss', 'sass']
    },
    {
        pluginName: 'Stylus',
        pluginId: 'stylus',
        pluginExts: ['styl', 'stylus']
    }, {
        pluginName: 'Less',
        pluginId: 'less',
        pluginExts: ['less']
    }
];

function validateComponentTag(tag) {
    if (typeof tag !== 'string') {
        throw new Error(`Tag "${tag}" must be a string type`);
    }
    tag = tag.trim().toLowerCase();
    if (tag.length === 0) {
        throw new Error(`Received empty tag value`);
    }
    if (tag.indexOf(' ') > -1) {
        throw new Error(`"${tag}" tag cannot contain a space`);
    }
    if (tag.indexOf(',') > -1) {
        throw new Error(`"${tag}" tag cannot be use for multiple tags`);
    }
    const invalidChars = tag.replace(/\w|-/g, '');
    if (invalidChars !== '') {
        throw new Error(`"${tag}" tag contains invalid characters: ${invalidChars}`);
    }
    if (tag.indexOf('-') === -1) {
        throw new Error(`"${tag}" tag must contain a dash (-) to work as a valid web component`);
    }
    if (tag.indexOf('--') > -1) {
        throw new Error(`"${tag}" tag cannot contain multiple dashes (--) next to each other`);
    }
    if (tag.indexOf('-') === 0) {
        throw new Error(`"${tag}" tag cannot start with a dash (-)`);
    }
    if (tag.lastIndexOf('-') === tag.length - 1) {
        throw new Error(`"${tag}" tag cannot end with a dash (-)`);
    }
    return tag;
}

function generateEntryModules(config, compilerCtx, buildCtx) {
    buildCtx.entryModules = [];
    // figure out all the actual import paths (basically which extension each import uses)
    calcModuleGraphImportPaths(compilerCtx, buildCtx.moduleGraphs);
    // figure out how modules and components connect
    calcComponentDependencies(compilerCtx.moduleFiles, buildCtx.moduleGraphs, buildCtx.componentRefs);
    try {
        const allModules = Object.keys(compilerCtx.moduleFiles).map(filePath => compilerCtx.moduleFiles[filePath]);
        const userConfigEntryModulesTags = getUserConfigEntryTags(config.bundles, allModules);
        const appEntryTags = getAppEntryTags(allModules);
        buildCtx.entryPoints = generateComponentEntries(allModules, userConfigEntryModulesTags, appEntryTags);
        const cleanedEntryModules = regroupEntryModules(allModules, buildCtx.entryPoints);
        buildCtx.entryModules = cleanedEntryModules.map(createEntryModule);
    }
    catch (e) {
        catchError(buildCtx.diagnostics, e);
    }
    return buildCtx.entryModules;
}
function getEntryEncapsulations(entryModule) {
    const encapsulations = [];
    entryModule.moduleFiles.forEach(m => {
        const encapsulation = m.cmpMeta.encapsulation || 0 /* NoEncapsulation */;
        if (!encapsulations.includes(encapsulation)) {
            encapsulations.push(encapsulation);
        }
    });
    if (encapsulations.length === 0) {
        encapsulations.push(0 /* NoEncapsulation */);
    }
    else if (encapsulations.includes(1 /* ShadowDom */) && !encapsulations.includes(2 /* ScopedCss */)) {
        encapsulations.push(2 /* ScopedCss */);
    }
    return encapsulations.sort();
}
function getEntryModes(moduleFiles) {
    const styleModeNames = [];
    moduleFiles.forEach(m => {
        const cmpStyleModes = getComponentStyleModes(m.cmpMeta);
        cmpStyleModes.forEach(modeName => {
            if (!styleModeNames.includes(modeName)) {
                styleModeNames.push(modeName);
            }
        });
    });
    if (styleModeNames.length === 0) {
        styleModeNames.push(DEFAULT_STYLE_MODE);
    }
    else if (styleModeNames.length > 1) {
        const index = (styleModeNames.indexOf(DEFAULT_STYLE_MODE));
        if (index > -1) {
            styleModeNames.splice(index, 1);
        }
    }
    return styleModeNames.sort();
}
function getComponentStyleModes(cmpMeta) {
    return (cmpMeta && cmpMeta.stylesMeta) ? Object.keys(cmpMeta.stylesMeta) : [];
}
function entryRequiresScopedStyles(encapsulations) {
    return encapsulations.some(e => requiresScopedStyles(e));
}
function regroupEntryModules(allModules, entryPoints) {
    const outtedNoEncapsulation = [];
    const outtedScopedCss = [];
    const outtedShadowDom = [];
    const cleanedEntryModules = [
        outtedNoEncapsulation,
        outtedScopedCss,
        outtedShadowDom
    ];
    entryPoints.forEach(entryPoint => {
        const entryModules = allModules.filter(m => {
            return entryPoint.some(ep => m.cmpMeta && ep.tag === m.cmpMeta.tagNameMeta);
        });
        const noEncapsulation = entryModules.filter(m => {
            return m.cmpMeta.encapsulation !== 2 /* ScopedCss */ && m.cmpMeta.encapsulation !== 1 /* ShadowDom */;
        });
        const scopedCss = entryModules.filter(m => {
            return m.cmpMeta.encapsulation === 2 /* ScopedCss */;
        });
        const shadowDom = entryModules.filter(m => {
            return m.cmpMeta.encapsulation === 1 /* ShadowDom */;
        });
        if ((noEncapsulation.length > 0 && scopedCss.length === 0 && shadowDom.length === 0) ||
            (noEncapsulation.length === 0 && scopedCss.length > 0 && shadowDom.length === 0) ||
            (noEncapsulation.length === 0 && scopedCss.length === 0 && shadowDom.length > 0)) {
            cleanedEntryModules.push(entryModules);
        }
        else if (noEncapsulation.length >= scopedCss.length && noEncapsulation.length >= shadowDom.length) {
            cleanedEntryModules.push(noEncapsulation);
            outtedScopedCss.push(...scopedCss);
            outtedShadowDom.push(...shadowDom);
        }
        else if (scopedCss.length >= noEncapsulation.length && scopedCss.length >= shadowDom.length) {
            cleanedEntryModules.push(scopedCss);
            outtedNoEncapsulation.push(...noEncapsulation);
            outtedShadowDom.push(...shadowDom);
        }
        else if (shadowDom.length >= noEncapsulation.length && shadowDom.length >= scopedCss.length) {
            cleanedEntryModules.push(shadowDom);
            outtedNoEncapsulation.push(...noEncapsulation);
            outtedScopedCss.push(...scopedCss);
        }
    });
    return cleanedEntryModules
        .filter(m => m.length > 0)
        .sort((a, b) => {
        if (a[0].cmpMeta.tagNameMeta < b[0].cmpMeta.tagNameMeta)
            return -1;
        if (a[0].cmpMeta.tagNameMeta > b[0].cmpMeta.tagNameMeta)
            return 1;
        if (a.length < b.length)
            return -1;
        if (a.length > b.length)
            return 1;
        return 0;
    });
}
function createEntryModule(moduleFiles) {
    const entryModule = {
        moduleFiles: moduleFiles
    };
    // generate a unique entry key based on the components within this entry module
    entryModule.entryKey = 'entry:' + entryModule.moduleFiles
        .sort((a, b) => {
        if (a.isCollectionDependency && !b.isCollectionDependency) {
            return 1;
        }
        if (!a.isCollectionDependency && b.isCollectionDependency) {
            return -1;
        }
        if (a.cmpMeta.tagNameMeta < b.cmpMeta.tagNameMeta)
            return -1;
        if (a.cmpMeta.tagNameMeta > b.cmpMeta.tagNameMeta)
            return 1;
        return 0;
    })
        .map(m => {
        return m.cmpMeta.tagNameMeta;
    }).join('.');
    // get the modes used in this bundle
    entryModule.modeNames = getEntryModes(entryModule.moduleFiles);
    // get the encapsulations used in this bundle
    const encapsulations = getEntryEncapsulations(entryModule);
    // figure out if we'll need a scoped css build
    entryModule.requiresScopedStyles = entryRequiresScopedStyles(encapsulations);
    return entryModule;
}
function getAppEntryTags(allModules) {
    return allModules
        .filter(m => m.cmpMeta && !m.isCollectionDependency)
        .map(m => m.cmpMeta.tagNameMeta)
        .sort((a, b) => {
        if (a.length < b.length)
            return 1;
        if (a.length > b.length)
            return -1;
        if (a[0] < b[0])
            return -1;
        if (a[0] > b[0])
            return 1;
        return 0;
    });
}
function getUserConfigEntryTags(configBundles, allModules) {
    configBundles = (configBundles || [])
        .filter(b => b.components && b.components.length > 0)
        .sort((a, b) => {
        if (a.components.length < b.components.length)
            return 1;
        if (a.components.length > b.components.length)
            return -1;
        return 0;
    });
    const definedTags = [];
    const entryTags = configBundles
        .map(b => {
        return b.components
            .map(tag => {
            tag = validateComponentTag(tag);
            const moduleFile = allModules.find(m => m.cmpMeta && m.cmpMeta.tagNameMeta === tag);
            if (!moduleFile) {
                throw new Error(`Component tag "${tag}" is defined in a bundle but no matching component was found within this app or its collections.`);
            }
            if (definedTags.includes(tag)) {
                throw new Error(`Component tag "${tag}" has been defined multiple times in the "bundles" config.`);
            }
            definedTags.push(tag);
            return tag;
        })
            .sort();
    });
    return entryTags;
}

var __awaiter$37 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function injectRegisterServiceWorker(config, swConfig, indexHtml) {
    return __awaiter$37(this, void 0, void 0, function* () {
        const match = indexHtml.match(BODY_CLOSE_REG);
        let swUrl = config.sys.path.relative(config.wwwDir, swConfig.swDest);
        if (swUrl.charAt(0) !== '/') {
            swUrl = '/' + swUrl;
        }
        if (match) {
            const serviceWorker = getRegisterSwScript(swUrl);
            indexHtml = indexHtml.replace(match[0], `<script>${serviceWorker}</script>\n${match[0]}`);
        }
        return indexHtml;
    });
}
function injectUnregisterServiceWorker(indexHtml) {
    const match = indexHtml.match(BODY_CLOSE_REG);
    if (match) {
        indexHtml = indexHtml.replace(match[0], `${UNREGSITER_SW}\n${match[0]}`);
    }
    return indexHtml;
}
function getRegisterSwScript(swUrl) {
    return `
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', function(){
        navigator.serviceWorker.register('${swUrl}')
          .then(function(reg) {
            console.log('service worker registered', reg);

            reg.onupdatefound = function() {
              var installingWorker = reg.installing;

              installingWorker.onstatechange = function() {
                if (installingWorker.state === 'installed') {
                  window.dispatchEvent(new Event('swUpdate'))
                }
              }
            }
          })
          .catch(function(err) { console.log('service worker error', err) });
      });
    }
`;
}
const UNREGSITER_SW = `
  <script>
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      // auto-unregister service worker during dev mode
      navigator.serviceWorker.getRegistration().then(function(registration) {
        if (registration) {
          registration.unregister().then(function() { location.reload(true) });
        }
      });
    }
  </script>
`;
const BODY_CLOSE_REG = /<\/body>/i;

var __awaiter$38 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateIndexHtml(config, compilerCtx, buildCtx) {
    return __awaiter$38(this, void 0, void 0, function* () {
        if (canSkipGenerateIndexHtml(config, compilerCtx, buildCtx)) {
            // no need to rebuild index.html if there were no app file changes
            return;
        }
        // get the source index html content
        try {
            const indexSrcHtml = yield compilerCtx.fs.readFile(config.srcIndexHtml);
            try {
                yield setIndexHtmlContent(config, compilerCtx, indexSrcHtml);
            }
            catch (e) {
                catchError(buildCtx.diagnostics, e);
            }
        }
        catch (e) {
            // it's ok if there's no index file
            config.logger.debug(`no index html: ${config.srcIndexHtml}: ${e}`);
        }
    });
}
function canSkipGenerateIndexHtml(config, compilerCtx, buildCtx) {
    if ((compilerCtx.hasSuccessfulBuild && buildCtx.appFileBuildCount === 0) || hasError(buildCtx.diagnostics) || !config.generateWWW) {
        // no need to rebuild index.html if there were no app file changes
        return true;
    }
    return false;
}
function setIndexHtmlContent(config, compilerCtx, indexHtml) {
    return __awaiter$38(this, void 0, void 0, function* () {
        const swConfig = config.serviceWorker;
        if (!swConfig && config.devMode) {
            // if we're not generating a sw, and this is a dev build
            // then let's inject a script that always unregisters any service workers
            indexHtml = injectUnregisterServiceWorker(indexHtml);
        }
        else if (swConfig) {
            // we have a valid sw config, so we'll need to inject the register sw script
            indexHtml = yield injectRegisterServiceWorker(config, swConfig, indexHtml);
        }
        // add the prerendered html to our list of files to write
        yield compilerCtx.fs.writeFile(config.wwwIndexHtml, indexHtml);
        config.logger.debug(`optimizeHtml, write: ${config.wwwIndexHtml}`);
    });
}

const AUTO_GENERATE_COMMENT = `<!-- Auto Generated Below -->`;
const NOTE = `*Built with [StencilJS](https://stenciljs.com/)*`;

function getMemberDocumentation(jsDoc) {
    if (jsDoc && jsDoc.documentation) {
        return jsDoc.documentation.trim();
    }
    return '';
}

class MarkdownAttrs {
    constructor() {
        this.rows = [];
    }
    addRow(memberMeta) {
        this.rows.push(new Row(memberMeta));
    }
    toMarkdown() {
        const content = [];
        if (!this.rows.length) {
            return content;
        }
        content.push(`## Attributes`);
        content.push(``);
        this.rows = this.rows.sort((a, b) => {
            if (a.memberMeta.attribName < b.memberMeta.attribName)
                return -1;
            if (a.memberMeta.attribName > b.memberMeta.attribName)
                return 1;
            return 0;
        });
        this.rows.forEach(row => {
            content.push(...row.toMarkdown());
        });
        return content;
    }
}
class Row {
    constructor(memberMeta) {
        this.memberMeta = memberMeta;
    }
    toMarkdown() {
        const content = [];
        content.push(`#### ${this.memberMeta.attribName}`);
        content.push(``);
        content.push(getPropType(this.memberMeta.propType));
        content.push(``);
        const doc = getMemberDocumentation(this.memberMeta.jsdoc);
        if (doc) {
            content.push(doc);
            content.push(``);
        }
        content.push(``);
        return content;
    }
}
function getPropType(propType) {
    switch (propType) {
        case 1 /* Any */:
            return 'any';
        case 3 /* Boolean */:
            return 'boolean';
        case 4 /* Number */:
            return 'number';
        case 2 /* String */:
            return 'string';
    }
    return '';
}

class MarkdownEvents {
    constructor() {
        this.rows = [];
    }
    addRow(eventMeta) {
        this.rows.push(new Row$1(eventMeta));
    }
    toMarkdown() {
        const content = [];
        if (!this.rows.length) {
            return content;
        }
        content.push(`## Events`);
        content.push(``);
        this.rows = this.rows.sort((a, b) => {
            if (a.eventMeta.eventName < b.eventMeta.eventName)
                return -1;
            if (a.eventMeta.eventName > b.eventMeta.eventName)
                return 1;
            return 0;
        });
        this.rows.forEach(row => {
            content.push(...row.toMarkdown());
        });
        return content;
    }
}
let Row$1 = class Row {
    constructor(eventMeta) {
        this.eventMeta = eventMeta;
    }
    toMarkdown() {
        const content = [];
        content.push(`#### ${this.eventMeta.eventName}`);
        content.push(``);
        const doc = getMemberDocumentation(this.eventMeta.jsdoc);
        if (doc) {
            content.push(doc);
            content.push(``);
        }
        content.push(``);
        return content;
    }
};

class MarkdownMethods {
    constructor() {
        this.rows = [];
    }
    addRow(memberName, memberMeta) {
        this.rows.push(new Row$2(memberName, memberMeta));
    }
    toMarkdown() {
        const content = [];
        if (!this.rows.length) {
            return content;
        }
        content.push(`## Methods`);
        content.push(``);
        this.rows = this.rows.sort((a, b) => {
            if (a.memberName < b.memberName)
                return -1;
            if (a.memberName > b.memberName)
                return 1;
            return 0;
        });
        this.rows.forEach(row => {
            content.push(...row.toMarkdown());
        });
        return content;
    }
}
let Row$2 = class Row {
    constructor(memberName, memberMeta) {
        this.memberName = memberName;
        this.memberMeta = memberMeta;
    }
    toMarkdown() {
        const content = [];
        content.push(`#### ${this.memberName}()`);
        content.push(``);
        const doc = getMemberDocumentation(this.memberMeta.jsdoc);
        if (doc) {
            content.push(doc);
            content.push(``);
        }
        content.push(``);
        return content;
    }
};

class MarkdownProps {
    constructor() {
        this.rows = [];
    }
    addRow(memberName, memberMeta) {
        this.rows.push(new Row$3(memberName, memberMeta));
    }
    toMarkdown() {
        const content = [];
        if (!this.rows.length) {
            return content;
        }
        content.push(`## Properties`);
        content.push(``);
        this.rows = this.rows.sort((a, b) => {
            if (a.memberName < b.memberName)
                return -1;
            if (a.memberName > b.memberName)
                return 1;
            return 0;
        });
        this.rows.forEach(row => {
            content.push(...row.toMarkdown());
        });
        return content;
    }
}
let Row$3 = class Row {
    constructor(memberName, memberMeta) {
        this.memberName = memberName;
        this.memberMeta = memberMeta;
    }
    toMarkdown() {
        const content = [];
        content.push(`#### ${this.memberName}`);
        content.push(``);
        content.push(getPropType$1(this.memberMeta.propType));
        content.push(``);
        const doc = getMemberDocumentation(this.memberMeta.jsdoc);
        if (doc) {
            content.push(doc);
            content.push(``);
        }
        content.push(``);
        return content;
    }
};
function getPropType$1(propType) {
    switch (propType) {
        case 1 /* Any */:
            return 'any';
        case 3 /* Boolean */:
            return 'boolean';
        case 4 /* Number */:
            return 'number';
        case 2 /* String */:
            return 'string';
    }
    return '';
}

function addAutoGenerate(cmpMeta, content) {
    content.push(AUTO_GENERATE_COMMENT);
    content.push(``);
    content.push(``);
    content.push(...generateMemberMarkdown(cmpMeta));
    content.push(``);
    content.push(`----------------------------------------------`);
    content.push(``);
    content.push(NOTE);
    content.push(``);
}
function generateMemberMarkdown(cmpMeta) {
    const attrs = new MarkdownAttrs();
    const events = new MarkdownEvents();
    const methods = new MarkdownMethods();
    const props = new MarkdownProps();
    cmpMeta.membersMeta && Object.keys(cmpMeta.membersMeta).forEach(memberName => {
        const memberMeta = cmpMeta.membersMeta[memberName];
        if (memberMeta.memberType === 1 /* Prop */ || memberMeta.memberType === 2 /* PropMutable */) {
            props.addRow(memberName, memberMeta);
            if (memberMeta.attribName) {
                attrs.addRow(memberMeta);
            }
        }
        else if (memberMeta.memberType === 6 /* Method */) {
            methods.addRow(memberName, memberMeta);
        }
    });
    cmpMeta.eventsMeta && cmpMeta.eventsMeta.forEach(ev => {
        events.addRow(ev);
    });
    return [
        ...props.toMarkdown(),
        ...attrs.toMarkdown(),
        ...events.toMarkdown(),
        ...methods.toMarkdown()
    ];
}

var __awaiter$39 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateReadmes(config, ctx) {
    if (!config.generateDocs) {
        return Promise.resolve();
    }
    const cmpDirectories = [];
    const promises = [];
    const warnings = [];
    const moduleFiles = Object.keys(ctx.moduleFiles).sort();
    moduleFiles.forEach(filePath => {
        const moduleFile = ctx.moduleFiles[filePath];
        if (!moduleFile.cmpMeta || moduleFile.isCollectionDependency) {
            return;
        }
        const dirPath = config.sys.path.dirname(filePath);
        if (cmpDirectories.includes(dirPath)) {
            if (!warnings.includes(dirPath)) {
                config.logger.warn(`multiple components found in: ${dirPath}`);
                warnings.push(dirPath);
            }
        }
        else {
            cmpDirectories.push(dirPath);
            promises.push(genereateReadme(config, ctx, moduleFile, dirPath));
        }
    });
    return Promise.all(promises);
}
function genereateReadme(config, ctx, moduleFile, dirPath) {
    return __awaiter$39(this, void 0, void 0, function* () {
        const readMePath = config.sys.path.join(dirPath, 'readme.md');
        let existingContent = null;
        try {
            existingContent = yield ctx.fs.readFile(readMePath);
        }
        catch (e) { }
        if (typeof existingContent === 'string' && existingContent.trim() !== '') {
            // update
            return updateReadme(config, ctx, moduleFile, readMePath, existingContent);
        }
        else {
            // create
            return createReadme(config, ctx, moduleFile, readMePath);
        }
    });
}
function createReadme(config, ctx, moduleFile, readMePath) {
    return __awaiter$39(this, void 0, void 0, function* () {
        const content = [];
        content.push(`# ${moduleFile.cmpMeta.tagNameMeta}`);
        content.push(``);
        content.push(``);
        content.push(``);
        addAutoGenerate(moduleFile.cmpMeta, content);
        yield ctx.fs.writeFile(readMePath, content.join('\n'));
        config.logger.info(`created readme docs: ${moduleFile.cmpMeta.tagNameMeta}`);
    });
}
function updateReadme(config, ctx, moduleFile, readMePath, existingContent) {
    return __awaiter$39(this, void 0, void 0, function* () {
        if (typeof existingContent !== 'string' || existingContent.trim() === '') {
            throw new Error('missing existing content');
        }
        const content = [];
        const existingLines = existingContent.split(/(\r?\n)/);
        let foundAutoGenerate = false;
        for (var i = 0; i < existingLines.length; i++) {
            if (existingLines[i].trim() === AUTO_GENERATE_COMMENT) {
                foundAutoGenerate = true;
                break;
            }
            if (existingLines[i] !== '\n' && existingLines[i] !== '\r') {
                content.push(existingLines[i]);
            }
        }
        if (!foundAutoGenerate) {
            config.logger.warn(`Unable to find ${AUTO_GENERATE_COMMENT} comment for docs auto-generation updates: ${readMePath}`);
            return true;
        }
        addAutoGenerate(moduleFile.cmpMeta, content);
        const updatedContent = content.join('\n');
        if (updatedContent.trim() === existingContent.trim()) {
            return true;
        }
        yield ctx.fs.writeFile(readMePath, updatedContent);
        config.logger.info(`updated readme docs: ${moduleFile.cmpMeta.tagNameMeta}`);
        return true;
    });
}

function validateCollectinCompatibility(config, collection) {
    if (!collection.compiler) {
        // if there is no compiler data at all then this was probably
        // set on purpose and we should avoid doing any upgrading
        return [];
    }
    // fill in any default data if somehow it's missing entirely
    collection.compiler.name = collection.compiler.name || '@stencil/core';
    collection.compiler.version = collection.compiler.version || '0.0.1';
    collection.compiler.typescriptVersion = collection.compiler.typescriptVersion || '2.5.3';
    // figure out which compiler upgrades, if any, we need to do
    return calculateRequiredUpgrades(config, collection.compiler.version);
}
function calculateRequiredUpgrades(config, collectionVersion) {
    // CUSTOM CHECKS PER KNOWN BREAKING CHANGES
    // UNIT TEST UNIT TEST UNIT TEST
    const upgrades = [];
    if (config.sys.semver.lte(collectionVersion, '0.0.6-10')) {
        // 2017-10-04
        // between 0.0.5 and 0.0.6-11 we no longer have a custom JSX parser
        upgrades.push(0 /* JSX_Upgrade_From_0_0_5 */);
    }
    if (config.sys.semver.lte(collectionVersion, '0.1.0')) {
        // 2017-12-27
        // from 0.1.0 and earlier, metadata was stored separately
        // from the component constructor. Now it puts the metadata
        // as static properties on each component constructor
        upgrades.push(1 /* Metadata_Upgrade_From_0_1_0 */);
    }
    if (config.sys.semver.lte(collectionVersion, '0.2.0')) {
        // 2018-01-19
        // ensure all @stencil/core imports are removed
        upgrades.push(2 /* Remove_Stencil_Imports */);
    }
    if (config.sys.semver.lte(collectionVersion, '0.3.0')) {
        // 2018-01-30
        // add dependencies to component metadata
        upgrades.push(3 /* Add_Component_Dependencies */);
    }
    return upgrades;
}

function componentDependencies(compilerCtx, buildCtx) {
    return (transformContext) => {
        function visit(node, filePath) {
            if (node.kind === ts.SyntaxKind.CallExpression) {
                callExpression(buildCtx, filePath, node);
            }
            else if (node.kind === ts.SyntaxKind.StringLiteral) {
                stringLiteral(buildCtx, filePath, node);
            }
            return ts.visitEachChild(node, (node) => {
                return visit(node, filePath);
            }, transformContext);
        }
        return (tsSourceFile) => {
            const filePath = normalizePath(tsSourceFile.fileName);
            addPropConnects(compilerCtx, buildCtx.componentRefs, filePath);
            return visit(tsSourceFile, filePath);
        };
    };
}
function addPropConnects(compilerCtx, sourceStrings, filePath) {
    const moduleFile = compilerCtx.moduleFiles[filePath];
    const cmpMeta = (moduleFile && moduleFile.cmpMeta);
    if (!cmpMeta) {
        return;
    }
    if (cmpMeta.membersMeta) {
        Object.keys(cmpMeta.membersMeta).forEach(memberName => {
            const memberMeta = cmpMeta.membersMeta[memberName];
            if (memberMeta.memberType === 4 /* PropConnect */) {
                addPropConnect(compilerCtx, sourceStrings, filePath, memberMeta.ctrlId);
            }
        });
    }
}
function addPropConnect(compilerCtx, sourceStrings, filePath, tag) {
    sourceStrings.push({
        tag: tag,
        filePath: filePath
    });
    compilerCtx.collections.forEach(collection => {
        collection.bundles.forEach(bundle => {
            if (bundle.components.includes(tag)) {
                bundle.components.forEach(bundleTag => {
                    if (bundleTag !== tag) {
                        sourceStrings.push({
                            tag: bundleTag,
                            filePath: filePath
                        });
                    }
                });
            }
        });
    });
}
function callExpression(buildCtx, filePath, node) {
    if (node.arguments && node.arguments[0]) {
        if (node.expression.kind === ts.SyntaxKind.Identifier) {
            // h('tag')
            callExpressionArg(buildCtx, filePath, node.expression, node.arguments);
        }
        else if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            // document.createElement('tag')
            if (node.expression.name) {
                // const
                callExpressionArg(buildCtx, filePath, node.expression.name, node.arguments);
            }
        }
    }
}
function callExpressionArg(buildCtx, filePath, callExpressionName, args) {
    if (TAG_CALL_EXPRESSIONS.includes(callExpressionName.escapedText)) {
        if (args[0].kind === ts.SyntaxKind.StringLiteral) {
            const tag = args[0].text;
            if (typeof tag === 'string') {
                buildCtx.componentRefs.push({
                    tag: tag,
                    filePath: filePath
                });
            }
        }
    }
}
function stringLiteral(buildCtx, filePath, node) {
    if (typeof node.text === 'string' && node.text.includes('<')) {
        buildCtx.componentRefs.push({
            html: node.text,
            filePath: filePath
        });
    }
}
const TAG_CALL_EXPRESSIONS = [
    'h',
    'createElement',
    'createElementNS'
];

function removeStencilImports() {
    return (transformContext) => {
        function visitImport(importNode) {
            if (importNode.moduleSpecifier &&
                ts.isStringLiteral(importNode.moduleSpecifier) &&
                importNode.moduleSpecifier.text === '@stencil/core') {
                return null;
            }
            return importNode;
        }
        function visit(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                    return visitImport(node);
                default:
                    return ts.visitEachChild(node, visit, transformContext);
            }
        }
        return (tsSourceFile) => {
            return visit(tsSourceFile);
        };
    };
}

var __awaiter$40 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * Check if class has component decorator
 * @param classNode
 */
function isComponentClass(classNode) {
    if (!Array.isArray(classNode.decorators)) {
        return false;
    }
    const componentDecoratorIndex = classNode.decorators.findIndex(dec => (ts.isCallExpression(dec.expression) && dec.expression.expression.getText() === 'Component'));
    return (componentDecoratorIndex !== -1);
}
function isInstanceOfObjectMap(object) {
    return (!object.hasOwnProperty('kind') &&
        !object.hasOwnProperty('flags') &&
        !object.hasOwnProperty('pos') &&
        !object.hasOwnProperty('end'));
}
function getTextOfPropertyName(name) {
    switch (name.kind) {
        case ts.SyntaxKind.Identifier:
            return name.text;
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.NumericLiteral:
            return name.text;
        case ts.SyntaxKind.ComputedPropertyName:
            const expression = name.expression;
            if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) {
                return name.expression.text;
            }
    }
    return undefined;
}
function objectLiteralToObjectMap(objectLiteral) {
    const attrs = objectLiteral.properties;
    return attrs.reduce((final, attr) => {
        const name = getTextOfPropertyName(attr.name);
        let val;
        switch (attr.initializer.kind) {
            case ts.SyntaxKind.ObjectLiteralExpression:
                val = objectLiteralToObjectMap(attr.initializer);
                break;
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.PropertyAccessExpression:
            default:
                val = attr.initializer;
        }
        final[name] = val;
        return final;
    }, {});
}
function objectMapToObjectLiteral(objMap) {
    const newProperties = Object.keys(objMap).map((key) => {
        const value = objMap[key];
        if (!ts.isIdentifier(value) && isInstanceOfObjectMap(value)) {
            return ts.createPropertyAssignment(ts.createLiteral(key), objectMapToObjectLiteral(value));
        }
        return ts.createPropertyAssignment(ts.createLiteral(key), value);
    });
    return ts.createObjectLiteral(newProperties);
}
/**
 * Convert a js value into typescript AST
 * @param val array, object, string, boolean, or number
 * @returns Typescript Object Literal, Array Literal, String Literal, Boolean Literal, Numeric Literal
 */
function convertValueToLiteral(val) {
    if (val === String) {
        return ts.createIdentifier('String');
    }
    if (val === Number) {
        return ts.createIdentifier('Number');
    }
    if (val === Boolean) {
        return ts.createIdentifier('Boolean');
    }
    if (Array.isArray(val)) {
        return arrayToArrayLiteral(val);
    }
    if (typeof val === 'object') {
        return objectToObjectLiteral(val);
    }
    return ts.createLiteral(val);
}
/**
 * Convert a js object into typescript AST
 * @param obj key value object
 * @returns Typescript Object Literal Expression
 */
function objectToObjectLiteral(obj) {
    if (Object.keys(obj).length === 0) {
        return ts.createObjectLiteral([]);
    }
    const newProperties = Object.keys(obj).map((key) => {
        return ts.createPropertyAssignment(ts.createLiteral(key), convertValueToLiteral(obj[key]));
    });
    return ts.createObjectLiteral(newProperties);
}
/**
 * Convert a js array into typescript AST
 * @param list array
 * @returns Typescript Array Literal Expression
 */
function arrayToArrayLiteral(list) {
    const newList = list.map(convertValueToLiteral);
    return ts.createArrayLiteral(newList);
}
/**
 * Execute an array of transforms over a string containing typescript source
 * @param sourceText Typescript source as a string
 * @param transformers Array of transforms to run agains the source string
 * @returns a string
 */
function transformSourceString(fileName, sourceText, transformers) {
    return __awaiter$40(this, void 0, void 0, function* () {
        const transformed = ts.transform(ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2015), transformers);
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }, {
            onEmitNode: transformed.emitNodeWithNotification,
            substituteNode: transformed.substituteNode
        });
        const result = printer.printBundle(ts.createBundle(transformed.transformed));
        transformed.dispose();
        return result;
    });
}

/* tslint:disable */
function upgradeJsxProps(transformContext) {
    return (tsSourceFile) => {
        return visit(tsSourceFile);
        function visit(node) {
            switch (node.kind) {
                case ts.SyntaxKind.CallExpression:
                    const callNode = node;
                    if (callNode.expression.text === 'h') {
                        const tag = callNode.arguments[0];
                        if (tag && typeof tag.text === 'string') {
                            node = upgradeCall(callNode);
                        }
                    }
                default:
                    return ts.visitEachChild(node, (node) => {
                        return visit(node);
                    }, transformContext);
            }
        }
    };
}
function upgradeCall(callNode) {
    const [tag, props, ...children] = callNode.arguments;
    let newArgs = [];
    newArgs.push(upgradeTagName(tag));
    newArgs.push(upgradeProps(props));
    if (children != null) {
        newArgs = newArgs.concat(upgradeChildren(children));
    }
    return ts.updateCall(callNode, callNode.expression, undefined, newArgs);
}
function upgradeTagName(tagName) {
    if (ts.isNumericLiteral(tagName) &&
        tagName.text === '0') {
        return ts.createLiteral('slot');
    }
    return tagName;
}
function upgradeProps(props) {
    let upgradedProps = {};
    let propHackValue;
    if (!ts.isObjectLiteralExpression(props)) {
        return ts.createNull();
    }
    const objectProps = objectLiteralToObjectMap(props);
    upgradedProps = Object.keys(objectProps).reduce((newProps, propName) => {
        const propValue = objectProps[propName];
        // If the propname is c, s, or k then map to proper name
        if (propName === 'c') {
            return Object.assign({}, newProps, { 'class': propValue });
        }
        if (propName === 's') {
            return Object.assign({}, newProps, { 'style': propValue });
        }
        if (propName === 'k') {
            return Object.assign({}, newProps, { 'key': propValue });
        }
        // If the propname is p or a then spread the value into props
        if (propName === 'a') {
            return Object.assign({}, newProps, propValue);
        }
        if (propName === 'p') {
            if (isInstanceOfObjectMap(propValue)) {
                return Object.assign({}, newProps, propValue);
            }
            else {
                propHackValue = propValue;
            }
        }
        // If the propname is o then we need to update names and then spread into props
        if (propName === 'o') {
            const eventListeners = Object.keys(propValue).reduce((newValue, eventName) => {
                return Object.assign({}, newValue, { [`on${eventName}`]: propValue[eventName] });
            }, {});
            return Object.assign({}, newProps, eventListeners);
        }
        return newProps;
    }, upgradedProps);
    try {
    }
    catch (e) {
        console.log(upgradedProps);
        console.log(objectProps);
        console.log(props);
        throw e;
    }
    const response = objectMapToObjectLiteral(upgradedProps);
    // Looks like someone used the props hack. So we need to create the following code:
    // Object.assign({}, upgradedProps, propHackValue);
    if (propHackValue) {
        const emptyObjectLiteral = ts.createObjectLiteral();
        return ts.createCall(ts.createPropertyAccess(ts.createIdentifier('Object'), ts.createIdentifier('assign')), undefined, [emptyObjectLiteral, response, propHackValue]);
    }
    return response;
}
function upgradeChildren(children) {
    return children.map(upgradeChild);
}
function upgradeChild(child) {
    if (ts.isCallExpression(child) && child.expression.text === 't') {
        return child.arguments[0];
    }
    return child;
}

function addComponentMetadata(moduleFiles) {
    return (transformContext) => {
        function visitClass(classNode, cmpMeta) {
            const staticMembers = addStaticMeta(cmpMeta);
            const newMembers = Object.keys(staticMembers).map(memberName => {
                return createGetter(memberName, staticMembers[memberName]);
            });
            return ts.updateClassDeclaration(classNode, classNode.decorators, classNode.modifiers, classNode.name, classNode.typeParameters, classNode.heritageClauses, [...classNode.members, ...newMembers]);
        }
        function visit(node, cmpMeta) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                    return visitClass(node, cmpMeta);
                default:
                    return ts.visitEachChild(node, (node) => {
                        return visit(node, cmpMeta);
                    }, transformContext);
            }
        }
        return (tsSourceFile) => {
            const moduleFile = moduleFiles[tsSourceFile.fileName];
            if (moduleFile && moduleFile.cmpMeta) {
                return visit(tsSourceFile, moduleFile.cmpMeta);
            }
            return tsSourceFile;
        };
    };
}
function addStaticMeta(cmpMeta) {
    const staticMembers = {};
    staticMembers.is = convertValueToLiteral(cmpMeta.tagNameMeta);
    if (cmpMeta.encapsulation === 1 /* ShadowDom */) {
        staticMembers.encapsulation = convertValueToLiteral('shadow');
    }
    else if (cmpMeta.encapsulation === 2 /* ScopedCss */) {
        staticMembers.encapsulation = convertValueToLiteral('scoped');
    }
    if (cmpMeta.hostMeta && Object.keys(cmpMeta.hostMeta).length > 0) {
        staticMembers.host = convertValueToLiteral(cmpMeta.hostMeta);
    }
    const propertiesMeta = formatComponentConstructorProperties(cmpMeta.membersMeta);
    if (propertiesMeta && Object.keys(propertiesMeta).length > 0) {
        staticMembers.properties = convertValueToLiteral(propertiesMeta);
    }
    const eventsMeta = formatComponentConstructorEvents(cmpMeta.eventsMeta);
    if (eventsMeta && eventsMeta.length > 0) {
        staticMembers.events = convertValueToLiteral(eventsMeta);
    }
    if (cmpMeta.stylesMeta) {
        const styleModes = Object.keys(cmpMeta.stylesMeta);
        if (styleModes.length > 0) {
            // awesome, we know we've got styles!
            // let's add the placeholder which we'll use later
            // after we generate the css
            staticMembers.style = convertValueToLiteral(getStylePlaceholder(cmpMeta.tagNameMeta));
            if (!cmpMeta.stylesMeta[DEFAULT_STYLE_MODE]) {
                // if there's only one style, then there's no need for styleId
                // but if there are numerous style modes, then we'll need to add this
                staticMembers.styleMode = convertValueToLiteral(getStyleIdPlaceholder(cmpMeta.tagNameMeta));
            }
        }
    }
    return staticMembers;
}
function createGetter(name, returnExpression) {
    return ts.createGetAccessor(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], name, undefined, undefined, ts.createBlock([
        ts.createReturn(returnExpression)
    ]));
}

function upgradeFromMetadata(moduleFiles) {
    const allModuleFiles = Object.keys(moduleFiles).map(filePath => {
        return moduleFiles[filePath];
    });
    return (tsSourceFile) => {
        const tsFilePath = normalizePath(tsSourceFile.fileName);
        let moduleFile = moduleFiles[tsFilePath];
        if (!moduleFile || !moduleFile.cmpMeta) {
            moduleFile = allModuleFiles.find(m => m.jsFilePath === tsFilePath);
        }
        if (moduleFile) {
            tsSourceFile = upgradeModuleFile(tsSourceFile, moduleFile.cmpMeta);
        }
        return tsSourceFile;
    };
}
function upgradeModuleFile(tsSourceFile, cmpMeta) {
    const staticMembers = addStaticMeta(cmpMeta);
    const newStatements = Object.keys(staticMembers).map(memberName => {
        return ts.createBinary(ts.createPropertyAccess(ts.createIdentifier(cmpMeta.componentClass), memberName), ts.createToken(ts.SyntaxKind.EqualsToken), staticMembers[memberName]);
    });
    return ts.updateSourceFileNode(tsSourceFile, [
        ...tsSourceFile.statements,
        ...newStatements
    ]);
}

var __awaiter$41 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function upgradeCollection(config, compilerCtx, buildCtx, collection) {
    return __awaiter$41(this, void 0, void 0, function* () {
        try {
            const upgradeTransforms = validateCollectinCompatibility(config, collection);
            if (upgradeTransforms.length === 0) {
                return;
            }
            const timeSpan = config.logger.createTimeSpan(`upgrade ${collection.collectionName} started`, true);
            const doUpgrade = createDoUpgrade(config, compilerCtx, buildCtx);
            yield doUpgrade(collection, upgradeTransforms);
            timeSpan.finish(`upgrade ${collection.collectionName} finished`);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
    });
}
function createDoUpgrade(config, compilerCtx, buildCtx) {
    return (collection, upgrades) => __awaiter$41(this, void 0, void 0, function* () {
        const upgradeTransforms = (upgrades.map((upgrade) => {
            switch (upgrade) {
                case 0 /* JSX_Upgrade_From_0_0_5 */:
                    config.logger.debug(`JSX_Upgrade_From_0_0_5, ${collection.collectionName}, compiled by v${collection.compiler.version}`);
                    return upgradeJsxProps;
                case 1 /* Metadata_Upgrade_From_0_1_0 */:
                    config.logger.debug(`Metadata_Upgrade_From_0_1_0, ${collection.collectionName}, compiled by v${collection.compiler.version}`);
                    return () => {
                        return upgradeFromMetadata(compilerCtx.moduleFiles);
                    };
                case 2 /* Remove_Stencil_Imports */:
                    config.logger.debug(`Remove_Stencil_Imports, ${collection.collectionName}, compiled by v${collection.compiler.version}`);
                    return (transformContext) => {
                        return removeStencilImports()(transformContext);
                    };
                case 3 /* Add_Component_Dependencies */:
                    config.logger.debug(`Add_Component_Dependencies, ${collection.collectionName}, compiled by v${collection.compiler.version}`);
                    return (transformContext) => {
                        return componentDependencies(compilerCtx, buildCtx)(transformContext);
                    };
            }
            return () => (tsSourceFile) => (tsSourceFile);
        }));
        yield Promise.all(collection.moduleFiles.map((moduleFile) => __awaiter$41(this, void 0, void 0, function* () {
            try {
                const source = yield compilerCtx.fs.readFile(moduleFile.jsFilePath);
                const output = yield transformSourceString(moduleFile.jsFilePath, source, upgradeTransforms);
                yield compilerCtx.fs.writeFile(moduleFile.jsFilePath, output, { inMemoryOnly: true });
            }
            catch (e) {
                const d = catchError(buildCtx.diagnostics, e);
                d.messageText = `error performing compiler upgrade on ${moduleFile.jsFilePath}: ${e}`;
            }
        })));
    });
}

var __awaiter$42 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function initCollections(config, compilerCtx, buildCtx) {
    return __awaiter$42(this, void 0, void 0, function* () {
        const uninitialized = compilerCtx.collections.filter(c => !c.isInitialized);
        return Promise.all(uninitialized.map((collection) => __awaiter$42(this, void 0, void 0, function* () {
            // Look at all dependent components from outside collections and
            // upgrade the components to be compatible with this version if need be
            yield upgradeCollection(config, compilerCtx, buildCtx, collection);
            collection.isInitialized = true;
        })));
    });
}

var __awaiter$43 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function initIndexHtml(config, compilerCtx, buildCtx) {
    return __awaiter$43(this, void 0, void 0, function* () {
        // if there isn't an index.html yet
        // let's generate a slim one quick so that
        // on the first build the user sees a loading indicator
        // this is synchronous on purpose so that it's saved
        // before the dev server fires up and loads the index.html page
        if (!config.generateWWW) {
            // only worry about this when generating www directory
            return;
        }
        // check if there's even a src index.html file
        const hasSrcIndexHtml = yield compilerCtx.fs.access(config.srcIndexHtml);
        if (!hasSrcIndexHtml) {
            // there is no src index.html file in the config, which is fine
            // since there is no src index file at all, don't bother
            // this isn't actually an error, don't worry about it
            return;
        }
        if (compilerCtx.hasSuccessfulBuild) {
            // we've already had a successful build, we're good
            // always recopy index.html (it's all cached if it didn't actually change, all good)
            const srcIndexHtmlContent = yield compilerCtx.fs.readFile(config.srcIndexHtml);
            yield compilerCtx.fs.writeFile(config.wwwIndexHtml, srcIndexHtmlContent);
            return;
        }
        try {
            // ok, so we haven't written an index.html build file yet
            // and we do know they have a src one, so let's write a
            // filler index.html file that shows while the first build is happening
            yield compilerCtx.fs.writeFile(config.wwwIndexHtml, APP_LOADING_HTML);
            yield compilerCtx.fs.commit();
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
    });
}
const APP_LOADING_HTML = `
<!DOCTYPE html>
<html dir="ltr" lang="en" data-init="app-dev-first-build-loader">
<head>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(function(registration) {
        registration.unregister();
      });
    }
  </script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="x-ua-compatible" content="IE=Edge">
  <title>Initializing First Build...</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      position: absolute;
      padding: 0;
      margin: 0;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    }
    .toast {
      position: absolute;
      top: 10px;
      right: 10px;
      left: 10px;
      margin: auto;
      max-width: 700px;
      border-radius: 3px;
      background: rgba(0,0,0,.9);
      -webkit-transform: translate3d(0px, -60px, 0px);
      transform: translate3d(0px, -60px, 0px);
      -webkit-transition: -webkit-transform 75ms ease-out;
      transition: transform 75ms ease-out;
      pointer-events: none;
    }

    .active {
      -webkit-transform: translate3d(0px, 0px, 0px);
      transform: translate3d(0px, 0px, 0px);
    }

    .content {
      display: flex;
      -webkit-align-items: center;
      -ms-flex-align: center;
      align-items: center;
      pointer-events: auto;
    }

    .message {
      -webkit-flex: 1;
      -ms-flex: 1;
      flex: 1;
      padding: 15px;
      font-size: 14px;
      color: #fff;
    }

    .spinner {
      position: relative;
      display: inline-block;
      width: 56px;
      height: 28px;
    }

    svg:not(:root) {
      overflow: hidden;
    }

    svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
      -webkit-animation: rotate 600ms linear infinite;
      animation: rotate 600ms linear infinite;
    }

    @-webkit-keyframes rotate {
      0% {
        -webkit-transform: rotate(0deg);
        transform: rotate(0deg);
      }
      100% {
        -webkit-transform: rotate(360deg);
        transform: rotate(360deg);
      }
    }

    @keyframes rotate {
      0% {
        -webkit-transform: rotate(0deg);
        transform: rotate(0deg);
      }
      100% {
        -webkit-transform: rotate(360deg);
        transform: rotate(360deg);
      }
    }

    svg circle {
      fill: transparent;
      stroke: white;
      stroke-width: 4px;
      stroke-dasharray: 128px;
      stroke-dashoffset: 82px;
    }
  </style>
</head>
<body>

  <div class="toast">
    <div class="content">
      <div class="message">Initializing First Build...</div>
      <div class="spinner">
        <svg viewBox="0 0 64 64"><circle transform="translate(32,32)" r="26"></circle></svg>
      </div>
    </div>
  </div>

  <script>
    setTimeout(function() {
      document.querySelector('.toast').classList.add('active');
    }, 100);

    setInterval(function() {
      try {
        var xhr = new XMLHttpRequest();
        xhr.addEventListener('load', function() {
          try {
            if (this.responseText.indexOf('app-dev-first-build-loader') === -1) {
              window.location.reload(true);
            }
          } catch (e) {
            console.error(e);
          }
        });
        var url = window.location.pathname + '?' + Math.random();
        xhr.open('GET', url);
        xhr.send();
      } catch (e) {
        console.error(e);
      }
    }, 1000);
  </script>

</body>
</html>
`;

var __awaiter$44 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * DEPRECATED "config.collections" since 0.6.0, 2018-02-13
 */
function _deprecatedConfigCollections(config, compilerCtx, buildCtx) {
    return __awaiter$44(this, void 0, void 0, function* () {
        const timeSpan = config.logger.createTimeSpan(`load collections started`, true);
        try {
            buildCtx.collections = yield loadConfigCollections(config, compilerCtx, buildCtx);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
        timeSpan.finish(`load collections finished`);
    });
}
function loadConfigCollections(config, compilerCtx, buildCtx) {
    // load up all of the collections which this app is dependent on
    return Promise.all(config._deprecatedCollections.map(configCollection => {
        return loadConfigCollection(config, compilerCtx, buildCtx, configCollection);
    }));
}
function loadConfigCollection(config, compilerCtx, buildCtx, configCollection) {
    return __awaiter$44(this, void 0, void 0, function* () {
        let collection = compilerCtx.collections.find(c => c.collectionName === configCollection.name);
        if (collection) {
            // we've already cached the collection, no need for another resolve/readFile/parse
            return collection;
        }
        // figure out the path to the dependent collection's package.json
        const collectionJsonFilePath = config.sys.resolveModule(config.rootDir, configCollection.name);
        // parse the dependent collection's package.json
        const packageJsonStr = yield compilerCtx.fs.readFile(collectionJsonFilePath);
        const packageData = JSON.parse(packageJsonStr);
        // verify this package has a "collection" property in its package.json
        if (!packageData.collection) {
            throw new Error(`stencil collection "${configCollection.name}" is missing the "collection" key from its package.json: ${collectionJsonFilePath}`);
        }
        // get the root directory of the dependency
        const collectionPackageRootDir = config.sys.path.dirname(collectionJsonFilePath);
        // figure out the full path to the collection collection file
        const collectionFilePath = pathJoin(config, collectionPackageRootDir, packageData.collection);
        config.logger.debug(`load colleciton: ${collectionFilePath}`);
        // we haven't cached the collection yet, let's read this file
        const collectionJsonStr = yield compilerCtx.fs.readFile(collectionFilePath);
        // get the directory where the collection collection file is sitting
        const collectionDir = normalizePath(config.sys.path.dirname(collectionFilePath));
        // parse the json string into our collection data
        collection = parseCollectionData(config, configCollection.name, collectionDir, collectionJsonStr);
        // append any collection data
        collection.moduleFiles.forEach(collectionModuleFile => {
            if (!compilerCtx.moduleFiles[collectionModuleFile.jsFilePath]) {
                compilerCtx.moduleFiles[collectionModuleFile.jsFilePath] = collectionModuleFile;
            }
        });
        // Look at all dependent components from outside collections and
        // upgrade the components to be compatible with this version if need be
        yield upgradeCollection(config, compilerCtx, buildCtx, collection);
        // cache it for later yo
        compilerCtx.collections.push(collection);
        // so let's recap: we've read the file, parsed it apart, and cached it, congrats
        return collection;
    });
}

var __awaiter$45 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function generateHostConfig(config, ctx, entryModules, hydrateResultss) {
    return __awaiter$45(this, void 0, void 0, function* () {
        const hostConfig = {
            hosting: {
                rules: []
            }
        };
        hydrateResultss = hydrateResultss.sort((a, b) => {
            if (a.url.toLowerCase() < b.url.toLowerCase())
                return -1;
            if (a.url.toLowerCase() > b.url.toLowerCase())
                return 1;
            return 0;
        });
        hydrateResultss.forEach(hydrateResults => {
            const hostRule = generateHostRule(config, ctx, entryModules, hydrateResults);
            if (hostRule) {
                hostConfig.hosting.rules.push(hostRule);
            }
        });
        addDefaults(config, hostConfig);
        const hostConfigFilePath = pathJoin(config, config.wwwDir, HOST_CONFIG_FILENAME);
        yield mergeUserHostConfigFile(config, ctx, hostConfig);
        yield ctx.fs.writeFile(hostConfigFilePath, JSON.stringify(hostConfig, null, 2));
    });
}
function generateHostRule(config, ctx, entryModules, hydrateResults) {
    const hostRule = {
        include: hydrateResults.path,
        headers: generateHostRuleHeaders(config, ctx, entryModules, hydrateResults)
    };
    if (hostRule.headers.length === 0) {
        return null;
    }
    return hostRule;
}
function generateHostRuleHeaders(config, ctx, entryModules, hydrateResults) {
    const hostRuleHeaders = [];
    addStyles(config, hostRuleHeaders, hydrateResults);
    addCoreJs(config, ctx.appCoreWWWPath, hostRuleHeaders);
    addBundles(config, entryModules, hostRuleHeaders, hydrateResults.components);
    addScripts(config, hostRuleHeaders, hydrateResults);
    addImgs(config, hostRuleHeaders, hydrateResults);
    return hostRuleHeaders;
}
function addCoreJs(config, appCoreWWWPath, hostRuleHeaders) {
    const relPath = pathJoin(config, '/', config.sys.path.relative(config.wwwDir, appCoreWWWPath));
    hostRuleHeaders.push(formatLinkRelPreloadHeader(relPath));
}
function addBundles(config, entryModules, hostRuleHeaders, components) {
    components = sortComponents(components);
    const bundleIds = getBundleIds(entryModules, components);
    bundleIds.forEach(bundleId => {
        if (hostRuleHeaders.length < MAX_LINK_REL_PRELOAD_COUNT) {
            const bundleUrl = getBundleUrl(config, bundleId);
            hostRuleHeaders.push(formatLinkRelPreloadHeader(bundleUrl));
        }
    });
}
function getBundleIds(entryModules, components) {
    const bundleIds = [];
    components.forEach(cmp => {
        entryModules.forEach(mb => {
            const moduleFile = mb.moduleFiles.find(mf => mf.cmpMeta && mf.cmpMeta.tagNameMeta === cmp.tag);
            if (!moduleFile) {
                return;
            }
            let bundleId;
            if (typeof moduleFile.cmpMeta.bundleIds === 'string') {
                bundleId = moduleFile.cmpMeta.bundleIds;
            }
            else {
                bundleId = moduleFile.cmpMeta.bundleIds[DEFAULT_MODE];
                if (!bundleId) {
                    bundleId = moduleFile.cmpMeta.bundleIds[DEFAULT_STYLE_MODE];
                }
            }
            if (bundleId && bundleIds.indexOf(bundleId) === -1) {
                bundleIds.push(bundleId);
            }
        });
    });
    return bundleIds;
}
function getBundleUrl(config, bundleId) {
    const unscopedFileName = getBundleFilename(bundleId, false);
    const unscopedWwwBuildPath = pathJoin(config, getAppWWWBuildDir(config), unscopedFileName);
    return pathJoin(config, '/', config.sys.path.relative(config.wwwDir, unscopedWwwBuildPath));
}
function sortComponents(components) {
    return components.sort((a, b) => {
        if (a.depth > b.depth)
            return -1;
        if (a.depth < b.depth)
            return 1;
        if (a.count > b.count)
            return -1;
        if (a.count < b.count)
            return 1;
        if (a.tag < b.tag)
            return -1;
        if (a.tag > b.tag)
            return 1;
        return 0;
    });
}
function addStyles(config, hostRuleHeaders, hydrateResults) {
    hydrateResults.styleUrls.forEach(styleUrl => {
        if (hostRuleHeaders.length >= MAX_LINK_REL_PRELOAD_COUNT) {
            return;
        }
        const url = config.sys.url.parse(styleUrl);
        if (url.hostname === hydrateResults.hostname) {
            hostRuleHeaders.push(formatLinkRelPreloadHeader(url.path));
        }
    });
}
function addScripts(config, hostRuleHeaders, hydrateResults) {
    hydrateResults.scriptUrls.forEach(scriptUrl => {
        if (hostRuleHeaders.length >= MAX_LINK_REL_PRELOAD_COUNT) {
            return;
        }
        const url = config.sys.url.parse(scriptUrl);
        if (url.hostname === hydrateResults.hostname) {
            hostRuleHeaders.push(formatLinkRelPreloadHeader(url.path));
        }
    });
}
function addImgs(config, hostRuleHeaders, hydrateResults) {
    hydrateResults.imgUrls.forEach(imgUrl => {
        if (hostRuleHeaders.length >= MAX_LINK_REL_PRELOAD_COUNT) {
            return;
        }
        const url = config.sys.url.parse(imgUrl);
        if (url.hostname === hydrateResults.hostname) {
            hostRuleHeaders.push(formatLinkRelPreloadHeader(url.path));
        }
    });
}
function formatLinkRelPreloadHeader(url) {
    const header = {
        name: 'Link',
        value: formatLinkRelPreloadValue(url)
    };
    return header;
}
function formatLinkRelPreloadValue(url) {
    const parts = [
        `<${url}>`,
        `rel=preload`
    ];
    const ext = url.split('.').pop().toLowerCase();
    if (ext === SCRIPT_EXT) {
        parts.push(`as=script`);
    }
    else if (ext === STYLE_EXT) {
        parts.push(`as=style`);
    }
    else if (IMG_EXTS.indexOf(ext) > -1) {
        parts.push(`as=image`);
    }
    return parts.join(';');
}
function addDefaults(config, hostConfig) {
    addBuildDirCacheControl(config, hostConfig);
    addServiceWorkerNoCacheControl(config, hostConfig);
}
function addBuildDirCacheControl(config, hostConfig) {
    const relPath = pathJoin(config, '/', config.sys.path.relative(config.wwwDir, getAppWWWBuildDir(config)), '**');
    hostConfig.hosting.rules.push({
        include: relPath,
        headers: [
            {
                name: `Cache-Control`,
                value: `public, max-age=31536000`
            }
        ]
    });
}
function addServiceWorkerNoCacheControl(config, hostConfig) {
    if (!config.serviceWorker) {
        return;
    }
    const swConfig = config.serviceWorker;
    const relPath = pathJoin(config, '/', config.sys.path.relative(config.wwwDir, swConfig.swDest));
    hostConfig.hosting.rules.push({
        include: relPath,
        headers: [
            {
                name: `Cache-Control`,
                value: `no-cache, no-store, must-revalidate`
            }
        ]
    });
}
function mergeUserHostConfigFile(config, ctx, hostConfig) {
    return __awaiter$45(this, void 0, void 0, function* () {
        const hostConfigFilePath = pathJoin(config, config.srcDir, HOST_CONFIG_FILENAME);
        try {
            const userHostConfigStr = yield ctx.fs.readFile(hostConfigFilePath);
            const userHostConfig = JSON.parse(userHostConfigStr);
            mergeUserHostConfig(userHostConfig, hostConfig);
        }
        catch (e) { }
    });
}
function mergeUserHostConfig(userHostConfig, hostConfig) {
    if (!userHostConfig || !userHostConfig.hosting) {
        return;
    }
    if (!Array.isArray(userHostConfig.hosting.rules)) {
        return;
    }
    const rules = userHostConfig.hosting.rules.concat(hostConfig.hosting.rules);
    hostConfig.hosting.rules = rules;
}
const DEFAULT_MODE = 'md';
const MAX_LINK_REL_PRELOAD_COUNT = 6;
const HOST_CONFIG_FILENAME = 'host.config.json';
const IMG_EXTS = ['png', 'gif', 'svg', 'jpg', 'jpeg', 'webp'];
const STYLE_EXT = 'css';
const SCRIPT_EXT = 'js';

function validatePrerenderConfig(config) {
    if (config.prerender && config.generateWWW) {
        if (typeof config.prerender !== 'object' || Array.isArray(config.prerender)) {
            config.prerender = {};
        }
        config.prerender = Object.assign({}, DEFAULT_SSR_CONFIG, DEFAULT_PRERENDER_CONFIG, config.prerender);
        if (typeof config.prerender.hydrateComponents !== 'boolean') {
            config.prerender.hydrateComponents = true;
        }
        if (!config.prerender.prerenderDir) {
            config.prerender.prerenderDir = config.wwwDir;
        }
        if (!config.sys.path.isAbsolute(config.prerender.prerenderDir)) {
            config.prerender.prerenderDir = normalizePath(config.sys.path.join(config.rootDir, config.prerender.prerenderDir));
        }
        config.buildEs5 = true;
    }
    else if (config.prerender !== null && config.generateWWW && !config.devMode) {
        config.prerender = {
            hydrateComponents: false,
            crawl: false,
            include: [
                { path: '/' }
            ],
            collapseWhitespace: DEFAULT_SSR_CONFIG.collapseWhitespace,
            inlineLoaderScript: DEFAULT_SSR_CONFIG.inlineLoaderScript,
            inlineStyles: false,
            inlineAssetsMaxSize: DEFAULT_SSR_CONFIG.inlineAssetsMaxSize,
            includePathQuery: DEFAULT_PRERENDER_CONFIG.includePathQuery,
            includePathHash: DEFAULT_PRERENDER_CONFIG.includePathHash,
            maxConcurrent: DEFAULT_PRERENDER_CONFIG.maxConcurrent,
            removeUnusedStyles: false
        };
        if (!config.prerender.prerenderDir) {
            config.prerender.prerenderDir = config.wwwDir;
        }
        if (!config.sys.path.isAbsolute(config.prerender.prerenderDir)) {
            config.prerender.prerenderDir = normalizePath(config.sys.path.join(config.rootDir, config.prerender.prerenderDir));
        }
    }
    else {
        config.prerender = null;
    }
}
const DEFAULT_PRERENDER_CONFIG = {
    crawl: true,
    include: [
        { path: '/' }
    ],
    includePathQuery: false,
    includePathHash: false,
    maxConcurrent: 4,
    hydrateComponents: true
};
const DEFAULT_SSR_CONFIG = {
    collapseWhitespace: true,
    inlineLoaderScript: true,
    inlineStyles: true,
    inlineAssetsMaxSize: 5000,
    removeUnusedStyles: true
};
const DEFAULT_PRERENDER_HOST = 'prerender.stenciljs.com';

function normalizeHydrateOptions(inputOpts) {
    const opts = Object.assign({}, DEFAULT_SSR_CONFIG, inputOpts);
    const req = opts.req;
    if (req && typeof req.get === 'function') {
        // assuming node express request object
        // https://expressjs.com/
        if (!opts.url)
            opts.url = req.protocol + '://' + req.get('host') + req.originalUrl;
        if (!opts.referrer)
            opts.referrer = req.get('referrer');
        if (!opts.userAgent)
            opts.userAgent = req.get('user-agent');
        if (!opts.cookie)
            opts.cookie = req.get('cookie');
    }
    return opts;
}
function generateHydrateResults(config, opts) {
    if (!opts.url) {
        opts.url = `https://${DEFAULT_PRERENDER_HOST}/`;
    }
    // https://nodejs.org/api/url.html
    const urlParse = config.sys.url.parse(opts.url);
    const hydrateResults = {
        diagnostics: [],
        url: opts.url,
        host: urlParse.host,
        hostname: urlParse.hostname,
        port: urlParse.port,
        path: urlParse.path,
        pathname: urlParse.pathname,
        search: urlParse.search,
        query: urlParse.query,
        hash: urlParse.hash,
        html: opts.html,
        styles: null,
        anchors: [],
        components: [],
        styleUrls: [],
        scriptUrls: [],
        imgUrls: [],
        opts: opts
    };
    createConsole(config, opts, hydrateResults);
    return hydrateResults;
}
function createConsole(config, opts, results) {
    const pathname = results.pathname;
    opts.console = opts.console || {};
    if (typeof opts.console.error !== 'function') {
        opts.console.error = function (...args) {
            results.diagnostics.push({
                level: `error`,
                type: `hydrate`,
                header: `runtime console.error: ${pathname}`,
                messageText: args.join(', ')
            });
        };
    }
    if (config.logger.level === 'debug') {
        ['debug', 'info', 'log', 'warn'].forEach(level => {
            if (typeof opts.console[level] !== 'function') {
                opts.console[level] = function (...args) {
                    results.diagnostics.push({
                        level: level,
                        type: 'hydrate',
                        header: `runtime console.${level}: ${pathname}`,
                        messageText: args.join(', ')
                    });
                };
            }
        });
    }
}
function normalizeDirection(doc, opts) {
    let dir = doc.body.getAttribute('dir');
    if (dir) {
        dir = dir.trim().toLowerCase();
        if (dir.trim().length > 0) {
            console.warn(`dir="${dir}" should be placed on the <html> instead of <body>`);
        }
    }
    if (opts.dir) {
        dir = opts.dir;
    }
    else {
        dir = doc.documentElement.getAttribute('dir');
    }
    if (dir) {
        dir = dir.trim().toLowerCase();
        if (dir !== 'ltr' && dir !== 'rtl') {
            console.warn(`only "ltr" and "rtl" are valid "dir" values on the <html> element`);
        }
    }
    if (dir !== 'ltr' && dir !== 'rtl') {
        dir = 'ltr';
    }
    doc.documentElement.dir = dir;
}
function normalizeLanguage(doc, opts) {
    let lang = doc.body.getAttribute('lang');
    if (lang) {
        lang = lang.trim().toLowerCase();
        if (lang.trim().length > 0) {
            console.warn(`lang="${lang}" should be placed on <html> instead of <body>`);
        }
    }
    if (opts.lang) {
        lang = opts.lang;
    }
    else {
        lang = doc.documentElement.getAttribute('lang');
    }
    if (lang) {
        lang = lang.trim().toLowerCase();
        if (lang.length > 0) {
            doc.documentElement.lang = lang;
        }
    }
}
function collectAnchors(config, doc, results) {
    const anchorElements = doc.querySelectorAll('a');
    for (var i = 0; i < anchorElements.length; i++) {
        const attrs = {};
        const anchorAttrs = anchorElements[i].attributes;
        for (var j = 0; j < anchorAttrs.length; j++) {
            attrs[anchorAttrs[j].nodeName.toLowerCase()] = anchorAttrs[j].nodeValue;
        }
        results.anchors.push(attrs);
    }
    config.logger.debug(`optimize ${results.pathname}, collected anchors: ${results.anchors.length}`);
}
function generateFailureDiagnostic(d) {
    return `
    <div style="padding: 20px;">
      <div style="font-weight: bold;">${d.header}</div>
      <div>${d.messageText}</div>
    </div>
  `;
}

const Build = {
    verboseError: true,
    cssVarShim: true,
    shadowDom: true,
    ssrServerSide: true,
    styles: true,
    hostData: true,
    hostTheme: true,
    svg: true,
    observeAttr: true,
    isDev: true,
    // decorators
    element: true,
    event: true,
    listener: true,
    method: true,
    propConnect: true,
    propContext: true,
    watchCallback: true,
    // lifecycle events
    cmpDidLoad: true,
    cmpWillLoad: true,
    cmpDidUpdate: true,
    cmpWillUpdate: true,
    cmpDidUnload: true,
};

function initElementListeners(plt, elm) {
    // so the element was just connected, which means it's in the DOM
    // however, the component instance hasn't been created yet
    // but what if an event it should be listening to get emitted right now??
    // let's add our listeners right now to our element, and if it happens
    // to receive events between now and the instance being created let's
    // queue up all of the event data and fire it off on the instance when it's ready
    const cmpMeta = plt.getComponentMeta(elm);
    if (cmpMeta.listenersMeta) {
        // we've got listens
        cmpMeta.listenersMeta.forEach(listenMeta => {
            // go through each listener
            if (!listenMeta.eventDisabled) {
                // only add ones that are not already disabled
                plt.domApi.$addEventListener(elm, listenMeta.eventName, createListenerCallback(plt, elm, listenMeta.eventMethodName), listenMeta.eventCapture, listenMeta.eventPassive);
            }
        });
    }
}
function createListenerCallback(plt, elm, eventMethodName, val) {
    // create the function that gets called when the element receives
    // an event which it should be listening for
    return (ev) => {
        // get the instance if it exists
        val = plt.instanceMap.get(elm);
        if (val) {
            // instance is ready, let's call it's member method for this event
            val[eventMethodName](ev);
        }
        else {
            // instance is not ready!!
            // let's queue up this event data and replay it later
            // when the instance is ready
            val = (plt.queuedEvents.get(elm) || []);
            val.push(eventMethodName, ev);
            plt.queuedEvents.set(elm, val);
        }
    };
}

function parsePropertyValue(propType, propValue) {
    // ensure this value is of the correct prop type
    // we're testing both formats of the "propType" value because
    // we could have either gotten the data from the attribute changed callback,
    // which wouldn't have Constructor data yet, and because this method is reused
    // within proxy where we don't have meta data, but only constructor data
    if (isDef(propValue)) {
        if (propType === Boolean || propType === 3 /* Boolean */) {
            // per the HTML spec, any string value means it is a boolean true value
            // but we'll cheat here and say that the string "false" is the boolean false
            return (propValue === 'false' ? false : propValue === '' || !!propValue);
        }
        if (propType === Number || propType === 4 /* Number */) {
            // force it to be a number
            return parseFloat(propValue);
        }
    }
    // not sure exactly what type we want
    // so no need to change to a different type
    return propValue;
}

function defineMember(plt, property, elm, instance, memberName) {
    function getComponentProp(values) {
        // component instance prop/state getter
        // get the property value directly from our internal values
        values = plt.valuesMap.get(plt.hostElementMap.get(this));
        return values && values[memberName];
    }
    function setComponentProp(newValue, elm) {
        // component instance prop/state setter (cannot be arrow fn)
        elm = plt.hostElementMap.get(this);
        if (elm) {
            if (property.state || property.mutable) {
                setValue(plt, elm, memberName, newValue);
            }
            else if (Build.verboseError) {
                console.warn(`@Prop() "${memberName}" on "${elm.tagName}" cannot be modified.`);
            }
        }
    }
    if (property.type || property.state) {
        const values = plt.valuesMap.get(elm);
        if (!property.state) {
            if (property.attr && (values[memberName] === undefined || values[memberName] === '')) {
                // check the prop value from the host element attribute
                const hostAttrValue = plt.domApi.$getAttribute(elm, property.attr);
                if (hostAttrValue != null) {
                    // looks like we've got an attribute value
                    // let's set it to our internal values
                    values[memberName] = parsePropertyValue(property.type, hostAttrValue);
                }
            }
            if (Build.clientSide) {
                // client-side
                // within the browser, the element's prototype
                // already has its getter/setter set, but on the
                // server the prototype is shared causing issues
                // so instead the server's elm has the getter/setter
                // directly on the actual element instance, not its prototype
                // so on the browser we can use "hasOwnProperty"
                if (elm.hasOwnProperty(memberName)) {
                    // @Prop or @Prop({mutable:true})
                    // property values on the host element should override
                    // any default values on the component instance
                    if (values[memberName] === undefined) {
                        values[memberName] = elm[memberName];
                    }
                    // for the client only, let's delete its "own" property
                    // this way our already assigned getter/setter on the prototype kicks in
                    delete elm[memberName];
                }
            }
            else {
                // server-side
                // server-side elm has the getter/setter
                // on the actual element instance, not its prototype
                // on the server we cannot accurately use "hasOwnProperty"
                // instead we'll do a direct lookup to see if the
                // constructor has this property
                if (elementHasProperty(plt, elm, memberName)) {
                    // @Prop or @Prop({mutable:true})
                    // property values on the host element should override
                    // any default values on the component instance
                    if (values[memberName] === undefined) {
                        values[memberName] = elm[memberName];
                    }
                }
            }
        }
        if (instance.hasOwnProperty(memberName) && values[memberName] === undefined) {
            // @Prop() or @Prop({mutable:true}) or @State()
            // we haven't yet got a value from the above checks so let's
            // read any "own" property instance values already set
            // to our internal value as the source of getter data
            // we're about to define a property and it'll overwrite this "own" property
            values[memberName] = instance[memberName];
        }
        if (property.watchCallbacks) {
            values[WATCH_CB_PREFIX + memberName] = property.watchCallbacks.slice();
        }
        // add getter/setter to the component instance
        // these will be pointed to the internal data set from the above checks
        definePropertyGetterSetter(instance, memberName, getComponentProp, setComponentProp);
    }
    else if (Build.element && property.elementRef) {
        // @Element()
        // add a getter to the element reference using
        // the member name the component meta provided
        definePropertyValue(instance, memberName, elm);
    }
    else if (Build.method && property.method) {
        // @Method()
        // add a property "value" on the host element
        // which we'll bind to the instance's method
        definePropertyValue(elm, memberName, instance[memberName].bind(instance));
    }
    else if (Build.propContext && property.context) {
        // @Prop({ context: 'config' })
        const contextObj = plt.getContextItem(property.context);
        if (contextObj !== undefined) {
            definePropertyValue(instance, memberName, (contextObj.getContext && contextObj.getContext(elm)) || contextObj);
        }
    }
    else if (Build.propConnect && property.connect) {
        // @Prop({ connect: 'ion-loading-ctrl' })
        definePropertyValue(instance, memberName, plt.propConnect(property.connect));
    }
}
function setValue(plt, elm, memberName, newVal, values, instance, watchMethods) {
    // get the internal values object, which should always come from the host element instance
    // create the _values object if it doesn't already exist
    values = plt.valuesMap.get(elm);
    if (!values) {
        plt.valuesMap.set(elm, values = {});
    }
    const oldVal = values[memberName];
    // check our new property value against our internal value
    if (newVal !== oldVal) {
        // gadzooks! the property's value has changed!!
        // set our new value!
        // https://youtu.be/dFtLONl4cNc?t=22
        values[memberName] = newVal;
        instance = plt.instanceMap.get(elm);
        if (instance) {
            // get an array of method names of watch functions to call
            watchMethods = values[WATCH_CB_PREFIX + memberName];
            if (Build.watchCallback && watchMethods) {
                // this instance is watching for when this property changed
                for (let i = 0; i < watchMethods.length; i++) {
                    try {
                        // fire off each of the watch methods that are watching this property
                        instance[watchMethods[i]].call(instance, newVal, oldVal, memberName);
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
            }
            if (!plt.activeRender && elm.$rendered) {
                // looks like this value actually changed, so we've got work to do!
                // but only if we've already created an instance, otherwise just chill out
                // queue that we need to do an update, but don't worry about queuing
                // up millions cuz this function ensures it only runs once
                queueUpdate(plt, elm);
            }
        }
    }
}
function definePropertyValue(obj, propertyKey, value) {
    // minification shortcut
    Object.defineProperty(obj, propertyKey, {
        'configurable': true,
        'value': value
    });
}
function definePropertyGetterSetter(obj, propertyKey, get, set) {
    // minification shortcut
    Object.defineProperty(obj, propertyKey, {
        'configurable': true,
        'get': get,
        'set': set
    });
}
const WATCH_CB_PREFIX = `wc-`;
function elementHasProperty(plt, elm, memberName) {
    // within the browser, the element's prototype
    // already has its getter/setter set, but on the
    // server the prototype is shared causing issues
    // so instead the server's elm has the getter/setter
    // directly on the actual element instance, not its prototype
    // so at the time of this function being called, the server
    // side element is unaware if the element has this property
    // name. So for server-side only, do this trick below
    // don't worry, this runtime code doesn't show on the client
    let hasOwnProperty = elm.hasOwnProperty(memberName);
    if (!hasOwnProperty) {
        // element doesn't
        const cmpMeta = plt.getComponentMeta(elm);
        if (cmpMeta) {
            if (cmpMeta.componentConstructor && cmpMeta.componentConstructor.properties) {
                // if we have the constructor property data, let's check that
                const member = cmpMeta.componentConstructor.properties[memberName];
                hasOwnProperty = !!(member && member.type);
            }
            if (!hasOwnProperty && cmpMeta.membersMeta) {
                // if we have the component's metadata, let's check that
                const member = cmpMeta.membersMeta[memberName];
                hasOwnProperty = !!(member && member.propType);
            }
        }
    }
    return hasOwnProperty;
}

function updateElement(plt, oldVnode, newVnode, isSvgMode, memberName) {
    // if the element passed in is a shadow root, which is a document fragment
    // then we want to be adding attrs/props to the shadow root's "host" element
    // if it's not a shadow root, then we add attrs/props to the same element
    const elm = (newVnode.elm.nodeType === 11 /* DocumentFragment */ && newVnode.elm.host) ? newVnode.elm.host : newVnode.elm;
    const oldVnodeAttrs = (oldVnode && oldVnode.vattrs) || EMPTY_OBJ;
    const newVnodeAttrs = newVnode.vattrs || EMPTY_OBJ;
    // remove attributes no longer present on the vnode by setting them to undefined
    for (memberName in oldVnodeAttrs) {
        if (!(newVnodeAttrs && newVnodeAttrs[memberName] != null) && oldVnodeAttrs[memberName] != null) {
            setAccessor(plt, elm, memberName, oldVnodeAttrs[memberName], undefined, isSvgMode);
        }
    }
    // add new & update changed attributes
    for (memberName in newVnodeAttrs) {
        if (!(memberName in oldVnodeAttrs) || newVnodeAttrs[memberName] !== (memberName === 'value' || memberName === 'checked' ? elm[memberName] : oldVnodeAttrs[memberName])) {
            setAccessor(plt, elm, memberName, oldVnodeAttrs[memberName], newVnodeAttrs[memberName], isSvgMode);
        }
    }
}
function setAccessor(plt, elm, memberName, oldValue, newValue, isSvg, i, ilen) {
    if (memberName === 'class' && !isSvg) {
        // Class
        if (oldValue !== newValue) {
            const oldList = (oldValue == null || oldValue === '') ? EMPTY_ARR : oldValue.trim().split(/\s+/);
            const newList = (newValue == null || newValue === '') ? EMPTY_ARR : newValue.trim().split(/\s+/);
            let classList = (elm.className == null || elm.className === '') ? EMPTY_ARR : elm.className.trim().split(/\s+/);
            for (i = 0, ilen = oldList.length; i < ilen; i++) {
                if (newList.indexOf(oldList[i]) === -1) {
                    classList = classList.filter((c) => c !== oldList[i]);
                }
            }
            for (i = 0, ilen = newList.length; i < ilen; i++) {
                if (oldList.indexOf(newList[i]) === -1) {
                    classList = [...classList, newList[i]];
                }
            }
            elm.className = classList.join(' ');
        }
    }
    else if (memberName === 'style') {
        // Style
        oldValue = oldValue || EMPTY_OBJ;
        newValue = newValue || EMPTY_OBJ;
        for (i in oldValue) {
            if (!newValue[i]) {
                elm.style[i] = '';
            }
        }
        for (i in newValue) {
            if (newValue[i] !== oldValue[i]) {
                elm.style[i] = newValue[i];
            }
        }
    }
    else if (memberName[0] === 'o' && memberName[1] === 'n' && (!(memberName in elm))) {
        // Event Handlers
        // adding an standard event listener, like <button onClick=...> or something
        memberName = toLowerCase(memberName.substring(2));
        if (newValue) {
            if (newValue !== oldValue) {
                // add listener
                plt.domApi.$addEventListener(elm, memberName, newValue);
            }
        }
        else {
            // remove listener
            plt.domApi.$removeEventListener(elm, memberName);
        }
    }
    else if (memberName !== 'list' && memberName !== 'type' && !isSvg &&
        (memberName in elm || (['object', 'function'].indexOf(typeof newValue) !== -1) && newValue !== null)
        || (!Build.clientSide && elementHasProperty(plt, elm, memberName))) {
        // Properties
        // - list and type are attributes that get applied as values on the element
        // - all svgs get values as attributes not props
        // - check if elm contains name or if the value is array, object, or function
        const cmpMeta = plt.getComponentMeta(elm);
        if (cmpMeta && cmpMeta.membersMeta && cmpMeta.membersMeta[memberName]) {
            // we know for a fact that this element is a known component
            // and this component has this member name as a property,
            // let's set the known @Prop on this element
            setProperty(elm, memberName, newValue);
        }
        else if (memberName !== 'ref') {
            // this member name is a property on this element, but it's not a component
            // this is a native property like "value" or something
            // also we can ignore the "ref" member name at this point
            setProperty(elm, memberName, newValue == null ? '' : newValue);
            if (newValue == null || newValue === false) {
                elm.removeAttribute(memberName);
            }
        }
    }
    else if (newValue != null) {
        // Element Attributes
        i = (memberName !== (memberName = memberName.replace(/^xlink\:?/, '')));
        if (BOOLEAN_ATTRS[memberName] === 1 && (!newValue || newValue === 'false')) {
            if (i) {
                elm.removeAttributeNS(XLINK_NS$1, toLowerCase(memberName));
            }
            else {
                elm.removeAttribute(memberName);
            }
        }
        else if (typeof newValue !== 'function') {
            if (i) {
                elm.setAttributeNS(XLINK_NS$1, toLowerCase(memberName), newValue);
            }
            else {
                elm.setAttribute(memberName, newValue);
            }
        }
    }
}
/**
 * Attempt to set a DOM property to the given value.
 * IE & FF throw for certain property-value combinations.
 */
function setProperty(elm, name, value) {
    try {
        elm[name] = value;
    }
    catch (e) { }
}
const BOOLEAN_ATTRS = {
    'allowfullscreen': 1,
    'async': 1,
    'autofocus': 1,
    'autoplay': 1,
    'checked': 1,
    'controls': 1,
    'disabled': 1,
    'enabled': 1,
    'formnovalidate': 1,
    'hidden': 1,
    'multiple': 1,
    'noresize': 1,
    'readonly': 1,
    'required': 1,
    'selected': 1,
    'spellcheck': 1,
};
const XLINK_NS$1 = 'http://www.w3.org/1999/xlink';

/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/snabbdom/snabbdom/blob/master/LICENSE
 *
 * Modified for Stencil's renderer and slot projection
 */
let isSvgMode = false;
function createRendererPatch(plt, domApi) {
    // createRenderer() is only created once per app
    // the patch() function which createRenderer() returned is the function
    // which gets called numerous times by each component
    function createElm(vnode, parentElm, childIndex, i, elm, childNode, namedSlot, slotNodes, hasLightDom) {
        if (typeof vnode.vtag === 'function') {
            vnode = vnode.vtag(Object.assign({}, vnode.vattrs, { children: vnode.vchildren }));
        }
        if (!useNativeShadowDom && vnode.vtag === 'slot') {
            if (defaultSlot || namedSlots) {
                if (scopeId) {
                    domApi.$setAttribute(parentElm, scopeId + '-slot', '');
                }
                // special case for manually relocating host content nodes
                // to their new home in either a named slot or the default slot
                namedSlot = (vnode.vattrs && vnode.vattrs.name);
                if (isDef(namedSlot)) {
                    // this vnode is a named slot
                    slotNodes = namedSlots && namedSlots[namedSlot];
                }
                else {
                    // this vnode is the default slot
                    slotNodes = defaultSlot;
                }
                if (isDef(slotNodes)) {
                    // the host element has some nodes that need to be moved around
                    // we have a slot for the user's vnode to go into
                    // while we're moving nodes around, temporarily disable
                    // the disconnectCallback from working
                    plt.tmpDisconnected = true;
                    for (i = 0; i < slotNodes.length; i++) {
                        childNode = slotNodes[i];
                        // remove the host content node from it's original parent node
                        // then relocate the host content node to its new slotted home
                        domApi.$remove(childNode);
                        domApi.$appendChild(parentElm, childNode);
                        if (childNode.nodeType !== 8 /* CommentNode */) {
                            hasLightDom = true;
                        }
                    }
                    if (!hasLightDom && vnode.vchildren) {
                        // the user did not provide light-dom content
                        // and this vnode does come with it's own default content
                        updateChildren(parentElm, [], vnode.vchildren);
                    }
                    // done moving nodes around
                    // allow the disconnect callback to work again
                    plt.tmpDisconnected = false;
                }
            }
            // this was a slot node, we do not create slot elements, our work here is done
            // no need to return any element to be added to the dom
            return null;
        }
        if (isDef(vnode.vtext)) {
            // create text node
            vnode.elm = domApi.$createTextNode(vnode.vtext);
        }
        else {
            // create element
            elm = vnode.elm = ((Build.svg && (isSvgMode || vnode.vtag === 'svg')) ? domApi.$createElementNS('http://www.w3.org/2000/svg', vnode.vtag) : domApi.$createElement(vnode.vtag));
            if (Build.svg) {
                isSvgMode = vnode.vtag === 'svg' ? true : (vnode.vtag === 'foreignObject' ? false : isSvgMode);
            }
            // add css classes, attrs, props, listeners, etc.
            updateElement(plt, null, vnode, isSvgMode);
            if (scopeId !== null && elm._scopeId !== scopeId) {
                // if there is a scopeId and this is the initial render
                // then let's add the scopeId as an attribute
                domApi.$setAttribute(elm, (elm._scopeId = scopeId), '');
            }
            const children = vnode.vchildren;
            if (Build.ssrServerSide && isDef(ssrId)) {
                // SSR ONLY: this is an SSR render and this
                // logic does not run on the client
                // give this element the SSR child id that can be read by the client
                domApi.$setAttribute(elm, SSR_CHILD_ID, ssrId + '.' + childIndex + (hasChildNodes(children) ? '' : '.'));
            }
            if (children) {
                for (i = 0; i < children.length; ++i) {
                    // create the node
                    childNode = createElm(children[i], elm, i);
                    // return node could have been null
                    if (childNode) {
                        if (Build.ssrServerSide && isDef(ssrId) && childNode.nodeType === 3 /* TextNode */) {
                            // SSR ONLY: add the text node's start comment
                            domApi.$appendChild(elm, domApi.$createComment('s.' + ssrId + '.' + i));
                        }
                        // append our new node
                        domApi.$appendChild(elm, childNode);
                        if (Build.ssrServerSide && isDef(ssrId) && childNode.nodeType === 3) {
                            // SSR ONLY: add the text node's end comment
                            domApi.$appendChild(elm, domApi.$createComment('/'));
                            domApi.$appendChild(elm, domApi.$createTextNode(' '));
                        }
                    }
                }
            }
            if (Build.svg) {
                // Only reset the SVG context when we're exiting SVG element
                if (vnode.vtag === 'svg') {
                    isSvgMode = false;
                }
            }
        }
        return vnode.elm;
    }
    function addVnodes(parentElm, before, vnodes, startIdx, endIdx, childNode, vnodeChild) {
        const containerElm = (parentElm.$defaultHolder && domApi.$parentNode(parentElm.$defaultHolder)) || parentElm;
        for (; startIdx <= endIdx; ++startIdx) {
            vnodeChild = vnodes[startIdx];
            if (isDef(vnodeChild)) {
                childNode = isDef(vnodeChild.vtext) ? domApi.$createTextNode(vnodeChild.vtext) : createElm(vnodeChild, parentElm, startIdx);
                if (isDef(childNode)) {
                    vnodeChild.elm = childNode;
                    domApi.$insertBefore(containerElm, childNode, before);
                }
            }
        }
    }
    function removeVnodes(vnodes, startIdx, endIdx) {
        for (; startIdx <= endIdx; ++startIdx) {
            if (isDef(vnodes[startIdx])) {
                domApi.$remove(vnodes[startIdx].elm);
            }
        }
    }
    function updateChildren(parentElm, oldCh, newCh) {
        let oldStartIdx = 0, newStartIdx = 0;
        let oldEndIdx = oldCh.length - 1;
        let oldStartVnode = oldCh[0];
        let oldEndVnode = oldCh[oldEndIdx];
        let newEndIdx = newCh.length - 1;
        let newStartVnode = newCh[0];
        let newEndVnode = newCh[newEndIdx];
        let oldKeyToIdx;
        let idxInOld;
        let elmToMove;
        let node;
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (oldStartVnode == null) {
                oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
            }
            else if (oldEndVnode == null) {
                oldEndVnode = oldCh[--oldEndIdx];
            }
            else if (newStartVnode == null) {
                newStartVnode = newCh[++newStartIdx];
            }
            else if (newEndVnode == null) {
                newEndVnode = newCh[--newEndIdx];
            }
            else if (isSameVnode(oldStartVnode, newStartVnode)) {
                patchVNode(oldStartVnode, newStartVnode);
                oldStartVnode = oldCh[++oldStartIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else if (isSameVnode(oldEndVnode, newEndVnode)) {
                patchVNode(oldEndVnode, newEndVnode);
                oldEndVnode = oldCh[--oldEndIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (isSameVnode(oldStartVnode, newEndVnode)) {
                patchVNode(oldStartVnode, newEndVnode);
                domApi.$insertBefore(parentElm, oldStartVnode.elm, domApi.$nextSibling(oldEndVnode.elm));
                oldStartVnode = oldCh[++oldStartIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (isSameVnode(oldEndVnode, newStartVnode)) {
                patchVNode(oldEndVnode, newStartVnode);
                domApi.$insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
                oldEndVnode = oldCh[--oldEndIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else {
                if (isUndef(oldKeyToIdx)) {
                    oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
                }
                idxInOld = oldKeyToIdx[newStartVnode.vkey];
                if (isUndef(idxInOld)) {
                    // new element
                    node = createElm(newStartVnode, parentElm, newStartIdx);
                    newStartVnode = newCh[++newStartIdx];
                }
                else {
                    elmToMove = oldCh[idxInOld];
                    if (elmToMove.vtag !== newStartVnode.vtag) {
                        node = createElm(newStartVnode, parentElm, idxInOld);
                    }
                    else {
                        patchVNode(elmToMove, newStartVnode);
                        oldCh[idxInOld] = undefined;
                        node = elmToMove.elm;
                    }
                    newStartVnode = newCh[++newStartIdx];
                }
                if (node) {
                    domApi.$insertBefore((oldStartVnode.elm && oldStartVnode.elm.parentNode) || parentElm, node, oldStartVnode.elm);
                }
            }
        }
        if (oldStartIdx > oldEndIdx) {
            addVnodes(parentElm, (newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm), newCh, newStartIdx, newEndIdx);
        }
        else if (newStartIdx > newEndIdx) {
            removeVnodes(oldCh, oldStartIdx, oldEndIdx);
        }
    }
    function isSameVnode(vnode1, vnode2) {
        // compare if two vnode to see if they're "technically" the same
        // need to have the same element tag, and same key to be the same
        return vnode1.vtag === vnode2.vtag && vnode1.vkey === vnode2.vkey;
    }
    function createKeyToOldIdx(children, beginIdx, endIdx) {
        const map = {};
        let i, key, ch;
        for (i = beginIdx; i <= endIdx; ++i) {
            ch = children[i];
            if (ch != null) {
                key = ch.vkey;
                if (key !== undefined) {
                    map.k = i;
                }
            }
        }
        return map;
    }
    function patchVNode(oldVNode, newVNode) {
        const elm = newVNode.elm = oldVNode.elm;
        const oldChildren = oldVNode.vchildren;
        const newChildren = newVNode.vchildren;
        let defaultSlot;
        if (Build.svg) {
            // test if we're rendering an svg element, or still rendering nodes inside of one
            // only add this to the when the compiler sees we're using an svg somewhere
            isSvgMode = newVNode.elm && newVNode.elm.parentElement != null && newVNode.elm.ownerSVGElement !== undefined;
            isSvgMode = newVNode.vtag === 'svg' ? true : (newVNode.vtag === 'foreignObject' ? false : isSvgMode);
        }
        if (isUndef(newVNode.vtext)) {
            // element node
            if (newVNode.vtag !== 'slot') {
                // either this is the first render of an element OR it's an update
                // AND we already know it's possible it could have changed
                // this updates the element's css classes, attrs, props, listeners, etc.
                updateElement(plt, oldVNode, newVNode, isSvgMode);
            }
            if (isDef(oldChildren) && isDef(newChildren)) {
                // looks like there's child vnodes for both the old and new vnodes
                updateChildren(elm, oldChildren, newChildren);
            }
            else if (isDef(newChildren)) {
                // no old child vnodes, but there are new child vnodes to add
                if (isDef(oldVNode.vtext)) {
                    // the old vnode was text, so be sure to clear it out
                    domApi.$setTextContent(elm, '');
                }
                // add the new vnode children
                addVnodes(elm, null, newChildren, 0, newChildren.length - 1);
            }
            else if (isDef(oldChildren)) {
                // no new child vnodes, but there are old child vnodes to remove
                removeVnodes(oldChildren, 0, oldChildren.length - 1);
            }
        }
        else if (defaultSlot = plt.defaultSlotsMap.get(elm)) {
            // this element has slotted content
            const parentElement = defaultSlot[0].parentElement;
            domApi.$setTextContent(parentElement, newVNode.vtext);
            plt.defaultSlotsMap.set(elm, [parentElement.childNodes[0]]);
        }
        else if (oldVNode.vtext !== newVNode.vtext) {
            // update the text content for the text only vnode
            // and also only if the text is different than before
            domApi.$setTextContent(elm, newVNode.vtext);
        }
        if (Build.svg) {
            // reset svgMode when svg node is fully patched
            if (isSvgMode && 'svg' === newVNode.vtag) {
                isSvgMode = false;
            }
        }
    }
    // internal variables to be reused per patch() call
    let isUpdate, defaultSlot, namedSlots, useNativeShadowDom, ssrId, scopeId;
    return function patch(oldVNode, newVNode, isUpdatePatch, elmDefaultSlot, elmNamedSlots, encapsulation, ssrPatchId) {
        // patchVNode() is synchronous
        // so it is safe to set these variables and internally
        // the same patch() call will reference the same data
        isUpdate = isUpdatePatch;
        defaultSlot = elmDefaultSlot;
        namedSlots = elmNamedSlots;
        if (Build.ssrServerSide) {
            if (encapsulation !== 'shadow') {
                ssrId = ssrPatchId;
            }
            else {
                ssrId = null;
            }
        }
        scopeId = (encapsulation === 'scoped' || (encapsulation === 'shadow' && !domApi.$supportsShadowDom)) ? 'data-' + domApi.$tagName(oldVNode.elm) : null;
        if (Build.shadowDom) {
            // use native shadow dom only if the component wants to use it
            // and if this browser supports native shadow dom
            useNativeShadowDom = (encapsulation === 'shadow' && domApi.$supportsShadowDom);
        }
        if (!isUpdate) {
            if (Build.shadowDom && useNativeShadowDom) {
                // this component SHOULD use native slot/shadow dom
                // this browser DOES support native shadow dom
                // and this is the first render
                // let's create that shadow root
                oldVNode.elm = domApi.$attachShadow(oldVNode.elm, { mode: 'open' });
            }
            else if (scopeId) {
                // this host element should use scoped css
                // add the scope attribute to the host
                domApi.$setAttribute(oldVNode.elm, scopeId + '-host', '');
            }
        }
        // synchronous patch
        patchVNode(oldVNode, newVNode);
        if (Build.ssrServerSide && isDef(ssrId)) {
            // SSR ONLY: we've been given an SSR id, so the host element
            // should be given the ssr id attribute
            domApi.$setAttribute(oldVNode.elm, SSR_VNODE_ID, ssrId);
        }
        // return our new vnode
        return newVNode;
    };
}
function callNodeRefs(vNode, isDestroy) {
    if (vNode) {
        vNode.vref && vNode.vref(isDestroy ? null : vNode.elm);
        vNode.vchildren && vNode.vchildren.forEach(vChild => {
            callNodeRefs(vChild, isDestroy);
        });
    }
}
function hasChildNodes(children) {
    // SSR ONLY: check if there are any more nested child elements
    // if there aren't, this info is useful so the client runtime
    // doesn't have to climb down and check so many elements
    if (children) {
        for (var i = 0; i < children.length; i++) {
            if (children[i].vtag !== 'slot' || hasChildNodes(children[i].vchildren)) {
                return true;
            }
        }
    }
    return false;
}

function initEventEmitters(plt, cmpEvents, instance) {
    if (cmpEvents) {
        const elm = plt.hostElementMap.get(instance);
        cmpEvents.forEach(eventMeta => {
            instance[eventMeta.method] = {
                emit: (data) => {
                    plt.emitEvent(elm, eventMeta.name, {
                        bubbles: eventMeta.bubbles,
                        composed: eventMeta.composed,
                        cancelable: eventMeta.cancelable,
                        detail: data
                    });
                }
            };
        });
    }
}

function proxyComponentInstance(plt, cmpConstructor, elm, instance, properties, memberName) {
    // at this point we've got a specific node of a host element, and created a component class instance
    // and we've already created getters/setters on both the host element and component class prototypes
    // let's upgrade any data that might have been set on the host element already
    // and let's have the getters/setters kick in and do their jobs
    // let's automatically add a reference to the host element on the instance
    plt.hostElementMap.set(instance, elm);
    // create the values object if it doesn't already exist
    // this will hold all of the internal getter/setter values
    if (!plt.valuesMap.has(elm)) {
        plt.valuesMap.set(elm, {});
    }
    // get the properties from the constructor
    // and add default "mode" and "color" properties
    properties = Object.assign({
        color: { type: String }
    }, cmpConstructor.properties);
    // always set mode
    properties.mode = { type: String };
    // define each of the members and initialize what their role is
    for (memberName in properties) {
        defineMember(plt, properties[memberName], elm, instance, memberName);
    }
}

function initComponentInstance(plt, elm, instance, componentConstructor, queuedEvents, i) {
    try {
        // using the user's component class, let's create a new instance
        componentConstructor = plt.getComponentMeta(elm).componentConstructor;
        instance = new componentConstructor();
        // ok cool, we've got an host element now, and a actual instance
        // and there were no errors creating the instance
        // let's upgrade the data on the host element
        // and let the getters/setters do their jobs
        proxyComponentInstance(plt, componentConstructor, elm, instance);
        if (Build.event) {
            // add each of the event emitters which wire up instance methods
            // to fire off dom events from the host element
            initEventEmitters(plt, componentConstructor.events, instance);
        }
        if (Build.listener) {
            try {
                // replay any event listeners on the instance that
                // were queued up between the time the element was
                // connected and before the instance was ready
                queuedEvents = plt.queuedEvents.get(elm);
                if (queuedEvents) {
                    // events may have already fired before the instance was even ready
                    // now that the instance is ready, let's replay all of the events that
                    // we queued up earlier that were originally meant for the instance
                    for (i = 0; i < queuedEvents.length; i += 2) {
                        // data was added in sets of two
                        // first item the eventMethodName
                        // second item is the event data
                        // take a look at initElementListener()
                        instance[queuedEvents[i]](queuedEvents[i + 1]);
                    }
                    plt.queuedEvents.delete(elm);
                }
            }
            catch (e) {
                plt.onError(e, 2 /* QueueEventsError */, elm);
            }
        }
    }
    catch (e) {
        // something done went wrong trying to create a component instance
        // create a dumby instance so other stuff can load
        // but chances are the app isn't fully working cuz this component has issues
        instance = {};
        plt.onError(e, 7 /* InitInstanceError */, elm, true);
    }
    plt.instanceMap.set(elm, instance);
    return instance;
}
function initComponentLoaded(plt, elm, hydratedCssClass, instance, onReadyCallbacks) {
    // all is good, this component has been told it's time to finish loading
    // it's possible that we've already decided to destroy this element
    // check if this element has any actively loading child elements
    if (!plt.hasLoadedMap.has(elm) && (instance = plt.instanceMap.get(elm)) && !plt.isDisconnectedMap.has(elm) && (!elm.$activeLoading || !elm.$activeLoading.length)) {
        // cool, so at this point this element isn't already being destroyed
        // and it does not have any child elements that are still loading
        // ensure we remove any child references cuz it doesn't matter at this point
        delete elm.$activeLoading;
        // sweet, this particular element is good to go
        // all of this element's children have loaded (if any)
        // elm._hasLoaded = true;
        plt.hasLoadedMap.set(elm, true);
        try {
            // fire off the ref if it exists
            callNodeRefs(plt.vnodeMap.get(elm));
            // fire off the user's elm.componentOnReady() callbacks that were
            // put directly on the element (well before anything was ready)
            if (onReadyCallbacks = plt.onReadyCallbacksMap.get(elm)) {
                onReadyCallbacks.forEach(cb => cb(elm));
                plt.onReadyCallbacksMap.delete(elm);
            }
            if (Build.cmpDidLoad) {
                // fire off the user's componentDidLoad method (if one was provided)
                // componentDidLoad only runs ONCE, after the instance's element has been
                // assigned as the host element, and AFTER render() has been called
                // we'll also fire this method off on the element, just to
                instance.componentDidLoad && instance.componentDidLoad();
            }
        }
        catch (e) {
            plt.onError(e, 4 /* DidLoadError */, elm);
        }
        // add the css class that this element has officially hydrated
        elm.classList.add(hydratedCssClass);
        // ( •_•)
        // ( •_•)>⌐■-■
        // (⌐■_■)
        // load events fire from bottom to top
        // the deepest elements load first then bubbles up
        propagateComponentLoaded(plt, elm);
    }
}
function propagateComponentLoaded(plt, elm, index, ancestorsActivelyLoadingChildren) {
    // load events fire from bottom to top
    // the deepest elements load first then bubbles up
    const ancestorHostElement = plt.ancestorHostElementMap.get(elm);
    if (ancestorHostElement) {
        // ok so this element already has a known ancestor host element
        // let's make sure we remove this element from its ancestor's
        // known list of child elements which are actively loading
        ancestorsActivelyLoadingChildren = ancestorHostElement.$activeLoading;
        if (ancestorsActivelyLoadingChildren) {
            index = ancestorsActivelyLoadingChildren.indexOf(elm);
            if (index > -1) {
                // yup, this element is in the list of child elements to wait on
                // remove it so we can work to get the length down to 0
                ancestorsActivelyLoadingChildren.splice(index, 1);
            }
            // the ancestor's initLoad method will do the actual checks
            // to see if the ancestor is actually loaded or not
            // then let's call the ancestor's initLoad method if there's no length
            // (which actually ends up as this method again but for the ancestor)
            !ancestorsActivelyLoadingChildren.length && ancestorHostElement.$initLoad();
        }
        plt.ancestorHostElementMap.delete(elm);
    }
}

function createThemedClasses(mode, color, classList) {
    const allClasses = {};
    return classList.split(' ')
        .reduce((classObj, classString) => {
        classObj[classString] = true;
        if (mode) {
            classObj[`${classString}-${mode}`] = true;
            if (color) {
                classObj[`${classString}-${color}`] = true;
                classObj[`${classString}-${mode}-${color}`] = true;
            }
        }
        return classObj;
    }, allClasses);
}

/**
 * Production h() function based on Preact by
 * Jason Miller (@developit)
 * Licensed under the MIT License
 * https://github.com/developit/preact/blob/master/LICENSE
 *
 * Modified for Stencil's compiler and vdom
 */
const stack = [];
class VNode {
}
function h(nodeName, vnodeData, child) {
    let children;
    let lastSimple = false;
    let simple = false;
    for (var i = arguments.length; i-- > 2;) {
        stack.push(arguments[i]);
    }
    while (stack.length) {
        if ((child = stack.pop()) && child.pop !== undefined) {
            for (i = child.length; i--;) {
                stack.push(child[i]);
            }
        }
        else {
            if (typeof child === 'boolean')
                child = null;
            if ((simple = typeof nodeName !== 'function')) {
                if (child == null)
                    child = '';
                else if (typeof child === 'number')
                    child = String(child);
                else if (typeof child !== 'string')
                    simple = false;
            }
            if (simple && lastSimple) {
                children[children.length - 1].vtext += child;
            }
            else if (children === undefined) {
                children = [simple ? t(child) : child];
            }
            else {
                children.push(simple ? t(child) : child);
            }
            lastSimple = simple;
        }
    }
    const vnode = new VNode();
    vnode.vtag = nodeName;
    vnode.vchildren = children;
    if (vnodeData) {
        vnode.vattrs = vnodeData;
        vnode.vkey = vnodeData.key;
        vnode.vref = vnodeData.ref;
        // normalize class / classname attributes
        if (vnodeData['className']) {
            vnodeData['class'] = vnodeData['className'];
        }
        if (typeof vnodeData['class'] === 'object') {
            for (i in vnodeData['class']) {
                if (vnodeData['class'][i]) {
                    stack.push(i);
                }
            }
            vnodeData['class'] = stack.join(' ');
            stack.length = 0;
        }
    }
    return vnode;
}
function t(textValue) {
    const vnode = new VNode();
    vnode.vtext = textValue;
    return vnode;
}

function render(plt, cmpMeta, elm, instance, isUpdateRender) {
    try {
        // if this component has a render function, let's fire
        // it off and generate the child vnodes for this host element
        // note that we do not create the host element cuz it already exists
        const hostMeta = cmpMeta.componentConstructor.host;
        if (instance.render || instance.hostData || hostMeta) {
            // tell the platform we're actively rendering
            // if a value is changed within a render() then
            // this tells the platform not to queue the change
            plt.activeRender = true;
            const vnodeChildren = instance.render && instance.render();
            let vnodeHostData;
            if (Build.hostData) {
                // user component provided a "hostData()" method
                // the returned data/attributes are used on the host element
                vnodeHostData = instance.hostData && instance.hostData();
            }
            // tell the platform we're done rendering
            // now any changes will again queue
            plt.activeRender = false;
            if (Build.hostTheme && hostMeta) {
                // component meta data has a "theme"
                // use this to automatically generate a good css class
                // from the mode and color to add to the host element
                vnodeHostData = Object.keys(hostMeta).reduce((hostData, key) => {
                    switch (key) {
                        case 'theme':
                            hostData['class'] = hostData['class'] || {};
                            hostData['class'] = Object.assign(hostData['class'], createThemedClasses(instance.mode, instance.color, hostMeta['theme']));
                    }
                    return hostData;
                }, vnodeHostData || {});
            }
            // looks like we've got child nodes to render into this host element
            // or we need to update the css class/attrs on the host element
            // if we haven't already created a vnode, then we give the renderer the actual element
            // if this is a re-render, then give the renderer the last vnode we already created
            const oldVNode = plt.vnodeMap.get(elm) || new VNode();
            oldVNode.elm = elm;
            // each patch always gets a new vnode
            // the host element itself isn't patched because it already exists
            // kick off the actual render and any DOM updates
            plt.vnodeMap.set(elm, plt.render(oldVNode, h(null, vnodeHostData, vnodeChildren), isUpdateRender, plt.defaultSlotsMap.get(elm), plt.namedSlotsMap.get(elm), cmpMeta.componentConstructor.encapsulation));
        }
        if (Build.styles) {
            // attach the styles this component needs, if any
            // this fn figures out if the styles should go in a
            // shadow root or if they should be global
            plt.attachStyles(plt, plt.domApi, cmpMeta, instance.mode, elm);
        }
        // it's official, this element has rendered
        elm.$rendered = true;
        if (elm.$onRender) {
            // ok, so turns out there are some child host elements
            // waiting on this parent element to load
            // let's fire off all update callbacks waiting
            elm.$onRender.forEach(cb => cb());
            elm.$onRender = null;
        }
    }
    catch (e) {
        plt.activeRender = false;
        plt.onError(e, 8 /* RenderError */, elm, true);
    }
}

function queueUpdate(plt, elm) {
    // only run patch if it isn't queued already
    if (!plt.isQueuedForUpdate.has(elm)) {
        plt.isQueuedForUpdate.set(elm, true);
        // run the patch in the next tick
        plt.queue.add(() => {
            // vdom diff and patch the host element for differences
            update(plt, elm);
        }, plt.isAppLoaded ? 1 /* Low */ : 3 /* High */);
    }
}
function update(plt, elm, isInitialLoad, instance, ancestorHostElement) {
    // no longer queued for update
    plt.isQueuedForUpdate.delete(elm);
    // everything is async, so somehow we could have already disconnected
    // this node, so be sure to do nothing if we've already disconnected
    if (!plt.isDisconnectedMap.has(elm)) {
        instance = plt.instanceMap.get(elm);
        isInitialLoad = !instance;
        let userPromise;
        if (isInitialLoad) {
            ancestorHostElement = plt.ancestorHostElementMap.get(elm);
            if (ancestorHostElement && !ancestorHostElement.$rendered) {
                // this is the intial load
                // this element has an ancestor host element
                // but the ancestor host element has NOT rendered yet
                // so let's just cool our jets and wait for the ancestor to render
                (ancestorHostElement.$onRender = ancestorHostElement.$onRender || []).push(() => {
                    // this will get fired off when the ancestor host element
                    // finally gets around to rendering its lazy self
                    update(plt, elm);
                });
                return;
            }
            // haven't created a component instance for this host element yet!
            // create the instance from the user's component class
            // https://www.youtube.com/watch?v=olLxrojmvMg
            instance = initComponentInstance(plt, elm);
            if (Build.cmpWillLoad) {
                // fire off the user's componentWillLoad method (if one was provided)
                // componentWillLoad only runs ONCE, after instance's element has been
                // assigned as the host element, but BEFORE render() has been called
                try {
                    if (instance.componentWillLoad) {
                        userPromise = instance.componentWillLoad();
                    }
                }
                catch (e) {
                    plt.onError(e, 3 /* WillLoadError */, elm);
                }
            }
        }
        else if (Build.cmpWillUpdate) {
            // already created an instance and this is an update
            // fire off the user's componentWillUpdate method (if one was provided)
            // componentWillUpdate runs BEFORE render() has been called
            // but only BEFORE an UPDATE and not before the intial render
            // get the returned promise (if one was provided)
            try {
                if (instance.componentWillUpdate) {
                    userPromise = instance.componentWillUpdate();
                }
            }
            catch (e) {
                plt.onError(e, 5 /* WillUpdateError */, elm);
            }
        }
        if (userPromise && userPromise.then) {
            // looks like the user return a promise!
            // let's not actually kick off the render
            // until the user has resolved their promise
            userPromise.then(() => renderUpdate(plt, elm, instance, isInitialLoad));
        }
        else {
            // user never returned a promise so there's
            // no need to wait on anything, let's do the render now my friend
            renderUpdate(plt, elm, instance, isInitialLoad);
        }
    }
}
function renderUpdate(plt, elm, instance, isInitialLoad) {
    // if this component has a render function, let's fire
    // it off and generate a vnode for this
    render(plt, plt.getComponentMeta(elm), elm, instance, !isInitialLoad);
    // _hasRendered was just set
    // _onRenderCallbacks were all just fired off
    try {
        if (isInitialLoad) {
            // so this was the initial load i guess
            elm.$initLoad();
            // componentDidLoad just fired off
        }
        else {
            if (Build.cmpDidUpdate) {
                // fire off the user's componentDidUpdate method (if one was provided)
                // componentDidUpdate runs AFTER render() has been called
                // but only AFTER an UPDATE and not after the intial render
                instance.componentDidUpdate && instance.componentDidUpdate();
            }
            callNodeRefs(plt.vnodeMap.get(elm));
        }
    }
    catch (e) {
        // derp
        plt.onError(e, 6 /* DidUpdateError */, elm, true);
    }
}

function connectedCallback(plt, cmpMeta, elm) {
    if (Build.listener) {
        // initialize our event listeners on the host element
        // we do this now so that we can listening to events that may
        // have fired even before the instance is ready
        if (!plt.hasListenersMap.has(elm)) {
            // it's possible we've already connected
            // then disconnected
            // and the same element is reconnected again
            plt.hasListenersMap.set(elm, true);
            initElementListeners(plt, elm);
        }
    }
    plt.isDisconnectedMap.delete(elm);
    if (!plt.hasConnectedMap.has(elm)) {
        // first time we've connected
        plt.hasConnectedMap.set(elm, true);
        // if somehow this node was reused, ensure we've removed this property
        // elm._hasDestroyed = null;
        // register this component as an actively
        // loading child to its parent component
        registerWithParentComponent(plt, elm);
        // add to the queue to load the bundle
        // it's important to have an async tick in here so we can
        // ensure the "mode" attribute has been added to the element
        // place in high priority since it's not much work and we need
        // to know as fast as possible, but still an async tick in between
        plt.queue.add(() => {
            // only collects slot references if this component even has slots
            plt.connectHostElement(cmpMeta, elm);
            // start loading this component mode's bundle
            // if it's already loaded then the callback will be synchronous
            plt.loadBundle(cmpMeta, elm.mode, () => 
            // we've fully loaded the component mode data
            // let's queue it up to be rendered next
            queueUpdate(plt, elm));
        }, 3 /* High */);
    }
}
function registerWithParentComponent(plt, elm, ancestorHostElement) {
    // find the first ancestor host element (if there is one) and register
    // this element as one of the actively loading child elements for its ancestor
    ancestorHostElement = elm;
    while (ancestorHostElement = plt.domApi.$parentElement(ancestorHostElement)) {
        // climb up the ancestors looking for the first registered component
        if (plt.isDefinedComponent(ancestorHostElement)) {
            // we found this elements the first ancestor host element
            // if the ancestor already loaded then do nothing, it's too late
            if (!plt.hasLoadedMap.has(elm)) {
                // keep a reference to this element's ancestor host element
                // elm._ancestorHostElement = ancestorHostElement;
                plt.ancestorHostElementMap.set(elm, ancestorHostElement);
                // ensure there is an array to contain a reference to each of the child elements
                // and set this element as one of the ancestor's child elements it should wait on
                (ancestorHostElement.$activeLoading = ancestorHostElement.$activeLoading || []).push(elm);
            }
            break;
        }
    }
}

function attributeChangedCallback(membersMeta, elm, attribName, oldVal, newVal, propName) {
    // only react if the attribute values actually changed
    if (oldVal !== newVal && membersMeta) {
        // normalize the attribute name w/ lower case
        attribName = toLowerCase(attribName);
        // using the known component meta data
        // look up to see if we have a property wired up to this attribute name
        for (propName in membersMeta) {
            if (membersMeta[propName].attribName === attribName) {
                // cool we've got a prop using this attribute name the value will
                // be a string, so let's convert it to the correct type the app wants
                // below code is ugly yes, but great minification ;)
                elm[propName] = parsePropertyValue(membersMeta[propName].propType, newVal);
                break;
            }
        }
    }
}

function disconnectedCallback(plt, elm, instance) {
    // only disconnect if we're not temporarily disconnected
    // tmpDisconnected will happen when slot nodes are being relocated
    if (!plt.tmpDisconnected && isDisconnected(plt.domApi, elm)) {
        // ok, let's officially destroy this thing
        // set this to true so that any of our pending async stuff
        // doesn't continue since we already decided to destroy this node
        // elm._hasDestroyed = true;
        plt.isDisconnectedMap.set(elm, true);
        // double check that we've informed the ancestor host elements
        // that they're good to go and loaded (cuz this one is on its way out)
        propagateComponentLoaded(plt, elm);
        // since we're disconnecting, call all of the JSX ref's with null
        callNodeRefs(plt.vnodeMap.get(elm), true);
        // detatch any event listeners that may have been added
        // because we're not passing an exact event name it'll
        // remove all of this element's event, which is good
        plt.domApi.$removeEventListener(elm);
        plt.hasListenersMap.delete(elm);
        if (Build.cmpDidUnload) {
            // call instance componentDidUnload
            // if we've created an instance for this
            instance = plt.instanceMap.get(elm);
            if (instance) {
                // call the user's componentDidUnload if there is one
                instance.componentDidUnload && instance.componentDidUnload();
            }
        }
    }
}
function isDisconnected(domApi, elm) {
    while (elm) {
        if (!domApi.$parentNode(elm)) {
            return domApi.$nodeType(elm) !== 9 /* DocumentNode */;
        }
        elm = domApi.$parentNode(elm);
    }
}

function proxyHostElementPrototype(plt, membersMeta, hostPrototype) {
    // create getters/setters on the host element prototype to represent the public API
    // the setters allows us to know when data has changed so we can re-render
    membersMeta && Object.keys(membersMeta).forEach(memberName => {
        // add getters/setters
        const memberType = membersMeta[memberName].memberType;
        if (memberType === 1 /* Prop */ || memberType === 2 /* PropMutable */) {
            // @Prop() or @Prop({ mutable: true })
            definePropertyGetterSetter(hostPrototype, memberName, function getHostElementProp() {
                // host element getter (cannot be arrow fn)
                // yup, ugly, srynotsry
                // but its creating _values if it doesn't already exist
                return (plt.valuesMap.get(this) || {})[memberName];
            }, function setHostElementProp(newValue) {
                // host element setter (cannot be arrow fn)
                setValue(plt, this, memberName, newValue);
            });
        }
        else if (memberType === 6 /* Method */) {
            // @Method()
            // add a placeholder noop value on the host element's prototype
            // incase this method gets called before setup
            definePropertyValue(hostPrototype, memberName, noop);
        }
    });
}

function initHostElement(plt, cmpMeta, HostElementConstructor, hydratedCssClass) {
    // let's wire up our functions to the host element's prototype
    // we can also inject our platform into each one that needs that api
    // note: these cannot be arrow functions cuz "this" is important here hombre
    HostElementConstructor.connectedCallback = function () {
        // coolsville, our host element has just hit the DOM
        connectedCallback(plt, cmpMeta, this);
    };
    if (Build.observeAttr) {
        HostElementConstructor.attributeChangedCallback = function (attribName, oldVal, newVal) {
            // the browser has just informed us that an attribute
            // on the host element has changed
            attributeChangedCallback(cmpMeta.membersMeta, this, attribName, oldVal, newVal);
        };
    }
    HostElementConstructor.disconnectedCallback = function () {
        // the element has left the builing
        disconnectedCallback(plt, this);
    };
    HostElementConstructor.componentOnReady = function (cb, promise) {
        if (!cb) {
            promise = new Promise(resolve => cb = resolve);
        }
        componentOnReady(plt, this, cb);
        return promise;
    };
    HostElementConstructor.$initLoad = function () {
        initComponentLoaded(plt, this, hydratedCssClass);
    };
    HostElementConstructor.forceUpdate = function () {
        queueUpdate(plt, this);
    };
    // add getters/setters to the host element members
    // these would come from the @Prop and @Method decorators that
    // should create the public API to this component
    proxyHostElementPrototype(plt, cmpMeta.membersMeta, HostElementConstructor);
}
function componentOnReady(plt, elm, cb, onReadyCallbacks) {
    if (!plt.isDisconnectedMap.has(elm)) {
        if (plt.hasLoadedMap.has(elm)) {
            cb(elm);
        }
        else {
            onReadyCallbacks = plt.onReadyCallbacksMap.get(elm) || [];
            onReadyCallbacks.push(cb);
            plt.onReadyCallbacksMap.set(elm, onReadyCallbacks);
        }
    }
}

function connectChildElements(config, plt, hydrateResults, parentElm) {
    if (parentElm && parentElm.children) {
        for (var i = 0; i < parentElm.children.length; i++) {
            connectElement(config, plt, hydrateResults, parentElm.children[i]);
            connectChildElements(config, plt, hydrateResults, parentElm.children[i]);
        }
    }
}
function connectElement(config, plt, hydrateResults, elm) {
    if (!plt.hasConnectedMap.has(elm)) {
        const tagName = elm.tagName.toLowerCase();
        const cmpMeta = plt.getComponentMeta(elm);
        if (cmpMeta) {
            connectHostElement(config, plt, hydrateResults, elm, cmpMeta);
        }
        else if (tagName === 'script') {
            connectScriptElement(hydrateResults, elm);
        }
        else if (tagName === 'link') {
            connectLinkElement(hydrateResults, elm);
        }
        else if (tagName === 'img') {
            connectImgElement(hydrateResults, elm);
        }
        plt.hasConnectedMap.set(elm, true);
    }
}
function connectHostElement(config, plt, hydrateResults, elm, cmpMeta) {
    if (!cmpMeta.componentConstructor) {
        plt.connectHostElement(cmpMeta, elm);
        plt.loadBundle(cmpMeta, elm.mode, noop);
    }
    if (cmpMeta.encapsulation !== 1 /* ShadowDom */) {
        initHostElement(plt, cmpMeta, elm, config.hydratedCssClass);
        connectedCallback(plt, cmpMeta, elm);
    }
    const depth = getNodeDepth(elm);
    const cmp = hydrateResults.components.find(c => c.tag === cmpMeta.tagNameMeta);
    if (cmp) {
        cmp.count++;
        if (depth > cmp.depth) {
            cmp.depth = depth;
        }
    }
    else {
        hydrateResults.components.push({
            tag: cmpMeta.tagNameMeta,
            count: 1,
            depth: depth
        });
    }
}
function connectScriptElement(hydrateResults, elm) {
    const src = elm.src;
    if (src && hydrateResults.scriptUrls.indexOf(src) === -1) {
        hydrateResults.scriptUrls.push(src);
    }
}
function connectLinkElement(hydrateResults, elm) {
    const href = elm.href;
    const rel = (elm.rel || '').toLowerCase();
    if (rel === 'stylesheet' && href && hydrateResults.styleUrls.indexOf(href) === -1) {
        hydrateResults.styleUrls.push(href);
    }
}
function connectImgElement(hydrateResults, elm) {
    const src = elm.src;
    if (src && hydrateResults.imgUrls.indexOf(src) === -1) {
        hydrateResults.imgUrls.push(src);
    }
}
function getNodeDepth(elm) {
    let depth = 0;
    while (elm.parentNode) {
        depth++;
        elm = elm.parentNode;
    }
    return depth;
}

function assignHostContentSlots(plt, domApi, elm, childNodes, childNode, slotName, defaultSlot, namedSlots, i) {
    // so let's loop through each of the childNodes to the host element
    // and pick out the ones that have a slot attribute
    // if it doesn't have a slot attribute, than it's a default slot
    if (!elm.$defaultHolder) {
        // create a comment to represent where the original
        // content was first placed, which is useful later on
        domApi.$insertBefore(elm, (elm.$defaultHolder = domApi.$createComment('')), childNodes[0]);
    }
    for (i = 0; i < childNodes.length; i++) {
        childNode = childNodes[i];
        if (domApi.$nodeType(childNode) === 1 /* ElementNode */ && ((slotName = domApi.$getAttribute(childNode, 'slot')) != null)) {
            // is element node
            // this element has a slot name attribute
            // so this element will end up getting relocated into
            // the component's named slot once it renders
            namedSlots = namedSlots || {};
            if (namedSlots[slotName]) {
                namedSlots[slotName].push(childNode);
            }
            else {
                namedSlots[slotName] = [childNode];
            }
        }
        else {
            // this is a text node
            // or it's an element node that doesn't have a slot attribute
            // let's add this node to our collection for the default slot
            if (defaultSlot) {
                defaultSlot.push(childNode);
            }
            else {
                defaultSlot = [childNode];
            }
        }
    }
    // keep a reference to all of the initial nodes
    // found as immediate childNodes to the host element
    // elm._hostContentNodes = {
    //   defaultSlot: defaultSlot,
    //   namedSlots: namedSlots
    // };
    plt.defaultSlotsMap.set(elm, defaultSlot);
    plt.namedSlotsMap.set(elm, namedSlots);
}

function createDomApi(App, win, doc) {
    // using the $ prefix so that closure is
    // cool with property renaming each of these
    if (!App.ael) {
        App.ael = (elm, eventName, cb, opts) => elm.addEventListener(eventName, cb, opts);
        App.rel = (elm, eventName, cb, opts) => elm.removeEventListener(eventName, cb, opts);
    }
    const unregisterListenerFns = new WeakMap();
    const domApi = {
        $documentElement: doc.documentElement,
        $head: doc.head,
        $body: doc.body,
        $supportsEventOptions: false,
        $nodeType: (node) => node.nodeType,
        $createElement: (tagName) => doc.createElement(tagName),
        $createElementNS: (namespace, tagName) => doc.createElementNS(namespace, tagName),
        $createTextNode: (text) => doc.createTextNode(text),
        $createComment: (data) => doc.createComment(data),
        $insertBefore: (parentNode, childNode, referenceNode) => parentNode.insertBefore(childNode, referenceNode),
        // https://developer.mozilla.org/en-US/docs/Web/API/ChildNode/remove
        // and it's polyfilled in es5 builds
        $remove: (node) => node.remove(),
        $appendChild: (parentNode, childNode) => parentNode.appendChild(childNode),
        $childNodes: (node) => node.childNodes,
        $parentNode: (node) => node.parentNode,
        $nextSibling: (node) => node.nextSibling,
        $tagName: (elm) => toLowerCase(elm.tagName),
        $getTextContent: (node) => node.textContent,
        $setTextContent: (node, text) => node.textContent = text,
        $getAttribute: (elm, key) => elm.getAttribute(key),
        $setAttribute: (elm, key, val) => elm.setAttribute(key, val),
        $setAttributeNS: (elm, namespaceURI, qualifiedName, val) => elm.setAttributeNS(namespaceURI, qualifiedName, val),
        $removeAttribute: (elm, key) => elm.removeAttribute(key),
        $elementRef: (elm, referenceName) => {
            if (referenceName === 'child') {
                return elm.firstElementChild;
            }
            if (referenceName === 'parent') {
                return domApi.$parentElement(elm);
            }
            if (referenceName === 'body') {
                return domApi.$body;
            }
            if (referenceName === 'document') {
                return doc;
            }
            if (referenceName === 'window') {
                return win;
            }
            return elm;
        },
        $addEventListener: (assignerElm, eventName, listenerCallback, useCapture, usePassive, attachTo, eventListenerOpts, splt) => {
            // remember the original name before we possibly change it
            const assignersEventName = eventName;
            let attachToElm = assignerElm;
            // get the existing unregister listeners for
            // this element from the unregister listeners weakmap
            let assignersUnregListeners = unregisterListenerFns.get(assignerElm);
            if (assignersUnregListeners && assignersUnregListeners[assignersEventName]) {
                // removed any existing listeners for this event for the assigner element
                // this element already has this listener, so let's unregister it now
                assignersUnregListeners[assignersEventName]();
            }
            if (typeof attachTo === 'string') {
                // attachTo is a string, and is probably something like
                // "parent", "window", or "document"
                // and the eventName would be like "mouseover" or "mousemove"
                attachToElm = domApi.$elementRef(assignerElm, attachTo);
            }
            else if (typeof attachTo === 'object') {
                // we were passed in an actual element to attach to
                attachToElm = attachTo;
            }
            else {
                // depending on the event name, we could actually be attaching
                // this element to something like the document or window
                splt = eventName.split(':');
                if (splt.length > 1) {
                    // document:mousemove
                    // parent:touchend
                    // body:keyup.enter
                    attachToElm = domApi.$elementRef(assignerElm, splt[0]);
                    eventName = splt[1];
                }
            }
            if (!attachToElm) {
                // somehow we're referencing an element that doesn't exist
                // let's not continue
                return;
            }
            let eventListener = listenerCallback;
            // test to see if we're looking for an exact keycode
            splt = eventName.split('.');
            if (splt.length > 1) {
                // looks like this listener is also looking for a keycode
                // keyup.enter
                eventName = splt[0];
                eventListener = (ev) => {
                    // wrap the user's event listener with our own check to test
                    // if this keyboard event has the keycode they're looking for
                    if (ev.keyCode === KEY_CODE_MAP[splt[1]]) {
                        listenerCallback(ev);
                    }
                };
            }
            // create the actual event listener options to use
            // this browser may not support event options
            eventListenerOpts = domApi.$supportsEventOptions ? {
                capture: !!useCapture,
                passive: !!usePassive
            } : !!useCapture;
            // ok, good to go, let's add the actual listener to the dom element
            App.ael(attachToElm, eventName, eventListener, eventListenerOpts);
            if (!assignersUnregListeners) {
                // we don't already have a collection, let's create it
                unregisterListenerFns.set(assignerElm, assignersUnregListeners = {});
            }
            // add the unregister listener to this element's collection
            assignersUnregListeners[assignersEventName] = () => {
                // looks like it's time to say goodbye
                attachToElm && App.rel(attachToElm, eventName, eventListener, eventListenerOpts);
                assignersUnregListeners[assignersEventName] = null;
            };
        },
        $removeEventListener: (elm, eventName) => {
            // get the unregister listener functions for this element
            const assignersUnregListeners = unregisterListenerFns.get(elm);
            if (assignersUnregListeners) {
                // this element has unregister listeners
                if (eventName) {
                    // passed in one specific event name to remove
                    assignersUnregListeners[eventName] && assignersUnregListeners[eventName]();
                }
                else {
                    // remove all event listeners
                    Object.keys(assignersUnregListeners).forEach(assignersEventName => {
                        assignersUnregListeners[assignersEventName] && assignersUnregListeners[assignersEventName]();
                    });
                }
            }
        }
    };
    if (Build.shadowDom) {
        domApi.$attachShadow = (elm, shadowRootInit) => elm.attachShadow(shadowRootInit);
        domApi.$supportsShadowDom = !!domApi.$documentElement.attachShadow;
    }
    if (Build.es5) {
        if (typeof win.CustomEvent !== 'function') {
            // CustomEvent polyfill
            win.CustomEvent = (event, data, evt) => {
                evt = doc.createEvent('CustomEvent');
                evt.initCustomEvent(event, data.bubbles, data.cancelable, data.detail);
                return evt;
            };
            win.CustomEvent.prototype = win.Event.prototype;
        }
    }
    domApi.$dispatchEvent = (elm, eventName, data) => elm && elm.dispatchEvent(new win.CustomEvent(eventName, data));
    if (Build.event || Build.listener) {
        // test if this browser supports event options or not
        try {
            win.addEventListener('e', null, Object.defineProperty({}, 'passive', {
                get: () => domApi.$supportsEventOptions = true
            }));
        }
        catch (e) { }
    }
    domApi.$parentElement = (elm, parentNode) => {
        // if the parent node is a document fragment (shadow root)
        // then use the "host" property on it
        // otherwise use the parent node
        parentNode = domApi.$parentNode(elm);
        return (parentNode && domApi.$nodeType(parentNode) === 11 /* DocumentFragment */) ? parentNode.host : parentNode;
    };
    return domApi;
}

function createQueueServer() {
    const highCallbacks = [];
    const lowCallbacks = [];
    let queued = false;
    function flush(cb) {
        while (highCallbacks.length > 0) {
            highCallbacks.shift()();
        }
        while (lowCallbacks.length > 0) {
            lowCallbacks.shift()();
        }
        queued = (highCallbacks.length > 0) || (lowCallbacks.length > 0);
        if (queued) {
            process.nextTick(flush);
        }
        cb && cb();
    }
    function add(cb, priority) {
        if (priority === 3 /* High */) {
            highCallbacks.push(cb);
        }
        else {
            lowCallbacks.push(cb);
        }
        if (!queued) {
            queued = true;
            process.nextTick(flush);
        }
    }
    return {
        add: add,
        flush: flush
    };
}

function patchDomApi(plt, domApi) {
    const orgCreateElement = domApi.$createElement;
    domApi.$createElement = (tagName) => {
        const elm = orgCreateElement(tagName);
        const cmpMeta = plt.getComponentMeta(elm);
        if (cmpMeta && !cmpMeta.componentConstructor) {
            plt.connectHostElement(cmpMeta, elm);
            plt.loadBundle(cmpMeta, elm.mode, noop);
        }
        return elm;
    };
}

function proxyController(domApi, controllerComponents, ctrlTag) {
    return {
        'create': proxyProp(domApi, controllerComponents, ctrlTag, 'create'),
        'componentOnReady': proxyProp(domApi, controllerComponents, ctrlTag, 'componentOnReady')
    };
}
function proxyProp(domApi, controllerComponents, ctrlTag, proxyMethodName) {
    return function () {
        const args = arguments;
        return loadComponent(domApi, controllerComponents, ctrlTag)
            .then(ctrlElm => ctrlElm[proxyMethodName].apply(ctrlElm, args));
    };
}
function loadComponent(domApi, controllerComponents, ctrlTag) {
    return new Promise(resolve => {
        let ctrlElm = controllerComponents[ctrlTag];
        if (!ctrlElm) {
            ctrlElm = domApi.$body.querySelector(ctrlTag);
        }
        if (!ctrlElm) {
            ctrlElm = controllerComponents[ctrlTag] = domApi.$createElement(ctrlTag);
            domApi.$appendChild(domApi.$body, ctrlElm);
        }
        ctrlElm.componentOnReady(resolve);
    });
}

function createPlatformServer(config, win, doc, cmpRegistry, hydrateResults, isPrerender, compilerCtx) {
    const loadedBundles = {};
    const styles = [];
    const controllerComponents = {};
    // create the app global
    const App = {};
    const domApi = createDomApi(App, win, doc);
    // init build context
    compilerCtx = compilerCtx || {};
    // the root <html> element is always the top level registered component
    cmpRegistry = Object.assign({ 'html': {} }, cmpRegistry);
    // initialize Core global object
    const Context = {};
    Context.addListener = noop;
    Context.enableListener = noop;
    Context.emit = noop;
    Context.isClient = false;
    Context.isServer = true;
    Context.isPrerender = isPrerender;
    Context.window = win;
    Context.location = win.location;
    Context.document = doc;
    // add the Core global to the window context
    // Note: "Core" is not on the window context on the client-side
    win.Context = Context;
    // add the h() fn to the app's global namespace
    App.h = h;
    App.Context = Context;
    // add the app's global to the window context
    win[config.namespace] = App;
    const appWwwDir = config.wwwDir;
    const appBuildDir = getAppWWWBuildDir(config);
    Context.publicPath = appBuildDir;
    // create the sandboxed context with a new instance of a V8 Context
    // V8 Context provides an isolated global environment
    config.sys.vm.createContext(compilerCtx, appWwwDir, win);
    // execute the global scripts (if there are any)
    runGlobalScripts();
    // create the platform api which is used throughout common core code
    const plt = {
        attachStyles: noop,
        connectHostElement,
        defineComponent,
        domApi,
        emitEvent: noop,
        getComponentMeta,
        getContextItem,
        isDefinedComponent,
        loadBundle: loadComponent$$1,
        onError,
        propConnect,
        queue: createQueueServer(),
        tmpDisconnected: false,
        ancestorHostElementMap: new WeakMap(),
        componentAppliedStyles: new WeakMap(),
        defaultSlotsMap: new WeakMap(),
        hasConnectedMap: new WeakMap(),
        hasListenersMap: new WeakMap(),
        hasLoadedMap: new WeakMap(),
        hostElementMap: new WeakMap(),
        instanceMap: new WeakMap(),
        isDisconnectedMap: new WeakMap(),
        isQueuedForUpdate: new WeakMap(),
        namedSlotsMap: new WeakMap(),
        onReadyCallbacksMap: new WeakMap(),
        queuedEvents: new WeakMap(),
        vnodeMap: new WeakMap(),
        valuesMap: new WeakMap()
    };
    // patch dom api like createElement()
    patchDomApi(plt, domApi);
    // create the renderer which will be used to patch the vdom
    plt.render = createRendererPatch(plt, domApi);
    // setup the root node of all things
    // which is the mighty <html> tag
    const rootElm = domApi.$documentElement;
    rootElm.$rendered = true;
    rootElm.$activeLoading = [];
    rootElm.$initLoad = function appLoadedCallback() {
        plt.hasLoadedMap.set(rootElm, true);
        appLoaded();
    };
    function appLoaded(failureDiagnostic) {
        if (plt.hasLoadedMap.has(rootElm) || failureDiagnostic) {
            // the root node has loaded
            // and there are no css files still loading
            plt.onAppLoad && plt.onAppLoad(rootElm, styles, failureDiagnostic);
        }
    }
    function connectHostElement(_cmpMeta, elm) {
        // set the "mode" property
        if (!elm.mode) {
            // looks like mode wasn't set as a property directly yet
            // first check if there's an attribute
            // next check the app's global
            elm.mode = domApi.$getAttribute(elm, 'mode') || Context.mode;
        }
        // pick out all of the light dom nodes from the host element
        assignHostContentSlots(plt, domApi, elm, elm.childNodes);
    }
    function getComponentMeta(elm) {
        // registry tags are always lower-case
        return cmpRegistry[elm.tagName.toLowerCase()];
    }
    function defineComponent(cmpMeta) {
        // default mode and color props
        cmpRegistry[cmpMeta.tagNameMeta] = cmpMeta;
    }
    /**
     * Execute a bundle queue item
     * @param name
     * @param deps
     * @param callback
     */
    function execBundleCallback(name, deps, callback) {
        const bundleExports = {};
        try {
            callback(bundleExports, ...deps.map(d => loadedBundles[d]));
        }
        catch (e) {
            onError(e, 1 /* LoadBundleError */, null, true);
        }
        // If name is undefined then this callback was fired by component callback
        if (name === undefined) {
            return;
        }
        loadedBundles[name] = bundleExports;
        // If name contains chunk then this callback was associated with a dependent bundle loading
        // let's add a reference to the constructors on each components metadata
        // each key in moduleImports is a PascalCased tag name
        if (!name.startsWith('./chunk')) {
            Object.keys(bundleExports).forEach(pascalCasedTagName => {
                const cmpMeta = cmpRegistry[toDashCase(pascalCasedTagName)];
                if (cmpMeta) {
                    // connect the component's constructor to its metadata
                    const componentConstructor = bundleExports[pascalCasedTagName];
                    if (!cmpMeta.componentConstructor) {
                        // init component constructor
                        cmpMeta.componentConstructor = componentConstructor;
                        cmpMeta.membersMeta = {
                            'color': {}
                        };
                        if (cmpMeta.componentConstructor.properties) {
                            Object.keys(cmpMeta.componentConstructor.properties).forEach(memberName => {
                                const constructorProperty = cmpMeta.componentConstructor.properties[memberName];
                                if (constructorProperty.type) {
                                    cmpMeta.membersMeta[memberName] = {
                                        propType: 1 /* Any */
                                    };
                                }
                            });
                        }
                    }
                    if (componentConstructor.style) {
                        styles.push(componentConstructor.style);
                    }
                }
            });
        }
    }
    /**
     * This function is called anytime a JS file is loaded
     */
    App.loadBundle = function loadBundle(bundleId, [, ...dependentsList], importer) {
        const missingDependents = dependentsList.filter(d => !loadedBundles[d]);
        missingDependents.forEach(d => {
            const fileName = d.replace('.js', '.es5.js');
            loadFile(fileName);
        });
        execBundleCallback(bundleId, dependentsList, importer);
    };
    function isDefinedComponent(elm) {
        return !!(cmpRegistry[elm.tagName.toLowerCase()]);
    }
    plt.attachStyles = function attachStyles(_domApi, _cmpMeta, _modeName, _elm) { };
    // This is executed by the component's connected callback.
    function loadComponent$$1(cmpMeta, modeName, cb, bundleId) {
        bundleId = (typeof cmpMeta.bundleIds === 'string') ?
            cmpMeta.bundleIds :
            cmpMeta.bundleIds[modeName];
        // It is possible the data was loaded from an outside source like tests
        if (cmpRegistry[cmpMeta.tagNameMeta].componentConstructor) {
            cb();
        }
        else if (loadedBundles[bundleId]) {
            // sweet, we've already loaded this bundle
            cb();
        }
        else {
            const fileName = getComponentBundleFilename(cmpMeta, modeName);
            loadFile(fileName);
        }
    }
    function loadFile(fileName) {
        const jsFilePath = config.sys.path.join(appBuildDir, fileName);
        const jsCode = compilerCtx.fs.readFileSync(jsFilePath);
        config.sys.vm.runInContext(jsCode, win);
    }
    function runGlobalScripts() {
        if (!compilerCtx || !compilerCtx.appFiles || !compilerCtx.appFiles.global) {
            return;
        }
        config.sys.vm.runInContext(compilerCtx.appFiles.global, win);
    }
    function onError(err, type, elm, appFailure) {
        const d = {
            type: 'runtime',
            header: 'Runtime error detected',
            level: 'error',
            messageText: err ? err.message ? err.message : err.toString() : ''
        };
        if (err && err.stack) {
            d.messageText += '\n' + err.stack;
            d.messageText = d.messageText.trim();
        }
        switch (type) {
            case 1 /* LoadBundleError */:
                d.header += ' while loading bundle';
                break;
            case 2 /* QueueEventsError */:
                d.header += ' while running initial events';
                break;
            case 3 /* WillLoadError */:
                d.header += ' during componentWillLoad()';
                break;
            case 4 /* DidLoadError */:
                d.header += ' during componentDidLoad()';
                break;
            case 7 /* InitInstanceError */:
                d.header += ' while initializing instance';
                break;
            case 8 /* RenderError */:
                d.header += ' while rendering';
                break;
            case 6 /* DidUpdateError */:
                d.header += ' while updating';
                break;
        }
        if (elm && elm.tagName) {
            d.header += ': ' + elm.tagName.toLowerCase();
        }
        hydrateResults.diagnostics.push(d);
        if (appFailure) {
            appLoaded(d);
        }
    }
    function propConnect(ctrlTag) {
        return proxyController(domApi, controllerComponents, ctrlTag);
    }
    function getContextItem(contextKey) {
        return Context[contextKey];
    }
    return plt;
}
function getComponentBundleFilename(cmpMeta, modeName) {
    let bundleId = (typeof cmpMeta.bundleIds === 'string') ?
        cmpMeta.bundleIds :
        (cmpMeta.bundleIds[modeName] || cmpMeta.bundleIds[DEFAULT_STYLE_MODE]);
    if (cmpMeta.encapsulation === 2 /* ScopedCss */ || cmpMeta.encapsulation === 1 /* ShadowDom */) {
        bundleId += '.sc';
    }
    // server-side always uses es5 and jsonp callback modules
    bundleId += '.es5.js';
    return bundleId;
}

function normalizePrerenderLocation(config, windowLocationHref, href) {
    const prerenderConfig = config && config.prerender;
    let prerenderLocation = null;
    try {
        if (typeof href !== 'string') {
            return null;
        }
        // remove any quotes that somehow got in the href
        href = href.replace(/\'|\"/g, '');
        // parse the <a href> passed in
        const hrefParseUrl = config.sys.url.parse(href);
        // don't bother for basically empty <a> tags
        if (!hrefParseUrl.pathname) {
            return null;
        }
        // parse the window.location
        const windowLocationUrl = config.sys.url.parse(windowLocationHref);
        // urls must be on the same host
        // but only check they're the same host when the href has a host
        if (hrefParseUrl.hostname && hrefParseUrl.hostname !== windowLocationUrl.hostname) {
            return null;
        }
        // convert it back to a nice in pretty path
        prerenderLocation = {
            url: config.sys.url.resolve(windowLocationHref, href)
        };
        const normalizedUrl = config.sys.url.parse(prerenderLocation.url);
        normalizedUrl.hash = null;
        if (!prerenderConfig || !prerenderConfig.includePathQuery) {
            normalizedUrl.search = null;
        }
        prerenderLocation.url = config.sys.url.format(normalizedUrl);
        prerenderLocation.path = config.sys.url.parse(prerenderLocation.url).path;
        if (hrefParseUrl.hash && prerenderConfig && prerenderConfig.includePathHash) {
            prerenderLocation.url += hrefParseUrl.hash;
            prerenderLocation.path += hrefParseUrl.hash;
        }
    }
    catch (e) {
        config.logger.error(`normalizePrerenderLocation`, e);
        return null;
    }
    return prerenderLocation;
}
function crawlAnchorsForNextUrls(config, prerenderQueue, results) {
    results.anchors && results.anchors.forEach(anchor => {
        addLocationToProcess(config, results.url, prerenderQueue, anchor.href);
    });
}
function addLocationToProcess(config, windowLocationHref, prerenderQueue, locationUrl) {
    const prerenderLocation = normalizePrerenderLocation(config, windowLocationHref, locationUrl);
    if (!prerenderLocation || prerenderQueue.some(p => p.url === prerenderLocation.url)) {
        // either it's not a good location to prerender
        // or we've already got it in the queue
        return;
    }
    // set that this location is pending to be prerendered
    prerenderLocation.status = 'pending';
    // add this to our queue of locations to prerender
    prerenderQueue.push(prerenderLocation);
}
function getPrerenderQueue(config) {
    const prerenderHost = `http://${DEFAULT_PRERENDER_HOST}`;
    const prerenderQueue = [];
    const prerenderConfig = config.prerender;
    if (Array.isArray(prerenderConfig.include)) {
        prerenderConfig.include.forEach(prerenderUrl => {
            addLocationToProcess(config, prerenderHost, prerenderQueue, prerenderUrl.path);
        });
    }
    return prerenderQueue;
}

var __awaiter$46 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function assetVersioning(config, compilerCtx, windowLocationHref, doc) {
    return Promise.all([
        versionElementAssets(config, compilerCtx, windowLocationHref, doc)
    ]);
}
function versionElementAssets(config, compilerCtx, windowLocationHref, doc) {
    return __awaiter$46(this, void 0, void 0, function* () {
        if (!config.assetVersioning.versionHtml) {
            return;
        }
        yield Promise.all([
            versionElementTypeAssets(config, compilerCtx, windowLocationHref, doc, 'img[src]', 'src'),
            versionElementTypeAssets(config, compilerCtx, windowLocationHref, doc, 'link[rel="apple-touch-icon"][href]', 'href'),
            versionElementTypeAssets(config, compilerCtx, windowLocationHref, doc, 'link[rel="icon"][href]', 'href'),
            versionElementTypeAssets(config, compilerCtx, windowLocationHref, doc, 'link[rel="manifest"][href]', 'href'),
            versionElementTypeAssets(config, compilerCtx, windowLocationHref, doc, 'link[rel="stylesheet"][href]', 'href'),
            versionElementTypeAssets(config, compilerCtx, windowLocationHref, doc, 'script[src]', 'src'),
        ]);
    });
}
function versionElementTypeAssets(config, compilerCtx, windowLocationHref, doc, selector, attrName) {
    return __awaiter$46(this, void 0, void 0, function* () {
        const elements = doc.querySelectorAll(selector);
        const promises = [];
        for (let i = 0; i < elements.length; i++) {
            promises.push(versionElementTypeAsset(config, compilerCtx, windowLocationHref, elements[i], attrName));
        }
        return Promise.all(promises);
    });
}
function versionElementTypeAsset(config, compilerCtx, windowLocationHref, elm, attrName) {
    return __awaiter$46(this, void 0, void 0, function* () {
        const url = elm.getAttribute(attrName);
        const versionedUrl = yield versionAsset(config, compilerCtx, windowLocationHref, url);
        if (versionedUrl) {
            elm.setAttribute(attrName, versionedUrl);
        }
    });
}
function versionAsset(config, compilerCtx, windowLocationHref, url) {
    return __awaiter$46(this, void 0, void 0, function* () {
        try {
            const orgFilePath = getFilePathFromUrl(config, windowLocationHref, url);
            if (!orgFilePath) {
                return null;
            }
            if (hasFileExtension(orgFilePath, TXT_EXT$1)) {
                const content = yield compilerCtx.fs.readFile(orgFilePath);
                const hash = config.sys.generateContentHash(content, config.hashedFileNameLength);
                const dirName = config.sys.path.dirname(orgFilePath);
                const fileName = config.sys.path.basename(orgFilePath);
                const hashedFileName = createHashedFileName(fileName, hash);
                const hashedFilePath = config.sys.path.join(dirName, hashedFileName);
                yield compilerCtx.fs.writeFile(hashedFilePath, content);
                yield compilerCtx.fs.remove(orgFilePath);
                return hashedFileName;
            }
        }
        catch (e) { }
        return null;
    });
}
function getFilePathFromUrl(config, windowLocationHref, url) {
    if (typeof url !== 'string' || url.trim() === '') {
        return null;
    }
    const location = normalizePrerenderLocation(config, windowLocationHref, url);
    if (!location) {
        return null;
    }
    return config.sys.path.join(config.wwwDir, location.path);
}
function createHashedFileName(fileName, hash) {
    const parts = fileName.split('.');
    parts.splice(parts.length - 1, 0, hash);
    return parts.join('.');
}
const TXT_EXT$1 = ['js', 'css', 'svg', 'json'];

function collapseHtmlWhitepace(node) {
    // this isn't about reducing HTML filesize (cuz it doesn't really matter after gzip)
    // this is more about having many less nodes for the client side to
    // have to climb through while it's creating vnodes from this HTML
    if (WHITESPACE_SENSITIVE_TAGS.indexOf(node.tagName) > -1) {
        return;
    }
    var lastWhitespaceTextNode = null;
    for (var i = node.childNodes.length - 1; i >= 0; i--) {
        var childNode = node.childNodes[i];
        if (childNode.nodeType === 3 /* TextNode */ || childNode.nodeType === 8 /* CommentNode */) {
            childNode.nodeValue = childNode.nodeValue.replace(REDUCE_WHITESPACE_REGEX, ' ');
            if (childNode.nodeValue === ' ') {
                if (lastWhitespaceTextNode === null) {
                    childNode.nodeValue = ' ';
                    lastWhitespaceTextNode = childNode;
                }
                else {
                    childNode.parentNode.removeChild(childNode);
                }
                continue;
            }
        }
        else if (childNode.childNodes) {
            collapseHtmlWhitepace(childNode);
        }
        lastWhitespaceTextNode = null;
    }
}
const REDUCE_WHITESPACE_REGEX = /\s\s+/g;
const WHITESPACE_SENSITIVE_TAGS = ['PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'];

// http://www.w3.org/TR/CSS21/grammar.html
// https://github.com/visionmedia/css-parse/pull/49#issuecomment-30088027
const commentre = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;
function parseCss(config, css, filePath) {
    /**
     * Positional.
     */
    var lineno = 1;
    var column = 1;
    var srcLines;
    /**
     * Update lineno and column based on `str`.
     */
    function updatePosition(str) {
        const lines = str.match(/\n/g);
        if (lines)
            lineno += lines.length;
        const i = str.lastIndexOf('\n');
        column = ~i ? str.length - i : column + str.length;
    }
    /**
     * Mark position and patch `node.position`.
     */
    function position() {
        const start = { line: lineno, column: column };
        return function (node) {
            node.position = new ParsePosition(start);
            whitespace();
            return node;
        };
    }
    /**
     * Store position information for a node
     */
    class ParsePosition {
        constructor(start) {
            this.start = start;
            this.end = { line: lineno, column: column };
            this.source = filePath;
        }
    }
    /**
     * Non-enumerable source string
     */
    ParsePosition.prototype.content = css;
    /**
     * Error `msg`.
     */
    const diagnostics = [];
    function error(msg) {
        if (!srcLines) {
            srcLines = css.split('\n');
        }
        const d = {
            level: 'error',
            type: 'css',
            language: 'css',
            header: 'CSS Parse',
            messageText: msg,
            absFilePath: filePath,
            lines: [{
                    lineIndex: lineno - 1,
                    lineNumber: lineno,
                    errorCharStart: column,
                    text: css[lineno - 1],
                }]
        };
        d.header = formatHeader('CSS', filePath, config.rootDir, lineno);
        if (lineno > 1) {
            const previousLine = {
                lineIndex: lineno - 1,
                lineNumber: lineno - 1,
                text: css[lineno - 2],
                errorCharStart: -1,
                errorLength: -1
            };
            d.lines.unshift(previousLine);
        }
        if (lineno + 2 < srcLines.length) {
            const nextLine = {
                lineIndex: lineno,
                lineNumber: lineno + 1,
                text: srcLines[lineno],
                errorCharStart: -1,
                errorLength: -1
            };
            d.lines.push(nextLine);
        }
        diagnostics.push(d);
    }
    /**
     * Parse stylesheet.
     */
    function stylesheet() {
        const rulesList = rules();
        return {
            type: 'stylesheet',
            stylesheet: {
                source: filePath,
                rules: rulesList,
                diagnostics: diagnostics
            }
        };
    }
    /**
     * Opening brace.
     */
    function open() {
        return match(/^{\s*/);
    }
    /**
     * Closing brace.
     */
    function close() {
        return match(/^}/);
    }
    /**
     * Parse ruleset.
     */
    function rules() {
        var node;
        const rules = [];
        whitespace();
        comments(rules);
        while (css.length && css.charAt(0) !== '}' && (node = atrule() || rule())) {
            if (node !== false) {
                rules.push(node);
                comments(rules);
            }
        }
        return rules;
    }
    /**
     * Match `re` and return captures.
     */
    function match(re) {
        const m = re.exec(css);
        if (!m)
            return;
        const str = m[0];
        updatePosition(str);
        css = css.slice(str.length);
        return m;
    }
    /**
     * Parse whitespace.
     */
    function whitespace() {
        match(/^\s*/);
    }
    /**
     * Parse comments;
     */
    function comments(rules) {
        var c;
        rules = rules || [];
        while (c = comment()) {
            if (c !== false) {
                rules.push(c);
            }
        }
        return rules;
    }
    /**
     * Parse comment.
     */
    function comment() {
        const pos = position();
        if ('/' !== css.charAt(0) || '*' !== css.charAt(1))
            return;
        var i = 2;
        while ('' !== css.charAt(i) && ('*' !== css.charAt(i) || '/' !== css.charAt(i + 1)))
            ++i;
        i += 2;
        if ('' === css.charAt(i - 1)) {
            return error('End of comment missing');
        }
        const str = css.slice(2, i - 2);
        column += 2;
        updatePosition(str);
        css = css.slice(i);
        column += 2;
        return pos({
            type: 'comment',
            comment: str
        });
    }
    /**
     * Parse selector.
     */
    function selector() {
        const m = match(/^([^{]+)/);
        if (!m)
            return;
        /* @fix Remove all comments from selectors
         * http://ostermiller.org/findcomment.html */
        return trim(m[0])
            .replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
            .replace(/"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g, function (m) {
            return m.replace(/,/g, '\u200C');
        })
            .split(/\s*(?![^(]*\)),\s*/)
            .map(function (s) {
            return s.replace(/\u200C/g, ',');
        });
    }
    /**
     * Parse declaration.
     */
    function declaration() {
        const pos = position();
        // prop
        var prop = match(/^(\*?[-#\/\*\\\w]+(\[[0-9a-z_-]+\])?)\s*/);
        if (!prop)
            return;
        prop = trim(prop[0]);
        // :
        if (!match(/^:\s*/))
            return error(`property missing ':'`);
        // val
        const val = match(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^\)]*?\)|[^};])+)/);
        const ret = pos({
            type: 'declaration',
            property: prop.replace(commentre, ''),
            value: val ? trim(val[0]).replace(commentre, '') : ''
        });
        // ;
        match(/^[;\s]*/);
        return ret;
    }
    /**
     * Parse declarations.
     */
    function declarations() {
        const decls = [];
        if (!open())
            return error(`missing '{'`);
        comments(decls);
        // declarations
        var decl;
        while (decl = declaration()) {
            if (decl !== false) {
                decls.push(decl);
                comments(decls);
            }
        }
        if (!close())
            return error(`missing '}'`);
        return decls;
    }
    /**
     * Parse keyframe.
     */
    function keyframe() {
        var m;
        const vals = [];
        const pos = position();
        while (m = match(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/)) {
            vals.push(m[1]);
            match(/^,\s*/);
        }
        if (!vals.length)
            return;
        return pos({
            type: 'keyframe',
            values: vals,
            declarations: declarations()
        });
    }
    /**
     * Parse keyframes.
     */
    function atkeyframes() {
        const pos = position();
        var m = match(/^@([-\w]+)?keyframes\s*/);
        if (!m)
            return;
        const vendor = m[1];
        // identifier
        m = match(/^([-\w]+)\s*/);
        if (!m)
            return error(`@keyframes missing name`);
        const name = m[1];
        if (!open())
            return error(`@keyframes missing '{'`);
        var frame;
        var frames = comments();
        while (frame = keyframe()) {
            frames.push(frame);
            frames = frames.concat(comments());
        }
        if (!close())
            return error(`@keyframes missing '}'`);
        return pos({
            type: 'keyframes',
            name: name,
            vendor: vendor,
            keyframes: frames
        });
    }
    /**
     * Parse supports.
     */
    function atsupports() {
        const pos = position();
        const m = match(/^@supports *([^{]+)/);
        if (!m)
            return;
        const supports = trim(m[1]);
        if (!open())
            return error(`@supports missing '{'`);
        const style = comments().concat(rules());
        if (!close())
            return error(`@supports missing '}'`);
        return pos({
            type: 'supports',
            supports: supports,
            rules: style
        });
    }
    /**
     * Parse host.
     */
    function athost() {
        const pos = position();
        const m = match(/^@host\s*/);
        if (!m)
            return;
        if (!open())
            return error(`@host missing '{'`);
        const style = comments().concat(rules());
        if (!close())
            return error(`@host missing '}'`);
        return pos({
            type: 'host',
            rules: style
        });
    }
    /**
     * Parse media.
     */
    function atmedia() {
        const pos = position();
        const m = match(/^@media *([^{]+)/);
        if (!m)
            return;
        const media = trim(m[1]);
        if (!open())
            return error(`@media missing '{'`);
        const style = comments().concat(rules());
        if (!close())
            return error(`@media missing '}'`);
        return pos({
            type: 'media',
            media: media,
            rules: style
        });
    }
    /**
     * Parse custom-media.
     */
    function atcustommedia() {
        const pos = position();
        const m = match(/^@custom-media\s+(--[^\s]+)\s*([^{;]+);/);
        if (!m)
            return;
        return pos({
            type: 'custom-media',
            name: trim(m[1]),
            media: trim(m[2])
        });
    }
    /**
     * Parse paged media.
     */
    function atpage() {
        const pos = position();
        const m = match(/^@page */);
        if (!m)
            return;
        const sel = selector() || [];
        if (!open())
            return error(`@page missing '{'`);
        var decls = comments();
        // declarations
        var decl;
        while (decl = declaration()) {
            decls.push(decl);
            decls = decls.concat(comments());
        }
        if (!close())
            return error(`@page missing '}'`);
        return pos({
            type: 'page',
            selectors: sel,
            declarations: decls
        });
    }
    /**
     * Parse document.
     */
    function atdocument() {
        const pos = position();
        const m = match(/^@([-\w]+)?document *([^{]+)/);
        if (!m)
            return;
        const vendor = trim(m[1]);
        const doc = trim(m[2]);
        if (!open())
            return error(`@document missing '{'`);
        const style = comments().concat(rules());
        if (!close())
            return error(`@document missing '}'`);
        return pos({
            type: 'document',
            document: doc,
            vendor: vendor,
            rules: style
        });
    }
    /**
     * Parse font-face.
     */
    function atfontface() {
        const pos = position();
        const m = match(/^@font-face\s*/);
        if (!m)
            return;
        if (!open())
            return error(`@font-face missing '{'`);
        var decls = comments();
        // declarations
        var decl;
        while (decl = declaration()) {
            decls.push(decl);
            decls = decls.concat(comments());
        }
        if (!close())
            return error(`@font-face missing '}'`);
        return pos({
            type: 'font-face',
            declarations: decls
        });
    }
    /**
     * Parse import
     */
    const atimport = _compileAtrule('import');
    /**
     * Parse charset
     */
    const atcharset = _compileAtrule('charset');
    /**
     * Parse namespace
     */
    const atnamespace = _compileAtrule('namespace');
    /**
     * Parse non-block at-rules
     */
    function _compileAtrule(name) {
        const re = new RegExp('^@' + name + '\\s*([^;]+);');
        return function () {
            const pos = position();
            const m = match(re);
            if (!m)
                return;
            const ret = { type: name };
            ret[name] = m[1].trim();
            return pos(ret);
        };
    }
    /**
     * Parse at rule.
     */
    function atrule() {
        if (css[0] !== '@')
            return;
        return atkeyframes()
            || atmedia()
            || atcustommedia()
            || atsupports()
            || atimport()
            || atcharset()
            || atnamespace()
            || atdocument()
            || atpage()
            || athost()
            || atfontface();
    }
    /**
     * Parse rule.
     */
    function rule() {
        const pos = position();
        const sel = selector();
        if (!sel)
            return error('selector missing');
        comments();
        return pos({
            type: 'rule',
            selectors: sel,
            declarations: declarations()
        });
    }
    return addParent(stylesheet());
}
/**
 * Trim `str`.
 */
function trim(str) {
    return str ? str.trim() : '';
}
/**
 * Adds non-enumerable parent node reference to each node.
 */
function addParent(obj, parent) {
    const isNode = obj && typeof obj.type === 'string';
    const childParent = isNode ? obj : parent;
    for (const k in obj) {
        const value = obj[k];
        if (Array.isArray(value)) {
            value.forEach(function (v) { addParent(v, childParent); });
        }
        else if (value && typeof value === 'object') {
            addParent(value, childParent);
        }
    }
    if (isNode) {
        Object.defineProperty(obj, 'parent', {
            configurable: true,
            writable: true,
            enumerable: false,
            value: parent || null
        });
    }
    return obj;
}

function getSelectors(sel) {
    // reusing global SELECTORS since this is a synchronous operation
    SELECTORS.all.length = SELECTORS.tags.length = SELECTORS.classNames.length = SELECTORS.ids.length = SELECTORS.attrs.length = 0;
    sel = sel.replace(/\./g, ' .')
        .replace(/\#/g, ' #')
        .replace(/\[/g, ' [')
        .replace(/\>/g, ' > ')
        .replace(/\+/g, ' + ')
        .replace(/\~/g, ' ~ ')
        .replace(/\*/g, ' * ')
        .replace(/\:not\((.*?)\)/g, ' ');
    const items = sel.split(' ');
    for (var i = 0; i < items.length; i++) {
        items[i] = items[i].split(':')[0];
        if (items[i].length === 0)
            continue;
        if (items[i].charAt(0) === '.') {
            SELECTORS.classNames.push(items[i].substr(1));
        }
        else if (items[i].charAt(0) === '#') {
            SELECTORS.ids.push(items[i].substr(1));
        }
        else if (items[i].charAt(0) === '[') {
            items[i] = items[i].substr(1).split('=')[0].split(']')[0].trim();
            SELECTORS.attrs.push(items[i].toLowerCase());
        }
        else if (/[a-z]/g.test(items[i].charAt(0))) {
            SELECTORS.tags.push(items[i].toLowerCase());
        }
    }
    SELECTORS.classNames = SELECTORS.classNames.sort((a, b) => {
        if (a.length < b.length)
            return -1;
        if (a.length > b.length)
            return 1;
        return 0;
    });
    return SELECTORS;
}
const SELECTORS = {
    all: [],
    tags: [],
    classNames: [],
    ids: [],
    attrs: []
};

/**
 * CSS stringify adopted from rework/css by
 * TJ Holowaychuk (@tj)
 * Licensed under the MIT License
 * https://github.com/reworkcss/css/blob/master/LICENSE
 */
class StringifyCss {
    constructor(opts) {
        this.usedSelectors = opts.usedSelectors;
    }
    /**
     * Visit `node`.
     */
    visit(node) {
        return this[node.type](node);
    }
    /**
     * Map visit over array of `nodes`, optionally using a `delim`
     */
    mapVisit(nodes, delim) {
        var buf = '';
        delim = delim || '';
        for (var i = 0, length = nodes.length; i < length; i++) {
            buf += this.visit(nodes[i]);
            if (delim && i < length - 1)
                buf += delim;
        }
        return buf;
    }
    /**
     * Compile `node`.
     */
    compile(node) {
        return node.stylesheet
            .rules.map(this.visit, this)
            .join('');
    }
    comment() {
        return '';
    }
    /**
     * Visit import node.
     */
    import(node) {
        return '@import ' + node.import + ';';
    }
    /**
     * Visit media node.
     */
    media(node) {
        const mediaCss = this.mapVisit(node.rules);
        if (mediaCss === '') {
            return '';
        }
        return '@media ' + node.media + '{' + this.mapVisit(node.rules) + '}';
    }
    /**
     * Visit document node.
     */
    document(node) {
        const documentCss = this.mapVisit(node.rules);
        if (documentCss === '') {
            return '';
        }
        const doc = '@' + (node.vendor || '') + 'document ' + node.document;
        return doc + '{' + documentCss + '}';
    }
    /**
     * Visit charset node.
     */
    charset(node) {
        return '@charset ' + node.charset + ';';
    }
    /**
     * Visit namespace node.
     */
    namespace(node) {
        return '@namespace ' + node.namespace + ';';
    }
    /**
     * Visit supports node.
     */
    supports(node) {
        const supportsCss = this.mapVisit(node.rules);
        if (supportsCss === '') {
            return '';
        }
        return '@supports ' + node.supports + '{' + supportsCss + '}';
    }
    /**
     * Visit keyframes node.
     */
    keyframes(node) {
        const keyframesCss = this.mapVisit(node.keyframes);
        if (keyframesCss === '') {
            return '';
        }
        return '@' + (node.vendor || '') + 'keyframes ' + node.name + '{' + keyframesCss + '}';
    }
    /**
     * Visit keyframe node.
     */
    keyframe(node) {
        const decls = node.declarations;
        return node.values.join(',') + '{' + this.mapVisit(decls) + '}';
    }
    /**
     * Visit page node.
     */
    page(node) {
        const sel = node.selectors.length
            ? node.selectors.join(', ')
            : '';
        return '@page ' + sel + '{' + this.mapVisit(node.declarations) + '}';
    }
    /**
     * Visit font-face node.
     */
    ['font-face'](node) {
        const fontCss = this.mapVisit(node.declarations);
        if (fontCss === '') {
            return '';
        }
        return '@font-face{' + fontCss + '}';
    }
    /**
     * Visit host node.
     */
    host(node) {
        return '@host{' + this.mapVisit(node.rules) + '}';
    }
    /**
     * Visit custom-media node.
     */
    ['custom-media'](node) {
        return '@custom-media ' + node.name + ' ' + node.media + ';';
    }
    /**
     * Visit rule node.
     */
    rule(node) {
        const decls = node.declarations;
        if (!decls.length)
            return '';
        var i, j;
        for (i = node.selectors.length - 1; i >= 0; i--) {
            const sel = getSelectors(node.selectors[i]);
            if (this.usedSelectors) {
                var include = true;
                // classes
                var jlen = sel.classNames.length;
                if (jlen > 0) {
                    for (j = 0; j < jlen; j++) {
                        if (this.usedSelectors.classNames.indexOf(sel.classNames[j]) === -1) {
                            include = false;
                            break;
                        }
                    }
                }
                // tags
                if (include) {
                    jlen = sel.tags.length;
                    if (jlen > 0) {
                        for (j = 0; j < jlen; j++) {
                            if (this.usedSelectors.tags.indexOf(sel.tags[j]) === -1) {
                                include = false;
                                break;
                            }
                        }
                    }
                }
                // attrs
                if (include) {
                    jlen = sel.attrs.length;
                    if (jlen > 0) {
                        for (j = 0; j < jlen; j++) {
                            if (this.usedSelectors.attrs.indexOf(sel.attrs[j]) === -1) {
                                include = false;
                                break;
                            }
                        }
                    }
                }
                // ids
                if (include) {
                    jlen = sel.ids.length;
                    if (jlen > 0) {
                        for (j = 0; j < jlen; j++) {
                            if (this.usedSelectors.ids.indexOf(sel.ids[j]) === -1) {
                                include = false;
                                break;
                            }
                        }
                    }
                }
                if (!include) {
                    node.selectors.splice(i, 1);
                }
            }
        }
        if (node.selectors.length === 0)
            return '';
        return `${node.selectors}{${this.mapVisit(decls)}}`;
    }
    /**
     * Visit declaration node.
     */
    declaration(node) {
        return node.property + ':' + node.value + ';';
    }
}

function removeUnusedStyles(config, usedSelectors, cssContent, diagnostics) {
    let cleanedCss = cssContent;
    try {
        // parse the css from being applied to the document
        const cssAst = parseCss(config, cssContent);
        if (cssAst.stylesheet.diagnostics.length) {
            cssAst.stylesheet.diagnostics.forEach(d => {
                diagnostics.push(d);
            });
            return cleanedCss;
        }
        try {
            // convert the parsed css back into a string
            // but only keeping what was found in our active selectors
            const stringify = new StringifyCss({ usedSelectors });
            cleanedCss = stringify.compile(cssAst);
        }
        catch (e) {
            diagnostics.push({
                level: 'error',
                type: 'css',
                header: 'CSS Stringify',
                messageText: e
            });
        }
    }
    catch (e) {
        diagnostics.push({
            level: 'error',
            type: 'css',
            header: 'CSS Parse',
            messageText: e
        });
    }
    return cleanedCss;
}

class UsedSelectors {
    constructor(elm) {
        this.tags = [];
        this.classNames = [];
        this.ids = [];
        this.attrs = [];
        this.collectSelectors(elm);
    }
    collectSelectors(elm) {
        var i;
        if (elm && elm.tagName) {
            // tags
            const tagName = elm.tagName.toLowerCase();
            if (this.tags.indexOf(tagName) === -1) {
                this.tags.push(tagName);
            }
            // classes
            const classList = elm.classList;
            for (i = 0; i < classList.length; i++) {
                const className = classList[i];
                if (this.classNames.indexOf(className) === -1) {
                    this.classNames.push(className);
                }
            }
            // attributes
            const attributes = elm.attributes;
            for (i = 0; i < attributes.length; i++) {
                const attr = attributes[i];
                const attrName = attr.name.toLowerCase();
                if (!attrName || attrName === 'class' || attrName === 'id' || attrName === 'style')
                    continue;
                if (this.attrs.indexOf(attrName) === -1) {
                    this.attrs.push(attrName);
                }
            }
            // ids
            var idValue = elm.getAttribute('id');
            if (idValue) {
                idValue = idValue.trim();
                if (idValue && this.ids.indexOf(idValue) === -1) {
                    this.ids.push(idValue);
                }
            }
            // drill down
            for (i = 0; i < elm.children.length; i++) {
                this.collectSelectors(elm.children[i]);
            }
        }
    }
}

function inlineComponentStyles(config, doc, styles, results, diagnostics) {
    if (!styles.length) {
        return;
    }
    if (results.opts.removeUnusedStyles !== false) {
        // removeUnusedStyles is the default
        try {
            // pick out all of the selectors that are actually
            // being used in the html document
            const usedSelectors = new UsedSelectors(doc.documentElement);
            styles = styles.map(styleText => {
                return removeUnusedStyles(config, usedSelectors, styleText, diagnostics);
            });
        }
        catch (e) {
            diagnostics.push({
                level: 'error',
                type: 'hydrate',
                header: 'HTML Selector Parse',
                messageText: e
            });
        }
    }
    config.logger.debug(`optimize ${results.pathname}, inline component styles`);
    // insert our styles to the head of the document
    insertStyles(doc, styles);
}
function insertStyles(doc, styles) {
    const styleElm = doc.createElement('style');
    styleElm.setAttribute('data-styles', '');
    styleElm.innerHTML = styles.join('').trim();
    if (styleElm.innerHTML.length) {
        doc.head.insertBefore(styleElm, doc.head.firstChild);
    }
}

var __awaiter$47 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function inlineExternalAssets(config, ctx, results, doc) {
    return __awaiter$47(this, void 0, void 0, function* () {
        const linkElements = doc.querySelectorAll('link[href][rel="stylesheet"]');
        for (var i = 0; i < linkElements.length; i++) {
            inlineStyle(config, ctx, results, doc, linkElements[i]);
        }
        const scriptElements = doc.querySelectorAll('script[src]');
        for (i = 0; i < scriptElements.length; i++) {
            yield inlineScript(config, ctx, results, scriptElements[i]);
        }
    });
}
function inlineStyle(config, ctx, results, doc, linkElm) {
    return __awaiter$47(this, void 0, void 0, function* () {
        const content = yield getAssetContent(config, ctx, results, linkElm.href);
        if (!content) {
            return;
        }
        config.logger.debug(`optimize ${results.pathname}, inline style: ${config.sys.url.parse(linkElm.href).pathname}`);
        const styleElm = doc.createElement('style');
        styleElm.innerHTML = content;
        linkElm.parentNode.insertBefore(styleElm, linkElm);
        linkElm.parentNode.removeChild(linkElm);
    });
}
function inlineScript(config, ctx, results, scriptElm) {
    return __awaiter$47(this, void 0, void 0, function* () {
        const content = yield getAssetContent(config, ctx, results, scriptElm.src);
        if (!content) {
            return;
        }
        config.logger.debug(`optimize ${results.pathname}, inline script: ${scriptElm.src}`);
        scriptElm.innerHTML = content;
        scriptElm.removeAttribute('src');
    });
}
function getAssetContent(config, ctx, results, assetUrl) {
    return __awaiter$47(this, void 0, void 0, function* () {
        // figure out the url's so we can check the hostnames
        const fromUrl = config.sys.url.parse(results.url);
        const toUrl = config.sys.url.parse(assetUrl);
        if (fromUrl.hostname !== toUrl.hostname) {
            // not the same hostname, so we wouldn't have the file content
            return null;
        }
        // figure out the local file path
        const filePath = getFilePathFromUrl$1(config, fromUrl, toUrl);
        // doesn't look like we've got it cached in app files
        try {
            // try looking it up directly
            const content = yield ctx.fs.readFile(filePath);
            // rough estimate of size
            const fileSize = content.length;
            if (fileSize > results.opts.inlineAssetsMaxSize) {
                // welp, considered too big, don't inline
                return null;
            }
            return content;
        }
        catch (e) {
            // never found the content for this file
            return null;
        }
    });
}
function getFilePathFromUrl$1(config, fromUrl, toUrl) {
    const resolvedUrl = '.' + config.sys.url.resolve(fromUrl.pathname, toUrl.pathname);
    return pathJoin(config, config.wwwDir, resolvedUrl);
}

var __awaiter$48 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function inlineLoaderScript(config, ctx, doc, results) {
    return __awaiter$48(this, void 0, void 0, function* () {
        // create the script url we'll be looking for
        const loaderFileName = getLoaderFileName(config);
        // find the external loader script
        // which is usually in the <head> and a pretty small external file
        // now that we're prerendering the html, and all the styles and html
        // will get hardcoded in the output, it's safe to now put the
        // loader script at the bottom of <body>
        const scriptElm = findExternalLoaderScript(config, doc, loaderFileName);
        if (scriptElm) {
            // append the loader script content to the bottom of <body>
            yield relocateInlineLoaderScript(config, ctx, doc, results, scriptElm);
        }
    });
}
function findExternalLoaderScript(config, doc, loaderFileName) {
    const scriptElements = doc.getElementsByTagName('script');
    for (let i = 0; i < scriptElements.length; i++) {
        if (isLoaderScriptSrc(config.publicPath, loaderFileName, scriptElements[i].getAttribute('src'))) {
            // this is a script element with a src attribute which is
            // pointing to the app's external loader script
            // remove the script from the document, be gone with you
            return scriptElements[i];
        }
    }
    return null;
}
function isLoaderScriptSrc(publicPath, loaderFileName, scriptSrc) {
    try {
        if (typeof scriptSrc !== 'string' || scriptSrc.trim() === '') {
            return false;
        }
        scriptSrc = scriptSrc.toLowerCase();
        if (!scriptSrc.includes(loaderFileName)) {
            return false;
        }
        if (scriptSrc.startsWith('http') || scriptSrc.startsWith('file')) {
            return false;
        }
        const pathDirs = publicPath.toLowerCase().split('/');
        const firstPublicPathDir = pathDirs.find(pathDir => pathDir.length > 0);
        const scriptSrcDirs = scriptSrc.split('/');
        const firstScriptSrcDir = scriptSrcDirs.find(scriptSrcDir => scriptSrcDir.length > 0);
        if (firstPublicPathDir !== null && firstScriptSrcDir !== null) {
            return firstPublicPathDir === firstScriptSrcDir;
        }
        return true;
    }
    catch (e) {
        return false;
    }
}
function relocateInlineLoaderScript(config, ctx, doc, results, scriptElm) {
    return __awaiter$48(this, void 0, void 0, function* () {
        // get the file path
        const appLoaderWWW = getLoaderWWW(config);
        // get the loader content
        let content = null;
        try {
            // let's look it up directly
            content = yield ctx.fs.readFile(appLoaderWWW);
        }
        catch (e) {
            config.logger.debug(`unable to inline loader: ${appLoaderWWW}`, e);
        }
        if (!content) {
            // didn't get good loader content, don't bother
            return;
        }
        config.logger.debug(`optimize ${results.pathname}, inline loader`);
        // remove the external src
        scriptElm.removeAttribute('src');
        // inline the js content
        scriptElm.innerHTML = content;
        if (results.opts.hydrateComponents) {
            // remove the script element from where it's currently at in the dom
            scriptElm.parentNode.removeChild(scriptElm);
            // place it back in the dom, but at the bottom of the body
            doc.body.appendChild(scriptElm);
        }
    });
}

function insertCanonicalLink(config, doc, results) {
    if (!results.path)
        return;
    // https://webmasters.googleblog.com/2009/02/specify-your-canonical.html
    // <link rel="canonical" href="http://www.example.com/product.php?item=swedish-fish" />
    let canonicalLink = doc.querySelector('link[rel="canonical"]');
    if (canonicalLink)
        return;
    canonicalLink = doc.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    canonicalLink.setAttribute('href', results.path);
    config.logger.debug(`add cononical link: ${results.path}`);
    doc.head.appendChild(canonicalLink);
}

var __awaiter$49 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function minifyInlineScripts(config, compilerCtx, doc, results) {
    return __awaiter$49(this, void 0, void 0, function* () {
        const scripts = doc.querySelectorAll('script');
        const promises = [];
        for (let i = 0; i < scripts.length; i++) {
            promises.push(minifyInlineStyle(config, compilerCtx, results, scripts[i]));
        }
        yield Promise.all(promises);
    });
}
function minifyInlineStyle(config, compilerCtx, results, script) {
    return __awaiter$49(this, void 0, void 0, function* () {
        if (script.hasAttribute('src')) {
            return;
        }
        if (script.innerHTML.includes('  ') || script.innerHTML.includes('\t')) {
            const minifyResults = yield minifyJs(config, compilerCtx, script.innerHTML, 'es5', false);
            minifyResults.diagnostics.forEach(d => {
                results.diagnostics.push(d);
            });
            if (typeof minifyResults.output === 'string') {
                script.innerHTML = minifyResults.output;
            }
        }
    });
}

var __awaiter$50 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function minifyInlineStyles(config, compilerCtx, doc, results) {
    return __awaiter$50(this, void 0, void 0, function* () {
        const styles = doc.querySelectorAll('style');
        const promises = [];
        for (let i = 0; i < styles.length; i++) {
            promises.push(minifyInlineStyle$1(config, compilerCtx, results, styles[i]));
        }
        yield Promise.all(promises);
    });
}
function minifyInlineStyle$1(config, compilerCtx, results, style) {
    return __awaiter$50(this, void 0, void 0, function* () {
        if (style.innerHTML.includes('  ') || style.innerHTML.includes('\t')) {
            style.innerHTML = yield minifyStyle(config, compilerCtx, results.diagnostics, style.innerHTML);
        }
    });
}

var __awaiter$51 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function optimizeHtml(config, compilerCtx, doc, styles, opts, results) {
    return __awaiter$51(this, void 0, void 0, function* () {
        const promises = [];
        if (opts.hydrateComponents !== false) {
            doc.documentElement.setAttribute('data-ssr', '');
        }
        if (opts.canonicalLink !== false) {
            try {
                insertCanonicalLink(config, doc, results);
            }
            catch (e) {
                results.diagnostics.push({
                    level: 'error',
                    type: 'hydrate',
                    header: 'Insert Canonical Link',
                    messageText: e
                });
            }
        }
        if (opts.inlineStyles !== false) {
            try {
                inlineComponentStyles(config, doc, styles, results, results.diagnostics);
            }
            catch (e) {
                results.diagnostics.push({
                    level: 'error',
                    type: 'hydrate',
                    header: 'Inline Component Styles',
                    messageText: e
                });
            }
        }
        if (opts.inlineLoaderScript !== false) {
            // remove the script to the external loader script request
            // inline the loader script at the bottom of the html
            promises.push(inlineLoaderScript(config, compilerCtx, doc, results));
        }
        if (opts.inlineAssetsMaxSize > 0) {
            promises.push(inlineExternalAssets(config, compilerCtx, results, doc));
        }
        if (opts.collapseWhitespace !== false && !config.devMode && config.logger.level !== 'debug') {
            // collapseWhitespace is the default
            try {
                config.logger.debug(`optimize ${results.pathname}, collapse html whitespace`);
                collapseHtmlWhitepace(doc.documentElement);
            }
            catch (e) {
                results.diagnostics.push({
                    level: 'error',
                    type: 'hydrate',
                    header: 'Reduce HTML Whitespace',
                    messageText: e
                });
            }
        }
        // need to wait on to see if external files are inlined
        yield Promise.all(promises);
        // reset for new promises
        promises.length = 0;
        if (config.minifyCss) {
            promises.push(minifyInlineStyles(config, compilerCtx, doc, results));
        }
        if (config.minifyJs) {
            promises.push(minifyInlineScripts(config, compilerCtx, doc, results));
        }
        if (config.assetVersioning) {
            promises.push(assetVersioning(config, compilerCtx, results.url, doc));
        }
        yield Promise.all(promises);
    });
}

var __awaiter$52 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function hydrateHtml(config, ctx, cmpRegistry, opts) {
    return new Promise(resolve => {
        // validate the hydrate options and add any missing info
        opts = normalizeHydrateOptions(opts);
        // create the results object we're gonna return
        const hydrateResults = generateHydrateResults(config, opts);
        // create a emulated window
        // attach data the request to the window
        const dom = config.sys.createDom();
        const win = dom.parse(opts);
        const doc = win.document;
        // normalize dir and lang before connecting elements
        // so that the info is their incase they read it at runtime
        normalizeDirection(doc, opts);
        normalizeLanguage(doc, opts);
        // create the platform
        const plt = createPlatformServer(config, win, doc, cmpRegistry, hydrateResults, opts.isPrerender, ctx);
        // fire off this function when the app has finished loading
        // and all components have finished hydrating
        plt.onAppLoad = (rootElm, styles, failureDiagnostic) => __awaiter$52(this, void 0, void 0, function* () {
            if (config._isTesting) {
                hydrateResults.__testPlatform = plt;
            }
            if (failureDiagnostic) {
                hydrateResults.html = generateFailureDiagnostic(failureDiagnostic);
                dom.destroy();
                resolve(hydrateResults);
                return;
            }
            // all synchronous operations next
            if (rootElm) {
                try {
                    // optimize this document!!
                    yield optimizeHtml(config, ctx, doc, styles, opts, hydrateResults);
                    // gather up all of the <a> tag information in the doc
                    if (opts.collectAnchors !== false && opts.hydrateComponents !== false) {
                        collectAnchors(config, doc, hydrateResults);
                    }
                    // serialize this dom back into a string
                    if (opts.serializeHtml !== false) {
                        hydrateResults.html = dom.serialize();
                    }
                }
                catch (e) {
                    // gahh, something's up
                    hydrateResults.diagnostics.push({
                        level: 'error',
                        type: 'hydrate',
                        header: 'DOM Serialize',
                        messageText: e
                    });
                    // idk, some error, just use the original html
                    hydrateResults.html = opts.html;
                }
            }
            if (opts.destroyDom !== false) {
                // always destroy the dom unless told otherwise
                dom.destroy();
            }
            else {
                // we didn't destroy the dom
                // so let's return the root element
                hydrateResults.root = rootElm;
            }
            // cool, all good here, even if there are errors
            // we're passing back the result object
            resolve(hydrateResults);
        });
        if (opts.hydrateComponents === false) {
            plt.onAppLoad(win.document.body, []);
            return;
        }
        // patch the render function that we can add SSR ids
        // and to connect any elements it may have just appened to the DOM
        let ssrIds = 0;
        const pltRender = plt.render;
        plt.render = function render(oldVNode, newVNode, isUpdate, defaultSlots, namedSlotsMap, encapsulation) {
            let ssrId;
            let existingSsrId;
            if (opts.ssrIds !== false) {
                // this may have been patched more than once
                // so reuse the ssr id if it already has one
                if (oldVNode && oldVNode.elm) {
                    existingSsrId = oldVNode.elm.getAttribute(SSR_VNODE_ID);
                }
                if (existingSsrId) {
                    ssrId = parseInt(existingSsrId, 10);
                }
                else {
                    ssrId = ssrIds++;
                }
            }
            newVNode = pltRender(oldVNode, newVNode, isUpdate, defaultSlots, namedSlotsMap, encapsulation, ssrId);
            connectChildElements(config, plt, hydrateResults, newVNode.elm);
            return newVNode;
        };
        // loop through each node and start connecting/hydrating
        // any elements that are host elements to components
        // this kicks off all the async hydrating
        connectChildElements(config, plt, hydrateResults, win.document.body);
        if (hydrateResults.components.length === 0) {
            // what gives, never found ANY host elements to connect!
            // ok we're just done i guess, idk
            hydrateResults.html = opts.html;
            resolve(hydrateResults);
        }
    });
}

function loadComponentRegistry(config, ctx) {
    const appRegistry = getAppRegistry(config, ctx);
    const cmpRegistry = {};
    const tagNames = Object.keys(appRegistry.components);
    tagNames.forEach(tagName => {
        cmpRegistry[tagName] = {
            tagNameMeta: tagName,
            bundleIds: appRegistry.components[tagName]
        };
    });
    return cmpRegistry;
}

var __awaiter$53 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Renderer {
    constructor(config, registry, ctx) {
        this.config = config;
        this.config = config;
        validateBuildConfig(config);
        // init the build context
        this.ctx = getCompilerCtx(config, ctx);
        // load the component registry from the registry.json file
        this.cmpRegistry = registry || loadComponentRegistry(config, this.ctx);
        if (Object.keys(this.cmpRegistry).length === 0) {
            throw new Error(`No registered components found: ${config.namespace}`);
        }
        // load the app global file into the context
        loadAppGlobal(config, this.ctx);
    }
    hydrate(hydrateOpts) {
        return __awaiter$53(this, void 0, void 0, function* () {
            let hydrateResults;
            // kick off hydrated, which is an async opertion
            try {
                hydrateResults = yield hydrateHtml(this.config, this.ctx, this.cmpRegistry, hydrateOpts);
            }
            catch (e) {
                hydrateResults = {
                    url: hydrateOpts.path,
                    diagnostics: [],
                    html: hydrateOpts.html,
                    styles: null,
                    anchors: [],
                    components: [],
                    styleUrls: [],
                    scriptUrls: [],
                    imgUrls: []
                };
                catchError(hydrateResults.diagnostics, e);
            }
            return hydrateResults;
        });
    }
    get fs() {
        return this.ctx.fs;
    }
}
function loadAppGlobal(config, ctx) {
    ctx.appFiles = ctx.appFiles || {};
    if (ctx.appFiles.global) {
        // already loaded the global js content
        return;
    }
    // let's load the app global js content
    const appGlobalPath = getGlobalWWW(config);
    try {
        ctx.appFiles.global = ctx.fs.readFileSync(appGlobalPath);
    }
    catch (e) {
        config.logger.debug(`missing app global: ${appGlobalPath}`);
    }
}

var __awaiter$54 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function prerenderPath(config, compilerCtx, buildCtx, indexSrcHtml, prerenderLocation) {
    return __awaiter$54(this, void 0, void 0, function* () {
        const msg = config.prerender.hydrateComponents ? 'prerender' : 'optimize html';
        const timeSpan = config.logger.createTimeSpan(`${msg}, started: ${prerenderLocation.path}`);
        const results = {
            diagnostics: []
        };
        try {
            // create the renderer config
            const rendererConfig = Object.assign({}, config);
            // create the hydrate options from the prerender config
            const hydrateOpts = rendererConfig.prerender;
            hydrateOpts.url = prerenderLocation.url;
            hydrateOpts.isPrerender = true;
            // set the input html which we just read from the src index html file
            hydrateOpts.html = indexSrcHtml;
            // create a server-side renderer
            const renderer = new Renderer(rendererConfig, null, compilerCtx);
            // parse the html to dom nodes, hydrate the components, then
            // serialize the hydrated dom nodes back to into html
            const hydratedResults = yield renderer.hydrate(hydrateOpts);
            // hydrating to string is done!!
            // let's use this updated html for the index content now
            Object.assign(results, hydratedResults);
        }
        catch (e) {
            // ahh man! what happened!
            catchError(buildCtx.diagnostics, e);
        }
        timeSpan.finish(`${msg}, finished: ${prerenderLocation.path}`);
        return results;
    });
}

var __awaiter$55 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function prerenderApp(config, compilerCtx, buildCtx, entryModules) {
    return __awaiter$55(this, void 0, void 0, function* () {
        const prerenderConfig = config.prerender;
        if (!prerenderConfig) {
            // no need to rebuild index.html if there were no app file changes
            config.logger.debug(`prerenderApp, skipping because config.prerender is falsy`);
            return [];
        }
        if (!config.generateWWW) {
            // no need to rebuild index.html if there were no app file changes
            config.logger.debug(`prerenderApp, skipping because config.generateWWW is falsy`);
            return [];
        }
        // if there was src index.html file, then the process before this one
        // would have already loaded and updated the src index to its www path
        // get the www index html content for the template for all prerendered pages
        let indexHtml = null;
        try {
            indexHtml = yield compilerCtx.fs.readFile(config.wwwIndexHtml);
        }
        catch (e) { }
        if (typeof indexHtml !== 'string') {
            // looks like we don't have an index html file, which is fine
            config.logger.debug(`prerenderApp, missing index.html for prerendering`);
            return [];
        }
        // get the prerender urls to queue up
        const prerenderQueue = getPrerenderQueue(config);
        if (!prerenderQueue.length) {
            const d = buildWarn(buildCtx.diagnostics);
            d.messageText = `No urls found in the prerender config`;
            return [];
        }
        return runPrerenderApp(config, compilerCtx, buildCtx, entryModules, prerenderQueue, indexHtml);
    });
}
function runPrerenderApp(config, compilerCtx, buildCtx, entryModules, prerenderQueue, indexHtml) {
    return __awaiter$55(this, void 0, void 0, function* () {
        // keep track of how long the entire build process takes
        const timeSpan = config.logger.createTimeSpan(`prerendering started`, !config.prerender.hydrateComponents);
        const hydrateResults = [];
        try {
            yield new Promise(resolve => {
                drainPrerenderQueue(config, compilerCtx, buildCtx, prerenderQueue, indexHtml, hydrateResults, resolve);
            });
            yield generateHostConfig(config, compilerCtx, entryModules, hydrateResults);
        }
        catch (e) {
            catchError(buildCtx.diagnostics, e);
        }
        if (hasError(buildCtx.diagnostics)) {
            timeSpan.finish(`prerendering failed`);
        }
        else {
            timeSpan.finish(`prerendered urls: ${hydrateResults.length}`);
        }
        if (compilerCtx.localPrerenderServer) {
            compilerCtx.localPrerenderServer.close();
            delete compilerCtx.localPrerenderServer;
        }
        return hydrateResults;
    });
}
function drainPrerenderQueue(config, compilerCtx, buildCtx, prerenderQueue, indexSrcHtml, hydrateResults, resolve) {
    for (var i = 0; i < config.prerender.maxConcurrent; i++) {
        const activelyProcessingCount = prerenderQueue.filter(p => p.status === 'processing').length;
        if (activelyProcessingCount >= config.prerender.maxConcurrent) {
            // whooaa, slow down there buddy, let's not get carried away
            break;
        }
        runNextPrerenderUrl(config, compilerCtx, buildCtx, prerenderQueue, indexSrcHtml, hydrateResults, resolve);
    }
    const remaining = prerenderQueue.filter(p => {
        return p.status === 'processing' || p.status === 'pending';
    }).length;
    if (remaining === 0) {
        // we're not actively processing anything
        // and there aren't anymore urls in the queue to be prerendered
        // so looks like our job here is done, good work team
        resolve();
    }
}
function runNextPrerenderUrl(config, compilerCtx, buildCtx, prerenderQueue, indexSrcHtml, hydrateResults, resolve) {
    return __awaiter$55(this, void 0, void 0, function* () {
        const p = prerenderQueue.find(p => p.status === 'pending');
        if (!p)
            return;
        // we've got a url that's pending
        // well guess what, it's go time
        p.status = 'processing';
        try {
            // prender this path and wait on the results
            const results = yield prerenderPath(config, compilerCtx, buildCtx, indexSrcHtml, p);
            // awesome!!
            // merge any diagnostics we just got from this
            config.logger.printDiagnostics(results.diagnostics);
            if (config.prerender.crawl !== false) {
                crawlAnchorsForNextUrls(config, prerenderQueue, results);
            }
            hydrateResults.push(results);
            yield writePrerenderDest(config, compilerCtx, results);
        }
        catch (e) {
            // darn, idk, bad news
            catchError(buildCtx.diagnostics, e);
        }
        // this job is not complete
        p.status = 'complete';
        // let's try to drain the queue again and let this
        // next call figure out if we're actually done or not
        drainPrerenderQueue(config, compilerCtx, buildCtx, prerenderQueue, indexSrcHtml, hydrateResults, resolve);
    });
}
function writePrerenderDest(config, ctx, results) {
    return __awaiter$55(this, void 0, void 0, function* () {
        const parsedUrl = config.sys.url.parse(results.url);
        // figure out the directory where this file will be saved
        const dir = config.sys.path.join(config.prerender.prerenderDir, parsedUrl.pathname);
        // create the full path where this will be saved (normalize for windowz)
        const filePath = pathJoin(config, dir, `index.html`);
        // add the prerender html content it to our collection of
        // files that need to be saved when we're all ready
        yield ctx.fs.writeFile(filePath, results.html);
    });
}

function parseCollectionModule(config, compilerCtx, pkgJsonFilePath, pkgData) {
    // note this MUST be synchronous because this is used during transpile
    const collectionName = pkgData.name;
    let collection = compilerCtx.collections.find(c => c.collectionName === collectionName);
    if (collection) {
        // we've already cached the collection, no need for another resolve/readFile/parse
        // thought being that /node_modules/ isn't changing between watch builds
        return collection;
    }
    // get the root directory of the dependency
    const collectionPackageRootDir = config.sys.path.dirname(pkgJsonFilePath);
    // figure out the full path to the collection collection file
    const collectionFilePath = pathJoin(config, collectionPackageRootDir, pkgData.collection);
    config.logger.debug(`load colleciton: ${collectionFilePath}`);
    // we haven't cached the collection yet, let's read this file
    // sync on purpose :(
    const collectionJsonStr = compilerCtx.fs.readFileSync(collectionFilePath);
    // get the directory where the collection collection file is sitting
    const collectionDir = normalizePath(config.sys.path.dirname(collectionFilePath));
    // parse the json string into our collection data
    collection = parseCollectionData(config, collectionName, collectionDir, collectionJsonStr);
    // remember the source of this collection node_module
    collection.moduleDir = collectionPackageRootDir;
    // append any collection data
    collection.moduleFiles.forEach(collectionModuleFile => {
        if (!compilerCtx.moduleFiles[collectionModuleFile.jsFilePath]) {
            compilerCtx.moduleFiles[collectionModuleFile.jsFilePath] = collectionModuleFile;
        }
    });
    // cache it for later yo
    compilerCtx.collections.push(collection);
    return collection;
}

function getCollections(config, compilerCtx, buildCtx, importNode) {
    if (!importNode.moduleSpecifier || !compilerCtx || !buildCtx) {
        return;
    }
    const moduleId = importNode.moduleSpecifier.text;
    if (moduleId.startsWith('.') || moduleId.startsWith('/')) {
        // not a node module import, so don't bother
        return;
    }
    if (compilerCtx.resolvedCollections.includes(moduleId)) {
        // we've already handled this collection moduleId before
        return;
    }
    // cache that we've already parsed this
    compilerCtx.resolvedCollections.push(moduleId);
    // see if we can add this collection dependency
    addCollection(config, compilerCtx, buildCtx, config.rootDir, moduleId);
}
function addCollection(config, compilerCtx, buildCtx, resolveFromDir, moduleId) {
    let pkgJsonFilePath;
    try {
        // get the full package.json file path
        pkgJsonFilePath = config.sys.resolveModule(resolveFromDir, moduleId);
    }
    catch (e) {
        // it's someone else's job to handle unresolvable paths
        return;
    }
    if (pkgJsonFilePath === 'package.json') {
        // the resolved package is actually this very same package, so whatever
        return;
    }
    // open up and parse the package.json
    // sync on purpose :(
    const pkgJsonStr = compilerCtx.fs.readFileSync(pkgJsonFilePath);
    const pkgData = JSON.parse(pkgJsonStr);
    if (!pkgData.collection || !pkgData.types) {
        // this import is not a stencil collection
        return;
    }
    // this import is a stencil collection
    // let's parse it and gather all the module data about it
    // internally it'll cached collection data if we've already done this
    const collection = parseCollectionModule(config, compilerCtx, pkgJsonFilePath, pkgData);
    // check if we already added this collection to the build context
    const alreadyHasCollection = buildCtx.collections.some(c => {
        return c.collectionName === collection.collectionName;
    });
    if (alreadyHasCollection) {
        // we already have this collection in our build context
        return;
    }
    // let's add the collection to the build context
    buildCtx.collections.push(collection);
    if (Array.isArray(collection.dependencies)) {
        // this collection has more collections
        // let's keep digging down and discover all of them
        collection.dependencies.forEach(dependencyModuleId => {
            const resolveFromDir = config.sys.path.dirname(pkgJsonFilePath);
            addCollection(config, compilerCtx, buildCtx, resolveFromDir, dependencyModuleId);
        });
    }
}

function evalText(text) {
    const fnStr = `return ${text};`;
    return new Function(fnStr)();
}
const getDeclarationParameters = (decorator) => {
    if (!ts.isCallExpression(decorator.expression)) {
        return [];
    }
    return decorator.expression.arguments.map((arg) => {
        return evalText(arg.getText().trim());
    });
};
function isDecoratorNamed(name) {
    return (dec) => {
        return (ts.isCallExpression(dec.expression) && dec.expression.expression.getText() === name);
    };
}
function isPropertyWithDecorators(member) {
    return ts.isPropertyDeclaration(member)
        && Array.isArray(member.decorators)
        && member.decorators.length > 0;
}
function isMethodWithDecorators(member) {
    return ts.isMethodDeclaration(member)
        && Array.isArray(member.decorators)
        && member.decorators.length > 0;
}
function serializeSymbol(checker, symbol) {
    return {
        name: symbol.getName(),
        documentation: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
        type: checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration))
    };
}
function isMethod(member, methodName) {
    if (ts.isMethodDeclaration(member)) {
        return member.getFirstToken().getText() === methodName;
    }
    return false;
}

function getComponentDecoratorMeta(checker, node) {
    const cmpMeta = {};
    const symbol = checker.getSymbolAtLocation(node.name);
    if (!node.decorators) {
        return undefined;
    }
    cmpMeta.jsdoc = serializeSymbol(checker, symbol);
    const componentDecorator = node.decorators.find(isDecoratorNamed('Component'));
    if (!componentDecorator) {
        return undefined;
    }
    const [componentOptions] = getDeclarationParameters(componentDecorator);
    if (!componentOptions.tag || componentOptions.tag.trim() === '') {
        throw new Error(`tag missing in component decorator: ${JSON.stringify(componentOptions, null, 2)}`);
    }
    // normalizeTag
    cmpMeta.tagNameMeta = componentOptions.tag;
    // normalizeHost
    cmpMeta.hostMeta = componentOptions.host || {};
    // normalizeEncapsulation
    cmpMeta.encapsulation =
        componentOptions.shadow ? 1 /* ShadowDom */ :
            componentOptions.scoped ? 2 /* ScopedCss */ :
                0 /* NoEncapsulation */;
    // noramlizeStyles
    cmpMeta.stylesMeta = {};
    // styles: 'div { padding: 10px }'
    if (typeof componentOptions.styles === 'string') {
        componentOptions.styles = componentOptions.styles.trim();
        if (componentOptions.styles.length > 0) {
            cmpMeta.stylesMeta = {
                [DEFAULT_STYLE_MODE]: {
                    styleStr: componentOptions.styles
                }
            };
        }
    }
    // styleUrl: 'my-styles.css'
    if (typeof componentOptions.styleUrl === 'string' && componentOptions.styleUrl.trim()) {
        cmpMeta.stylesMeta = {
            [DEFAULT_STYLE_MODE]: {
                externalStyles: [{
                        originalComponentPath: componentOptions.styleUrl.trim()
                    }]
            }
        };
        // styleUrls: ['my-styles.css', 'my-other-styles']
    }
    else if (Array.isArray(componentOptions.styleUrls)) {
        cmpMeta.stylesMeta = {
            [DEFAULT_STYLE_MODE]: {
                externalStyles: componentOptions.styleUrls.map(styleUrl => {
                    const externalStyle = {
                        originalComponentPath: styleUrl.trim()
                    };
                    return externalStyle;
                })
            }
        };
        // styleUrls: {
        //   ios: 'badge.ios.css',
        //   md: 'badge.md.css',
        //   wp: 'badge.wp.css'
        // }
    }
    else {
        Object.keys(componentOptions.styleUrls || {}).reduce((stylesMeta, styleType) => {
            const styleUrls = componentOptions.styleUrls;
            const sUrls = [].concat(styleUrls[styleType]);
            stylesMeta[styleType] = {
                externalStyles: sUrls.map(sUrl => {
                    const externalStyle = {
                        originalComponentPath: sUrl
                    };
                    return externalStyle;
                })
            };
            return stylesMeta;
        }, cmpMeta.stylesMeta);
    }
    cmpMeta.assetsDirsMeta = [];
    // assetsDir: './somedir'
    if (componentOptions.assetsDir) {
        const assetsMeta = {
            originalComponentPath: componentOptions.assetsDir
        };
        cmpMeta.assetsDirsMeta.push(assetsMeta);
    }
    // assetsDirs: ['./somedir', '../someotherdir']
    if (Array.isArray(componentOptions.assetsDirs)) {
        cmpMeta.assetsDirsMeta = cmpMeta.assetsDirsMeta.concat(componentOptions.assetsDirs.map(assetDir => ({ originalComponentPath: assetDir })));
    }
    return cmpMeta;
}

function getElementDecoratorMeta(checker, classNode) {
    return classNode.members
        .filter(isPropertyWithDecorators)
        .reduce((membersMeta, member) => {
        const elementDecorator = member.decorators.find(isDecoratorNamed('Element'));
        if (elementDecorator) {
            membersMeta[member.name.getText()] = {
                memberType: 7 /* Element */
            };
        }
        return membersMeta;
    }, {});
}

function getEventDecoratorMeta(checker, classNode) {
    return classNode.members
        .filter(isPropertyWithDecorators)
        .reduce((membersMeta, member) => {
        const elementDecorator = member.decorators.find(isDecoratorNamed('Event'));
        if (elementDecorator == null) {
            return membersMeta;
        }
        const [eventOptions] = getDeclarationParameters(elementDecorator);
        const metadata = convertOptionsToMeta(eventOptions, member.name.getText());
        if (metadata) {
            const symbol = checker.getSymbolAtLocation(member.name);
            metadata.jsdoc = serializeSymbol(checker, symbol);
            membersMeta.push(metadata);
        }
        return membersMeta;
    }, []);
}
function convertOptionsToMeta(rawEventOpts = {}, methodName) {
    if (!methodName) {
        return null;
    }
    return {
        eventMethodName: methodName,
        eventName: typeof rawEventOpts.eventName === 'string' ? rawEventOpts.eventName : methodName,
        eventBubbles: typeof rawEventOpts.bubbles === 'boolean' ? rawEventOpts.bubbles : true,
        eventCancelable: typeof rawEventOpts.cancelable === 'boolean' ? rawEventOpts.cancelable : true,
        eventComposed: typeof rawEventOpts.composed === 'boolean' ? rawEventOpts.composed : true
    };
}

function getListenDecoratorMeta(checker, classNode) {
    const listeners = [];
    classNode.members
        .filter(isMethodWithDecorators)
        .forEach(member => {
        member.decorators
            .filter(isDecoratorNamed('Listen'))
            .map(dec => getDeclarationParameters(dec))
            .forEach(([listenText, listenOptions]) => {
            listenText.split(',').forEach(eventName => {
                const symbol = checker.getSymbolAtLocation(member.name);
                const jsdoc = serializeSymbol(checker, symbol);
                listeners.push(Object.assign({}, validateListener(eventName.trim(), listenOptions, member.name.getText()), { jsdoc }));
            });
        });
    });
    return listeners;
}
// export function getListenDecoratorMeta
function validateListener(eventName, rawListenOpts = {}, methodName) {
    let rawEventName = eventName;
    let splt = eventName.split(':');
    if (splt.length > 2) {
        throw `@Listen can only contain one colon: ${eventName}`;
    }
    if (splt.length > 1) {
        let prefix = splt[0].toLowerCase().trim();
        if (!isValidElementRefPrefix(prefix)) {
            throw `invalid @Listen prefix "${prefix}" for "${eventName}"`;
        }
        rawEventName = splt[1].toLowerCase().trim();
    }
    splt = rawEventName.split('.');
    if (splt.length > 2) {
        throw `@Listen can only contain one period: ${eventName}`;
    }
    if (splt.length > 1) {
        let suffix = splt[1].toLowerCase().trim();
        if (!isValidKeycodeSuffix(suffix)) {
            throw `invalid @Listen suffix "${suffix}" for "${eventName}"`;
        }
        rawEventName = splt[0].toLowerCase().trim();
    }
    const listenMeta = {
        eventName: eventName,
        eventMethodName: methodName
    };
    listenMeta.eventCapture = (typeof rawListenOpts.capture === 'boolean') ? rawListenOpts.capture : false;
    listenMeta.eventPassive = (typeof rawListenOpts.passive === 'boolean') ? rawListenOpts.passive :
        // if the event name is kown to be a passive event then set it to true
        (PASSIVE_TRUE_DEFAULTS.indexOf(rawEventName.toLowerCase()) > -1);
    // default to enabled=true if it wasn't provided
    listenMeta.eventDisabled = (rawListenOpts.enabled === false);
    return listenMeta;
}
function isValidElementRefPrefix(prefix) {
    return (VALID_ELEMENT_REF_PREFIXES.indexOf(prefix) > -1);
}
function isValidKeycodeSuffix(prefix) {
    return (VALID_KEYCODE_SUFFIX.indexOf(prefix) > -1);
}
const PASSIVE_TRUE_DEFAULTS = [
    'dragstart', 'drag', 'dragend', 'dragenter', 'dragover', 'dragleave', 'drop',
    'mouseenter', 'mouseover', 'mousemove', 'mousedown', 'mouseup', 'mouseleave', 'mouseout', 'mousewheel',
    'pointerover', 'pointerenter', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'pointerleave',
    'resize',
    'scroll',
    'touchstart', 'touchmove', 'touchend', 'touchenter', 'touchleave', 'touchcancel',
    'wheel',
];
const VALID_ELEMENT_REF_PREFIXES = [
    'child', 'parent', 'body', 'document', 'window'
];
const VALID_KEYCODE_SUFFIX = [
    'enter', 'escape', 'space', 'tab', 'up', 'right', 'down', 'left'
];

function getMethodDecoratorMeta(checker, classNode) {
    return classNode.members
        .filter(isMethodWithDecorators)
        .reduce((membersMeta, member) => {
        const elementDecorator = member.decorators.find(isDecoratorNamed('Method'));
        if (elementDecorator == null) {
            return membersMeta;
        }
        const symbol = checker.getSymbolAtLocation(member.name);
        if (elementDecorator) {
            membersMeta[member.name.getText()] = {
                memberType: 6 /* Method */,
                jsdoc: serializeSymbol(checker, symbol)
            };
        }
        return membersMeta;
    }, {});
}

function getPropDecoratorMeta(checker, classNode, sourceFile, diagnostics) {
    return classNode.members
        .filter(member => Array.isArray(member.decorators) && member.decorators.length > 0)
        .reduce((allMembers, prop) => {
        const memberData = {};
        const propDecorator = prop.decorators.find(isDecoratorNamed('Prop'));
        if (propDecorator == null) {
            return allMembers;
        }
        const suppliedOptions = propDecorator.expression.arguments
            .map(arg => {
            try {
                const fnStr = `return ${arg.getText()};`;
                return new Function(fnStr)();
            }
            catch (e) {
                const d = catchError(diagnostics, e);
                d.messageText = `parse prop options: ${e}`;
            }
        });
        const propOptions = suppliedOptions[0];
        const memberName = prop.name.text;
        const symbol = checker.getSymbolAtLocation(prop.name);
        if (propOptions && typeof propOptions.connect === 'string') {
            memberData.memberType = 4 /* PropConnect */;
            memberData.ctrlId = propOptions.connect;
        }
        else if (propOptions && typeof propOptions.context === 'string') {
            memberData.memberType = 3 /* PropContext */;
            memberData.ctrlId = propOptions.context;
        }
        else {
            let attribType;
            // If the @Prop() attribute does not have a defined type then infer it
            if (!prop.type) {
                let attribTypeText = inferPropType(prop.initializer);
                if (!attribTypeText) {
                    attribTypeText = 'any';
                    diagnostics.push({
                        level: 'warn',
                        type: 'build',
                        header: 'Prop type provided is not supported, defaulting to any',
                        messageText: `'${prop.getFullText()}'`,
                    });
                }
                attribType = {
                    text: attribTypeText,
                };
            }
            else {
                attribType = getAttributeTypeInfo(prop.type, sourceFile);
            }
            if (propOptions && typeof propOptions.state === 'boolean') {
                diagnostics.push({
                    level: 'warn',
                    type: 'build',
                    header: '@Prop({ state: true }) option has been deprecated',
                    messageText: `"state" has been renamed to @Prop({ mutable: true })`,
                });
                propOptions.mutable = propOptions.state;
            }
            if (propOptions && typeof propOptions.mutable === 'boolean') {
                memberData.memberType = 2 /* PropMutable */;
            }
            else {
                memberData.memberType = 1 /* Prop */;
            }
            memberData.attribName = toDashCase(memberName);
            memberData.attribType = attribType;
            memberData.propType = propTypeFromTSType(attribType.text);
            memberData.jsdoc = serializeSymbol(checker, symbol);
        }
        allMembers[memberName] = memberData;
        return allMembers;
    }, {});
}
function getAttributeTypeInfo(type, sourceFile) {
    const typeInfo = {
        text: type.getFullText().trim()
    };
    const typeReferences = getAllTypeReferences(type)
        .reduce((allReferences, rt) => {
        allReferences[rt] = getTypeReferenceLocation(rt, sourceFile);
        return allReferences;
    }, {});
    if (Object.keys(typeReferences).length > 0) {
        typeInfo.typeReferences = typeReferences;
    }
    return typeInfo;
}
function getAllTypeReferences(node) {
    const referencedTypes = [];
    function visit(node) {
        switch (node.kind) {
            case ts.SyntaxKind.TypeReference:
                referencedTypes.push(node.typeName.getText().trim());
                if (node.typeArguments) {
                    node.typeArguments
                        .filter(ta => ts.isTypeReferenceNode(ta))
                        .forEach(tr => referencedTypes.push(tr.typeName.getText().trim()));
                }
            /* tslint:disable */
            default:
                return ts.forEachChild(node, (node) => {
                    return visit(node);
                });
        }
        /* tslint:enable */
    }
    visit(node);
    return referencedTypes;
}
function getTypeReferenceLocation(typeName, sourceFile) {
    const sourceFileObj = sourceFile.getSourceFile();
    // Loop through all top level imports to find any reference to the type for 'import' reference location
    const importTypeDeclaration = sourceFileObj.statements.find(st => {
        const statement = ts.isImportDeclaration(st) &&
            ts.isImportClause(st.importClause) &&
            st.importClause.namedBindings && ts.isNamedImports(st.importClause.namedBindings) &&
            Array.isArray(st.importClause.namedBindings.elements) &&
            st.importClause.namedBindings.elements.find(nbe => nbe.name.getText() === typeName);
        if (!statement) {
            return false;
        }
        return true;
    });
    if (importTypeDeclaration) {
        const localImportPath = importTypeDeclaration.moduleSpecifier.text;
        return {
            referenceLocation: 'import',
            importReferenceLocation: localImportPath
        };
    }
    // Loop through all top level exports to find if any reference to the type for 'local' reference location
    const isExported = sourceFileObj.statements.some(st => {
        // Is the interface defined in the file and exported
        const isInterfaceDeclarationExported = ((ts.isInterfaceDeclaration(st) &&
            st.name.getText() === typeName) &&
            Array.isArray(st.modifiers) &&
            st.modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword));
        // Is the interface exported through a named export
        const isTypeInExportDeclaration = ts.isExportDeclaration(st) &&
            ts.isNamedExports(st.exportClause) &&
            st.exportClause.elements.some(nee => nee.name.getText() === typeName);
        return isInterfaceDeclarationExported || isTypeInExportDeclaration;
    });
    if (isExported) {
        return {
            referenceLocation: 'local'
        };
    }
    // This is most likely a global type, if it is a local that is not exported then typescript will inform the dev
    return {
        referenceLocation: 'global',
    };
}
function inferPropType(expression) {
    if (expression == null) {
        return undefined;
    }
    if (ts.isStringLiteral(expression)) {
        return 'string';
    }
    if (ts.isNumericLiteral(expression)) {
        return 'number';
    }
    if ([ts.SyntaxKind.BooleanKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].indexOf(expression.kind) !== -1) {
        return 'boolean';
    }
    if ((ts.SyntaxKind.NullKeyword === expression.kind) ||
        (ts.SyntaxKind.UndefinedKeyword === expression.kind) ||
        (ts.isRegularExpressionLiteral(expression)) ||
        (ts.isArrayLiteralExpression(expression)) ||
        (ts.isObjectLiteralExpression(expression))) {
        return 'any';
    }
    return undefined;
}
function propTypeFromTSType(type) {
    switch (type) {
        case 'string':
            return 2 /* String */;
        case 'number':
            return 4 /* Number */;
        case 'boolean':
            return 3 /* Boolean */;
        case 'any':
            return 1 /* Any */;
        default:
            return 0 /* Unknown */;
    }
}

function getStateDecoratorMeta(checker, classNode) {
    return classNode.members
        .filter(isPropertyWithDecorators)
        .reduce((membersMeta, member) => {
        const elementDecorator = member.decorators.find(isDecoratorNamed('State'));
        if (elementDecorator) {
            membersMeta[member.name.getText()] = {
                memberType: 5 /* State */
            };
        }
        return membersMeta;
    }, {});
}

function getWatchDecoratorMeta(config, classNode, cmpMeta) {
    const methods = classNode.members.filter(isMethodWithDecorators);
    getChangeMetaByName(config, methods, cmpMeta, 'Watch');
    getChangeMetaByName(config, methods, cmpMeta, 'PropWillChange');
    getChangeMetaByName(config, methods, cmpMeta, 'PropDidChange');
}
function getChangeMetaByName(config, methods, cmpMeta, decoratorName) {
    methods.forEach(({ decorators, name }) => {
        decorators
            .filter(isDecoratorNamed(decoratorName))
            .forEach(propChangeDecorator => {
            const [propName] = getDeclarationParameters(propChangeDecorator);
            if (propName) {
                updateWatchCallback(config, cmpMeta, propName, name, decoratorName);
            }
        });
    });
}
function updateWatchCallback(config, cmpMeta, propName, decoratorData, decoratorName) {
    cmpMeta.membersMeta = cmpMeta.membersMeta || {};
    cmpMeta.membersMeta[propName] = cmpMeta.membersMeta[propName] || {};
    cmpMeta.membersMeta[propName].watchCallbacks = cmpMeta.membersMeta[propName].watchCallbacks || [];
    cmpMeta.membersMeta[propName].watchCallbacks.push(decoratorData.getText());
    if (decoratorName === 'PropWillChange' || decoratorName === 'PropDidChange') {
        config.logger.warn(`@${decoratorName}('${propName}') decorator within "${cmpMeta.tagNameMeta}" component has been deprecated. Please update to @Watch('${propName}').`);
    }
}

function validateComponentClass(config, cmpMeta, classNode) {
    requiresReturnStatement(config, cmpMeta, classNode, 'hostData');
    requiresReturnStatement(config, cmpMeta, classNode, 'render');
}
function requiresReturnStatement(config, cmpMeta, classNode, methodName) {
    const classElm = classNode.members.find(m => isMethod(m, methodName));
    if (!classElm)
        return;
    let hasReturn = false;
    function visitNode(node) {
        if (node.kind === ts.SyntaxKind.ReturnStatement) {
            hasReturn = true;
        }
        ts.forEachChild(node, visitNode);
    }
    ts.forEachChild(classElm, visitNode);
    if (!hasReturn) {
        config.logger.warn(`The "${methodName}()" method within the "${cmpMeta.tagNameMeta}" component is missing a "return" statement.`);
    }
}

function gatherMetadata(config, compilerCtx, buildCtx, typechecker, sourceFileList) {
    const componentMetaList = {};
    const diagnostics = [];
    const visitFile = visitFactory(config, compilerCtx, buildCtx, typechecker, componentMetaList, diagnostics);
    // Visit every sourceFile in the program
    for (const sourceFile of sourceFileList) {
        ts.forEachChild(sourceFile, (node) => {
            visitFile(node, node);
        });
    }
    return componentMetaList;
}
function visitFactory(config, compilerCtx, buildCtx, checker, componentMetaList, diagnostics) {
    return function visit(node, sourceFile) {
        if (node.kind === ts.SyntaxKind.ImportDeclaration) {
            getCollections(config, compilerCtx, buildCtx, node);
        }
        if (ts.isClassDeclaration(node)) {
            const cmpMeta = visitClass(config, checker, node, sourceFile, diagnostics);
            if (cmpMeta) {
                const tsFilePath = normalizePath(sourceFile.getSourceFile().fileName);
                componentMetaList[tsFilePath] = cmpMeta;
            }
        }
        ts.forEachChild(node, (node) => {
            visit(node, sourceFile);
        });
    };
}
function visitClass(config, checker, classNode, sourceFile, diagnostics) {
    let cmpMeta = getComponentDecoratorMeta(checker, classNode);
    if (!cmpMeta) {
        return undefined;
    }
    cmpMeta = Object.assign({}, cmpMeta, { componentClass: classNode.name.getText().trim(), membersMeta: Object.assign({}, getElementDecoratorMeta(checker, classNode), getMethodDecoratorMeta(checker, classNode), getStateDecoratorMeta(checker, classNode), getPropDecoratorMeta(checker, classNode, sourceFile, diagnostics)), eventsMeta: getEventDecoratorMeta(checker, classNode), listenersMeta: getListenDecoratorMeta(checker, classNode) });
    getWatchDecoratorMeta(config, classNode, cmpMeta);
    // validate the user's component class for any common errors
    validateComponentClass(config, cmpMeta, classNode);
    // Return Class Declaration with Decorator removed and as default export
    return cmpMeta;
}

var __awaiter$56 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const METADATA_MEMBERS_TYPED = [1 /* Prop */, 2 /* PropMutable */];
/**
 * Generate the component.d.ts file that contains types for all components
 * @param config the project build configuration
 * @param options compiler options from tsconfig
 */
function generateComponentTypesFile(config, compilerCtx, cmpList) {
    return __awaiter$56(this, void 0, void 0, function* () {
        let typeImportData = {};
        const allTypes = {};
        let componentsFileContent = `/**
 * This is an autogenerated file created by the Stencil build process.
 * It contains typing information for all components that exist in this project
 * and imports for stencil collections that might be configured in your stencil.config.js file
 */
declare global {
  namespace JSX {
    interface Element {}
    export interface IntrinsicElements {}
  }
  namespace JSXElements {}

  interface HTMLStencilElement extends HTMLElement {
    componentOnReady(): Promise<this>;
    componentOnReady(done: (ele?: this) => void): void;
  }

  interface HTMLAttributes {}
}\n\n`;
        const collectionTypesImports = yield getCollectionsTypeImports(config, compilerCtx);
        componentsFileContent += collectionTypesImports;
        const componentFileString = Object.keys(cmpList)
            .filter(moduleFileName => cmpList[moduleFileName] != null)
            .sort()
            .reduce((finalString, moduleFileName) => {
            const cmpMeta = cmpList[moduleFileName];
            const importPath = normalizePath(config.sys.path.relative(config.srcDir, moduleFileName)
                .replace(/\.(tsx|ts)$/, ''));
            typeImportData = updateReferenceTypeImports(config, typeImportData, allTypes, cmpMeta, moduleFileName);
            finalString +=
                `${createTypesAsString(cmpMeta, importPath)}\n`;
            return finalString;
        }, '');
        const typeImportString = Object.keys(typeImportData).reduce((finalString, filePath) => {
            const typeData = typeImportData[filePath];
            let importFilePath;
            if (config.sys.path.isAbsolute(filePath)) {
                importFilePath = normalizePath('./' +
                    config.sys.path.relative(config.srcDir, filePath)).replace(/\.(tsx|ts)$/, '');
            }
            else {
                importFilePath = filePath;
            }
            finalString +=
                `import {
${typeData.sort(sortImportNames).map(td => {
                    if (td.localName === td.importName) {
                        return `  ${td.importName},`;
                    }
                    else {
                        return `  ${td.localName} as ${td.importName},`;
                    }
                }).join('\n')}
} from '${importFilePath}';\n`;
            return finalString;
        }, '');
        componentsFileContent += typeImportString + componentFileString;
        if (componentFileString.includes('namespace JSX')) {
            componentsFileContent += `declare global { namespace JSX { interface StencilJSX {} } }\n`;
        }
        return componentsFileContent;
    });
}
function sortImportNames(a, b) {
    const aName = a.localName.toLowerCase();
    const bName = b.localName.toLowerCase();
    if (aName < bName)
        return -1;
    if (aName > bName)
        return 1;
    if (a.localName < b.localName)
        return -1;
    if (a.localName > b.localName)
        return 1;
    return 0;
}
/**
 * Find all referenced types by a component and add them to the importDataObj and return the newly
 * updated importDataObj
 *
 * @param importDataObj key/value of type import file, each value is an array of imported types
 * @param cmpMeta the metadata for the component that is referencing the types
 * @param filePath the path of the component file
 * @param config general config that all of stencil uses
 */
function updateReferenceTypeImports(config, importDataObj, allTypes, cmpMeta, filePath) {
    function getIncrememntTypeName(name) {
        if (allTypes[name] == null) {
            allTypes[name] = 1;
            return name;
        }
        allTypes[name] += 1;
        return `${name}${allTypes[name]}`;
    }
    return Object.keys(cmpMeta.membersMeta)
        .filter((memberName) => {
        const member = cmpMeta.membersMeta[memberName];
        return METADATA_MEMBERS_TYPED.indexOf(member.memberType) !== -1 &&
            member.attribType.typeReferences;
    })
        .reduce((obj, memberName) => {
        const member = cmpMeta.membersMeta[memberName];
        Object.keys(member.attribType.typeReferences).forEach(typeName => {
            const type = member.attribType.typeReferences[typeName];
            let importFileLocation;
            // If global then there is no import statement needed
            if (type.referenceLocation === 'global') {
                return;
                // If local then import location is the current file
            }
            else if (type.referenceLocation === 'local') {
                importFileLocation = filePath;
            }
            else if (type.referenceLocation === 'import') {
                importFileLocation = type.importReferenceLocation;
            }
            // If this is a relative path make it absolute
            if (importFileLocation.startsWith('.')) {
                importFileLocation =
                    config.sys.path.resolve(config.sys.path.dirname(filePath), importFileLocation);
            }
            obj[importFileLocation] = obj[importFileLocation] || [];
            // If this file already has a reference to this type move on
            if (obj[importFileLocation].find(df => df.localName === typeName)) {
                return;
            }
            const newTypeName = getIncrememntTypeName(typeName);
            obj[importFileLocation].push({
                localName: typeName,
                importName: newTypeName
            });
        });
        return obj;
    }, importDataObj);
}
/**
 * Generate a string based on the types that are defined within a component.
 *
 * @param cmpMeta the metadata for the component that a type definition string is generated for
 * @param importPath the path of the component file
 */
function createTypesAsString(cmpMeta, importPath) {
    const tagName = cmpMeta.tagNameMeta;
    const tagNameAsPascal = dashToPascalCase(cmpMeta.tagNameMeta);
    const interfaceName = `HTML${tagNameAsPascal}Element`;
    const jsxInterfaceName = `${tagNameAsPascal}Attributes`;
    const interfaceOptions = membersToInterfaceOptions(cmpMeta.membersMeta);
    cmpMeta.membersMeta;
    return `
import {
  ${cmpMeta.componentClass} as ${dashToPascalCase(cmpMeta.tagNameMeta)}
} from './${importPath}';

declare global {
  interface ${interfaceName} extends ${tagNameAsPascal}, HTMLStencilElement {
  }
  var ${interfaceName}: {
    prototype: ${interfaceName};
    new (): ${interfaceName};
  };
  interface HTMLElementTagNameMap {
    "${tagName}": ${interfaceName};
  }
  interface ElementTagNameMap {
    "${tagName}": ${interfaceName};
  }
  namespace JSX {
    interface IntrinsicElements {
      "${tagName}": JSXElements.${jsxInterfaceName};
    }
  }
  namespace JSXElements {
    export interface ${jsxInterfaceName} extends HTMLAttributes {
      ${Object.keys(interfaceOptions)
        .sort(sortInterfaceMembers)
        .map((key) => `${key}?: ${interfaceOptions[key]};`).join('\n      ')}
    }
  }
}
`;
}
function sortInterfaceMembers(a, b) {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower < bLower)
        return -1;
    if (aLower > bLower)
        return 1;
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function membersToInterfaceOptions(membersMeta) {
    const interfaceData = Object.keys(membersMeta)
        .filter((memberName) => {
        return METADATA_MEMBERS_TYPED.indexOf(membersMeta[memberName].memberType) !== -1;
    })
        .reduce((obj, memberName) => {
        const member = membersMeta[memberName];
        obj[memberName] = member.attribType.text;
        return obj;
    }, {});
    return interfaceData;
}
function getCollectionsTypeImports(config, compilerCtx) {
    return __awaiter$56(this, void 0, void 0, function* () {
        const collections = compilerCtx.collections.map(collection => {
            return getCollectionTypesImport(config, compilerCtx, collection);
        });
        const collectionTypes = yield Promise.all(collections);
        if (collectionTypes.length > 0) {
            return `${collectionTypes.join('\n')}\n\n`;
        }
        return '';
    });
}
function getCollectionTypesImport(config, compilerCtx, collection) {
    return __awaiter$56(this, void 0, void 0, function* () {
        let typeImport = '';
        try {
            const collectionDir = collection.moduleDir;
            const collectionPkgJson = config.sys.path.join(collectionDir, 'package.json');
            const pkgJsonStr = yield compilerCtx.fs.readFile(collectionPkgJson);
            const pkgData = JSON.parse(pkgJsonStr);
            if (pkgData.types && pkgData.collection) {
                typeImport = `import '${pkgData.name}';`;
            }
        }
        catch (e) {
            config.logger.debug(`getCollectionTypesImport: ${e}`);
        }
        if (typeImport === '') {
            config.logger.debug(`unabled to find "${collection.collectionName}" collection types`);
        }
        return typeImport;
    });
}

function getTsHost(config, ctx, writeQueue, tsCompilerOptions) {
    const tsHost = ts.createCompilerHost(tsCompilerOptions);
    tsHost.directoryExists = (dirPath) => {
        dirPath = normalizePath(dirPath);
        try {
            const stat = ctx.fs.statSync(dirPath);
            return stat && stat.isDirectory;
        }
        catch (e) {
            return false;
        }
    };
    tsHost.getSourceFile = (filePath) => {
        filePath = normalizePath(filePath);
        let tsSourceFile = null;
        try {
            let content = ctx.fs.readFileSync(filePath);
            if (isDtsFile(filePath)) {
                if (content.includes('namespace JSX {') && !content.includes('StencilJSX')) {
                    // we currently have what seems to be an unsolvable problem where any third-party
                    // package can provide their own global JSX types, while stencil also
                    // provides them as a global in order for typescript to understand and use JSX
                    // types. So we're renaming any "other" imported global JSX namespaces so there
                    // are no collisions with the same global JSX interfaces stencil already has
                    // we're totally up for better ideas  ¯\_(ツ)_/¯
                    content = content.replace('namespace JSX {', `namespace JSX_NO_COLLISION_${Math.round(Math.random() * 99999999)} {`);
                    config.logger.debug(`renamed global JSX namespace collision: ${filePath}`);
                }
            }
            tsSourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2015);
        }
        catch (e) {
            config.logger.error(`tsHost.getSourceFile unable to find: ${filePath}`, e);
        }
        return tsSourceFile;
    };
    tsHost.fileExists = (filePath) => {
        return ctx.fs.accessSync(filePath);
    }, tsHost.readFile = (filePath) => {
            let sourceText = null;
            try {
                sourceText = ctx.fs.readFileSync(filePath);
            }
            catch (e) { }
            return sourceText;
        }, tsHost.writeFile = (outputFilePath, outputText, _writeByteOrderMark, _onError, sourceFiles) => {
            sourceFiles.forEach(sourceFile => {
                writeQueue.push(writeFileInMemory(config, ctx, sourceFile, outputFilePath, outputText));
            });
        };
    return tsHost;
}
function writeFileInMemory(config, ctx, sourceFile, distFilePath, outputText) {
    let tsFilePath = normalizePath(sourceFile.fileName);
    if (!config.sys.path.isAbsolute(tsFilePath)) {
        tsFilePath = normalizePath(config.sys.path.join(config.rootDir, tsFilePath));
    }
    distFilePath = normalizePath(distFilePath);
    // if this build is also building a distribution then we
    // actually want to eventually write the files to disk
    // otherwise we still want to put these files in our file system but
    // only as in-memory files and never are actually written to disk
    const isInMemoryOnly = !config.generateDistribution;
    // get or create the ctx module file object
    if (!ctx.moduleFiles[tsFilePath]) {
        // we don't have this module in the ctx yet
        ctx.moduleFiles[tsFilePath] = {};
    }
    // figure out which file type this is
    if (isJsFile(distFilePath)) {
        // transpiled file is a js file
        ctx.moduleFiles[tsFilePath].jsFilePath = distFilePath;
    }
    else if (isDtsFile(distFilePath)) {
        // transpiled file is a .d.ts file
        ctx.moduleFiles[tsFilePath].dtsFilePath = distFilePath;
    }
    else {
        // idk, this shouldn't happen
        config.logger.debug(`unknown transpiled output: ${distFilePath}`);
    }
    // let's write the beast to our internal in-memory file system
    // the distFilePath is only written to disk when a distribution
    // is being created. But if we're not generating a distribution
    // like just a website, we still need to write it to our file system
    // so it can be read later, but it only needs to be in memory
    return ctx.fs.writeFile(distFilePath, outputText, { inMemoryOnly: isInMemoryOnly });
}

function moduleGraph(config, buildCtx) {
    return (transformContext) => {
        function visitImport(moduleGraph, dirPath, importNode) {
            if (importNode.moduleSpecifier) {
                let importPath = importNode.moduleSpecifier.getText().replace(/\'|\"|\`/g, '');
                if (importPath.startsWith('.') || importPath.startsWith('/')) {
                    importPath = pathJoin(config, dirPath, importPath);
                }
                moduleGraph.importPaths.push(importPath);
            }
            return importNode;
        }
        function visit(moduleGraph, dirPath, node) {
            switch (node.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                    return visitImport(moduleGraph, dirPath, node);
                default:
                    return ts.visitEachChild(node, (node) => {
                        return visit(moduleGraph, dirPath, node);
                    }, transformContext);
            }
        }
        return (tsSourceFile) => {
            const moduleGraph = {
                filePath: normalizePath(tsSourceFile.fileName),
                importPaths: []
            };
            const dirPath = config.sys.path.dirname(tsSourceFile.fileName);
            buildCtx.moduleGraphs.push(moduleGraph);
            return visit(moduleGraph, dirPath, tsSourceFile);
        };
    };
}

function normalizeAssetsDir(config, componentFilePath, assetsMetas) {
    return assetsMetas.map((assetMeta) => {
        return Object.assign({}, assetMeta, normalizeAssetDir(config, componentFilePath, assetMeta.originalComponentPath));
    });
}
function normalizeAssetDir(config, componentFilePath, assetsDir) {
    const assetsMeta = {};
    // get the absolute path of the directory which the component is sitting in
    const componentDir = normalizePath(config.sys.path.dirname(componentFilePath));
    // get the relative path from the component file to the assets directory
    assetsDir = normalizePath(assetsDir.trim());
    if (config.sys.path.isAbsolute(assetsDir)) {
        // this path is absolute already!
        // add as the absolute path
        assetsMeta.absolutePath = assetsDir;
        // if this is an absolute path already, let's convert it to be relative
        assetsMeta.cmpRelativePath = config.sys.path.relative(componentDir, assetsDir);
    }
    else {
        // this path is relative to the component
        assetsMeta.cmpRelativePath = assetsDir;
        // create the absolute path to the asset dir
        assetsMeta.absolutePath = pathJoin(config, componentDir, assetsDir);
    }
    return assetsMeta;
}

function normalizeStyles(config, componentFilePath, stylesMeta) {
    const newStylesMeta = {};
    Object.keys(stylesMeta).forEach((modeName) => {
        newStylesMeta[modeName] = {
            externalStyles: []
        };
        const externalStyles = stylesMeta[modeName].externalStyles || [];
        newStylesMeta[modeName].externalStyles = externalStyles.map(externalStyle => {
            const { cmpRelativePath, absolutePath } = normalizeModeStylePaths(config, componentFilePath, externalStyle.originalComponentPath);
            const normalizedExternalStyles = {
                absolutePath: absolutePath,
                cmpRelativePath: cmpRelativePath,
                originalComponentPath: externalStyle.originalComponentPath,
                originalCollectionPath: externalStyle.originalCollectionPath
            };
            return normalizedExternalStyles;
        });
        if (typeof stylesMeta[modeName].styleStr === 'string') {
            newStylesMeta[modeName].styleStr = stylesMeta[modeName].styleStr;
        }
    });
    return newStylesMeta;
}
function normalizeModeStylePaths(config, componentFilePath, stylePath) {
    let cmpRelativePath;
    let absolutePath;
    // get the absolute path of the directory which the component is sitting in
    const componentDir = normalizePath(config.sys.path.dirname(componentFilePath));
    // get the relative path from the component file to the style
    let componentRelativeStylePath = normalizePath(stylePath.trim());
    if (config.sys.path.isAbsolute(componentRelativeStylePath)) {
        // this path is absolute already!
        // add to our list of style absolute paths
        absolutePath = componentRelativeStylePath;
        // if this is an absolute path already, let's convert it to be relative
        componentRelativeStylePath = config.sys.path.relative(componentDir, componentRelativeStylePath);
        // add to our list of style relative paths
        cmpRelativePath = componentRelativeStylePath;
    }
    else {
        // this path is relative to the component
        // add to our list of style relative paths
        cmpRelativePath = componentRelativeStylePath;
        // create the absolute path to the style file
        const absoluteStylePath = normalizePath(config.sys.path.join(componentDir, componentRelativeStylePath));
        // add to our list of style absolute paths
        absolutePath = absoluteStylePath;
    }
    return {
        cmpRelativePath,
        absolutePath
    };
}

function removeCollectionImports(compilerCtx) {
    /*
  
      // remove side effect collection imports like:
      import 'ionicons';
  
      // do not remove collection imports with importClauses:
      import * as asdf 'ionicons';
      import { asdf } '@ionic/core';
  
    */
    return (transformContext) => {
        function visitImport(importNode) {
            if (!importNode.importClause && importNode.moduleSpecifier && ts.isStringLiteral(importNode.moduleSpecifier)) {
                // must not have an import clause
                // must have a module specifier and
                // the module specifier must be a string literal
                const moduleImport = importNode.moduleSpecifier.text;
                // test if this side effect import is a collection
                const isCollectionImport = compilerCtx.collections.some(c => {
                    return c.collectionName === moduleImport;
                });
                if (isCollectionImport) {
                    // turns out this is a side effect import is a collection,
                    // we actually don't want to include this in the JS output
                    // we've already gather the types we needed, kthxbai
                    return null;
                }
            }
            return importNode;
        }
        function visit(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                    return visitImport(node);
                default:
                    return ts.visitEachChild(node, visit, transformContext);
            }
        }
        return (tsSourceFile) => {
            return visit(tsSourceFile);
        };
    };
}

// same as the "declare" variables in the root index.ts file
const DECORATORS_TO_REMOVE = [
    'Element',
    'Event',
    'Listen',
    'Method',
    'Prop',
    'PropDidChange',
    'PropWillChange',
    'State',
    'Watch'
];
/**
 * Remove all decorators that are for metadata purposes
 */
function removeDecorators() {
    return (transformContext) => {
        function visit(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                    if (!isComponentClass(node)) {
                        return node;
                    }
                    return visitComponentClass(node);
                default:
                    return ts.visitEachChild(node, visit, transformContext);
            }
        }
        return (tsSourceFile) => visit(tsSourceFile);
    };
}
/**
 * Visit the component class and remove decorators
 * @param classNode
 */
function visitComponentClass(classNode) {
    classNode.decorators = removeDecoratorsByName(classNode.decorators, ['Component']);
    classNode.members.forEach((member) => {
        if (Array.isArray(member.decorators)) {
            member.decorators = removeDecoratorsByName(member.decorators, DECORATORS_TO_REMOVE);
        }
    });
    return classNode;
}
/**
 * Remove a decorator from the an array by name
 * @param decorators array of decorators
 * @param name name to remove
 */
function removeDecoratorsByName(decoratorList, names) {
    const updatedDecoratorList = decoratorList.filter(dec => {
        const toRemove = ts.isCallExpression(dec.expression) && names.indexOf(dec.expression.expression.getText()) >= 0;
        return !toRemove;
    });
    if (updatedDecoratorList.length === 0 && decoratorList.length > 0) {
        return undefined;
    }
    if (updatedDecoratorList.length !== decoratorList.length) {
        return ts.createNodeArray(updatedDecoratorList);
    }
    return decoratorList;
}

var __awaiter$57 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function transpileModules(config, compilerCtx, buildCtx, tsFilePaths) {
    return __awaiter$57(this, void 0, void 0, function* () {
        if (hasError(buildCtx.diagnostics)) {
            // we've already got an error, let's not continue
            return;
        }
        if (tsFilePaths.length === 0) {
            // don't bother if there are no ts files to transpile
            return;
        }
        // fire up the typescript program
        const timespace = config.logger.createTimeSpan('transpileModules start', true);
        // get the tsconfig compiler options we'll use
        const tsOptions = yield getUserTsConfig(config, compilerCtx);
        if (config.suppressTypeScriptErrors) {
            // suppressTypeScriptErrors mainly for unit testing
            tsOptions.lib = [];
        }
        const writeQueue = [];
        // get the ts compiler host we'll use, which patches file operations
        // with our in-memory file system
        const tsHost = getTsHost(config, compilerCtx, writeQueue, tsOptions);
        // fire up the typescript program
        const componentsDtsSrcFilePath = getComponentsDtsSrcFilePath(config);
        // get all of the ts files paths to transpile
        // ensure the components.d.ts file is always excluded from this transpile program
        const checkProgramTsFiles = tsFilePaths.filter(filePath => filePath !== componentsDtsSrcFilePath);
        // keep track of how many files we transpiled (great for debugging/testing)
        buildCtx.transpileBuildCount = checkProgramTsFiles.length;
        // run the first program that only does the checking
        const checkProgram = ts.createProgram(checkProgramTsFiles, tsOptions, tsHost);
        // Gather component metadata and type info
        const metadata = gatherMetadata(config, compilerCtx, buildCtx, checkProgram.getTypeChecker(), checkProgram.getSourceFiles());
        Object.keys(metadata).forEach(key => {
            const tsFilePath = normalizePath(key);
            const fileMetadata = metadata[tsFilePath];
            // normalize metadata
            fileMetadata.stylesMeta = normalizeStyles(config, tsFilePath, fileMetadata.stylesMeta);
            fileMetadata.assetsDirsMeta = normalizeAssetsDir(config, tsFilePath, fileMetadata.assetsDirsMeta);
            // assign metadata to module files
            if (!compilerCtx.moduleFiles[tsFilePath]) {
                compilerCtx.moduleFiles[tsFilePath] = {};
            }
            compilerCtx.moduleFiles[tsFilePath].cmpMeta = fileMetadata;
        });
        // Generate d.ts files for component types
        const componentTypesFileContent = yield generateComponentTypesFile(config, compilerCtx, metadata);
        // queue the components.d.ts async file write and put it into memory
        yield compilerCtx.fs.writeFile(componentsDtsSrcFilePath, componentTypesFileContent);
        // get all of the ts files paths to transpile
        // ensure the components.d.ts file is always included to this transpile program
        const programTsFiles = tsFilePaths.slice();
        if (programTsFiles.indexOf(componentsDtsSrcFilePath) === -1) {
            // we must always include the components.d.ts file in this tranpsile program
            programTsFiles.push(componentsDtsSrcFilePath);
        }
        // create another program, but use the previous checkProgram to speed it up
        const program = ts.createProgram(programTsFiles, tsOptions, tsHost, checkProgram);
        // run the second program again with our new typed info
        transpileProgram(program, tsHost, config, compilerCtx, buildCtx);
        // figure out if we actually have changed JS text that was written
        const writeResults = yield Promise.all(writeQueue);
        buildCtx.hasChangedJsText = writeResults.some(r => r.changedContent);
        // done and done
        timespace.finish(`transpileModules finished`);
    });
}
function transpileProgram(program, tsHost, config, compilerCtx, buildCtx) {
    // this is the big one, let's go ahead and kick off the transpiling
    const buildConditionals = {
        isDev: !!config.devMode
    };
    program.emit(undefined, tsHost.writeFile, undefined, false, {
        // NOTE! order of transforms and being in either "before" or "after" is very important!!!!
        before: [
            removeDecorators(),
            addComponentMetadata(compilerCtx.moduleFiles),
            buildConditionalsTransform(buildConditionals)
        ],
        after: [
            removeStencilImports(),
            removeCollectionImports(compilerCtx),
            moduleGraph(config, buildCtx),
            componentDependencies(compilerCtx, buildCtx)
        ]
    });
    if (!config.suppressTypeScriptErrors) {
        // suppressTypeScriptErrors mainly for unit testing
        const tsDiagnostics = [];
        program.getSyntacticDiagnostics().forEach(d => tsDiagnostics.push(d));
        program.getSemanticDiagnostics().forEach(d => tsDiagnostics.push(d));
        program.getOptionsDiagnostics().forEach(d => tsDiagnostics.push(d));
        loadTypeScriptDiagnostics(config.rootDir, buildCtx.diagnostics, tsDiagnostics);
    }
}

var __awaiter$58 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function transpileAppModules(config, compilerCtx, buildCtx) {
    return __awaiter$58(this, void 0, void 0, function* () {
        if (canSkipTranspiling(config, buildCtx)) {
            // this is a rebuild, but turns out the files causing to
            // do not require us to run the transpiling again
            return;
        }
        const timeSpan = config.logger.createTimeSpan(`compile started`);
        try {
            // recursively scan all of the src directories
            // looking for typescript files to transpile
            // and read the files async and put into our
            // in-memory file system
            const tsFilePaths = yield scanDirForTsFiles(config, compilerCtx.fs, config.srcDir);
            // found all the files we need to transpile
            // and have all the files in-memory and ready to go
            // go ahead and kick off transpiling
            yield transpileModules(config, compilerCtx, buildCtx, tsFilePaths);
        }
        catch (e) {
            // gah!!
            catchError(buildCtx.diagnostics, e);
        }
        timeSpan.finish(`compile finished`);
    });
}
function scanDirForTsFiles(config, fs, dir) {
    return __awaiter$58(this, void 0, void 0, function* () {
        const scanDirTimeSpan = config.logger.createTimeSpan(`scan ${config.srcDir} for ts files started`, true);
        // loop through this directory and sub directories looking for
        // files that need to be transpiled
        const dirItems = yield fs.readdir(dir, { recursive: true });
        // filter down to only the ts files we should include
        const tsFileItems = dirItems.filter(item => {
            return item.isFile && isFileIncludePath(config, item.absPath);
        });
        // let's async read and cache the source file so it get's loaded up
        // into our in-memory file system to be used later during the actual transpile
        yield Promise.all(tsFileItems.map((tsFileItem) => __awaiter$58(this, void 0, void 0, function* () {
            yield fs.readFile(tsFileItem.absPath);
        })));
        scanDirTimeSpan.finish(`scan for ts files finished`);
        // return just the abs path
        return tsFileItems.map(tsFileItem => tsFileItem.absPath);
    });
}
function canSkipTranspiling(config, buildCtx) {
    if (buildCtx.requiresFullBuild) {
        // requires a full rebuild, so we cannot skip transpiling
        return false;
    }
    if (buildCtx.dirsAdded.length > 0 || buildCtx.dirsDeleted.length > 0) {
        // if a directory was added or deleted
        // then we cannot skip transpiling
        return false;
    }
    const isTsFileInChangedFiles = buildCtx.filesChanged.some(filePath => {
        // do transpiling if one of the changed files is a ts file
        // and the changed file is not the components.d.ts file
        // when the components.d.ts file is written to disk it shouldn't cause a new build
        return isFileIncludePath(config, filePath);
    });
    // we can skip transpiling if there are no ts files that have changed
    return !isTsFileInChangedFiles;
}
function isFileIncludePath(config, readPath) {
    for (var i = 0; i < config.excludeSrc.length; i++) {
        if (config.sys.minimatch(readPath, config.excludeSrc[i])) {
            // this file is a file we want to exclude
            return false;
        }
    }
    for (i = 0; i < config.includeSrc.length; i++) {
        if (config.sys.minimatch(readPath, config.includeSrc[i])) {
            // this file is a file we want to include
            return true;
        }
    }
    // not a file we want to include, let's not add it
    return false;
}

var __awaiter$59 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function build(config, compilerCtx, watcher) {
    return __awaiter$59(this, void 0, void 0, function* () {
        // create the build context if it doesn't exist
        // the buid context is the same object used for all builds and rebuilds
        // ctx is where stuff is cached for fast in-memory lookups later
        compilerCtx = getCompilerCtx(config, compilerCtx);
        // reset the build context, this is important for rebuilds
        const buildCtx = getBuildContext(config, compilerCtx, watcher);
        try {
            // create an initial index.html file if one doesn't already exist
            // this is synchronous on purpose
            yield initIndexHtml(config, compilerCtx, buildCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // empty the directories on the first build
            yield emptyDestDir(config, compilerCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // DEPRECATED config.colllections 2018-02-13
            yield _deprecatedConfigCollections(config, compilerCtx, buildCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // async scan the src directory for ts files
            // then transpile them all in one go
            yield transpileAppModules(config, compilerCtx, buildCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // initialize all the collections we found when transpiling
            // async copy collection files and upgrade collections as needed
            yield initCollections(config, compilerCtx, buildCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // we've got the compiler context filled with app modules and collection dependency modules
            // figure out how all these components should be connected
            const entryModules = generateEntryModules(config, compilerCtx, buildCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // bundle modules and styles into separate files phase
            const jsModules = yield bundle(config, compilerCtx, buildCtx, entryModules);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // create each of the components's styles
            yield generateStyles(config, compilerCtx, buildCtx, entryModules);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // both styles and modules are done bundling
            // inject the styles into the modules and
            // generate each of the output bundles
            const cmpRegistry = yield generateBundles(config, compilerCtx, buildCtx, entryModules, jsModules);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // generate the app files, such as app.js, app.core.js
            yield generateAppFiles(config, compilerCtx, buildCtx, entryModules, cmpRegistry);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // copy all assets
            if (!compilerCtx.hasSuccessfulBuild) {
                // only do the initial copy on the first build
                // watcher handles any re-copies
                yield copyTasks(config, compilerCtx, buildCtx.diagnostics, false);
                if (buildCtx.shouldAbort())
                    return buildCtx.finish();
            }
            // build index file and service worker
            yield generateIndexHtml(config, compilerCtx, buildCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // generate each of the readmes
            yield generateReadmes(config, compilerCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // prerender that app
            yield prerenderApp(config, compilerCtx, buildCtx, entryModules);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
            // write all the files and copy asset files
            yield writeBuildFiles(config, compilerCtx, buildCtx);
            if (buildCtx.shouldAbort())
                return buildCtx.finish();
        }
        catch (e) {
            // ¯\_(ツ)_/¯
            catchError(buildCtx.diagnostics, e);
        }
        // return what we've learned today
        return buildCtx.finish();
    });
}

var __awaiter$60 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function docs(config, compilerCtx) {
    return __awaiter$60(this, void 0, void 0, function* () {
        compilerCtx = getCompilerCtx(config, compilerCtx);
        const buildCtx = getBuildContext(config, compilerCtx, null);
        config.logger.info(config.logger.cyan(`${config.sys.compiler.name} v${config.sys.compiler.version}`));
        // keep track of how long the entire build process takes
        const timeSpan = config.logger.createTimeSpan(`generate docs, ${config.fsNamespace}, started`);
        try {
            // begin the build
            // async scan the src directory for ts files
            // then transpile them all in one go
            yield transpileAppModules(config, compilerCtx, buildCtx);
            // generate each of the readmes
            yield generateReadmes(config, compilerCtx);
        }
        catch (e) {
            // catch all phase
            catchError(buildCtx.diagnostics, e);
        }
        // finalize phase
        buildCtx.diagnostics = cleanDiagnostics(buildCtx.diagnostics);
        config.logger.printDiagnostics(buildCtx.diagnostics);
        // create a nice pretty message stating what happend
        let buildStatus = 'finished';
        let statusColor = 'green';
        if (hasError(buildCtx.diagnostics)) {
            buildStatus = 'failed';
            statusColor = 'red';
        }
        timeSpan.finish(`generate docs ${buildStatus}`, statusColor, true, true);
    });
}

function validateServiceWorkerConfig(config) {
    if (!config.serviceWorker) {
        config.serviceWorker = null;
        return;
    }
    if (typeof config.serviceWorker !== 'object') {
        // what was passed in could have been a boolean
        // in that case let's just turn it into an empty obj so Object.assign doesn't crash
        config.serviceWorker = {};
    }
    const swConfig = Object.assign({}, DEFAULT_SW_CONFIG, config.serviceWorker);
    if (typeof swConfig.globDirectory !== 'string') {
        swConfig.globDirectory = config.wwwDir;
    }
    if (!swConfig.swDest) {
        swConfig.swDest = config.sys.path.join(config.wwwDir, DEFAULT_SW_FILENAME);
    }
    if (!config.sys.path.isAbsolute(swConfig.swDest)) {
        swConfig.swDest = config.sys.path.join(config.wwwDir, swConfig.swDest);
    }
    config.serviceWorker = swConfig;
}
const DEFAULT_SW_CONFIG = {
    globPatterns: [
        '**/*.{js,css,json,html,ico,png,svg}'
    ]
};
const DEFAULT_SW_FILENAME = 'sw.js';

class Compiler {
    constructor(config) {
        this.config = config;
        this.isValid = isValid(config);
        if (this.isValid) {
            this.ctx = getCompilerCtx(config);
            let startupMsg = `${config.sys.compiler.name} v${config.sys.compiler.version} `;
            if (config.sys.platform !== 'win32') {
                startupMsg += `💎`;
            }
            config.logger.info(config.logger.cyan(startupMsg));
            config.logger.debug(`compiler runtime: ${config.sys.compiler.runtime}`);
        }
    }
    build() {
        return build(this.config, this.ctx);
    }
    on(eventName, cb) {
        return this.ctx.events.subscribe(eventName, cb);
    }
    once(eventName) {
        return new Promise(resolve => {
            const off = this.ctx.events.subscribe(eventName, (...args) => {
                off();
                resolve.apply(this, args);
            });
        });
    }
    off(eventName, cb) {
        this.ctx.events.unsubscribe(eventName, cb);
    }
    trigger(eventName, ...args) {
        args.unshift(eventName);
        this.ctx.events.emit.apply(this.ctx.events, args);
    }
    docs() {
        return docs(this.config, this.ctx);
    }
    get fs() {
        return this.ctx.fs;
    }
    get name() {
        return this.config.sys.compiler.name;
    }
    get version() {
        return this.config.sys.compiler.version;
    }
}
function isValid(config) {
    try {
        // validate the build config
        validateBuildConfig(config, true);
        validatePrerenderConfig(config);
        validateServiceWorkerConfig(config);
        return true;
    }
    catch (e) {
        if (config.logger) {
            const diagnostics = [];
            catchError(diagnostics, e);
            config.logger.printDiagnostics(diagnostics);
        }
        else {
            console.error(e);
        }
        return false;
    }
}

exports.Compiler = Compiler;