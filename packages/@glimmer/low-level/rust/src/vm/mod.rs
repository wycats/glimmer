use vm::stack::Stack;
use wasm_bindgen::prelude::*;

use opcode_compiler::Opcode;
use program::{Program, VMHandle};
use std::rc::Rc;
use vm::cursor::Cursor;
use vm::element::{
    DOMElementBuilder, DOMElementBuilderDelegate, ElementBuilder, ElementBuilderDelegate,
};
use vm::evaluate::TemplateIterator;
use vm::state::VmState;
use vm::stack::StackEntry;
use runtime::std_references::Reference;

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

    pub fn render(self, handle: VMHandle, root: Cursor) -> TemplateIterator {
        let mut state = VmState::browser(root, handle.offset as i32);
        state.push_frame();
        state.stack.push(StackEntry::Reference(Reference::undefined()));
        TemplateIterator::new(state)
    }

    pub fn next(&mut self, iterator: &mut TemplateIterator) -> bool {
        iterator.next(self.program)
    }
}
