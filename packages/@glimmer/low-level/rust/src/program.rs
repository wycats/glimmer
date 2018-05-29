use opcode_compiler::{Opcode, ProgramCompiler};
use template::Template;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct VMHandle {
    crate offset: u32,
}

impl VMHandle {
    crate fn new(offset: u32) -> VMHandle {
        VMHandle { offset }
    }
}

#[derive(Copy, Clone)]
pub struct Program<'program> {
    crate constants: &'program Constants,
    crate opcodes: &'program [Opcode],
}

impl Program<'program> {
    crate fn new(constants: &'program Constants, opcodes: &'program [Opcode]) -> Program<'program> {
        Program { constants, opcodes }
    }

    crate fn at(&self, at: u32) -> Opcode {
        self.opcodes[at as usize]
    }

    crate fn string(&self, constant: ConstantString) -> &str {
        self.constants.get_string(constant)
    }
}

crate struct Constants {
    strings: Vec<String>,
}

#[derive(Copy, Clone, Debug)]
crate struct ConstantString(u32);

impl Constants {
    crate fn new() -> Constants {
        Constants { strings: vec![] }
    }

    crate fn add_string(&mut self, to_add: &str) -> ConstantString {
        let position = self.strings.iter().position(|s| s == to_add);

        if let Some(index) = position {
            ConstantString(index as u32)
        } else {
            let next = self.strings.len();
            self.strings.push(to_add.to_string());
            ConstantString(next as u32)
        }
    }

    crate fn get_string(&self, constant: ConstantString) -> &str {
        &self.strings[constant.0 as usize]
    }
}
