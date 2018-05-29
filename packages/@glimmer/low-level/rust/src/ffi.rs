//! Definitions provided when this wasm module is instantiated by glimmer

use wasm_bindgen::prelude::*;

#[wasm_bindgen(module = "./rust-imports")]
extern "C" {
    pub type Node;
    pub type DOMTree;
    pub type Element;
    pub type Text;

    pub fn println(s: String);

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
}
