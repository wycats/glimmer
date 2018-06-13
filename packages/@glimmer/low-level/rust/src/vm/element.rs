use debug::WasmUnwrap;
use ffi as js;
use vm::cursor::Cursor;

use std::fmt;

#[derive(Debug)]
crate struct DOMElementBuilder {
    tree: js::DOMTree,
    delegate: Box<dyn ElementBuilderDelegate>,
}

impl DOMElementBuilder {
    crate fn browser(root: Cursor) -> Box<dyn ElementBuilder> {
        let delegate = Box::new(DOMElementBuilderDelegate {
            stack: vec![root],
            constructing: None,
        }) as Box<dyn ElementBuilderDelegate>;
        let builder = DOMElementBuilder::new(delegate);

        Box::new(builder)
    }

    crate fn new(delegate: impl ElementBuilderDelegate + 'static) -> DOMElementBuilder {
        DOMElementBuilder {
            tree: js::browser_dom_tree(),
            delegate: Box::new(delegate),
        }
    }
}

#[derive(Debug)]
crate struct DOMElementBuilderDelegate {
    stack: Vec<Cursor>,
    constructing: Option<js::Element>,
}

#[derive(Debug)]
pub struct DebugProgress {
    output: String,
    constructing: Option<String>,
}

impl DOMElementBuilderDelegate {
    fn append_top(&mut self) -> &mut Cursor {
        self.stack
            .last_mut()
            .expect("Didn't expect empty element stack")
    }

    fn last_two(&mut self) -> (&mut Cursor, &mut Cursor) {
        let (top, rest) = self.stack.split_last_mut().unwrap();
        let (second, rest) = rest.split_last_mut().unwrap();
        (top, second)
    }

    fn constructing(&self) -> &js::Element {
        self.constructing
            .as_ref()
            .wasm_expect("Expected to be constructing an element, but wasn't")
    }
}

impl ElementBuilderDelegate for DOMElementBuilderDelegate {
    fn progress(&self) -> DebugProgress {
        let root = &self.stack[0].element();
        let output = js::inner_html(root);

        let constructing = self.constructing.as_ref();

        DebugProgress {
            output,
            constructing: constructing.map(|c| js::outer_html(c)),
        }
    }

    fn open_element(&mut self, tree: &js::DOMTree, tag: &str) {
        let element = js::create_element(tree, tag);
        self.constructing = Some(element);
    }

    fn set_attribute(&mut self, tree: &js::DOMTree, name: &str, value: &str) {
        js::set_attribute(tree, self.constructing(), name, value);
    }

    fn flush_element(&mut self, tree: &js::DOMTree) {
        let constructing = self.constructing.take().unwrap();
        self.stack.push(Cursor::from_parent(constructing));
        let (constructing, parent) = self.last_two();
        parent.append_element(tree, constructing.element());
    }

    fn close_element(&mut self, tree: &js::DOMTree) {
        self.stack.pop();
    }

    fn append_text(&mut self, tree: &js::DOMTree, data: &str) {
        let text = js::create_text_node(tree, data);
        let top = self.append_top();
        top.append_text(tree, &text)
    }
}

impl ElementBuilderDelegate for Box<dyn ElementBuilderDelegate> {
    fn progress(&self) -> DebugProgress {
        (**self).progress()
    }

    fn open_element(&mut self, tree: &js::DOMTree, tag: &str) {
        (**self).open_element(tree, tag)
    }

    fn set_attribute(&mut self, tree: &js::DOMTree, name: &str, value: &str) {
        (**self).set_attribute(tree, name, value)
    }

    fn flush_element(&mut self, tree: &js::DOMTree) {
        (**self).flush_element(tree)
    }

    fn close_element(&mut self, tree: &js::DOMTree) {
        (**self).close_element(tree)
    }

    fn append_text(&mut self, tree: &js::DOMTree, tag: &str) {
        (**self).append_text(tree, tag)
    }
}

impl ElementBuilder for DOMElementBuilder {
    fn progress(&self) -> DebugProgress {
        self.delegate.progress()
    }

    fn inner(&mut self) -> (&mut ElementBuilderDelegate, &mut js::DOMTree) {
        let delegate = &mut self.delegate;
        let tree = &mut self.tree;

        (delegate, tree)
    }
}

pub trait ElementBuilder: fmt::Debug {
    fn progress(&self) -> DebugProgress;

    fn inner(&mut self) -> (&mut ElementBuilderDelegate, &mut js::DOMTree);

    fn open_element(&mut self, tag: &str) {
        let (delegate, tree) = self.inner();
        delegate.open_element(tree, tag)
    }

    fn set_attribute(&mut self, name: &str, value: &str) {
        let (delegate, tree) = self.inner();
        delegate.set_attribute(tree, name, value)
    }

    fn close_element(&mut self) {
        let (delegate, tree) = self.inner();
        delegate.close_element(tree);
    }

    fn flush_element(&mut self) {
        let (delegate, tree) = self.inner();
        delegate.flush_element(tree);
    }

    fn append_text(&mut self, data: &str) {
        let (delegate, tree) = self.inner();
        delegate.append_text(tree, data)
    }
}

pub trait ElementBuilderDelegate: fmt::Debug {
    fn progress(&self) -> DebugProgress;

    fn open_element(&mut self, tree: &js::DOMTree, tag: &str);
    fn set_attribute(&mut self, tree: &js::DOMTree, name: &str, value: &str);
    fn flush_element(&mut self, tree: &js::DOMTree);
    fn close_element(&mut self, tree: &js::DOMTree);
    fn append_text(&mut self, tree: &js::DOMTree, tag: &str);
}
