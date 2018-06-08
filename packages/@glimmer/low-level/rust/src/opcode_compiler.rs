use ffi::println;
use hir::Attribute;
use hir::Expression;
use hir::Parameter;
use hir::Positional;
use hir::Statement;
use hir::Value;
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

    fn compile_expression(&mut self, expression: &Expression) {
        ExpressionEncoder::from_encoder(self).compile_expression(expression)
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
                panic!("Unimplemented compile {:?}", rest);
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

            Attribute::DynamicAttr {
                name,
                value,
                namespace,
            } => {
                self.compile_expression(value);
                self.buffer.push(Opcode::CautiousAttr {
                    name: self.constants.add_string(&name),
                    namespace: None,
                })
            }

            rest => {
                panic!("Unimplemented compile attribute {:?}", rest);
            }
        }
    }

    fn exit(&mut self) {
        self.buffer.push(Opcode::Exit);
    }
}

struct ExpressionEncoder<'compiler> {
    buffer: &'compiler mut Vec<Opcode>,
    constants: &'compiler mut Constants,
}

impl ExpressionEncoder<'compiler> {
    fn from_encoder(encoder: &mut Encoder) -> ExpressionEncoder {
        ExpressionEncoder {
            buffer: &mut encoder.buffer,
            constants: &mut encoder.constants,
        }
    }

    fn compile_expression(&mut self, expression: &Expression) {
        match expression {
            Expression::Undefined => self.push_primitive_reference(Primitive::Undefined),
            Expression::Concat(positional) => {
                self.compile_positional(positional);
                self.buffer
                    .push(Opcode::Concat(positional.expressions.len() as u32));
            }
            Expression::Value(value) => self.compile_value(value),
            Expression::Unknown(name) => self.compile_unknown(name),

            rest => panic!("Unimplemented compile expression {:?}", rest),
        }
    }

    fn compile_value(&mut self, value: &Value) {
        match value {
            Value::String(string) => self.constant_string(string),
            Value::Integer(int) => self
                .buffer
                .push(Opcode::Primitive(Primitive::Integer(*int))),
            Value::Float(float) => self
                .buffer
                .push(Opcode::Primitive(Primitive::Float(*float))),
            Value::Boolean(boolean) => self
                .buffer
                .push(Opcode::Primitive(Primitive::Boolean(*boolean))),
            Value::Null => self.buffer.push(Opcode::Primitive(Primitive::Null)),
        }
    }

    fn constant_string(&mut self, string: &str) {
        let constant = self.constants.add_string(string);
        self.buffer.push(Opcode::String(constant));
    }

    fn compile_unknown(&mut self, name: &str) {
        // TODO: Handle helpers via dynamic resolver
        self.buffer.push(Opcode::GetVariable(0));
        self.buffer
            .push(Opcode::GetProperty(self.constants.add_string(name)));
    }

    fn compile_positional(&mut self, positional: &Positional) {
        for expr in &positional.expressions {
            self.compile_expression(expr);
        }
    }

    fn push_primitive_reference(&mut self, primitive: Primitive) {
        self.push_primitive(primitive);
    }

    fn push_primitive(&mut self, primitive: Primitive) {
        self.buffer.push(Opcode::Primitive(primitive));
    }

    fn primitive_reference(&mut self) {
        self.buffer.push(Opcode::PrimitiveReference);
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
    GetVariable(u32),
    GetProperty(ConstantString),
    Text(ConstantString),
    OpenElement(ConstantString),
    StaticAttr {
        name: ConstantString,
        value: ConstantString,
        namespace: Option<ConstantString>,
    },
    TrustingAttr {
        name: ConstantString,
        namespace: Option<ConstantString>,
    },
    CautiousAttr {
        name: ConstantString,
        namespace: Option<ConstantString>,
    },
    FlushElement,
    CloseElement,
    PushFrame,
    PopFrame,
    Primitive(Primitive),
    String(ConstantString),
    PrimitiveReference,
    Concat(u32),
    Exit,
}

#[derive(Debug)]
crate enum DebugOpcode<'constants> {
    GetVariable(u32),
    GetProperty(&'constants str),
    Text(&'constants str),
    OpenElement(&'constants str),
    StaticAttr {
        name: &'constants str,
        value: &'constants str,
        namespace: Option<&'constants str>,
    },
    TrustingAttr {
        name: &'constants str,
        namespace: Option<&'constants str>,
    },
    CautiousAttr {
        name: &'constants str,
        namespace: Option<&'constants str>,
    },
    FlushElement,
    CloseElement,
    PushFrame,
    PopFrame,
    Primitive(Primitive),
    String(&'constants str),
    PrimitiveReference,
    Concat(u32),
    Exit,
}

impl Opcode {
    crate fn debug(&self, constants: &'constants Constants) -> DebugOpcode<'constants> {
        match self {
            Opcode::GetVariable(offset) => DebugOpcode::GetVariable(*offset),
            Opcode::GetProperty(constant) => {
                DebugOpcode::GetProperty(constants.get_string(*constant))
            }
            Opcode::Text(constant) => DebugOpcode::Text(constants.get_string(*constant)),
            Opcode::OpenElement(constant) => {
                DebugOpcode::OpenElement(constants.get_string(*constant))
            }
            Opcode::StaticAttr {
                name,
                value,
                namespace,
            } => DebugOpcode::StaticAttr {
                name: constants.get_string(*name),
                value: constants.get_string(*value),
                namespace: namespace.map(|n| constants.get_string(n)),
            },
            Opcode::TrustingAttr { name, namespace } => DebugOpcode::TrustingAttr {
                name: constants.get_string(*name),
                namespace: namespace.map(|n| constants.get_string(n)),
            },
            Opcode::CautiousAttr { name, namespace } => DebugOpcode::CautiousAttr {
                name: constants.get_string(*name),
                namespace: namespace.map(|n| constants.get_string(n)),
            },
            Opcode::FlushElement => DebugOpcode::FlushElement,
            Opcode::CloseElement => DebugOpcode::CloseElement,
            Opcode::PushFrame => DebugOpcode::PushFrame,
            Opcode::PopFrame => DebugOpcode::PopFrame,
            Opcode::Primitive(primitive) => DebugOpcode::Primitive(*primitive),
            Opcode::String(constant) => DebugOpcode::String(constants.get_string(*constant)),
            Opcode::PrimitiveReference => DebugOpcode::PrimitiveReference,
            Opcode::Concat(int) => DebugOpcode::Concat(*int),
            Opcode::Exit => DebugOpcode::Exit,
        }
    }
}

#[derive(Copy, Clone, Debug)]
crate enum Primitive {
    Undefined,
    Null,
    True,
    False,
    Integer(i64),
    Float(f64),
    Boolean(bool),
}
