use super::reference::ReferenceTrait;
use super::validator::combine::TagsPair;
use super::validator::{Tag, ValidatorTrait};
use ffi::{self, JsTag};
use runtime::reference::VmJsValue;
use runtime::reference::VmValue;
use runtime::validator::updatable::UpdatableTag;
use runtime::validator::SharedTag;
use runtime::validator::Validator;
use std::fmt::Debug;

use wasm_bindgen::prelude::*;

use std::cell::RefCell;
use std::ops::Deref;
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
    inner: VmValue<'static>,
}

impl ReferenceTrait for ConstReference {
    type Validator = Tag;

    fn get_tag(&'input mut self) -> Validator<'input, Tag> {
        Validator::Owned(Tag::new(ConstValidator))
    }

    fn value(&mut self) -> VmValue {
        self.inner.clone()
    }

    fn get(&self, key: &str) -> Reference {
        Reference::undefined()
    }
}

impl ConstReference {
    crate fn new(value: VmValue<'static>) -> ConstReference {
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

pub trait JsReference: Debug {
    type Validator: ValidatorTrait;

    fn get_tag(&'input self) -> Validator<'input, Self::Validator>;
    fn value(&self) -> JsValue;
    fn get(&self, key: &str) -> Box<dyn JsReference<Validator = Self::Validator>>;
}

impl JsReference for Box<dyn JsReference<Validator = Tag>> {
    type Validator = Tag;

    fn get_tag(&'input self) -> Validator<'input, Tag> {
        (**self).get_tag()
    }

    fn value(&self) -> JsValue {
        (**self).value()
    }

    fn get(&self, key: &str) -> Box<dyn JsReference<Validator = Tag>> {
        (**self).get(key)
    }
}

#[derive(Debug)]
crate struct JsRootReference {
    value: VmJsValue,
}

impl JsRootReference {
    crate fn new(value: JsValue) -> JsRootReference {
        JsRootReference {
            value: VmJsValue(value),
        }
    }
}

impl JsReference for JsRootReference {
    type Validator = Tag;

    fn value(&self) -> JsValue {
        self.value.0.clone()
    }

    fn get_tag(&self) -> Validator<Tag> {
        Validator::Owned(Tag::new(ConstValidator))
    }

    fn get(&self, _key: &str) -> Box<dyn JsReference<Validator = Tag>> {
        unimplemented!()
    }
}

#[derive(Debug)]
struct JsRootPropertyReference {
    parent: VmJsValue,
    key: String,
    tag: Tag,
}

impl JsRootPropertyReference {
    crate fn new(parent: JsValue, key: impl Into<String>) -> JsRootPropertyReference {
        let key = key.into();
        let inner_tag = ffi::tag_for_property(&parent, &key);

        JsRootPropertyReference {
            parent: VmJsValue(parent),
            key,
            tag: Tag::new(JsTag::new(inner_tag)),
        }
    }
}

impl JsReference for JsRootPropertyReference {
    type Validator = Tag;

    fn get_tag(&self) -> Validator<Tag> {
        Validator::Borrowed(&self.tag)
    }

    fn value(&self) -> JsValue {
        ffi::get(&self.parent.0, &self.key)
    }

    fn get(&self, _key: &str) -> Box<dyn JsReference<Validator = Tag>> {
        unimplemented!()
    }
}

#[derive(Debug)]
struct JsNestedReference {
    parent: Box<dyn JsReference<Validator = Tag>>,
    key: String,
}

impl JsNestedReference {
    crate fn new(
        parent: impl JsReference<Validator = Tag> + 'static,
        key: impl Into<String>,
    ) -> JsNestedReference {
        JsNestedReference {
            parent: Box::new(parent),
            key: key.into(),
        }
    }
}

impl JsReference for JsNestedReference {
    type Validator = Tag;

    fn value(&self) -> JsValue {
        let parent = self.parent.value();

        ffi::get(&parent, &self.key)
    }

    fn get_tag(&'input self) -> Validator<'input, Tag> {
        let parent_tag = self.parent.get_tag();
        let parent = self.parent.value();

        let new_tag = ffi::tag_for_property(&parent, &self.key);

        unimplemented!()
    }

    fn get(&self, _key: &str) -> Box<dyn JsReference<Validator = Tag>> {
        unimplemented!()
    }
}

#[derive(Debug)]
pub enum Reference {
    Constant(ConstReference),
    JsReference(Box<dyn JsReference<Validator = Tag>>),
    Other(Box<dyn ReferenceTrait<Validator = Tag>>),
}

impl ReferenceTrait for Reference {
    type Validator = Tag;

    fn get_tag(&mut self) -> Validator<Tag> {
        match self {
            Reference::Constant(constant) => Validator::Owned(Tag::new(ConstValidator)),
            Reference::JsReference(js) => js.get_tag(),
            Reference::Other(other) => other.get_tag(),
        }
    }

    fn value(&mut self) -> VmValue {
        match self {
            Reference::Constant(constant) => constant.inner.clone(),
            Reference::JsReference(js) => VmValue::JsValue(VmJsValue(js.value())),
            Reference::Other(other) => other.value(),
        }
    }

    fn get(&self, key: &str) -> Reference {
        match self {
            Reference::JsReference(reference) => Reference::JsReference(reference.get(key)),
            _ => Reference::undefined(),
        }
    }
}

impl Reference {
    crate fn undefined() -> Reference {
        Reference::Constant(ConstReference::undefined())
    }

    crate fn string(s: impl Into<String>) -> Reference {
        Reference::Constant(ConstReference::string(s.into()))
    }
}
