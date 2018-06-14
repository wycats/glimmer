#![allow(unreachable_pub)]

use std::collections::LinkedList;

enum Opcode {}

#[derive(new)]
crate struct UpdateProgram {
    #[new(value = "LinkedList::new()")]
    instructions: LinkedList<Opcode>,
}

impl UpdateProgram {}
