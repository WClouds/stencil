import { Compiler } from '../compiler/index';
import { Config } from '../declarations';
export declare class TestingCompiler extends Compiler {
    constructor(config?: Config);
    loadConfigFile(configPath: string): void;
}
