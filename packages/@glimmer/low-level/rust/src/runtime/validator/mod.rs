mod combine;

use std::fmt::{self, Debug};
use ffi::{Tag, is_const_tag};
use self::combine::{CachedTag, TagsPair};

static mut REVISION: u64 = 0;

pub fn revision() -> u64 {
    REVISION
}

pub fn bump() -> u64 {
    unsafe { REVISION += 1 };
    REVISION
}

pub trait ValidatorTrait: Debug {
    fn value(&self) -> u64;
    fn validate(&self, snapshot: u64) -> bool;

    fn is_const(&self) -> bool {
        false
    }
}

crate enum Validator {
    Constant,
    Js(Tag),
    Updatable(Box<UpdatableTag>),
    Cached(Box<CachedTag>),
    Pair(Box<TagsPair>),
    Other(Box<dyn ValidatorTrait>)
}

impl fmt::Debug for Validator {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Validator::Js(tag) => write!(f, "JS Tag"),
            Validator::Other(tag) => tag.fmt(f)
        }
    }
}


impl ValidatorTrait for Validator {
    fn value(&self) -> u64 {
        match self {
            Validator::Constant => 0,
            Validator::Updatable(tag) => tag.inner.value(),
            Validator::Js(tag) => tag.value() as u64,
            Validator::Other(tag) => tag.value()
        }
    }

    fn validate(&self, snapshot: u64) -> bool {
        match self {
            Validator::Constant => true,
            Validator::Updatable(tag) => tag.inner.validate(snapshot),
            Validator::Js(tag) => tag.validate(snapshot as u32),
            Validator::Other(tag) => tag.validate(snapshot)
        }
    }

    fn is_const(&self) -> bool {
        match self {
            Validator::Constant => true,
            Validator::Updatable(_) => false,
            Validator::Js(tag) => is_const_tag(tag),
            Validator::Other(tag) => tag.is_const()
        }
    }
}

crate trait InnerTag {
    fn value(&mut self) -> u64;
}

crate struct UpdatableTag {
    inner: Validator
}

impl UpdatableTag {
    crate fn new() -> UpdatableTag {
        UpdatableTag { inner: Validator::Constant }
    }

    crate fn update(&mut self, validator: Validator) {
        self.inner = validator;
    }

    crate fn as_validator(self) -> Validator {
        Validator::Updatable(Box::new(self))
    }
}

crate fn compile(a: Validator, b: Validator) {}