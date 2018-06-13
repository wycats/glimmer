use crate::ffi;
use crate::runtime::std_references::Reference;
use crate::runtime::validator::{Validator, ValidatorTrait};

use std::borrow::Cow;
use std::fmt;
use std::fmt::Debug;

use wasm_bindgen::prelude::*;

#[derive(Clone)]
pub struct VmJsValue(crate JsValue);

impl fmt::Debug for VmJsValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "JsValue")
    }
}

#[derive(Debug, Clone)]
pub enum VmValue<'input> {
    JsValue(VmJsValue),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    String(String),
    Str(&'input str),
    Null,
    Undefined,
}

impl VmValue<'input> {
    crate fn borrow(&'narrow self) -> VmValue<'narrow> {
        match self {
            VmValue::JsValue(value) => VmValue::JsValue(value.clone()),
            VmValue::Integer(int) => VmValue::Integer(*int),
            VmValue::Float(float) => VmValue::Float(*float),
            VmValue::Boolean(boolean) => VmValue::Boolean(*boolean),
            VmValue::String(string) => VmValue::Str(&string),
            VmValue::Str(string) => VmValue::Str(string),
            VmValue::Null => VmValue::Null,
            VmValue::Undefined => VmValue::Undefined,
        }
    }
}

impl VmValue<'input> {
    // Used to turn a reference on the stack into a string. Very loose; might be worth
    // tightening up to assert that we only get expected values in this situation.
    crate fn as_string(&self) -> Cow<str> {
        match self {
            VmValue::JsValue(value) => Cow::from(ffi::to_string(&value.0)),
            VmValue::Integer(int) => Cow::from(int.to_string()),
            VmValue::Float(float) => Cow::from(float.to_string()),
            VmValue::Boolean(boolean) => Cow::from(boolean.to_string()),
            VmValue::String(string) => Cow::from(string),
            VmValue::Str(string) => Cow::from(*string),
            VmValue::Null => Cow::from(""),
            VmValue::Undefined => Cow::from(""),
        }
    }
}

pub trait ReferenceTrait: Debug {
    type Validator: ValidatorTrait;

    fn get_tag(&'input self) -> Validator<'input, Self::Validator>;
    fn value(&self) -> VmValue;

    fn get(&self, key: &str) -> Reference {
        Reference::undefined()
    }
}
