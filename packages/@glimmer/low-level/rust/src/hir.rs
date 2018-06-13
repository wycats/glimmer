use debug::WasmUnwrap;

#[derive(Debug)]
pub struct Namespace(String);

#[derive(Debug)]
pub struct EvalInfo(Vec<u32>);

#[derive(Debug)]
pub enum Core {
    Path(Vec<String>),
    Positional(Positional),
    Named(Named),
    Args(Box<Positional>, Box<Named>),
    EvalInfo(Vec<u32>),
}

#[derive(Debug)]
pub struct PathExpression {
    crate parts: Vec<String>,
}

#[derive(Debug)]
pub struct Positional {
    crate expressions: Vec<Expression>,
}

#[derive(Debug)]
pub struct Named {
    crate keys: Vec<String>,
    crate values: Vec<Expression>,
}

#[derive(Debug)]
pub enum Expression {
    Unknown(String),
    Get(u32, PathExpression),

    MaybeLocal(PathExpression),
    Value(Value),
    HasBlock(YieldTo),
    Undefined,

    Concat(Positional),
    Helper(Call),
}

#[derive(Debug)]
pub enum Value {
    String(String),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    Null,
}

#[derive(Debug)]
pub struct Call {
    crate name: String,
    crate positional: Option<Positional>,
    crate named: Option<Named>,
}

impl Call {
    crate fn assert_positional(&self) -> &Positional {
        self.positional
            .as_ref()
            .wasm_expect("Expected call to have positional arguments, but it had none")
    }
}

#[derive(Debug)]
pub struct YieldTo {
    symbol: u32,
}

#[derive(Debug, Display)]
pub enum Statement {
    Text(String),
    Append {
        expression: Expression,
        trusting: bool,
    },
    Comment(String),
    Modifier(Call),
    Block {
        call: Call,
        default: Option<InlineBlock>,
        alternative: Option<InlineBlock>,
    },
    Component {
        name: String,
        attributes: Vec<Attribute>,
        named: Named,
        block: Option<InlineBlock>,
    },
    OpenElement(String),
    SplatElement(String),
    FlushElement,
    CloseElement,
    Parameter(Parameter),
    Yield {
        yield_to: YieldTo,
        positional: Option<Positional>,
    },
    Partial {
        expression: Expression,
        eval_info: EvalInfo,
    },
    TrustingAttr {
        name: String,
        expression: Expression,
        namespace: Option<Namespace>,
    },
    Debugger {
        eval_info: EvalInfo,
    },
}

#[derive(Debug)]
pub struct InlineBlock {
    crate statements: Vec<Statement>,
    crate parameters: Vec<u64>,
}

#[derive(Debug)]
pub enum Attribute {
    StaticAttr {
        name: String,
        value: String,
        namespace: Option<Namespace>,
    },
    DynamicAttr {
        name: String,
        value: Expression,
        namespace: Option<Namespace>,
    },
    AttrSplat {
        yield_to: YieldTo,
    },
}

#[derive(Debug)]
pub enum Argument {
    DynamicArg {
        name: String,
        expression: Expression,
    },
    StaticArg {
        name: String,
        expression: Expression,
    },
}

#[derive(Debug)]
pub enum Parameter {
    Attribute(Attribute),
    Argument(Argument),
}
