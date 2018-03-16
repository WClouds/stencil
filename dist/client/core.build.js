(function(window, document, Context, namespace) {
"use strict";


const Build = {
    cssVarShim: true,
    shadowDom: true,
    ssrServerSide: true,
    devInspector: true,
    verboseError: true,
    styles: true,
    hostData: true,
    hostTheme: true,
    svg: true,
    observeAttr: true,
    isDev: true,
    isProd: false,
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

function initStyleTemplate(domApi, cmpMeta, cmpConstructor) {
    const style = cmpConstructor.style;
    if (style) {
        // we got a style mode for this component, let's create an id for this style
        const styleModeId = cmpConstructor.is + (cmpConstructor.styleMode || DEFAULT_STYLE_MODE);
        if (!cmpMeta[styleModeId]) {
            // we don't have this style mode id initialized yet
            if (Build.es5) {
                // ie11's template polyfill doesn't fully do the trick and there's still issues
                // so instead of trying to clone templates with styles in them, we'll just
                // keep a map of the style text as a string to create <style> elements for es5 builds
                cmpMeta[styleModeId] = style;
            }
            else {
                // use <template> elements to clone styles
                // create the template element which will hold the styles
                // adding it to the dom via <template> so that we can
                // clone this for each potential shadow root that will need these styles
                // otherwise it'll be cloned and added to document.body.head
                // but that's for the renderer to figure out later
                const templateElm = domApi.$createElement('template');
                // keep a reference to this template element within the
                // Constructor using the style mode id as the key
                cmpMeta[styleModeId] = templateElm;
                // add the style text to the template element's innerHTML
                templateElm.innerHTML = `<style>${style}</style>`;
                // add our new template element to the head
                // so it can be cloned later
                domApi.$appendChild(domApi.$head, templateElm);
            }
        }
    }
}
function attachStyles(plt, domApi, cmpMeta, modeName, elm, customStyle, styleElm) {
    // first see if we've got a style for a specific mode
    let styleModeId = cmpMeta.tagNameMeta + (modeName || DEFAULT_STYLE_MODE);
    let styleTemplate = cmpMeta[styleModeId];
    if (!styleTemplate) {
        // didn't find a style for this mode
        // now let's check if there's a default style for this component
        styleModeId = cmpMeta.tagNameMeta + DEFAULT_STYLE_MODE;
        styleTemplate = cmpMeta[styleModeId];
    }
    if (styleTemplate) {
        // cool, we found a style template element for this component
        let styleContainerNode = domApi.$head;
        // if this browser supports shadow dom, then let's climb up
        // the dom and see if we're within a shadow dom
        if (domApi.$supportsShadowDom) {
            if (cmpMeta.encapsulation === 1 /* ShadowDom */) {
                // we already know we're in a shadow dom
                // so shadow root is the container for these styles
                styleContainerNode = elm.shadowRoot;
            }
            else {
                // climb up the dom and see if we're in a shadow dom
                while (elm = domApi.$parentNode(elm)) {
                    if (elm.host && elm.host.shadowRoot) {
                        // looks like we are in shadow dom, let's use
                        // this shadow root as the container for these styles
                        styleContainerNode = (elm.host.shadowRoot);
                        break;
                    }
                }
            }
        }
        // if this container element already has these styles
        // then there's no need to apply them again
        // create an object to keep track if we'ready applied this component style
        const appliedStyles = plt.componentAppliedStyles.get(styleContainerNode) || {};
        if (!appliedStyles[styleModeId]) {
            // looks like we haven't applied these styles to this container yet
            if (Build.es5) {
                // es5 builds are not usig <template> because of ie11 issues
                // instead the "template" is just the style text as a string
                // create a new style element and add as innerHTML
                styleElm = domApi.$createElement('style');
                styleElm.innerHTML = styleTemplate;
                if (Build.cssVarShim && customStyle && !customStyle.supportsCssVars) {
                    customStyle.addStyle(styleElm);
                }
            }
            else {
                // this browser supports the <template> element
                // and all its native content.cloneNode() goodness
                // clone the template element to create a new <style> element
                styleElm = styleTemplate.content.cloneNode(true);
            }
            // let's make sure we put the styles below the <style data-styles> element
            // so any visibility css overrides the default
            const dataStyles = styleContainerNode.querySelectorAll('[data-styles]');
            domApi.$insertBefore(styleContainerNode, styleElm, (dataStyles.length && dataStyles[dataStyles.length - 1].nextSibling) || styleContainerNode.firstChild);
            // remember we don't need to do this again for this element
            appliedStyles[styleModeId] = true;
            plt.componentAppliedStyles.set(styleContainerNode, appliedStyles);
        }
    }
}

const isDef = (v) => v !== undefined && v !== null;
const isUndef = (v) => v === undefined || v === null;
const toLowerCase = (str) => str.toLowerCase();
const toDashCase = (str) => toLowerCase(str.replace(/([A-Z0-9])/g, g => ' ' + g[0]).trim().replace(/ /g, '-'));
const dashToPascalCase = (str) => toLowerCase(str).split('-').map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('');
const noop = () => { };

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

function parseComponentLoader(cmpRegistryData, cmpRegistry, i, d) {
    // tag name will always be lower case
    const cmpMeta = {
        tagNameMeta: cmpRegistryData[0],
        membersMeta: {
            // every component defaults to always have
            // the mode and color properties
            // but only color should observe any attribute changes
            'color': { attribName: 'color' }
        }
    };
    // map of the bundle ids
    // can contain modes, and array of esm and es5 bundle ids
    cmpMeta.bundleIds = cmpRegistryData[1];
    // parse member meta
    // this data only includes props that are attributes that need to be observed
    // it does not include all of the props yet
    const memberData = cmpRegistryData[3];
    if (memberData) {
        for (i = 0; i < memberData.length; i++) {
            d = memberData[i];
            cmpMeta.membersMeta[d[0]] = {
                memberType: d[1],
                attribName: typeof d[2] === 'string' ? d[2] : d[2] ? d[0] : 0,
                propType: d[3]
            };
        }
    }
    // encapsulation
    cmpMeta.encapsulation = cmpRegistryData[4];
    if (cmpRegistryData[5]) {
        // parse listener meta
        cmpMeta.listenersMeta = cmpRegistryData[5].map(parseListenerData);
    }
    return cmpRegistry[cmpMeta.tagNameMeta] = cmpMeta;
}
function parseListenerData(listenerData) {
    return {
        eventName: listenerData[0],
        eventMethodName: listenerData[1],
        eventDisabled: !!listenerData[2],
        eventPassive: !!listenerData[3],
        eventCapture: !!listenerData[4]
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

function createVNodesFromSsr(plt, domApi, rootElm) {
    const allSsrElms = rootElm.querySelectorAll(`[${SSR_VNODE_ID}]`);
    const ilen = allSsrElms.length;
    let elm, ssrVNodeId, ssrVNode, i, j, jlen;
    if (ilen > 0) {
        plt.hasLoadedMap.set(rootElm, true);
        for (i = 0; i < ilen; i++) {
            elm = allSsrElms[i];
            ssrVNodeId = domApi.$getAttribute(elm, SSR_VNODE_ID);
            ssrVNode = new VNode();
            ssrVNode.vtag = domApi.$tagName(ssrVNode.elm = elm);
            plt.vnodeMap.set(elm, ssrVNode);
            for (j = 0, jlen = elm.childNodes.length; j < jlen; j++) {
                addChildSsrVNodes(domApi, elm.childNodes[j], ssrVNode, ssrVNodeId, true);
            }
        }
    }
}
function addChildSsrVNodes(domApi, node, parentVNode, ssrVNodeId, checkNestedElements) {
    const nodeType = domApi.$nodeType(node);
    let previousComment;
    let childVNodeId, childVNodeSplt, childVNode;
    if (checkNestedElements && nodeType === 1 /* ElementNode */) {
        childVNodeId = domApi.$getAttribute(node, SSR_CHILD_ID);
        if (childVNodeId) {
            // split the start comment's data with a period
            childVNodeSplt = childVNodeId.split('.');
            // ensure this this element is a child element of the ssr vnode
            if (childVNodeSplt[0] === ssrVNodeId) {
                // cool, this element is a child to the parent vnode
                childVNode = new VNode();
                childVNode.vtag = domApi.$tagName(childVNode.elm = node);
                // this is a new child vnode
                // so ensure its parent vnode has the vchildren array
                if (!parentVNode.vchildren) {
                    parentVNode.vchildren = [];
                }
                // add our child vnode to a specific index of the vnode's children
                parentVNode.vchildren[childVNodeSplt[1]] = childVNode;
                // this is now the new parent vnode for all the next child checks
                parentVNode = childVNode;
                // if there's a trailing period, then it means there aren't any
                // more nested elements, but maybe nested text nodes
                // either way, don't keep walking down the tree after this next call
                checkNestedElements = (childVNodeSplt[2] !== '');
            }
        }
        // keep drilling down through the elements
        for (let i = 0; i < node.childNodes.length; i++) {
            addChildSsrVNodes(domApi, node.childNodes[i], parentVNode, ssrVNodeId, checkNestedElements);
        }
    }
    else if (nodeType === 3 /* TextNode */ &&
        (previousComment = node.previousSibling) &&
        domApi.$nodeType(previousComment) === 8 /* CommentNode */) {
        // split the start comment's data with a period
        childVNodeSplt = domApi.$getTextContent(previousComment).split('.');
        // ensure this is an ssr text node start comment
        // which should start with an "s" and delimited by periods
        if (childVNodeSplt[0] === 's' && childVNodeSplt[1] === ssrVNodeId) {
            // cool, this is a text node and it's got a start comment
            childVNode = t(domApi.$getTextContent(node));
            childVNode.elm = node;
            // this is a new child vnode
            // so ensure its parent vnode has the vchildren array
            if (!parentVNode.vchildren) {
                parentVNode.vchildren = [];
            }
            // add our child vnode to a specific index of the vnode's children
            parentVNode.vchildren[childVNodeSplt[2]] = childVNode;
        }
    }
}

function createQueueClient(App, win, resolvePending, rafPending) {
    const now = () => win.performance.now();
    const highPromise = Promise.resolve();
    const highPriority = [];
    const lowPriority = [];
    if (!App.raf) {
        App.raf = window.requestAnimationFrame.bind(window);
    }
    function doHighPriority() {
        // holy geez we need to get this stuff done and fast
        // all high priority callbacks should be fired off immediately
        while (highPriority.length > 0) {
            highPriority.shift()();
        }
        resolvePending = false;
    }
    function doWork(start) {
        start = now();
        // always run all of the high priority work if there is any
        doHighPriority();
        while (lowPriority.length > 0 && (now() - start < 40)) {
            lowPriority.shift()();
        }
        // check to see if we still have work to do
        if (rafPending = (lowPriority.length > 0)) {
            // everyone just settle down now
            // we already don't have time to do anything in this callback
            // let's throw the next one in a requestAnimationFrame
            // so we can just simmer down for a bit
            App.raf(flush);
        }
    }
    function flush(start) {
        // always run all of the high priority work if there is any
        doHighPriority();
        // always force a bunch of medium callbacks to run, but still have
        // a throttle on how many can run in a certain time
        start = 4 + now();
        while (lowPriority.length > 0 && (now() < start)) {
            lowPriority.shift()();
        }
        if (rafPending = (lowPriority.length > 0)) {
            // still more to do yet, but we've run out of time
            // let's let this thing cool off and try again in the next ric
            App.raf(doWork);
        }
    }
    return {
        add: (cb, priority) => {
            if (priority === 3 /* High */) {
                // uses Promise.resolve() for next tick
                highPriority.push(cb);
                if (!resolvePending) {
                    // not already pending work to do, so let's tee it up
                    resolvePending = true;
                    highPromise.then(doHighPriority);
                }
            }
            else {
                // defaults to low priority
                // uses requestAnimationFrame
                lowPriority.push(cb);
                if (!rafPending) {
                    // not already pending work to do, so let's tee it up
                    rafPending = true;
                    App.raf(doWork);
                }
            }
        }
    };
}

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
function enableEventListener(plt, instance, eventName, shouldEnable, attachTo, passive) {
    if (instance) {
        // cool, we've got an instance, it's get the element it's on
        const elm = plt.hostElementMap.get(instance);
        const cmpMeta = plt.getComponentMeta(elm);
        if (cmpMeta && cmpMeta.listenersMeta) {
            // alrighty, so this cmp has listener meta
            if (shouldEnable) {
                // we want to enable this event
                // find which listen meta we're talking about
                const listenMeta = cmpMeta.listenersMeta.find(l => l.eventName === eventName);
                if (listenMeta) {
                    // found the listen meta, so let's add the listener
                    plt.domApi.$addEventListener(elm, eventName, (ev) => instance[listenMeta.eventMethodName](ev), listenMeta.eventCapture, (passive === undefined) ? listenMeta.eventPassive : !!passive, attachTo);
                }
            }
            else {
                // we're disabling the event listener
                // so let's just remove it entirely
                plt.domApi.$removeEventListener(elm, eventName);
            }
        }
    }
}

function generateDevInspector(App, namespace, win, plt) {
    const devInspector = win.devInspector = (win.devInspector || {});
    devInspector.apps = devInspector.apps || [];
    devInspector.apps.push(generateDevInspectorApp(App, namespace, plt));
    if (!devInspector.getInstance) {
        devInspector.getInstance = (elm) => {
            return Promise.all(devInspector.apps.map(app => {
                return app.getInstance(elm);
            })).then(results => {
                return results.find(instance => !!instance);
            });
        };
    }
    if (!devInspector.getComponents) {
        devInspector.getComponents = () => {
            const appsMetadata = [];
            devInspector.apps.forEach(app => {
                appsMetadata.push(app.getComponents());
            });
            return Promise.all(appsMetadata).then(appMetadata => {
                const allMetadata = [];
                appMetadata.forEach(metadata => {
                    metadata.forEach(m => {
                        allMetadata.push(m);
                    });
                });
                return allMetadata;
            });
        };
    }
    return devInspector;
}
function generateDevInspectorApp(App, namespace, plt) {
    const app = {
        namespace: namespace,
        getInstance: (elm) => {
            if (elm && elm.tagName) {
                return Promise.all([
                    getComponentMeta(plt, elm.tagName),
                    getComponentInstance(plt, elm)
                ]).then(results => {
                    if (results[0] && results[1]) {
                        const cmp = {
                            meta: results[0],
                            instance: results[1]
                        };
                        return cmp;
                    }
                    return null;
                });
            }
            return Promise.resolve(null);
        },
        getComponent: (tagName) => {
            return getComponentMeta(plt, tagName);
        },
        getComponents: () => {
            return Promise.all(App.components.map(cmp => {
                return getComponentMeta(plt, cmp[0]);
            })).then(metadata => {
                return metadata.filter(m => m);
            });
        }
    };
    return app;
}
function getMembersMeta(properties) {
    return Object.keys(properties).reduce((membersMap, memberKey) => {
        const prop = properties[memberKey];
        let category;
        const member = {
            name: memberKey
        };
        if (prop.state) {
            category = 'states';
            member.watchers = prop.watchCallbacks || [];
        }
        else if (prop.elementRef) {
            category = 'elements';
        }
        else if (prop.method) {
            category = 'methods';
        }
        else {
            category = 'props';
            let type = 'any';
            if (prop.type) {
                type = prop.type;
                if (typeof prop.type === 'function') {
                    type = prop.type.name;
                }
            }
            member.type = type.toLowerCase();
            member.mutable = prop.mutable || false;
            member.connect = prop.connect || '-';
            member.context = prop.connect || '-';
            member.watchers = prop.watchCallbacks || [];
        }
        membersMap[category].push(member);
        return membersMap;
    }, {
        props: [],
        states: [],
        elements: [],
        methods: []
    });
}
function getComponentMeta(plt, tagName) {
    const elm = { tagName: tagName };
    const internalMeta = plt.getComponentMeta(elm);
    if (!internalMeta || !internalMeta.componentConstructor) {
        return Promise.resolve(null);
    }
    const cmpCtr = internalMeta.componentConstructor;
    const members = getMembersMeta(cmpCtr.properties || {});
    const listeners = (internalMeta.listenersMeta || []).map(listenerMeta => {
        return {
            event: listenerMeta.eventName,
            capture: listenerMeta.eventCapture,
            disabled: listenerMeta.eventDisabled,
            passive: listenerMeta.eventPassive,
            method: listenerMeta.eventMethodName
        };
    });
    const emmiters = cmpCtr.events || [];
    const meta = Object.assign({ tag: cmpCtr.is, bundle: internalMeta.bundleIds || 'unknown', encapsulation: cmpCtr.encapsulation || 'none' }, members, { events: {
            emmiters,
            listeners
        } });
    return Promise.resolve(meta);
}
function getComponentInstance(plt, elm) {
    return Promise.resolve(plt.instanceMap.get(elm));
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

function useShadowDom(supportsNativeShadowDom, cmpMeta) {
    return (supportsNativeShadowDom && cmpMeta.encapsulation === 1 /* ShadowDom */);
}
function useScopedCss(supportsNativeShadowDom, cmpMeta) {
    if (cmpMeta.encapsulation === 2 /* ScopedCss */) {
        return true;
    }
    if (cmpMeta.encapsulation === 1 /* ShadowDom */ && !supportsNativeShadowDom) {
        return true;
    }
    return false;
}

function createPlatformClient(namespace, Context, win, doc, resourcesUrl, hydratedCssClass) {
    const cmpRegistry = { 'html': {} };
    const controllerComponents = {};
    const App = win[namespace] = win[namespace] || {};
    const domApi = createDomApi(App, win, doc);
    // set App Context
    Context.isServer = Context.isPrerender = !(Context.isClient = true);
    Context.window = win;
    Context.location = win.location;
    Context.document = doc;
    Context.resourcesUrl = Context.publicPath = resourcesUrl;
    if (Build.listener) {
        Context.enableListener = (instance, eventName, enabled, attachTo, passive) => enableEventListener(plt, instance, eventName, enabled, attachTo, passive);
    }
    if (Build.event) {
        Context.emit = (elm, eventName, data) => domApi.$dispatchEvent(elm, Context.eventNameFn ? Context.eventNameFn(eventName) : eventName, data);
    }
    // add the h() fn to the app's global namespace
    App.h = h;
    App.Context = Context;
    // keep a global set of tags we've already defined
    const globalDefined = win.$definedCmps = win.$definedCmps || {};
    // create the platform api which is used throughout common core code
    const plt = {
        connectHostElement,
        domApi,
        defineComponent,
        emitEvent: Context.emit,
        getComponentMeta: elm => cmpRegistry[domApi.$tagName(elm)],
        getContextItem: contextKey => Context[contextKey],
        isClient: true,
        isDefinedComponent: (elm) => !!(globalDefined[domApi.$tagName(elm)] || plt.getComponentMeta(elm)),
        loadBundle,
        onError: (err, type, elm) => console.error(err, type, elm && elm.tagName),
        propConnect: ctrlTag => proxyController(domApi, controllerComponents, ctrlTag),
        queue: createQueueClient(App, win),
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
    // create the renderer that will be used
    plt.render = createRendererPatch(plt, domApi);
    // setup the root element which is the mighty <html> tag
    // the <html> has the final say of when the app has loaded
    const rootElm = domApi.$documentElement;
    rootElm.$rendered = true;
    rootElm.$activeLoading = [];
    // this will fire when all components have finished loaded
    rootElm.$initLoad = () => {
        plt.hasLoadedMap.set(rootElm, App.loaded = plt.isAppLoaded = true);
        domApi.$dispatchEvent(win, 'appload', { detail: { namespace: namespace } });
    };
    // if the HTML was generated from SSR
    // then let's walk the tree and generate vnodes out of the data
    createVNodesFromSsr(plt, domApi, rootElm);
    function connectHostElement(cmpMeta, elm) {
        // set the "mode" property
        if (!elm.mode) {
            // looks like mode wasn't set as a property directly yet
            // first check if there's an attribute
            // next check the app's global
            elm.mode = domApi.$getAttribute(elm, 'mode') || Context.mode;
        }
        // host element has been connected to the DOM
        if (!domApi.$getAttribute(elm, SSR_VNODE_ID) && !useShadowDom(domApi.$supportsShadowDom, cmpMeta)) {
            // only required when we're NOT using native shadow dom (slot)
            // this host element was NOT created with SSR
            // let's pick out the inner content for slot projection
            assignHostContentSlots(plt, domApi, elm, elm.childNodes);
        }
        if (!domApi.$supportsShadowDom && cmpMeta.encapsulation === 1 /* ShadowDom */) {
            // this component should use shadow dom
            // but this browser doesn't support it
            // so let's polyfill a few things for the user
            elm.shadowRoot = elm;
        }
    }
    function defineComponent(cmpMeta, HostElementConstructor) {
        if (!globalDefined[cmpMeta.tagNameMeta]) {
            // keep a map of all the defined components
            globalDefined[cmpMeta.tagNameMeta] = true;
            // initialize the members on the host element prototype
            initHostElement(plt, cmpMeta, HostElementConstructor.prototype, hydratedCssClass);
            if (Build.observeAttr) {
                // add which attributes should be observed
                const observedAttributes = [];
                // at this point the membersMeta only includes attributes which should
                // be observed, it does not include all props yet, so it's safe to
                // loop through all of the props (attrs) and observed them
                for (const propName in cmpMeta.membersMeta) {
                    // initialize the actual attribute name used vs. the prop name
                    // for example, "myProp" would be "my-prop" as an attribute
                    // and these can be configured to be all lower case or dash case (default)
                    if (cmpMeta.membersMeta[propName].attribName) {
                        observedAttributes.push(
                        // dynamically generate the attribute name from the prop name
                        // also add it to our array of attributes we need to observe
                        cmpMeta.membersMeta[propName].attribName);
                    }
                }
                // set the array of all the attributes to keep an eye on
                // https://www.youtube.com/watch?v=RBs21CFBALI
                HostElementConstructor.observedAttributes = observedAttributes;
            }
            // define the custom element
            win.customElements.define(cmpMeta.tagNameMeta, HostElementConstructor);
        }
    }
    function loadBundle(cmpMeta, modeName, cb) {
        if (cmpMeta.componentConstructor) {
            // we're already all loaded up :)
            cb();
        }
        else {
            const bundleId = (typeof cmpMeta.bundleIds === 'string') ?
                cmpMeta.bundleIds :
                cmpMeta.bundleIds[modeName];
            const url = resourcesUrl + bundleId + ((useScopedCss(domApi.$supportsShadowDom, cmpMeta) ? '.sc' : '') + '.js');
            // dynamic es module import() => woot!
            import(url).then(importedModule => {
                // async loading of the module is done
                try {
                    // get the component constructor from the module
                    cmpMeta.componentConstructor = importedModule[dashToPascalCase(cmpMeta.tagNameMeta)];
                    // initialize this component constructor's styles
                    // it is possible for the same component to have difficult styles applied in the same app
                    initStyleTemplate(domApi, cmpMeta, cmpMeta.componentConstructor);
                }
                catch (e) {
                    // oh man, something's up
                    console.error(e);
                    // provide a bogus component constructor
                    // so the rest of the app acts as normal
                    cmpMeta.componentConstructor = class {
                    };
                }
                // bundle all loaded up, let's continue
                cb();
            }).catch(err => console.error(err, url));
        }
    }
    if (Build.styles) {
        plt.attachStyles = attachStyles;
    }
    if (Build.devInspector) {
        generateDevInspector(App, namespace, window, plt);
    }
    // register all the components now that everything's ready
    // standard es2015 class extends HTMLElement
    (App.components || [])
        .map(data => parseComponentLoader(data, cmpRegistry))
        .forEach(cmpMeta => plt.defineComponent(cmpMeta, class extends HTMLElement {
    }));
    // notify that the app has initialized and the core script is ready
    // but note that the components have not fully loaded yet, that's the "appload" event
    App.initialized = true;
    domApi.$dispatchEvent(window, 'appinit', { detail: { namespace: namespace } });
}

/*
Extremely simple css parser. Intended to be not more than what we need
and definitely not necessarily correct =).
*/
/* tslint:disable */
class StyleNode {
    constructor() {
        this.rules = null;
        this.start = 0;
        this.end = 0;
        this.parent = null;
        this.previous = null;
        this.parsedCssText = '';
        this.cssText = '';
        this.parsedSelector = '';
        this.atRule = false;
        this.selector = '';
        this.type = 0;
        this.keyframesName = '';
    }
}
// given a string of css, return a simple rule tree
function parse(text) {
    text = clean(text);
    return parseCss(lex(text), text);
}
// remove stuff we don't care about that may hinder parsing
function clean(cssText) {
    return cssText.replace(COMMENTS_RX, '').replace(PORT_RX, '');
}
// super simple {...} lexer that returns a node tree
function lex(text) {
    let root = new StyleNode();
    root.start = 0;
    root.end = text.length;
    let n = root;
    for (let i = 0, l = text.length; i < l; i++) {
        if (text[i] === OPEN_BRACE) {
            if (!n.rules) {
                n.rules = [];
            }
            let p = n;
            let previous = p.rules[p.rules.length - 1] || null;
            n = new StyleNode();
            n.start = i + 1;
            n.parent = p;
            n.previous = previous;
            p.rules.push(n);
        }
        else if (text[i] === CLOSE_BRACE) {
            n.end = i + 1;
            n = n.parent || root;
        }
    }
    return root;
}
// add selectors/cssText to node tree
function parseCss(node, text) {
    let t = text.substring(node.start, node.end - 1);
    node.parsedCssText = node.cssText = t.trim();
    if (node.parent) {
        let ss = node.previous ? node.previous.end : node.parent.start;
        t = text.substring(ss, node.start - 1);
        t = _expandUnicodeEscapes(t);
        t = t.replace(MULTI_SPACES_RX, ' ');
        t = t.substring(t.lastIndexOf(';') + 1);
        let s = node.parsedSelector = node.selector = t.trim();
        node.atRule = (s.indexOf(AT_START) === 0);
        // note, support a subset of rule types...
        if (node.atRule) {
            if (s.indexOf(MEDIA_START) === 0) {
                node.type = 4 /* MEDIA_RULE */;
            }
            else if (s.match(KEYFRAMES_RULE_RX)) {
                node.type = 7 /* KEYFRAMES_RULE */;
                node.keyframesName = node.selector.split(MULTI_SPACES_RX).pop();
            }
        }
        else {
            if (s.indexOf(VAR_START) === 0) {
                node.type = 1000 /* MIXIN_RULE */;
            }
            else {
                node.type = 1 /* STYLE_RULE */;
            }
        }
    }
    let r$ = node.rules;
    if (r$) {
        for (let i = 0, l = r$.length, r; (i < l) && (r = r$[i]); i++) {
            parseCss(r, text);
        }
    }
    return node;
}
/**
 * conversion of sort unicode escapes with spaces like `\33 ` (and longer) into
 * expanded form that doesn't require trailing space `\000033`
 */
function _expandUnicodeEscapes(s) {
    return s.replace(/\\([0-9a-f]{1,6})\s/gi, function () {
        let code = arguments[1], repeat = 6 - code.length;
        while (repeat--) {
            code = '0' + code;
        }
        return '\\' + code;
    });
}
/**
 * stringify parsed css.
 */
function stringify(node, preserveProperties, text = '') {
    // calc rule cssText
    let cssText = '';
    if (node.cssText || node.rules) {
        let r$ = node.rules;
        if (r$) {
            for (let i = 0, l = r$.length, r; (i < l) && (r = r$[i]); i++) {
                cssText = stringify(r, preserveProperties, cssText);
            }
        }
        else {
            cssText = preserveProperties ? node.cssText :
                removeCustomProps(node.cssText);
            cssText = cssText.trim();
            if (cssText) {
                cssText = '  ' + cssText + '\n';
            }
        }
    }
    // emit rule if there is cssText
    if (cssText) {
        if (node.selector) {
            text += node.selector + ' ' + OPEN_BRACE + '\n';
        }
        text += cssText;
        if (node.selector) {
            text += CLOSE_BRACE + '\n\n';
        }
    }
    return text;
}
function removeCustomProps(cssText) {
    cssText = removeCustomPropAssignment(cssText);
    return removeCustomPropApply(cssText);
}
function removeCustomPropAssignment(cssText) {
    return cssText.replace(CUSTOM_PROP_RX, '');
}
function removeCustomPropApply(cssText) {
    return cssText.replace(VAR_APPLY_RX, '');
}
class StyleInfo {
    static get(node) {
        if (node) {
            return node[infoKey];
        }
        else {
            return null;
        }
    }
    static set(node, styleInfo) {
        node[infoKey] = styleInfo;
        return styleInfo;
    }
    constructor(ast) {
        this.styleRules = ast || null;
        this.styleProperties = null;
    }
}
const OPEN_BRACE = '{';
const CLOSE_BRACE = '}';
// helper regexp's
const COMMENTS_RX = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim;
const PORT_RX = /@import[^;]*;/gim;
const CUSTOM_PROP_RX = /(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?(?:[;\n]|$)/gim;
const VAR_APPLY_RX = /[^;:]*?:[^;]*?var\([^;]*\)(?:[;\n]|$)?/gim;
const KEYFRAMES_RULE_RX = /^@[^\s]*keyframes/;
const MULTI_SPACES_RX = /\s+/g;
const VAR_START = '--';
const MEDIA_START = '@media';
const AT_START = '@';
const infoKey = '__styleInfo';

function toCssText(win, rules, callback) {
    if (!rules) {
        return '';
    }
    if (typeof rules === 'string') {
        rules = parse(rules);
    }
    if (callback) {
        forEachRule(win, rules, callback);
    }
    return stringify(rules, false);
}
function rulesForStyle(style) {
    if (!style.__cssRules && style.textContent) {
        style.__cssRules = parse(style.textContent);
    }
    return style.__cssRules || null;
}
function forEachRule(win, node, styleRuleCallback, keyframesRuleCallback, onlyActiveRules) {
    if (!node) {
        return;
    }
    let skipRules = false;
    const type = node.type;
    if (onlyActiveRules) {
        if (type === 4 /* MEDIA_RULE */) {
            const matchMedia = node.selector.match(MEDIA_MATCH);
            if (matchMedia) {
                // if rule is a non matching @media rule, skip subrules
                if (!win.matchMedia(matchMedia[1]).matches) {
                    skipRules = true;
                }
            }
        }
    }
    if (type === 1 /* STYLE_RULE */) {
        styleRuleCallback(node);
    }
    else if (keyframesRuleCallback &&
        type === 7 /* KEYFRAMES_RULE */) {
        keyframesRuleCallback(node);
    }
    else if (type === 1000 /* MIXIN_RULE */) {
        skipRules = true;
    }
    const r$ = node.rules;
    if (r$ && !skipRules) {
        for (let i = 0, l = r$.length, r; (i < l) && (r = r$[i]); i++) {
            forEachRule(win, r, styleRuleCallback, keyframesRuleCallback, onlyActiveRules);
        }
    }
}
/**
 * Walk from text[start] matching parens and
 * returns position of the outer end paren
 */
function findMatchingParen(text, start) {
    let level = 0;
    for (let i = start, l = text.length; i < l; i++) {
        if (text[i] === '(') {
            level++;
        }
        else if (text[i] === ')') {
            if (--level === 0) {
                return i;
            }
        }
    }
    return -1;
}
function processVariableAndFallback(str, callback) {
    // find 'var('
    const start = str.indexOf('var(');
    if (start === -1) {
        // no var?, everything is prefix
        return callback(str, '', '', '');
    }
    // ${prefix}var(${inner})${suffix}
    const end = findMatchingParen(str, start + 3);
    const inner = str.substring(start + 4, end);
    const prefix = str.substring(0, start);
    // suffix may have other variables
    const suffix = processVariableAndFallback(str.substring(end + 1), callback);
    const comma = inner.indexOf(',');
    // value and fallback args should be trimmed to match in property lookup
    if (comma === -1) {
        // variable, no fallback
        return callback(prefix, inner.trim(), '', suffix);
    }
    // var(${value},${fallback})
    const value = inner.substring(0, comma).trim();
    const fallback = inner.substring(comma + 1).trim();
    return callback(prefix, value, fallback, suffix);
}
const MEDIA_MATCH = /@media\s(.*)/;

/* tslint:disable */
class StyleProperties {
    constructor(win) {
        this.win = win;
        this.matchesSelector = ((p) => p.matches || p.matchesSelector ||
            p.mozMatchesSelector || p.msMatchesSelector ||
            p.webkitMatchesSelector)(win.Element.prototype);
    }
    // decorate a single rule with property info
    decorateRule(rule) {
        if (rule.propertyInfo) {
            return rule.propertyInfo;
        }
        let info = {}, properties = {};
        let hasProperties = this.collectProperties(rule, properties);
        if (hasProperties) {
            info.properties = properties;
            // TODO(sorvell): workaround parser seeing mixins as additional rules
            rule.rules = null;
        }
        info.cssText = rule.parsedCssText;
        rule.propertyInfo = info;
        return info;
    }
    // collects the custom properties from a rule's cssText
    collectProperties(rule, properties) {
        let info = rule.propertyInfo;
        if (info) {
            if (info.properties) {
                Object.assign(properties, info.properties);
                return true;
            }
        }
        else {
            let m;
            let cssText = rule.parsedCssText;
            let value;
            let a;
            while ((m = VAR_ASSIGN.exec(cssText))) {
                // note: group 2 is var, 3 is mixin
                value = (m[2] || m[3]).trim();
                // value of 'inherit' or 'unset' is equivalent to not setting the property here
                if (value !== 'inherit' || value !== 'unset') {
                    properties[m[1].trim()] = value;
                }
                a = true;
            }
            return a;
        }
    }
    // turns custom properties into realized values.
    reify(props) {
        // big perf optimization here: reify only *own* properties
        // since this object has __proto__ of the element's scope properties
        let names = Object.getOwnPropertyNames(props);
        for (let i = 0, n; i < names.length; i++) {
            n = names[i];
            props[n] = this.valueForProperty(props[n], props);
        }
    }
    // given a property value, returns the reified value
    // a property value may be:
    // (1) a literal value like: red or 5px;
    // (2) a variable value like: var(--a), var(--a, red), or var(--a, --b) or
    // var(--a, var(--b));
    valueForProperty(property, props) {
        // case (1) default
        if (property) {
            if (property.indexOf(';') >= 0) {
                property = this.valueForProperties(property, props);
            }
            else {
                // case (2) variable
                let fn = (prefix, value, fallback, suffix) => {
                    if (!value) {
                        return prefix + suffix;
                    }
                    let propertyValue = this.valueForProperty(props[value], props);
                    // if value is "initial", then the variable should be treated as unset
                    if (!propertyValue || propertyValue === 'initial') {
                        // fallback may be --a or var(--a) or literal
                        propertyValue = this.valueForProperty(props[fallback] || fallback, props) || fallback;
                    }
                    return prefix + (propertyValue || '') + suffix;
                };
                property = processVariableAndFallback(property, fn);
            }
        }
        return property && property.trim() || '';
    }
    // note: we do not yet support mixin within mixin
    valueForProperties(property, props) {
        let parts = property.split(';');
        for (let i = 0, p; i < parts.length; i++) {
            if ((p = parts[i])) {
                let colon = p.indexOf(':');
                if (colon !== -1) {
                    let pp = p.substring(colon);
                    pp = pp.trim();
                    pp = this.valueForProperty(pp, props) || pp;
                    p = p.substring(0, colon) + pp;
                }
                parts[i] = (p && p.lastIndexOf(';') === p.length - 1) ?
                    // strip trailing ;
                    p.slice(0, -1) :
                    p || '';
            }
        }
        return parts.join(';');
    }
    // Test if the rules in these styles matches the given `element` and if so,
    // collect any custom properties into `props`.
    propertyDataFromStyles(rules, element) {
        let props = {};
        // generates a unique key for these matches
        let o = [];
        // note: active rules excludes non-matching @media rules
        forEachRule(this.win, rules, (rule) => {
            // TODO(sorvell): we could trim the set of rules at declaration
            // time to only include ones that have properties
            if (!rule.propertyInfo) {
                this.decorateRule(rule);
            }
            // match element against transformedSelector: selector may contain
            // unwanted uniquification and parsedSelector does not directly match
            // for :host selectors.
            try {
                let selectorToMatch = rule.transformedSelector || rule.parsedSelector;
                if (element && rule.propertyInfo.properties && selectorToMatch) {
                    if (this.matchesSelector.call(element, selectorToMatch)) {
                        this.collectProperties(rule, props);
                        // produce numeric key for these matches for lookup
                        addToBitMask(rule.index, o);
                    }
                }
            }
            catch (e) {
                console.error(e);
            }
        }, null, true);
        return { properties: props, key: o };
    }
    applyCustomStyle(style, properties) {
        let rules = rulesForStyle(style);
        style.textContent = toCssText(this.win, rules, (rule) => {
            let css = rule.cssText = rule.parsedCssText;
            if (rule.propertyInfo && rule.propertyInfo.cssText) {
                // remove property assignments
                // so next function isn't confused
                // NOTE: we have 3 categories of css:
                // (1) normal properties,
                // (2) custom property assignments (--foo: red;),
                // (3) custom property usage: border: var(--foo); @apply(--foo);
                // In elements, 1 and 3 are separated for efficiency; here they
                // are not and this makes this case unique.
                css = removeCustomPropAssignment(css);
                // replace with reified properties, scenario is same as mixin
                rule.cssText = this.valueForProperties(css, properties);
            }
        });
    }
}
function addToBitMask(n, bits) {
    let o = parseInt((n / 32), 10);
    let v = 1 << (n % 32);
    bits[o] = (bits[o] || 0) | v;
}
const VAR_ASSIGN = /(?:^|[;\s{]\s*)(--[\w-]*?)\s*:\s*(?:((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};{])+)|\{([^}]*)\}(?:(?=[;\s}])|$))/gi;

class CustomStyle {
    constructor(win, doc) {
        this.win = win;
        this.customStyles = [];
        this.enqueued = false;
        this.flushCallbacks = [];
        this.supportsCssVars = !!(win.CSS && win.CSS.supports && win.CSS.supports('color', 'var(--c)'));
        if (!this.supportsCssVars) {
            this.documentOwner = doc.documentElement;
            const ast = new StyleNode();
            ast.rules = [];
            this.documentOwnerStyleInfo = StyleInfo.set(this.documentOwner, new StyleInfo(ast));
            this.styleProperties = new StyleProperties(win);
        }
    }
    flushCustomStyles() {
        const customStyles = this.processStyles();
        // early return if custom-styles don't need validation
        if (!this.enqueued) {
            return;
        }
        this.updateProperties(this.documentOwner, this.documentOwnerStyleInfo);
        this.applyCustomStyles(customStyles);
        this.enqueued = false;
        while (this.flushCallbacks.length) {
            this.flushCallbacks.shift()();
        }
    }
    applyCustomStyles(customStyles) {
        for (let i = 0; i < customStyles.length; i++) {
            const c = customStyles[i];
            const s = this.getStyleForCustomStyle(c);
            if (s) {
                this.styleProperties.applyCustomStyle(s, this.documentOwnerStyleInfo.styleProperties);
            }
        }
    }
    updateProperties(host, styleInfo) {
        const owner = this.documentOwner;
        const ownerStyleInfo = StyleInfo.get(owner);
        const ownerProperties = ownerStyleInfo.styleProperties;
        const props = Object.create(ownerProperties || null);
        const propertyData = this.styleProperties.propertyDataFromStyles(ownerStyleInfo.styleRules, host);
        const propertiesMatchingHost = propertyData.properties;
        Object.assign(props, propertiesMatchingHost);
        this.styleProperties.reify(props);
        styleInfo.styleProperties = props;
    }
    addStyle(style) {
        return new Promise(resolve => {
            if (!style.__seen) {
                style.__seen = true;
                this.customStyles.push(style);
                this.flushCallbacks.push(resolve);
                if (!this.enqueued) {
                    this.enqueued = true;
                    this.win.requestAnimationFrame(() => {
                        if (this.enqueued) {
                            this.flushCustomStyles();
                        }
                    });
                }
            }
            else {
                resolve();
            }
        });
    }
    getStyleForCustomStyle(customStyle) {
        if (customStyle.__cached) {
            return customStyle.__cached;
        }
        return (customStyle.getStyle) ? customStyle.getStyle() : customStyle;
    }
    processStyles() {
        const cs = this.customStyles;
        for (let i = 0; i < cs.length; i++) {
            const customStyle = cs[i];
            if (customStyle.__cached) {
                continue;
            }
            const style = this.getStyleForCustomStyle(customStyle);
            if (style) {
                this.transformCustomStyleForDocument(style);
                customStyle.__cached = style;
            }
        }
        return cs;
    }
    transformCustomStyleForDocument(style) {
        const ast = rulesForStyle(style);
        this.documentOwnerStyleInfo.styleRules.rules.push(ast);
    }
}

function initCssVarShim(win, doc, customStyle, callback) {
    if (customStyle.supportsCssVars) {
        callback();
    }
    else {
        win.requestAnimationFrame(() => {
            const promises = [];
            const linkElms = doc.querySelectorAll('link[rel="stylesheet"][href]');
            for (var i = 0; i < linkElms.length; i++) {
                promises.push(loadLinkStyles(doc, customStyle, linkElms[i]));
            }
            const styleElms = doc.querySelectorAll('style');
            for (i = 0; i < styleElms.length; i++) {
                promises.push(customStyle.addStyle(styleElms[i]));
            }
            Promise.all(promises).then(() => {
                callback();
            });
        });
    }
}
function loadLinkStyles(doc, customStyle, linkElm) {
    const url = linkElm.href;
    return fetch(url).then(rsp => rsp.text()).then(text => {
        if (hasCssVariables(text)) {
            const styleElm = doc.createElement('style');
            styleElm.innerHTML = text;
            linkElm.parentNode.insertBefore(styleElm, linkElm);
            return customStyle.addStyle(styleElm).then(() => {
                linkElm.parentNode.removeChild(linkElm);
            });
        }
        return Promise.resolve();
    }).catch(err => {
        console.error(err);
    });
}
function hasCssVariables(css) {
    return css.indexOf('var(') > -1 || /--[-a-zA-Z0-9\s]+:/.test(css);
}

function createPlatformClientLegacy(namespace, Context, win, doc, resourcesUrl, hydratedCssClass) {
    const cmpRegistry = { 'html': {} };
    const bundleQueue = [];
    const loadedBundles = {};
    const pendingBundleRequests = {};
    const controllerComponents = {};
    const App = win[namespace] = win[namespace] || {};
    const domApi = createDomApi(App, win, doc);
    // set App Context
    Context.isServer = Context.isPrerender = !(Context.isClient = true);
    Context.window = win;
    Context.location = win.location;
    Context.document = doc;
    Context.resourcesUrl = Context.publicPath = resourcesUrl;
    if (Build.listener) {
        Context.enableListener = (instance, eventName, enabled, attachTo, passive) => enableEventListener(plt, instance, eventName, enabled, attachTo, passive);
    }
    if (Build.event) {
        Context.emit = (elm, eventName, data) => domApi.$dispatchEvent(elm, Context.eventNameFn ? Context.eventNameFn(eventName) : eventName, data);
    }
    // add the h() fn to the app's global namespace
    App.h = h;
    App.Context = Context;
    // keep a global set of tags we've already defined
    const globalDefined = win.$definedCmps = win.$definedCmps || {};
    // create the platform api which is used throughout common core code
    const plt = {
        connectHostElement,
        domApi,
        defineComponent,
        emitEvent: Context.emit,
        getComponentMeta: elm => cmpRegistry[domApi.$tagName(elm)],
        getContextItem: contextKey => Context[contextKey],
        isClient: true,
        isDefinedComponent: (elm) => !!(globalDefined[domApi.$tagName(elm)] || plt.getComponentMeta(elm)),
        loadBundle: loadComponent$$1,
        onError: (err, type, elm) => console.error(err, type, elm && elm.tagName),
        propConnect: ctrlTag => proxyController(domApi, controllerComponents, ctrlTag),
        queue: createQueueClient(App, win),
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
    // create the renderer that will be used
    plt.render = createRendererPatch(plt, domApi);
    // setup the root element which is the mighty <html> tag
    // the <html> has the final say of when the app has loaded
    const rootElm = domApi.$documentElement;
    rootElm.$rendered = true;
    rootElm.$activeLoading = [];
    // this will fire when all components have finished loaded
    rootElm.$initLoad = () => {
        plt.hasLoadedMap.set(rootElm, App.loaded = plt.isAppLoaded = true);
        domApi.$dispatchEvent(win, 'appload', { detail: { namespace: namespace } });
    };
    // if the HTML was generated from SSR
    // then let's walk the tree and generate vnodes out of the data
    createVNodesFromSsr(plt, domApi, rootElm);
    function connectHostElement(cmpMeta, elm) {
        // set the "mode" property
        if (!elm.mode) {
            // looks like mode wasn't set as a property directly yet
            // first check if there's an attribute
            // next check the app's global
            elm.mode = domApi.$getAttribute(elm, 'mode') || Context.mode;
        }
        // host element has been connected to the DOM
        if (!domApi.$getAttribute(elm, SSR_VNODE_ID) && !useShadowDom(domApi.$supportsShadowDom, cmpMeta)) {
            // only required when we're NOT using native shadow dom (slot)
            // this host element was NOT created with SSR
            // let's pick out the inner content for slot projection
            assignHostContentSlots(plt, domApi, elm, elm.childNodes);
        }
        if (!domApi.$supportsShadowDom && cmpMeta.encapsulation === 1 /* ShadowDom */) {
            // this component should use shadow dom
            // but this browser doesn't support it
            // so let's polyfill a few things for the user
            elm.shadowRoot = elm;
        }
    }
    function defineComponent(cmpMeta, HostElementConstructor) {
        const tagName = cmpMeta.tagNameMeta;
        if (!globalDefined[tagName]) {
            // keep a map of all the defined components
            globalDefined[tagName] = true;
            // initialize the members on the host element prototype
            initHostElement(plt, cmpMeta, HostElementConstructor.prototype, hydratedCssClass);
            if (Build.observeAttr) {
                // add which attributes should be observed
                const observedAttributes = [];
                // at this point the membersMeta only includes attributes which should
                // be observed, it does not include all props yet, so it's safe to
                // loop through all of the props (attrs) and observed them
                for (const propName in cmpMeta.membersMeta) {
                    // initialize the actual attribute name used vs. the prop name
                    // for example, "myProp" would be "my-prop" as an attribute
                    // and these can be configured to be all lower case or dash case (default)
                    if (cmpMeta.membersMeta[propName].attribName) {
                        observedAttributes.push(
                        // dynamically generate the attribute name from the prop name
                        // also add it to our array of attributes we need to observe
                        cmpMeta.membersMeta[propName].attribName);
                    }
                }
                // set the array of all the attributes to keep an eye on
                // https://www.youtube.com/watch?v=RBs21CFBALI
                HostElementConstructor.observedAttributes = observedAttributes;
            }
            // define the custom element
            win.customElements.define(tagName, HostElementConstructor);
        }
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
            console.error(e);
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
                    // get the component constructor from the module
                    cmpMeta.componentConstructor = bundleExports[pascalCasedTagName];
                    initStyleTemplate(domApi, cmpMeta, cmpMeta.componentConstructor);
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
            });
        }
    }
    /**
     * Check to see if any items in the bundle queue can be executed
     */
    function checkQueue() {
        for (let i = bundleQueue.length - 1; i > -1; i--) {
            const [bundleId, dependentsList, importer] = bundleQueue[i];
            if (dependentsList.every(dep => loadedBundles[dep]) && !loadedBundles[bundleId]) {
                execBundleCallback(bundleId, dependentsList, importer);
            }
        }
    }
    /**
     * This function is called anytime a JS file is loaded
     */
    App.loadBundle = function loadBundle(bundleId, [, ...dependentsList], importer) {
        const missingDependents = dependentsList.filter(d => !loadedBundles[d]);
        missingDependents.forEach(d => {
            const url = resourcesUrl + d.replace('.js', '.es5.js');
            requestUrl(url);
        });
        bundleQueue.push([bundleId, dependentsList, importer]);
        // If any dependents are not yet met then queue the bundle execution
        if (missingDependents.length === 0) {
            checkQueue();
        }
    };
    let customStyle;
    let requestBundleQueue = [];
    if (Build.cssVarShim) {
        customStyle = new CustomStyle(win, doc);
        initCssVarShim(win, doc, customStyle, () => {
            // loaded all the css, let's run all the request bundle callbacks
            while (requestBundleQueue.length) {
                requestBundleQueue.shift()();
            }
            // set to null to we know we're loaded
            requestBundleQueue = null;
        });
    }
    // This is executed by the component's connected callback.
    function loadComponent$$1(cmpMeta, modeName, cb, bundleId) {
        bundleId = (typeof cmpMeta.bundleIds === 'string') ?
            cmpMeta.bundleIds :
            cmpMeta.bundleIds[modeName];
        if (loadedBundles[bundleId]) {
            // sweet, we've already loaded this bundle
            cb();
        }
        else {
            // never seen this bundle before, let's start the request
            // and add it to the callbacks to fire when it has loaded
            bundleQueue.push([undefined, [bundleId], cb]);
            // when to request the bundle depends is we're using the css shim or not
            if (Build.cssVarShim && !customStyle.supportsCssVars) {
                // using css shim, so we've gotta wait until it's ready
                if (requestBundleQueue) {
                    // add this to the loadBundleQueue to run when css is ready
                    requestBundleQueue.push(() => {
                        requestComponentBundle(cmpMeta, bundleId);
                    });
                }
                else {
                    // css already all loaded
                    requestComponentBundle(cmpMeta, bundleId);
                }
            }
            else {
                // not using css shim, so no need to wait on css shim to finish
                // figure out which bundle to request and kick it off
                requestComponentBundle(cmpMeta, bundleId);
            }
        }
    }
    function requestComponentBundle(cmpMeta, bundleId, url, tmrId, scriptElm) {
        // create the url we'll be requesting
        // always use the es5/jsonp callback module
        url = resourcesUrl + bundleId + ((useScopedCss(domApi.$supportsShadowDom, cmpMeta) ? '.sc' : '') + '.es5.js');
        requestUrl(url, tmrId, scriptElm);
    }
    // Use JSONP to load in bundles
    function requestUrl(url, tmrId, scriptElm) {
        function onScriptComplete() {
            clearTimeout(tmrId);
            scriptElm.onerror = scriptElm.onload = null;
            domApi.$remove(scriptElm);
            // remove from our list of active requests
            pendingBundleRequests[url] = false;
        }
        if (!pendingBundleRequests[url]) {
            // we're not already actively requesting this url
            // let's kick off the bundle request and
            // remember that we're now actively requesting this url
            pendingBundleRequests[url] = true;
            // create a sript element to add to the document.head
            scriptElm = domApi.$createElement('script');
            scriptElm.charset = 'utf-8';
            scriptElm.async = true;
            scriptElm.src = url;
            // create a fallback timeout if something goes wrong
            tmrId = setTimeout(onScriptComplete, 120000);
            // add script completed listener to this script element
            scriptElm.onerror = scriptElm.onload = onScriptComplete;
            // inject a script tag in the head
            // kick off the actual request
            domApi.$appendChild(domApi.$head, scriptElm);
        }
    }
    if (Build.styles) {
        plt.attachStyles = (plt, domApi, cmpMeta, modeName, elm) => {
            attachStyles(plt, domApi, cmpMeta, modeName, elm, customStyle);
        };
    }
    if (Build.devInspector) {
        generateDevInspector(App, namespace, window, plt);
    }
    // register all the components now that everything's ready
    (App.components || [])
        .map(data => parseComponentLoader(data, cmpRegistry))
        .forEach(cmpMeta => {
        // es5 way of extending HTMLElement
        function HostElement(self) {
            return HTMLElement.call(this, self);
        }
        HostElement.prototype = Object.create(HTMLElement.prototype, { constructor: { value: HostElement, configurable: true } });
        plt.defineComponent(cmpMeta, HostElement);
    });
    // notify that the app has initialized and the core script is ready
    // but note that the components have not fully loaded yet, that's the "appload" event
    App.initialized = true;
    domApi.$dispatchEvent(win, 'appload', { detail: { namespace: namespace } });
}

if (Build.es5) {
    // es5 build which does not use es module imports or dynamic imports
    // and requires the es5 way of extending HTMLElement
    createPlatformClientLegacy(namespace, Context, window, document, resourcesUrl, hydratedCssClass);
}
else {
    // es2015 build which does uses es module imports and dynamic imports
    createPlatformClient(namespace, Context, window, document, resourcesUrl, hydratedCssClass);
}

})(window, document, Context, namespace);