//! Definitions provided when this wasm module is instantiated by glimmer

use crate::runtime::validator::ValidatorTrait;
use std::fmt;
use std::mem::transmute;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = debug)]
    crate fn console_debug(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = info)]
    crate fn console_info(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = warn)]
    crate fn console_warn(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = error)]
    crate fn console_error(s: &str);
}

#[wasm_bindgen(module = "./rust-imports")]
extern "C" {
    pub type Node;
    pub type DOMTree;
    pub type Element;
    pub type Text;

    pub fn println(s: &str);
    pub fn get(obj: &JsValue, key: &str) -> JsValue;

    pub fn collapsed(header: &str, body: &str);

    #[wasm_bindgen(js_name = isEqual)]
    pub fn is_equal(a: &JsValue, b: &JsValue) -> bool;

    #[wasm_bindgen(js_name = toString)]
    pub fn to_string(a: &JsValue) -> String;

    #[wasm_bindgen(js_name = debugElement)]
    pub fn debug_element(a: &JsValue) -> String;

    #[wasm_bindgen(js_name = debugNode)]
    pub fn debug_node(a: &JsValue) -> String;

    #[wasm_bindgen(js_name = tagValue)]
    pub fn tag_value(tag: &JsValue) -> u32;

    #[wasm_bindgen(js_name = tagValidate)]
    pub fn tag_validate(tag: &JsValue, snapshot: u32) -> bool;

    #[wasm_bindgen(js_name = tagForProperty)]
    pub fn tag_for_property(parent: &JsValue, key: &str) -> JsValue;

    #[wasm_bindgen(js_name = isConst)]
    pub fn is_const_tag(tag: &JsValue) -> bool;

    #[wasm_bindgen(js_name = browserDOMTree)]
    pub fn browser_dom_tree() -> DOMTree;

    #[wasm_bindgen(js_name = createElement)]
    pub fn create_element(tree: &DOMTree, tag: &str) -> Element;

    #[wasm_bindgen(js_name = createTextNode)]
    pub fn create_text_node(tree: &DOMTree, data: &str) -> Text;

    #[wasm_bindgen(js_name = insertBefore)]
    pub fn insert_before(tree: &DOMTree, parent: &Element, node: &Node, reference: &Node);

    #[wasm_bindgen(js_name = insertBefore)]
    pub fn insert_element_before(
        tree: &DOMTree,
        parent: &Element,
        node: &Element,
        reference: &Node,
    );

    #[wasm_bindgen(js_name = insertBefore)]
    pub fn insert_text_before(tree: &DOMTree, parent: &Element, node: &Text, reference: &Node);

    pub fn append(tree: &DOMTree, parent: &Element, node: &Node);

    #[wasm_bindgen(js_name = append)]
    pub fn append_text(tree: &DOMTree, parent: &Element, node: &Text);

    #[wasm_bindgen(js_name = append)]
    pub fn append_element(tree: &DOMTree, parent: &Element, node: &Element);

    #[wasm_bindgen(js_name = setAttribute)]
    pub fn set_attribute(tree: &DOMTree, element: &Element, name: &str, value: &str);

    #[wasm_bindgen(js_name = innerHTML)]
    pub fn inner_html(parent: &Element) -> String;

    #[wasm_bindgen(js_name = outerHTML)]
    pub fn outer_html(parent: &Element) -> String;

    pub fn stringify(object: &JsValue) -> String;

    #[wasm_bindgen(js_name = toBoolean)]
    pub fn to_boolean(object: &JsValue) -> bool;
}

crate struct JsTag {
    inner: JsValue,
}

impl fmt::Debug for JsTag {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Tag({})", to_string(&self.inner))
    }
}

impl JsTag {
    crate fn new(inner: JsValue) -> JsTag {
        JsTag { inner }
    }
}

impl ValidatorTrait for JsTag {
    fn value(&self) -> u64 {
        tag_value(&self.inner) as u64
    }

    fn is_const(&self) -> bool {
        is_const_tag(&self.inner)
    }
}

impl fmt::Debug for Node {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Node ({})", debug_node(unsafe { transmute(self) }))
    }
}

impl fmt::Debug for Element {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Element ({})", debug_element(unsafe { transmute(self) }))
    }
}

impl fmt::Debug for DOMTree {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "DOMTree ({})", to_string(unsafe { transmute(self) }))
    }
}
