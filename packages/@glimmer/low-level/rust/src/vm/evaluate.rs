use ffi::println;
use opcode_compiler::Opcode;
use program::Program;
use vm::VmState;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct TemplateIterator {
    state: VmState,
}

impl TemplateIterator {
    crate fn new(state: VmState) -> TemplateIterator {
        TemplateIterator { state }
    }

    crate fn next(&mut self, program: Program) -> bool {
        if self.state.pc == -1 {
            return false;
        }

        let op = program.at(self.state.pc as u32);
        self.evaluate(op, program);
        true
    }

    crate fn finish(&mut self, program: Program) {
        while self.next(program) {}
    }

    fn evaluate(&mut self, op: Opcode, program: Program) {
        match op {
            Opcode::Text(constant) => {
                let string = program.string(constant);
                self.state.builder.append_text(string);
                self.state.next();
            }

            Opcode::OpenElement(constant) => {
                let string = program.string(constant);
                self.state.builder.open_element(string);
                self.state.next();
            }

            Opcode::StaticAttr {
                name,
                value,
                namespace,
            } => {
                let name = program.string(name);
                let value = program.string(value);
                self.state.builder.set_attribute(name, value);
                self.state.next();
            }

            Opcode::FlushElement => {
                self.state.builder.flush_element();
                self.state.next();
            }

            Opcode::CloseElement => {
                self.state.builder.close_element();
                self.state.next();
            }

            Opcode::Exit => {
                self.state.goto(-1);
            }

            rest => {
                println(format!("Unimplemented evaluate {:?}", rest));
                unimplemented!();
            }
        }
    }
}
