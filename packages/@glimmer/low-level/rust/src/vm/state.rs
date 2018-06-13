use crate::vm::cursor::Cursor;
use crate::vm::element::{DOMElementBuilder, ElementBuilder};
use crate::vm::stack::Stack;

use std::fmt;

#[derive(Debug)]
crate struct Registers {
    crate pc: isize,
    crate ra: isize,
    crate fp: usize,
}

impl Registers {
    crate fn new(pc: isize) -> Registers {
        Registers { pc, ra: -1, fp: 0 }
    }
}

crate struct VmState {
    crate builder: Box<dyn ElementBuilder>,
    crate stack: Stack,
    crate registers: Registers,
}

impl fmt::Debug for VmState {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.debug_struct("VmState")
            .field(
                "registers",
                &format_args!("pc={} ra={}", self.registers.pc, self.registers.ra),
            )
            .field("stack", &DebugStack(&self.stack))
            .finish()
    }
}

struct DebugStack<'input>(&'input Stack);

impl fmt::Debug for DebugStack<'input> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.debug_list()
            .entries(self.0.debug_frames().iter())
            .finish()
    }
}

impl VmState {
    crate fn debug_short(&self) -> String {
        format!(
            "pc={} ra={} fp={}",
            self.registers.pc, self.registers.ra, self.registers.fp
        )
    }

    crate fn pc(&self) -> isize {
        self.registers.pc
    }

    crate fn builder(&mut self) -> &mut ElementBuilder {
        &mut *self.builder
    }

    crate fn browser(root: Cursor, pc: isize) -> VmState {
        VmState {
            builder: DOMElementBuilder::browser(root),
            stack: Stack::new(),
            registers: Registers::new(pc),
        }
    }

    crate fn next(&mut self) -> bool {
        if self.registers.pc == -1 {
            false
        } else {
            self.registers.pc += 1;
            true
        }
    }

    crate fn goto(&mut self, target: isize) -> bool {
        self.registers.pc = target;
        true
    }

    crate fn return_from_call(&mut self) -> bool {
        let ra = self.stack.pop_frame();

        self.registers.pc = self.registers.ra;
        self.registers.ra = ra;
        true
    }

    crate fn push_frame(&mut self, _count: usize) {
        self.stack.push_frame(self.registers.ra);
    }
}
