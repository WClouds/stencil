export interface BuildConditionals {
    coreId?: 'core' | 'core.pf';
    polyfills?: boolean;
    es5?: boolean;
    cssVarShim?: boolean;
    clientSide?: boolean;
    isDev: boolean;
    isProd: boolean;
    devInspector: boolean;
    verboseError: boolean;
    ssrServerSide: boolean;
    styles: boolean;
    shadowDom: boolean;
    hostData: boolean;
    hostTheme: boolean;
    element: boolean;
    event: boolean;
    listener: boolean;
    method: boolean;
    propConnect: boolean;
    propContext: boolean;
    watchCallback: boolean;
    cmpDidLoad: boolean;
    cmpWillLoad: boolean;
    cmpDidUpdate: boolean;
    cmpWillUpdate: boolean;
    cmpDidUnload: boolean;
    observeAttr: boolean;
    svg: boolean;
}
export interface UserBuildConditionals {
    isDev: boolean;
}
