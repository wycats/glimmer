use super::render_result::RenderResult;

use crate::compiler::{ProgramCompiler, ProgramTemplate};
use crate::ffi;
use crate::program::VMHandle;
use crate::runtime::std_references::{JsRootReference, Reference};
use crate::vm::cursor::Cursor;
use crate::vm::evaluate::TemplateIterator;
use crate::vm::VM;

use std::cell::RefCell;
use std::rc::Rc;

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
    pub fn renderMain(
        &mut self,
        handle: VMHandle,
        cursor: Cursor,
        object: JsValue,
    ) -> TemplateIterator {
        let program = self.compiler.as_program();
        let vm = VM::browser(program);
        info!("{}", ffi::stringify(&object));
        let reference = JsRootReference::new(object);

        vm.render(handle, cursor, Reference::JsReference(Box::new(reference)))
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
    pub fn renderMain(
        &mut self,
        handle: VMHandle,
        cursor: Cursor,
        object: JsValue,
    ) -> TemplateIterator {
        self.inner.borrow_mut().renderMain(handle, cursor, object)
    }
}
