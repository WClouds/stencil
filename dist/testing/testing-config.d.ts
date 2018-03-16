import * as d from '../declarations';
import { TestingLogger } from './testing-logger';
import { TestingSystem } from './testing-sys';
export declare class TestingConfig implements d.Config {
    logger: TestingLogger;
    sys: TestingSystem;
    namespace: string;
    rootDir: string;
    suppressTypeScriptErrors: boolean;
    devMode: boolean;
    enableCache: boolean;
    buildAppCore: boolean;
    flags: d.ConfigFlags;
    bundles: d.ConfigBundle[];
    outputTargets: d.OutputTarget[];
    buildEs5: boolean;
    hashFileNames: boolean;
    minifyCss: boolean;
    minifyJs: boolean;
}
