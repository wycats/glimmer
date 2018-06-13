use super::reference::ReferenceTrait;
use super::validator::combine::TagsPair;
use super::validator::{Tag, ValidatorTrait};
use ffi::{self, JsTag};
use runtime::reference::VmJsValue;
use runtime::reference::VmValue;
use runtime::validator::updatable::UpdatableTag;
use runtime::validator::SharedTag;
use runtime::validator::Validator;

use wasm_bindgen::prelude::*;

use std::cell::RefCell;
use std::fmt::{self, Debug};
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

    fn get_tag(&'input self) -> Validator<'input, Tag> {
        Validator::Owned(Tag::new(ConstValidator))
    }

    fn value(&self) -> VmValue {
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
    fn clone_ref(&self) -> Box<dyn JsReference<Validator = Self::Validator>>;
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

    fn clone_ref(&self) -> Box<dyn JsReference<Validator = Self::Validator>> {
        (**self).clone_ref()
    }
}

#[derive(Clone)]
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

impl fmt::Debug for JsRootReference {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", ffi::stringify(&self.value.0))
    }
}

impl JsReference for JsRootReference {
    type Validator = SharedTag;

    fn value(&self) -> JsValue {
        self.value.0.clone()
    }

    fn get_tag(&self) -> Validator<SharedTag> {
        Validator::Owned(SharedTag::new(ConstValidator))
    }

    fn get(&self, key: &str) -> Box<dyn JsReference<Validator = SharedTag>> {
        Box::new(JsRootPropertyReference::new(self.value.0.clone(), key))
    }

    fn clone_ref(&self) -> Box<dyn JsReference<Validator = Self::Validator>> {
        Box::new(self.clone())
    }
}

#[derive(Debug, Clone)]
struct JsRootPropertyReference {
    parent: VmJsValue,
    key: String,
    tag: SharedTag,
}

impl JsRootPropertyReference {
    crate fn new(parent: JsValue, key: impl Into<String>) -> JsRootPropertyReference {
        let key = key.into();
        let inner_tag = ffi::tag_for_property(&parent, &key);

        JsRootPropertyReference {
            parent: VmJsValue(parent),
            key,
            tag: SharedTag::new(JsTag::new(inner_tag)),
        }
    }
}

impl JsReference for JsRootPropertyReference {
    type Validator = SharedTag;

    fn get_tag(&self) -> Validator<SharedTag> {
        Validator::Borrowed(&self.tag)
    }

    fn value(&self) -> JsValue {
        ffi::get(&self.parent.0, &self.key)
    }

    fn get(&self, key: &str) -> Box<dyn JsReference<Validator = SharedTag>> {
        Box::new(JsNestedReference::new(self.clone_ref(), key))
    }

    fn clone_ref(&self) -> Box<dyn JsReference<Validator = Self::Validator>> {
        Box::new(Clone::clone(self))
    }
}

#[derive(Debug)]
struct JsNestedReference {
    parent: Box<dyn JsReference<Validator = SharedTag>>,
    key: String,
}

impl JsNestedReference {
    crate fn new(
        parent: Box<dyn JsReference<Validator = SharedTag> + 'static>,
        key: impl Into<String>,
    ) -> JsNestedReference {
        JsNestedReference {
            parent,
            key: key.into(),
        }
    }
}

impl JsReference for JsNestedReference {
    type Validator = SharedTag;

    fn value(&self) -> JsValue {
        let parent = self.parent.value();

        ffi::get(&parent, &self.key)
    }

    fn get_tag(&'input self) -> Validator<'input, SharedTag> {
        let parent_tag = self.parent.get_tag();
        let parent = self.parent.value();

        let new_tag = ffi::tag_for_property(&parent, &self.key);

        panic!("Unimplemented JsNestedReference#get_tag({:?})", self.key)
    }

    fn get(&self, key: &str) -> Box<dyn JsReference<Validator = SharedTag>> {
        Box::new(JsNestedReference::new(self.clone_ref(), key))
    }

    fn clone_ref(&self) -> Box<dyn JsReference<Validator = Self::Validator>> {
        Box::new(JsNestedReference {
            parent: self.parent.clone_ref(),
            key: self.key.clone(),
        })
    }
}

#[derive(Debug)]
crate struct ConditionalReference {
    inner: Reference,
}

impl ConditionalReference {
    crate fn new(inner: Reference) -> ConditionalReference {
        ConditionalReference { inner }
    }
}

impl ReferenceTrait for ConditionalReference {
    type Validator = SharedTag;

    fn get_tag(&self) -> Validator<SharedTag> {
        self.inner.get_tag()
    }

    fn value(&self) -> VmValue {
        let value = self.inner.value();

        let boolean = match value {
            VmValue::JsValue(value) => ffi::to_boolean(&value.0),
            VmValue::Integer(int) => int == 0,
            VmValue::Float(float) => float == 0.0,
            VmValue::Boolean(boolean) => boolean == true,
            VmValue::String(string) => string == "",
            VmValue::Str(string) => string == "",
            VmValue::Null => false,
            VmValue::Undefined => false,
        };

        VmValue::Boolean(boolean)
    }
}

#[derive(Debug)]
pub enum Reference {
    Constant(ConstReference),
    JsReference(Box<dyn JsReference<Validator = SharedTag>>),
    Other(Box<dyn ReferenceTrait<Validator = SharedTag>>),
}

impl ReferenceTrait for Reference {
    type Validator = SharedTag;

    fn get_tag(&self) -> Validator<SharedTag> {
        match self {
            Reference::Constant(constant) => Validator::Owned(SharedTag::new(ConstValidator)),
            Reference::JsReference(js) => js.get_tag(),
            Reference::Other(other) => other.get_tag(),
        }
    }

    fn value(&self) -> VmValue {
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

    crate fn other(r: impl ReferenceTrait<Validator = SharedTag> + 'static) -> Reference {
        Reference::Other(Box::new(r))
    }
}
