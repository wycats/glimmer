use ffi;
use runtime::validator::Validator;
use runtime::reference::VmJsValue;
use super::reference::ReferenceTrait;
use super::validator::ValidatorTrait;
use runtime::reference::VmValue;

use wasm_bindgen::prelude::*;

use std::cell::RefCell;
use std::rc::Rc;

#[derive(Debug)]
crate struct ConstValidator;

impl ValidatorTrait for ConstValidator {
    fn value(&self) -> u64 {
        0
    }

    fn validate(&self, snapshot: u64) -> bool {
        true
    }

    fn is_const(&self) -> bool {
        true
    }
}

#[derive(Debug)]
pub struct ConstReference {
    inner: VmValue,
}

impl ConstReference {
    crate fn new(value: VmValue) -> ConstReference {
        ConstReference { inner: value }
    }

    crate fn string(value: impl Into<String>) -> ConstReference {
        ConstReference {
            inner: VmValue::String(value.into()),
        }
    }

    crate fn undefined() -> ConstReference {
        ConstReference {
            inner: VmValue::Undefined,
        }
    }
}

#[derive(Debug, Clone)]
pub struct JsPropertyReference {
    inner: Rc<RefCell<JsPropertyReferenceTypes>>
}

#[derive(Debug)]
enum JsPropertyReferenceTypes {
    RootReference(JsRootReference),
    NestedReference(JsNestedReference)
}

impl JsPropertyReference {
    crate fn get(&mut self, key: &str) -> JsPropertyReference {
        let parent = match self {
            JsPropertyReference::RootReference(reference) => reference.value(),
            JsPropertyReference::NestedReference(reference) => reference.value()
        };
    }
}

#[derive(Debug)]
crate struct JsRootReference {
    parent: VmJsValue,
    key: String,
    tag: Validator
}

impl JsRootReference {
    crate fn new(parent: JsValue, key: impl Into<String>) -> JsRootReference {
        let key = key.into();
        let tag = ffi::tag_for_property(&parent, &key);

        JsRootReference {
            parent: VmJsValue(parent),
            key,
            tag: Validator::Js(tag)
        }
    }

    crate fn value(&mut self) -> JsValue {
        ffi::get(&self.parent.0, &self.key)
    }
}

#[derive(Debug)]
struct JsNestedReference {
    parent: JsPropertyReference,
    key: String,
    tag: Validator
}

impl JsNestedReference {
    crate fn new(parent: JsPropertyReference, key: impl Into<String>) -> JsNestedReference {
        let parent_tag = parent.get_tag();
        let parent_object_tag = UpdatableTag::new();

        JsNestedReference {
            parent,
            key: key.into()
        }
    }
}

#[derive(Debug)]
pub enum Reference {
    Constant(ConstReference),
    JsReference(JsPropertyReference),
    Other(Box<dyn ReferenceTrait>),
}

impl ReferenceTrait for Reference {
    fn get_tag(&mut self) -> Validator {
        match self {
            Reference::Constant(constant) => Validator::Constant,
            Reference::Other(other) => other.get_tag(),
        }
    }

    fn value(&mut self) -> &VmValue {
        match self {
            Reference::Constant(constant) => &constant.inner,
            Reference::Other(other) => other.value(),
        }
    }

    fn get(&self, key: &str) -> Reference {
        match self {
            Reference::JsReference(reference) => reference.get(key),
            _ => Reference::undefined(),
        }
    }
}

impl Reference {
    crate fn undefined() -> Reference {
        Reference::Constant(ConstReference::undefined())
    }

    crate fn get_string(&mut self, key: &str) -> Reference {
        let value = self.value();

        match value {
            VmValue::JsValue(VmJsValue(value)) => {}
        }
    }
}
