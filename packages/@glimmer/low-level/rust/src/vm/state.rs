use runtime::reference::VmValue;
use vm::cursor::Cursor;
use vm::element::DOMElementBuilder;
use vm::element::ElementBuilder;
use vm::stack::Stack;
use vm::stack::StackEntry;

#[derive(Debug)]
crate struct Registers {
    crate pc: i32,
    crate ra: i32,
    crate fp: u32,
}

impl Registers {
    crate fn new(pc: i32) -> Registers {
        Registers { pc, ra: 0, fp: 0 }
    }
}

#[derive(Debug)]
crate struct VmState {
    crate builder: Box<dyn ElementBuilder>,
    crate stack: Stack,
    crate registers: Registers,
}

impl VmState {
    crate fn pc(&self) -> i32 {
        self.registers.pc
    }

    crate fn builder(&mut self) -> &mut ElementBuilder {
        &mut *self.builder
    }

    crate fn get_variable(&self, offset: u32) -> &StackEntry {
        let fp = self.registers.fp;
        self.stack.at(fp + 1 + offset as u32)
    }

    crate fn stack_pointer(&self, offset: u32) -> StackEntry {
        let fp = self.registers.fp;
        StackEntry::StackPointer(fp + offset)
    }

    crate fn browser(root: Cursor, pc: i32) -> VmState {
        VmState {
            builder: DOMElementBuilder::browser(root),
            stack: Stack::new(),
            registers: Registers::new(pc),
        }
    }

    crate fn next(&mut self) {
        self.registers.pc += 1;
    }

    crate fn goto(&mut self, target: i32) {
        self.registers.pc = target;
    }

    crate fn push_frame(&mut self) {
        self.stack.push(StackEntry::FrameStart {
            ra: self.registers.ra,
            fp: self.stack.len()
        });

        self.registers.fp = self.stack.len();
    }

    crate fn pop_frame(&mut self) {
        self.stack.truncate(self.registers.fp);

        match self.stack.pop() {
            StackEntry::FrameStart { ra, fp } => {
                self.registers.ra = ra;
                self.stack.truncate(fp);
            }

            rest => {
                panic!("Expected top of stack to be FrameStart, was {:?}", rest);
            }
        }
    }
}
