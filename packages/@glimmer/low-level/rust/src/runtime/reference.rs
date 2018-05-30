use super::validator::Validator;
use runtime::std_references::Reference;
use std::fmt::Debug;

use std::fmt;

use wasm_bindgen::prelude::*;

pub struct VmJsValue(crate JsValue);

impl fmt::Debug for VmJsValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "JsValue")
    }
}

#[derive(Debug)]
pub enum VmValue {
    JsValue(VmJsValue),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    String(String),
    Null,
    Undefined,
}

pub trait ReferenceTrait: Debug {
    fn get_tag(&mut self) -> Validator;
    fn value(&mut self) -> &VmValue;

    fn get(&self, key: &str) -> Reference {
        Reference::undefined()
    }
}
