use crate::ffi;
use crate::program::Program;

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
    parent: ffi::Element,
    next: Option<ffi::Node>,
}

#[wasm_bindgen]
impl Cursor {
    #[wasm_bindgen(constructor)]
    pub fn from_parts(parent: ffi::Element, next: ffi::Node) -> Cursor {
        Cursor {
            parent: parent,
            next: Some(next),
        }
    }

    pub fn from_parent(parent: ffi::Element) -> Cursor {
        Cursor {
            parent: parent,
            next: None,
        }
    }
}

impl Cursor {
    crate fn append_element(&self, tree: &ffi::DOMTree, element: &ffi::Element) {
        match &self.next {
            None => ffi::append_element(tree, &self.parent, element),
            Some(next) => ffi::insert_element_before(tree, &self.parent, element, next),
        }
    }

    crate fn append_node(&self, tree: &ffi::DOMTree, node: &ffi::Node) {
        match &self.next {
            None => ffi::append(tree, &self.parent, node),
            Some(next) => ffi::insert_before(tree, &self.parent, node, next),
        }
    }

    crate fn append_text(&self, tree: &ffi::DOMTree, node: &ffi::Text) {
        match &self.next {
            None => ffi::append_text(tree, &self.parent, node),
            Some(next) => ffi::insert_text_before(tree, &self.parent, node, next),
        }
    }

    crate fn element(&self) -> &ffi::Element {
        &self.parent
    }
}
