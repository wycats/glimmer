use ffi::println;
use hir::Attribute;
use hir::Parameter;
use hir::Statement;
use program::VMHandle;
use program::{ConstantString, Constants, Program};
use template::Template;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct ProgramCompiler {
    templates: Vec<Template>,
    encoder: Encoder,
}

#[wasm_bindgen]
impl ProgramCompiler {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ProgramCompiler {
        ProgramCompiler {
            templates: vec![],
            encoder: Encoder::new(),
        }
    }

    pub fn add(&mut self, template: &str) -> ProgramTemplate {
        let json = serde_json::from_str(template).unwrap();
        let template = Template::new(json).unwrap();
        let index = self.templates.len();
        self.templates.push(template);
        ProgramTemplate {
            offset: index as u32,
        }
    }

    pub fn compile(&mut self, template: ProgramTemplate) -> VMHandle {
        let template = &self.templates[template.offset as usize];
        let handle = self.encoder.next_handle();

        for statement in &template.statements {
            self.encoder.compile_statement(statement);
        }

        // TODO: Don't hardcode this
        self.encoder.exit();

        handle
    }
}

impl ProgramCompiler {
    crate fn as_program(&'program self) -> Program<'program> {
        Program::new(&self.encoder.constants, &self.encoder.buffer[..])
    }
}

pub struct Encoder {
    buffer: Vec<Opcode>,
    constants: Constants,
}

impl Encoder {
    fn new() -> Encoder {
        Encoder {
            buffer: Vec::with_capacity(1024 * 16),
            constants: Constants::new(),
        }
    }

    fn next_handle(&self) -> VMHandle {
        VMHandle::new(self.buffer.len() as u32)
    }

    fn compile_statement(&mut self, statement: &Statement) {
        match statement {
            Statement::Text(s) => {
                let string = self.constants.add_string(&s);
                self.buffer.push(Opcode::Text(string));
            }
            Statement::OpenElement(t) => {
                let string = self.constants.add_string(&t);
                self.buffer.push(Opcode::OpenElement(string));
            }
            Statement::FlushElement => self.buffer.push(Opcode::FlushElement),
            Statement::CloseElement => self.buffer.push(Opcode::CloseElement),

            Statement::Parameter(p) => self.compile_parameter(p),

            rest => {
                println(format!("Unimplemented compile {:?}", rest));
                unimplemented!();
            }
        }
    }

    fn compile_parameter(&mut self, p: &Parameter) {
        match p {
            Parameter::Attribute(a) => self.compile_attribute(a),
            Parameter::Argument(a) => unimplemented!(),
        }
    }

    fn compile_attribute(&mut self, a: &Attribute) {
        match a {
            Attribute::StaticAttr {
                name,
                value,
                namespace,
            } => {
                self.buffer.push(Opcode::StaticAttr {
                    name: self.constants.add_string(&name),
                    value: self.constants.add_string(&value),
                    namespace: None,
                });
            }

            rest => {
                println(format!("Unimplemented compile attribute {:?}", rest));
                unimplemented!()
            }
        }
    }

    fn exit(&mut self) {
        self.buffer.push(Opcode::Exit);
    }
}

#[wasm_bindgen]
#[derive(Copy, Clone)]
pub struct ProgramTemplate {
    offset: u32,
}

#[wasm_bindgen]
impl ProgramTemplate {
    pub fn new(offset: u32) -> ProgramTemplate {
        ProgramTemplate { offset }
    }

    pub fn into_layout(&self) -> ProgramTemplate {
        *self
    }
}

#[derive(Copy, Clone, Debug)]
crate enum Opcode {
    Text(ConstantString),
    OpenElement(ConstantString),
    StaticAttr {
        name: ConstantString,
        value: ConstantString,
        namespace: Option<ConstantString>,
    },
    FlushElement,
    CloseElement,
    Exit,
}
