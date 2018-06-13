use crate::ffi::println;
use crate::hir::*;

use serde_json::map::Map;
use serde_json::Value as JsonValue;

pub fn parse(statements: &JsonValue) -> Vec<Statement> {
    let statements = statements.as_array().unwrap();

    statements.iter().map(parse_statement).collect()
}

/**
    export type Block         = [Opcodes.Block, str, Params, Hash, Option<SerializedInlineBlock>, Option<SerializedInlineBlock>];

    export interface SerializedBlock {
        statements: Statements.Statement[];
        parameters: number[];
    }
 */

fn parse_statement(statement: &JsonValue) -> Statement {
    let statement = statement.as_array().unwrap();

    trace_collapsed!(
        format!("Parsing statement {}", statement[0]),
        format!("{}", serde_json::to_string_pretty(statement).unwrap())
    );

    match statement[0].as_u64().unwrap() {
        0 => Statement::Text(statement[1].assert_string()),
        1 => Statement::Append {
            expression: parse_expression(&statement[1]),
            trusting: statement[2].assert_bool(),
        },
        4 => Statement::Block {
            call: parse_call(&statement[1], &statement[2], &statement[3]),
            default: parse_block(&statement[4]),
            alternative: parse_block(&statement[5]),
        },
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

fn parse_call(name: &JsonValue, positional: &JsonValue, named: &JsonValue) -> Call {
    let name = name.assert_string();
    let positional = parse_expressions(positional);
    let named = parse_named(named);

    Call {
        name,
        positional,
        named,
    }
}

fn parse_path(path: &JsonValue) -> PathExpression {
    PathExpression {
        parts: path.assert_str_array(),
    }
}

fn parse_block(statement: &JsonValue) -> Option<InlineBlock> {
    if (statement.is_null()) {
        None
    } else {
        let object = statement.assert_object();
        let statements = parse(object.get("statements").unwrap());
        let parameters = object.get("parameters").unwrap().assert_u64_array();

        Some(InlineBlock {
            statements,
            parameters,
        })
    }
}

fn parse_expressions(expressions: &JsonValue) -> Option<Positional> {
    if expressions.is_null() {
        return None;
    }

    let expressions = expressions.assert_array();

    if expressions.len() == 0 {
        return None;
    }

    let expressions = expressions.iter().map(parse_expression).collect();

    Some(Positional { expressions })
}

fn parse_named(named: &JsonValue) -> Option<Named> {
    if named.is_null() {
        return None;
    }

    let array = named.assert_array();
    let keys = named[0].assert_str_array();

    if keys.len() == 0 {
        return None;
    }

    let values = named[1]
        .assert_array()
        .iter()
        .map(parse_expression)
        .collect();

    Some(Named { keys, values })
}

fn parse_expression(expression: &JsonValue) -> Expression {
    trace!("Parsing expression {:?}", expression);

    let expression = match expression {
        JsonValue::Array(vec) => parse_sexp(&vec),
        JsonValue::String(string) => Expression::Value(Value::String(string.clone())),
        JsonValue::Null => Expression::Value(Value::Null),
        rest => {
            panic!("Unimplemented parse expression {:#?}", rest);
        }
    };

    trace!("Parsed {:?}", expression);
    expression
}

fn parse_sexp(expression: &[JsonValue]) -> Expression {
    match expression[0].assert_u64() {
        20 => Expression::Unknown(expression[1].assert_string()),
        21 => Expression::Get(
            expression[1].assert_u64() as u32,
            parse_path(&expression[2]),
        ),
        22 => Expression::MaybeLocal(parse_path(&expression[1])),
        27 => Expression::Concat(parse_expressions(&expression[1]).unwrap()),
        rest => {
            panic!("Unimplemented parse sexp {:#?}", rest);
        }
    }
}

trait AssertJsonType {
    fn assert_string(&self) -> String;
    fn assert_u64(&self) -> u64;
    fn assert_bool(&self) -> bool;
    fn assert_array(&self) -> &[JsonValue];
    fn assert_object(&self) -> &Map<String, JsonValue>;
    fn assert_str_array(&self) -> Vec<String>;
    fn assert_u64_array(&self) -> Vec<u64>;
}

fn assert_array(value: &JsonValue) -> &Vec<JsonValue> {
    value.as_array().unwrap()
}

impl AssertJsonType for JsonValue {
    fn assert_string(&self) -> String {
        self.as_str().unwrap().to_string()
    }

    fn assert_bool(&self) -> bool {
        self.as_bool().unwrap()
    }

    fn assert_array(&self) -> &[JsonValue] {
        &self.as_array().unwrap()[..]
    }

    fn assert_object(&self) -> &Map<String, JsonValue> {
        &self.as_object().unwrap()
    }

    fn assert_str_array(&self) -> Vec<String> {
        assert_array(self)
            .iter()
            .map(|v| v.assert_string())
            .collect()
    }

    fn assert_u64_array(&self) -> Vec<u64> {
        assert_array(self).iter().map(|v| v.assert_u64()).collect()
    }

    fn assert_u64(&self) -> u64 {
        if !self.is_u64() {
            panic!("Expected u64, got {:#?}", self);
        }
        self.as_u64().unwrap()
    }
}
