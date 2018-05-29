use ffi::println;
use hir::*;
use serde_json::Value as JsonValue;

pub fn parse(statements: &JsonValue) -> Vec<Statement> {
    let statements = statements.as_array().unwrap();

    statements.iter().map(parse_statement).collect()
}

fn parse_statement(statement: &JsonValue) -> Statement {
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
        v => {
            println(format!("Unimplemented parse {}", v));
            panic!("Unimplemented parse {}", v);
        }
    }
}

trait JsonString {
    fn assert_string(&self) -> String;
}

impl JsonString for JsonValue {
    fn assert_string(&self) -> String {
        self.as_str().unwrap().to_string()
    }
}
