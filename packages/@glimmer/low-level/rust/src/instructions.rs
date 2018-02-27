use std::mem;

use gbox::GBox;

pub struct Encoder {
    instructions: Box<[u32]>,
    offset: usize,
}

// Be sure to keep these in sync with `executor.ts`
const PUSH: u32 = 0;
const APPEND_TEXT: u32 = 1;
const APPEND_COMMENT: u32 = 2;
const OPEN_ELEMENT: u32 = 3;
const OPEN_DYNAMIC_ELEMENT: u32 = 4;
const FLUSH_ELEMENT_OPERATIONS: u32 = 5;
const FLUSH_ELEMENT: u32 = 6;
const PUSH_REMOTE_ELEMENT: u32 = 7;
const POP_REMOTE_ELEMENT: u32 = 8;
const CLOSE_ELEMENT: u32 = 9;
const UPDATE_WITH_REFERENCE: u32 = 10;
const STATIC_ATTR: u32 = 11;
const DYNAMIC_ATTR: u32 = 12;
const DYNAMIC_ATTR_WITH_CONST: u32 = 13;

impl Encoder {
    pub fn new() -> Encoder {
        Encoder {
            instructions: Box::new([0; 2048]),
            offset: 0,
        }
    }

    pub fn encode(&mut self, inst: u32, op1: GBox, op2: GBox) {
        if self.offset + 3 >= self.instructions.len() {
            self.grow();
        }
        let range = self.offset..self.offset + 3;
        let slice = match self.instructions.get_mut(range) {
            Some(i) => i,
            None => panic!("overflowed instruction builder array"),
        };
        slice[0] = inst;
        slice[1] = op1.bits();
        slice[2] = op2.bits();
        self.offset += 3;
    }

    fn grow(&mut self) {
        panic!("need to figure out how to grow an array without pulling in \
                code from std that panics...")
    }

    pub fn as_ptr(&self) -> *const u32 {
        self.instructions.as_ptr()
    }

    pub fn finalize(&mut self) -> usize {
        mem::replace(&mut self.offset, 0)
    }

    pub fn append_text(&mut self, text: GBox) {
        self.encode(APPEND_TEXT, text, GBox::undefined());
    }

    pub fn append_comment(&mut self, text: GBox) {
        self.encode(APPEND_COMMENT, text, GBox::undefined())
    }

    pub fn open_element(&mut self, tag_name: GBox) {
        self.encode(OPEN_ELEMENT, tag_name, GBox::undefined())
    }

    pub fn open_dynamic_element(&mut self, tag: GBox) {
        self.encode(OPEN_DYNAMIC_ELEMENT, tag, GBox::undefined());
    }

    pub fn flush_element_operations(&mut self, operations: GBox) {
        self.encode(FLUSH_ELEMENT_OPERATIONS, operations, GBox::undefined());
    }

    pub fn flush_element(&mut self) {
        self.encode(FLUSH_ELEMENT, GBox::undefined(), GBox::undefined());
    }

    pub fn close_element(&mut self) {
        self.encode(CLOSE_ELEMENT, GBox::undefined(), GBox::undefined());
    }

    pub fn push_remote_element(&mut self,
                               element: GBox,
                               guid: GBox,
                               next_sibling: GBox) {
        self.encode(PUSH, next_sibling, GBox::undefined());
        self.encode(PUSH_REMOTE_ELEMENT, element, guid);
    }

    pub fn pop_remote_element(&mut self) {
        self.encode(POP_REMOTE_ELEMENT, GBox::undefined(), GBox::undefined())
    }

    pub fn update_with_reference(&mut self, reference: GBox) {
        self.encode(UPDATE_WITH_REFERENCE, reference, GBox::undefined())
    }

    pub fn static_attr(&mut self, name: GBox, value: GBox, namespace: GBox) {
        self.encode(PUSH, namespace, GBox::undefined());
        self.encode(STATIC_ATTR, name, value);
    }

    pub fn dynamic_attr(&mut self,
                        name: GBox,
                        value_reference: GBox,
                        trusting: GBox,
                        namespace: GBox) {
        self.encode(PUSH, namespace, GBox::undefined());
        self.encode(PUSH, trusting, GBox::undefined());
        self.encode(DYNAMIC_ATTR, name, value_reference);
    }

    pub fn dynamic_attr_with_const(&mut self,
                                   name: GBox,
                                   value_reference: GBox,
                                   trusting: GBox,
                                   namespace: GBox) {
        self.encode(PUSH, namespace, GBox::undefined());
        self.encode(PUSH, trusting, GBox::undefined());
        self.encode(DYNAMIC_ATTR_WITH_CONST, name, value_reference);
    }
}