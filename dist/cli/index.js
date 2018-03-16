'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * SSR Attribute Names
 */

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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

function getConfigFilePath(process, sys, configArg) {
    if (configArg) {
        if (!sys.path.isAbsolute(configArg)) {
            // passed in a custom stencil config location
            // but it's relative, so prefix the cwd
            return normalizePath(sys.path.join(process.cwd(), configArg));
        }
        // config path already an absolute path, we're good here
        return normalizePath(configArg);
    }
    // nothing was passed in, use the current working directory
    return normalizePath(process.cwd());
}
function hasError$1(diagnostics) {
    if (!diagnostics) {
        return false;
    }
    return diagnostics.some(d => d.level === 'error' && d.type !== 'runtime');
}

function help(process, logger) {
    const p = logger.dim((process.platform === 'win32') ? '>' : '$');
    console.log(`
  ${logger.bold('Build:')} ${logger.dim('Build components for development or production.')}

    ${p} ${logger.green('stencil build [--dev] [--watch] [--prerender] [--debug]')}

      ${logger.green('--dev')} ${logger.dim('..................')} Execute a development build
      ${logger.green('--watch')} ${logger.dim('................')} Execute a build in watch mode
      ${logger.green('--prerender')} ${logger.dim('............')} Prerender URLs
      ${logger.green('--stats')} ${logger.dim('................')} Write stencil-stats.json file
      ${logger.green('--log')} ${logger.dim('..................')} Write stencil-build.log file
      ${logger.green('--config')} ${logger.dim('...............')} Set stencil config file
      ${logger.green('--docs')} ${logger.dim('.................')} Generate readme.md docs for each component
      ${logger.green('--debug')} ${logger.dim('................')} Set the log level to debug

  ${logger.bold('Examples:')}

    ${p} ${logger.green('stencil build --dev --watch')}
    ${p} ${logger.green('stencil build --prerender')}
    ${p} ${logger.green('stencil init')}

`);
}

var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function initApp(process, sys, logger) {
    return __awaiter$1(this, void 0, void 0, function* () {
        const configPath = sys.path.join(process.cwd(), 'stencil.config.js');
        try {
            const fs = require('fs');
            fs.writeFileSync(configPath, DEFAULT_CONFIG);
            logger.info(`Created config: ${configPath}`);
        }
        catch (e) {
            logger.error(e);
        }
    });
}
const DEFAULT_CONFIG = `
exports.config = {
  namespace: 'App',
  collections: []
};
`;

const toLowerCase = (str) => str.toLowerCase();
const dashToPascalCase = (str) => toLowerCase(str).split('-').map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('');

function parseFlags(process) {
    const cmdArgs = getCmdArgs(process);
    const flags = {};
    if (cmdArgs[0] && !cmdArgs[0].startsWith('-')) {
        flags.task = cmdArgs[0];
    }
    else {
        flags.task = null;
    }
    ARG_OPTS.boolean.forEach(booleanName => {
        if (cmdArgs.includes(`--${booleanName}`)) {
            flags[configCase(booleanName)] = true;
            return;
        }
        if (cmdArgs.includes(`--no-${booleanName}`)) {
            flags[configCase(booleanName)] = false;
            return;
        }
        const alias = ARG_OPTS.alias[booleanName];
        if (alias) {
            if (cmdArgs.includes(`-${alias}`)) {
                flags[configCase(booleanName)] = true;
                return;
            }
        }
        flags[configCase(booleanName)] = null;
    });
    ARG_OPTS.string.forEach(stringName => {
        for (let i = 0; i < cmdArgs.length; i++) {
            const cmdArg = cmdArgs[i];
            if (cmdArg.startsWith(`--${stringName}=`)) {
                const values = cmdArg.split('=');
                values.shift();
                flags[configCase(stringName)] = values.join('=');
                return;
            }
            if (cmdArg === `--${stringName}`) {
                flags[configCase(stringName)] = cmdArgs[i + 1];
                return;
            }
            const alias = ARG_OPTS.alias[stringName];
            if (alias) {
                if (cmdArg.startsWith(`-${alias}=`)) {
                    const values = cmdArg.split('=');
                    values.shift();
                    flags[configCase(stringName)] = values.join('=');
                    return;
                }
                if (cmdArg === `-${alias}`) {
                    flags[configCase(stringName)] = cmdArgs[i + 1];
                    return;
                }
            }
            flags[configCase(stringName)] = null;
        }
    });
    return flags;
}
function configCase(prop) {
    prop = dashToPascalCase(prop);
    return prop.charAt(0).toLowerCase() + prop.substr(1);
}
const ARG_OPTS = {
    boolean: [
        'cache',
        'debug',
        'dev',
        'docs',
        'es5',
        'help',
        'log',
        'prod',
        'prerender',
        'skip-node-check',
        'stats',
        'version',
        'watch'
    ],
    string: [
        'config',
        'log-level'
    ],
    alias: {
        'config': 'c',
        'help': 'h',
        'version': 'v'
    }
};
function getCmdArgs(process) {
    let cmdArgs = process.argv.slice(2);
    try {
        const npmRunArgs = process.env.npm_config_argv;
        if (npmRunArgs) {
            cmdArgs = cmdArgs.concat(JSON.parse(npmRunArgs).original);
        }
    }
    catch (e) { }
    return cmdArgs;
}

var __awaiter$2 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function run(process, sys, logger) {
    return __awaiter$2(this, void 0, void 0, function* () {
        process.on('unhandledRejection', (r) => logger.error(r));
        const flags = parseFlags(process);
        if (flags.help || flags.task === 'help') {
            help(process, logger);
            process.exit(0);
        }
        if (flags.task === 'init') {
            initApp(process, sys, logger);
            process.exit(0);
        }
        if (flags.version) {
            console.log(sys.compiler.version);
            process.exit(0);
        }
        // load the config file
        let config;
        try {
            const configPath = getConfigFilePath(process, sys, flags.config);
            config = sys.loadConfigFile(configPath);
        }
        catch (e) {
            logger.error(e);
            process.exit(1);
        }
        try {
            if (!config.logger) {
                // if a logger was not provided then use the
                // default stencil command line logger
                config.logger = logger;
            }
            if (config.logLevel) {
                config.logger.level = config.logLevel;
            }
            if (!config.sys) {
                // if the config was not provided then use the default node sys
                config.sys = sys;
            }
            config.flags = flags;
            const { Compiler } = require('../compiler/index.js');
            const compiler = new Compiler(config);
            if (!compiler.isValid) {
                process.exit(1);
            }
            process.title = `Stencil: ${config.namespace}`;
            switch (flags.task) {
                case 'build':
                    const results = yield compiler.build();
                    if (!config.watch && hasError$1(results && results.diagnostics)) {
                        process.exit(1);
                    }
                    if (config.watch) {
                        process.once('SIGINT', () => {
                            process.exit(0);
                        });
                    }
                    break;
                case 'docs':
                    yield compiler.docs();
                    break;
                default:
                    config.logger.error(`Invalid stencil command, please see the options below:`);
                    help(process, logger);
                    process.exit(1);
            }
        }
        catch (e) {
            config.logger.error('uncaught cli error', e);
            process.exit(1);
        }
    });
}

exports.run = run;
