use crate::compiler::{DynamicAttr, Opcode, StaticAttr};
use crate::ffi;
use crate::program::Program;
use crate::runtime::reference::{ReferenceTrait, VmValue};
use crate::runtime::std_references::{ConditionalReference, ConstReference, Reference};
use crate::vm::VmState;

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
    Goto(isize),
}

impl TemplateIterator {
    crate fn new(state: VmState) -> TemplateIterator {
        TemplateIterator { state }
    }

    crate fn next(&mut self, program: Program) -> bool {
        trace!("Evaluating opcode at {}", self.state.pc());

        let op = program.at(self.state.pc());

        match self.evaluate(op, program) {
            Next::Continue => self.state.next(),
            Next::Goto(pc) => self.state.goto(pc),
            Next::Exit => false,
        }
    }

    crate fn finish(&mut self, program: Program) {
        while self.next(program) {}
    }

    crate fn evaluate(&mut self, op: Opcode, program: Program) -> Next {
        info!("Evaluating opcode: {:?}", op.debug(program.constants));

        progress(&self.state);

        let ret = match op {
            Opcode::Text(constant) => {
                let string = program.string(constant);
                self.state.builder.append_text(string);
                Next::Continue
            }

            Opcode::AppendText => {
                let mut reference = self.state.stack.pop_reference();
                let mut value = reference.value();
                let string = value.as_string();
                self.state.builder.append_text(&string);

                Next::Continue
            }

            Opcode::OpenElement(constant) => {
                let string = program.string(constant);
                self.state.builder.open_element(string);
                Next::Continue
            }

            Opcode::StaticAttr(StaticAttr {
                name,
                value,
                namespace,
            }) => {
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

            Opcode::PushFrame(count) => {
                self.state.push_frame(count);
                Next::Continue
            }

            Opcode::Return => {
                self.state.return_from_call();
                Next::Continue
            }

            Opcode::CautiousAttr(DynamicAttr { name, namespace }) => {
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
                self.state.stack.push_reference(Reference::string(string));
                Next::Continue
            }

            Opcode::GetVariable(slot) => {
                self.state.stack.push_parent_pointer(slot);
                Next::Continue
            }

            Opcode::GetProperty(constant) => {
                let string = program.string(constant);
                let top = self.state.stack.pop_and_deref_pointer();
                let next = top.as_reference().get(string);
                self.state.stack.push_reference(next);
                Next::Continue
            }

            Opcode::Exit => Next::Exit,

            Opcode::Concat(count) => {
                let mut out: Vec<&mut Reference> = Vec::with_capacity(count as usize);
                let mut stack = (&mut self.state.stack);
                let mut strings = Vec::new();

                for _ in 0..count {
                    let mut reference = stack.pop_reference();
                    let value = reference.value();
                    let string = value.as_string();
                    strings.push(string.to_string());
                }

                strings.reverse();

                stack.push_reference(Reference::string(strings.join("")));

                Next::Continue
            }

            Opcode::ToBoolean => {
                // self.state.stack.update_top(|entry| {});
                // let mut reference = self.state.stack.pop_reference();
                // let boolean = ConditionalReference::new(*reference);

                // self.state
                //     .stack
                //     .push(StackEntry::Reference(Reference::other(boolean)));

                Next::Continue
            }

            Opcode::Call(target) => Next::Goto(target as isize),

            rest => {
                panic!("Unimplemented evaluate {:#?}", rest);
            }
        };

        progress(&self.state);

        ret
    }
}

fn progress(state: &VmState) {
    trace_collapsed!(
        format!("State {}", state.debug_short()),
        format!("{:#?}", state)
    );
    trace_collapsed!("Progress", format!("{:#?}", state.builder.progress()));
}
