use runtime::std_references::Reference;
use ffi::println;
use opcode_compiler::Opcode;
use program::Program;
use runtime::reference::ReferenceTrait;
use runtime::std_references::ConstReference;
use vm::VmState;
use vm::stack::StackEntry;
use itertools::Itertools;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug)]
pub struct TemplateIterator {
    state: VmState,
}

crate enum Next {
    Continue,
    Exit,
    Goto(i32),
}

impl TemplateIterator {
    crate fn new(state: VmState) -> TemplateIterator {
        TemplateIterator { state }
    }

    crate fn next(&mut self, program: Program) -> bool {
        let op = program.at(self.state.pc());

        match self.evaluate(op, program) {
            Next::Continue => self.state.next(),
            Next::Goto(pc) => self.state.goto(pc),
            Next::Exit => return false,
        }

        true
    }

    crate fn finish(&mut self, program: Program) {
        while self.next(program) {}
    }

    crate fn evaluate(&mut self, op: Opcode, program: Program) -> Next {
        debug!("Evaluating opcode: {:?}", op.debug(program.constants));
        trace!("State {:#?}", self.state);
        trace!("Progress {:#?}", self.state.builder.progress());

        match op {
            Opcode::Text(constant) => {
                let string = program.string(constant);
                self.state.builder.append_text(string);
                Next::Continue
            }

            Opcode::OpenElement(constant) => {
                let string = program.string(constant);
                self.state.builder.open_element(string);
                Next::Continue
            }

            Opcode::StaticAttr {
                name,
                value,
                namespace,
            } => {
                let name = program.string(name);
                let value = program.string(value);
                self.state.builder().set_attribute(name, value);
                Next::Continue
            }

            Opcode::FlushElement => {
                self.state.builder().flush_element();
                Next::Continue
            }

            Opcode::CloseElement => {
                self.state.builder().close_element();
                Next::Continue
            }

            Opcode::CautiousAttr { name, namespace } => {
                let name = program.string(name);
                let stack = &mut self.state.stack;

                let mut reference = stack.pop_reference();
                let mut value = reference.value();
                let string = value.as_string();

                self.state.builder.set_attribute(name, &string);
                Next::Continue
            }

            Opcode::String(constant) => {
                let string = program.string(constant);
                self.state.stack.push(StackEntry::Reference(Reference::string(string)));
                Next::Continue
            }

            Opcode::GetVariable(slot) => {
                let pointer = self.state.stack_pointer(slot);
                self.state.stack.push(pointer);
                Next::Continue
            }

            Opcode::GetProperty(constant) => {
                let string = program.string(constant);
                let top = self.state.stack.top_ref();
                let next = top.get(string);
                Next::Continue
            }

            Opcode::Exit => Next::Exit,

            Opcode::Concat(count) => {
                let mut out: Vec<&mut Reference> = Vec::with_capacity(count as usize);
                let mut stack = (&mut self.state.stack);
                let mut string = String::new();

                for _ in 0..count {
                    string.push_str(&(stack.pop_reference().value().as_string()));
                }

                stack.push(StackEntry::Reference(Reference::string(string)));

                Next::Continue
            }

            rest => {
                panic!("Unimplemented evaluate {:#?}", rest);
            }
        }
    }
}
