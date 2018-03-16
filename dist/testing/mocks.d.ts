import * as d from '../declarations';
import { Cache } from '../compiler/cache';
import { TestingFs } from './testing-fs';
import { TestingLogger } from './index';
export declare function mockPlatform(win?: any, domApi?: d.DomApi): MockedPlatform;
export interface MockedPlatform extends d.PlatformApi {
    $flushQueue?: () => Promise<any>;
    $flushLoadBundle?: () => Promise<any>;
}
export declare function mockConfig(opts?: {
    enableLogger: boolean;
}): d.Config;
export declare function mockCompilerCtx(): d.CompilerCtx;
export declare function mockStencilSystem(): d.StencilSystem;
export declare function mockFs(): TestingFs;
export declare function mockLogger(): TestingLogger;
export declare function mockCache(): Cache;
export declare function mockWindow(): Window;
export declare function mockDocument(window?: Window): Document;
export declare function mockDomApi(win?: any, doc?: any): d.DomApi;
export declare function mockRenderer(plt?: MockedPlatform, domApi?: d.DomApi): d.RendererApi;
export declare function mockQueue(): {
    add: (cb: Function) => void;
    flush: (cb?: Function) => void;
    clear: () => void;
};
export declare function mockHtml(html: string): Element;
export declare function mockSVGElement(): Element;
export declare function mockElement(tag?: string): Element;
export declare function mockComponentInstance(plt: d.PlatformApi, domApi: d.DomApi, cmpMeta?: d.ComponentMeta): d.ComponentInstance;
export declare function mockTextNode(text: string): Element;
export declare function mockDefine(plt: MockedPlatform, cmpMeta: d.ComponentMeta): d.ComponentMeta;
export declare function mockEvent(domApi: d.DomApi, name: string, detail?: any): CustomEvent;
export declare function mockDispatchEvent(domApi: d.DomApi, el: HTMLElement, name: string, detail?: any): boolean;
export declare function mockConnect(plt: MockedPlatform, html: string): any;
export declare function waitForLoad(plt: MockedPlatform, rootNode: any, tag: string): Promise<d.HostElement>;
export declare function compareHtml(input: string): string;
export declare function removeWhitespaceFromNodes(node: Node): any;
