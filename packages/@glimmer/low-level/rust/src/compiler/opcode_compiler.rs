use super::builtin_blocks::{try_compile_block, BuiltinResult, CompileBlock};
use debug::WasmUnwrap;
use ffi::println;
use hir::Attribute;
use hir::Expression;
use hir::Parameter;
use hir::Positional;
use hir::Statement;
use hir::Value;
use program::VMHandle;
use program::{ConstantString, Constants, Program};
use std::collections::HashMap;
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
        let json = serde_json::from_str(template).wasm_unwrap();
        let template = Template::new(json).wasm_unwrap();
        let index = self.templates.len();
        self.templates.push(template);
        ProgramTemplate {
            offset: index as u32,
        }
    }

    pub fn compile(&mut self, template: ProgramTemplate) -> VMHandle {
        let template = &self.templates[template.offset as usize];

        let offset = self.encoder.with_frame(|frame| {
            for statement in &template.statements {
                frame.compile_statement(statement);
            }

            frame.push(Opcode::Return);
        });

        VMHandle::new(offset)
    }
}

impl ProgramCompiler {
    crate fn as_program(&'program self) -> Program<'program> {
        let program = Program::new(&self.encoder.constants, &self.encoder.buffer[..]);

        trace_collapsed!("Whole program", program.debug());

        program
    }
}

crate struct LabelTarget {
    at: isize,
    target: &'static str,
}

// A frame represents a block of code between a `{{#...}}` and a
// `{{/...}}`.

/// EncoderFrame represents a single compiled block, which is
/// being compiled into a single flat Program.
crate struct EncoderFrame<'encoder> {
    encoder: &'encoder mut Encoder,
    buffer: Vec<Opcode>,
    labels: HashMap<&'static str, isize>,
    targets: Vec<LabelTarget>,
}

impl EncoderFrame<'encoder> {
    crate fn new(encoder: &mut Encoder) -> EncoderFrame<'_> {
        EncoderFrame {
            encoder,
            buffer: vec![],
            labels: HashMap::new(),
            targets: vec![],
        }
    }

    crate fn with_frame(&mut self, with_frame: impl FnOnce(&mut EncoderFrame)) -> usize {
        let mut frame = EncoderFrame::new(self.encoder);
        with_frame(&mut frame);
        let next = frame.finalize();

        next
    }

    crate fn compile_block(&mut self, statements: &[Statement]) {
        for statement in statements {
            self.compile_statement(statement);
        }
    }

    crate fn goto_block(
        &mut self,
        args: impl FnOnce(&mut EncoderFrame) -> usize,
        body: impl FnOnce(&mut EncoderFrame),
    ) {
        let count = args(self);
        self.push(Opcode::PushFrame(count));

        let offset = self.with_frame(|frame| {
            body(frame);
            frame.push(Opcode::Return);
        });

        self.push(Opcode::Call(offset));
    }

    crate fn push(&mut self, opcode: Opcode) {
        self.buffer.push(opcode);
    }

    crate fn constants(&mut self) -> &mut Constants {
        &mut self.encoder.constants
    }

    crate fn target(&mut self, at: isize, target: &'static str) {
        self.targets.push(LabelTarget { at, target });
    }

    crate fn label(&mut self, name: &'static str, index: isize) {
        self.labels.insert(name, index);
    }

    crate fn patch(&mut self) {
        let EncoderFrame {
            encoder,
            buffer,
            labels,
            targets,
        } = self;

        for LabelTarget { at, target } in targets {
            let address = labels[target] - *at;
        }
    }

    crate fn patch_opcode(&mut self, opcode: &mut RelativeJump, address: isize) -> RelativeJump {
        match opcode {
            RelativeJump::Goto(_) => RelativeJump::Goto(address),
            RelativeJump::JumpIf(_) => RelativeJump::JumpIf(address),
            RelativeJump::JumpUnless(_) => RelativeJump::JumpUnless(address),
        }
    }

    fn finalize(mut self) -> usize {
        self.patch();
        let buffer = self.buffer;
        trace_collapsed!("Adding buffer to program", format!("{:#?}", buffer));
        let next = self.encoder.buffer.len();
        self.encoder.buffer.extend(buffer);
        next
    }
}

impl EncoderFrame<'encoder> {
    crate fn compile_expression(&mut self, expression: &Expression) {
        ExpressionEncoder::from_encoder(self).compile_expression(expression)
    }

    fn compile_statement(&mut self, statement: &Statement) {
        trace_collapsed!(
            format!("Compiling {}", statement),
            format!("{:#?}", statement)
        );

        match statement {
            Statement::Text(s) => {
                let string = self.encoder.constants.add_string(&s);
                self.buffer.push(Opcode::Text(string));
            }
            Statement::Append {
                expression,
                trusting,
            } => {
                self.compile_expression(expression);
                self.buffer.push(Opcode::AppendText);
            }
            Statement::OpenElement(t) => {
                let string = self.constants().add_string(&t);
                self.buffer.push(Opcode::OpenElement(string));
            }
            Statement::FlushElement => self.buffer.push(Opcode::FlushElement),
            Statement::CloseElement => self.buffer.push(Opcode::CloseElement),

            Statement::Parameter(p) => self.compile_parameter(p),

            Statement::Block {
                call,
                default,
                alternative,
            } => {
                let compile = CompileBlock {
                    call,
                    default,
                    alternative,
                };

                match try_compile_block(compile, self) {
                    BuiltinResult::Compiled => {}
                    BuiltinResult::NotCompiled => {
                        panic!("Couldn't compile block with name {}", call.name)
                    }
                }
            }

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
                self.buffer.push(Opcode::StaticAttr(StaticAttr {
                    name: self.encoder.constants.add_string(&name),
                    value: self.encoder.constants.add_string(&value),
                    namespace: None,
                }));
            }

            Attribute::DynamicAttr {
                name,
                value,
                namespace,
            } => {
                self.compile_expression(value);
                self.buffer.push(Opcode::CautiousAttr(DynamicAttr {
                    name: self.encoder.constants.add_string(&name),
                    namespace: None,
                }))
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

/// The data structure that is used to compile an entire program. This
/// includes the opcodes as well as a Constants structure that
/// accumulates strings as they are encountered during the compilation
/// process.
///
/// Strings are interned in Constants; a given String will only appear
/// once in the output program, no matter how many times it appears in
/// the source.
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
        VMHandle::new(self.buffer.len())
    }

    crate fn with_frame(&mut self, with_frame: impl FnOnce(&mut EncoderFrame)) -> usize {
        EncoderFrame::new(self).with_frame(with_frame)
    }

    crate fn buffer(&mut self) -> &mut Vec<Opcode> {
        &mut self.buffer
    }
}

struct ExpressionEncoder<'compiler> {
    buffer: &'compiler mut Vec<Opcode>,
    constants: &'compiler mut Constants,
}

impl ExpressionEncoder<'compiler> {
    fn from_encoder(encoder: &'c mut EncoderFrame) -> ExpressionEncoder<'c> {
        ExpressionEncoder {
            buffer: &mut encoder.buffer,
            constants: &mut encoder.encoder.constants,
        }
    }

    fn compile_expression(&mut self, expression: &Expression) {
        match expression {
            Expression::Undefined => self.push_primitive_reference(Primitive::Undefined),
            Expression::Concat(positional) => {
                self.compile_positional(positional);
                self.buffer
                    .push(Opcode::Concat(positional.expressions.len()));
            }
            Expression::MaybeLocal(path) => {
                self.buffer.push(Opcode::GetVariable(0));

                for part in &path.parts {
                    let part = self.constants.add_string(part);
                    self.buffer.push(Opcode::GetProperty(part));
                }
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
crate struct StaticAttr {
    crate name: ConstantString,
    crate value: ConstantString,
    crate namespace: Option<ConstantString>,
}

#[derive(Copy, Clone, Debug)]
crate struct DynamicAttr {
    crate name: ConstantString,
    crate namespace: Option<ConstantString>,
}

#[derive(Copy, Clone, Debug)]
crate enum Opcode {
    GetVariable(usize),
    GetProperty(ConstantString),
    Text(ConstantString),
    AppendText,
    OpenElement(ConstantString),
    StaticAttr(StaticAttr),
    TrustingAttr(DynamicAttr),
    CautiousAttr(DynamicAttr),
    FlushElement,
    CloseElement,
    PushFrame(usize),
    Return,
    ToBoolean,
    Primitive(Primitive),
    String(ConstantString),
    PrimitiveReference,
    Concat(usize),
    Jump(RelativeJump),
    Call(usize),
    Exit,
}

#[derive(Copy, Clone, Debug)]
crate enum RelativeJump {
    Goto(isize),
    JumpIf(isize),
    JumpUnless(isize),
}

#[derive(Debug)]
crate enum DebugOpcode<'constants> {
    GetVariable(usize),
    GetProperty(&'constants str),
    Text(&'constants str),
    AppendText,
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
    PushFrame(usize),
    Return,
    ToBoolean,
    Primitive(Primitive),
    String(&'constants str),
    PrimitiveReference,
    Concat(usize),
    Jump(RelativeJump),
    Call(usize),
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
            Opcode::AppendText => DebugOpcode::AppendText,
            Opcode::OpenElement(constant) => {
                DebugOpcode::OpenElement(constants.get_string(*constant))
            }
            Opcode::StaticAttr(StaticAttr {
                name,
                value,
                namespace,
            }) => DebugOpcode::StaticAttr {
                name: constants.get_string(*name),
                value: constants.get_string(*value),
                namespace: namespace.map(|n| constants.get_string(n)),
            },
            Opcode::TrustingAttr(DynamicAttr { name, namespace }) => DebugOpcode::TrustingAttr {
                name: constants.get_string(*name),
                namespace: namespace.map(|n| constants.get_string(n)),
            },
            Opcode::CautiousAttr(DynamicAttr { name, namespace }) => DebugOpcode::CautiousAttr {
                name: constants.get_string(*name),
                namespace: namespace.map(|n| constants.get_string(n)),
            },
            Opcode::FlushElement => DebugOpcode::FlushElement,
            Opcode::CloseElement => DebugOpcode::CloseElement,
            Opcode::PushFrame(count) => DebugOpcode::PushFrame(*count),
            Opcode::Return => DebugOpcode::Return,
            Opcode::ToBoolean => DebugOpcode::ToBoolean,
            Opcode::Primitive(primitive) => DebugOpcode::Primitive(*primitive),
            Opcode::String(constant) => DebugOpcode::String(constants.get_string(*constant)),
            Opcode::PrimitiveReference => DebugOpcode::PrimitiveReference,
            Opcode::Concat(int) => DebugOpcode::Concat(*int),
            Opcode::Jump(jump) => DebugOpcode::Jump(*jump),
            Opcode::Call(to) => DebugOpcode::Call(*to),
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
