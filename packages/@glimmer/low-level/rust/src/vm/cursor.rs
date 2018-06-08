use ffi as js;
use program::Program;
use wasm_bindgen::prelude::*;

fn print(value: impl Into<String>) {
    println!("{}", value.into())
}

fn main() {
    print("hello");
    print("hello".to_string());
    print(Q::new(12))
}

struct Q {
    inner: u64,
}

impl Q {
    pub fn new(value: u64) -> Q {
        Q { inner: value }
    }
}

impl Into<String> for Q {
    fn into(self) -> String {
        "Q".to_string()
    }
}

impl Into<u64> for Q {
    fn into(self) -> u64 {
        32
    }
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct Cursor {
    parent: js::Element,
    next: Option<js::Node>,
}

#[wasm_bindgen]
impl Cursor {
    #[wasm_bindgen(constructor)]
    pub fn from_parts(parent: js::Element, next: js::Node) -> Cursor {
        Cursor {
            parent: parent,
            next: Some(next),
        }
    }

    pub fn from_parent(parent: js::Element) -> Cursor {
        Cursor {
            parent: parent,
            next: None,
        }
    }
}

impl Cursor {
    crate fn append_element(&self, tree: &js::DOMTree, element: &js::Element) {
        match &self.next {
            None => js::append_element(tree, &self.parent, element),
            Some(next) => js::insert_element_before(tree, &self.parent, element, next),
        }
    }

    crate fn append_node(&self, tree: &js::DOMTree, node: &js::Node) {
        match &self.next {
            None => js::append(tree, &self.parent, node),
            Some(next) => js::insert_before(tree, &self.parent, node, next),
        }
    }

    crate fn append_text(&self, tree: &js::DOMTree, node: &js::Text) {
        match &self.next {
            None => js::append_text(tree, &self.parent, node),
            Some(next) => js::insert_text_before(tree, &self.parent, node, next),
        }
    }

    crate fn element(&self) -> &js::Element {
        &self.parent
    }
}
