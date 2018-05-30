use ffi::println;
use hir::*;
use serde_json::Value as JsonValue;

pub fn parse(statements: &JsonValue) -> Vec<Statement> {
    let statements = statements.as_array().unwrap();

    statements.iter().map(parse_statement).collect()
}

fn parse_statement(statement: &JsonValue) -> Statement {
    debug_println!("Parsing statement {:?}", statement);

    let statement = statement.as_array().unwrap();

    match statement[0].as_u64().unwrap() {
        0 => Statement::Text(statement[1].assert_string()),
        6 => Statement::OpenElement(statement[1].assert_string()),
        8 => Statement::FlushElement,
        9 => Statement::CloseElement,
        10 => Statement::Parameter(Parameter::Attribute(Attribute::StaticAttr {
            name: statement[1].assert_string(),
            value: statement[2].assert_string(),
            namespace: None,
        })),
        11 => Statement::Parameter(Parameter::Attribute(Attribute::DynamicAttr {
            name: statement[1].assert_string(),
            value: parse_expression(&statement[2]),
            namespace: None,
        })),
        v => {
            panic!("Unimplemented parse {:#?}", v);
        }
    }
}

fn parse_expression(expression: &JsonValue) -> Expression {
    debug_println!("Parsing expression {:?}", expression);

    match expression {
        JsonValue::Array(vec) => parse_sexp(&vec),
        JsonValue::String(string) => Expression::Value(Value::String(string.clone())),
        JsonValue::Null => Expression::Value(Value::Null),
        rest => {
            panic!("Unimplemented parse expression {:#?}", rest);
        }
    }
}

fn parse_sexp(expression: &[JsonValue]) -> Expression {
    match expression[0].assert_u64() {
        20 => Expression::Unknown(expression[1].assert_string()),
        21 => Expression::Get(
            expression[1].assert_u64() as u32,
            PathExpression {
                parts: expression[2].assert_str_array(),
            },
        ),
        27 => Expression::Concat(Positional {
            expressions: expression[1]
                .assert_array()
                .iter()
                .map(parse_expression)
                .collect(),
        }),
        rest => {
            panic!("Unimplemented parse sexp {:#?}", rest);
        }
    }
}

trait AssertJsonType {
    fn assert_string(&self) -> String;
    fn assert_u64(&self) -> u64;
    fn assert_array(&self) -> &[JsonValue];
    fn assert_str_array(&self) -> Vec<String>;
}

fn assert_array(value: &JsonValue) -> &Vec<JsonValue> {
    value.as_array().unwrap()
}

impl AssertJsonType for JsonValue {
    fn assert_string(&self) -> String {
        self.as_str().unwrap().to_string()
    }

    fn assert_array(&self) -> &[JsonValue] {
        &self.as_array().unwrap()[..]
    }

    fn assert_str_array(&self) -> Vec<String> {
        assert_array(self)
            .iter()
            .map(|v| v.assert_string())
            .collect()
    }

    fn assert_u64(&self) -> u64 {
        if !self.is_u64() {
            panic!("Expected u64, got {:#?}", self);
        }
        self.as_u64().unwrap()
    }
}
