use std::option;

use ffi::println;
use hir::Statement;
use parse::parse;
use program::VMHandle;
use serde_json::Value;

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
        debug_println!("Parsing template: {:?}", statements);
        let parsed = parse(statements);
        Ok(Template { statements: parsed })
    }

    crate fn statements(&self) -> &[Statement] {
        &self.statements[..]
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
