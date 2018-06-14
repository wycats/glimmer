#![allow(bare_trait_objects)]

use crate::hir::Statement;
use crate::parse::parse;
use crate::program::VMHandle;
use serde_json::Value;

use std::option;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse_template(input: &str) -> Template {
    let json: Value = serde_json::from_str(input).unwrap();
    Template::new(json).unwrap()
}

#[wasm_bindgen]
pub struct Template {
    crate statements: Vec<Statement>,
}

#[wasm_bindgen]
impl Template {
    #[wasm_bindgen(method, js_name = asLayout)]
    pub fn as_layout(&self) -> Layout {
        Layout
    }
}

impl Template {
    crate fn new(template: Value) -> Result<Template, option::NoneError> {
        let statements = &template.as_object()?["statements"];
        trace_collapsed!("Parsing template", format!("{:#?}", statements));
        let parsed = parse(statements);
        Ok(Template { statements: parsed })
    }
}

#[wasm_bindgen]
pub struct Layout;

#[wasm_bindgen]
impl Layout {
    pub fn compile(&self) -> VMHandle {
        VMHandle::new(0)
    }
}

#[wasm_bindgen]
pub struct CompiledTemplate;

#[wasm_bindgen]
impl CompiledTemplate {}
