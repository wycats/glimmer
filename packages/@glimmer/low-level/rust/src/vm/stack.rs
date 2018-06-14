#![allow(unreachable_pub)]

use crate::debug::WasmUnwrap;
use crate::runtime::std_references::Reference;

use std::fmt;

#[derive(Debug, new)]
crate struct StackFrame {
    #[new(default)]
    entries: Vec<StackEntry>,
    ra: isize,
}

impl StackFrame {
    fn push(&mut self, entry: StackEntry) {
        self.entries.push(entry);
    }

    fn pop(&mut self) -> StackEntry {
        self.entries
            .pop()
            .wasm_expect("Tried to pop a stack with no frames")
    }
}

enum StackEntry {
    Pointer {
        frame: usize,
        offset: usize,
    },

    #[allow(unused)]
    ByValue(StackByValue),
    ByReference(StackByReference),
}

impl fmt::Debug for StackEntry {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            StackEntry::Pointer { frame, offset } => write!(f, "*({}:{})", frame, offset),
            StackEntry::ByValue(by_value) => match *by_value {
                StackByValue::Integer(integer) => write!(f, "{:?}", integer),
                StackByValue::Float(float) => write!(f, "{:?}", float),
                StackByValue::Boolean(boolean) => write!(f, "{:?}", boolean),
            },
            StackEntry::ByReference(by_reference) => match by_reference {
                StackByReference::String(string) => write!(f, "{:?}", string),
                StackByReference::Reference(_) => write!(f, "Reference"),
            },
        }
    }
}

#[derive(Debug)]
crate enum OwnedStackEntry<'stack> {
    Integer(i64),
    Float(f64),
    Boolean(bool),
    Reference(&'stack Reference),
    String(&'stack str),
}

impl OwnedStackEntry<'stack> {
    crate fn as_reference(&self) -> &'stack Reference {
        match self {
            OwnedStackEntry::Reference(reference) => reference,

            rest => panic!("Expected stack entry to be Reference, was {:?}", rest),
        }
    }
}

#[allow(unused)]
#[derive(Debug, Copy, Clone)]
enum StackByValue {
    Integer(i64),
    Float(f64),
    Boolean(bool),
}

#[derive(Debug)]
enum StackByReference {
    Reference(Reference),

    #[allow(unused)]
    String(String),
}

#[derive(Debug, new)]
crate struct Stack {
    #[new(value = "vec![StackFrame::new(-1)]")]
    frames: Vec<StackFrame>,
}

impl Stack {
    crate fn debug_frames(&self) -> &[StackFrame] {
        &self.frames
    }

    crate fn push_frame(&mut self, ra: isize) {
        self.frames.push(StackFrame::new(ra));
    }

    crate fn pop_frame(&mut self) -> isize {
        let frame = self.frames.pop().wasm_expect("Expected at least one frame");
        frame.ra
    }

    #[allow(unused)]
    crate fn push_integer(&mut self, integer: i64) {
        self.top_frame()
            .push(StackEntry::ByValue(StackByValue::Integer(integer)))
    }

    #[allow(unused)]
    crate fn pop_integer(&mut self) -> i64 {
        match self.top_frame().pop() {
            StackEntry::ByValue(StackByValue::Integer(integer)) => integer,

            rest => panic!("Expected integer at top of stack, got {:?}", rest),
        }
    }

    #[allow(unused)]
    crate fn push_float(&mut self, float: f64) {
        self.top_frame()
            .push(StackEntry::ByValue(StackByValue::Float(float)))
    }

    #[allow(unused)]
    crate fn pop_float(&mut self) -> f64 {
        match self.top_frame().pop() {
            StackEntry::ByValue(StackByValue::Float(float)) => float,

            rest => panic!("Expected float at top of stack, got {:?}", rest),
        }
    }

    #[allow(unused)]
    crate fn push_boolean(&mut self, boolean: bool) {
        self.top_frame()
            .push(StackEntry::ByValue(StackByValue::Boolean(boolean)))
    }

    #[allow(unused)]
    crate fn pop_boolean(&mut self) -> bool {
        match self.top_frame().pop() {
            StackEntry::ByValue(StackByValue::Boolean(boolean)) => boolean,

            rest => panic!("Expected boolean at top of stack, got {:?}", rest),
        }
    }

    #[allow(unused)]
    crate fn push_string(&mut self, string: String) {
        self.top_frame()
            .push(StackEntry::ByReference(StackByReference::String(string)))
    }

    #[allow(unused)]
    crate fn pop_string(&mut self) -> String {
        match self.top_frame().pop() {
            StackEntry::ByReference(StackByReference::String(string)) => string,

            rest => panic!("Expected string at top of stack, got {:?}", rest),
        }
    }

    crate fn push_reference(&mut self, reference: Reference) {
        self.top_frame()
            .push(StackEntry::ByReference(StackByReference::Reference(
                reference,
            )))
    }

    crate fn pop_reference(&mut self) -> Reference {
        match self.top_frame().pop() {
            StackEntry::ByReference(StackByReference::Reference(reference)) => reference,

            rest => panic!("Expected reference at top of stack, got {:?}", rest),
        }
    }

    crate fn push_parent_pointer(&mut self, parent_offset: usize) {
        let parent_frame = self.frames.len() - 2;
        let last = self.top_frame();

        last.push(StackEntry::Pointer {
            frame: parent_frame,
            offset: parent_offset,
        });
    }

    #[allow(unused)]
    crate fn push_current_pointer(&mut self, offset: usize) {
        let frame = self.frames.len() - 1;
        let last = self.top_frame();

        last.push(StackEntry::Pointer { frame, offset });
    }

    crate fn pop_and_deref_pointer(&'stack mut self) -> OwnedStackEntry<'stack> {
        match self.top_frame().pop() {
            StackEntry::Pointer { frame, offset } => {
                let target_frame = &mut self.frames[frame];
                let entry = &mut target_frame.entries[offset];

                match entry {
                    StackEntry::ByValue(StackByValue::Integer(integer)) => {
                        OwnedStackEntry::Integer(*integer)
                    }

                    StackEntry::ByValue(StackByValue::Float(float)) => {
                        OwnedStackEntry::Float(*float)
                    }

                    StackEntry::ByValue(StackByValue::Boolean(boolean)) => {
                        OwnedStackEntry::Boolean(*boolean)
                    }

                    StackEntry::ByReference(StackByReference::String(string)) => {
                        OwnedStackEntry::String(string)
                    }

                    StackEntry::ByReference(StackByReference::Reference(reference)) => {
                        OwnedStackEntry::Reference(reference)
                    }

                    rest => panic!("Expected pointer to a value, got a pointer ({:?})", rest),
                }
            }

            rest => panic!("Expected pointer at top of stack, got {:?}", rest),
        }
    }

    fn top_frame(&mut self) -> &mut StackFrame {
        let frame = self.frames.last_mut();
        frame.wasm_expect("Expected at least one frame")
    }
}
