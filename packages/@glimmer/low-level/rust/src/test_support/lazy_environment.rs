use super::render_result::RenderResult;
use opcode_compiler::{ProgramCompiler, ProgramTemplate};
use program::VMHandle;
use std::rc::Rc;
use vm::cursor::Cursor;
use vm::element::DOMElementBuilder;
use vm::element::DOMElementBuilderDelegate;
use vm::evaluate::TemplateIterator;
use vm::VM;
use wasm_bindgen::__rt::core::cell::RefCell;

use wasm_bindgen::prelude::*;

pub struct InnerLazyTestEnvironment {
    compiler: ProgramCompiler,
}

impl InnerLazyTestEnvironment {
    pub fn add(&mut self, src: &str) -> ProgramTemplate {
        self.compiler.add(src)
    }

    pub fn compile(&mut self, template: ProgramTemplate) -> VMHandle {
        self.compiler.compile(template)
    }

    #[allow(non_snake_case)]
    pub fn renderMain(&mut self, handle: VMHandle, cursor: Cursor) -> TemplateIterator {
        let program = self.compiler.as_program();
        let mut vm = VM::browser(program);
        vm.render(handle, cursor)
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct LazyTestEnvironment {
    inner: Rc<RefCell<InnerLazyTestEnvironment>>,
}

#[wasm_bindgen]
impl LazyTestEnvironment {
    #[wasm_bindgen(constructor)]
    pub fn new() -> LazyTestEnvironment {
        let env = InnerLazyTestEnvironment {
            compiler: ProgramCompiler::new(),
        };

        LazyTestEnvironment {
            inner: Rc::new(RefCell::new(env)),
        }
    }

    pub fn begin(&self) {}
    pub fn commit(&self) {}

    pub fn finish(&self, iterator: &mut TemplateIterator) -> RenderResult {
        iterator.finish(self.inner.borrow().compiler.as_program());

        RenderResult::new(self.clone())
    }

    pub fn add(&mut self, src: &str) -> ProgramTemplate {
        self.inner.borrow_mut().add(src)
    }

    pub fn compile(&mut self, template: ProgramTemplate) -> VMHandle {
        self.inner.borrow_mut().compile(template)
    }

    #[allow(non_snake_case)]
    pub fn renderMain(&mut self, handle: VMHandle, cursor: Cursor) -> TemplateIterator {
        self.inner.borrow_mut().renderMain(handle, cursor)
    }
}
