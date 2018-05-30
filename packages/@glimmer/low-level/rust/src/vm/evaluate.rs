use ffi::println;
use opcode_compiler::Opcode;
use program::Program;
use runtime::std_references::ConstReference;
use vm::VmState;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
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

            Opcode::String(constant) => {
                let string = program.string(constant);
                let reference = ConstReference::string(string);
                Next::Continue
            }

            Opcode::GetVariable(slot) => {
                let pointer = self.state.stack_pointer(slot);
                self.state.stack.push(pointer);
                Next::Continue
            }

            Opcode::GetProperty(constant) => {
                let string = program.string(constant);
                let top = self.state.stack.top_mut().as_reference();
                let next = top.get(string);
                Next::Continue
            }

            Opcode::Exit => Next::Exit,

            rest => {
                panic!("Unimplemented evaluate {:#?}", rest);
            }
        }
    }
}
