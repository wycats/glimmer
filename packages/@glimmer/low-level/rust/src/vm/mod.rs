use vm::stack::Stack;
use wasm_bindgen::prelude::*;

use compiler::Opcode;
use program::{Program, VMHandle};
use runtime::std_references::Reference;
use std::rc::Rc;
use vm::cursor::Cursor;
use vm::element::{
    DOMElementBuilder, DOMElementBuilderDelegate, ElementBuilder, ElementBuilderDelegate,
};
use vm::evaluate::TemplateIterator;
use vm::state::VmState;

pub mod cursor;
pub mod element;
pub mod evaluate;
pub mod stack;
pub mod state;

pub struct VM<'render> {
    program: Program<'render>,
}

impl VM<'program> {
    pub fn browser(program: Program<'program>) -> VM<'program> {
        VM { program }
    }

    pub fn render(self, handle: VMHandle, root: Cursor, reference: Reference) -> TemplateIterator {
        let mut state = VmState::browser(root, handle.offset as isize);
        state.stack.push_reference(reference);
        state.push_frame(1);
        TemplateIterator::new(state)
    }

    pub fn next(&mut self, iterator: &mut TemplateIterator) -> bool {
        iterator.next(self.program)
    }
}
