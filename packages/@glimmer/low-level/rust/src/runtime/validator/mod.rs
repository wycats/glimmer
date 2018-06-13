crate mod combine;
crate mod updatable;

use self::combine::TagsPair;
use runtime::validator::combine::TagsCombinator;
use std::cell::RefCell;
use std::fmt::{self, Debug};
use std::rc::Rc;

pub static INITIAL: u64 = 1;
static mut REVISION: u64 = 1;

pub fn revision() -> u64 {
    unsafe { REVISION }
}

pub fn bump() -> u64 {
    unsafe {
        REVISION += 1;
        REVISION
    }
}

pub trait ValidatorTrait: Debug {
    fn value(&self) -> u64;

    fn validate(&self, snapshot: u64) -> bool {
        self.value() == snapshot
    }

    fn is_const(&self) -> bool {
        false
    }
}

impl ValidatorTrait for Box<dyn ValidatorTrait + Sync> {
    fn value(&self) -> u64 {
        (**self).value()
    }

    fn validate(&self, snapshot: u64) -> bool {
        (**self).validate(snapshot)
    }

    fn is_const(&self) -> bool {
        (**self).is_const()
    }
}

#[derive(Debug)]
pub enum Validator<'input, V: ValidatorTrait + 'input> {
    Borrowed(&'input V),
    Owned(V),
}

impl<V: ValidatorTrait> ValidatorTrait for Validator<'input, V> {
    fn value(&self) -> u64 {
        match self {
            Validator::Borrowed(t) => t.value(),
            Validator::Owned(t) => t.value(),
        }
    }

    fn validate(&self, snapshot: u64) -> bool {
        match self {
            Validator::Borrowed(t) => t.validate(snapshot),
            Validator::Owned(t) => t.validate(snapshot),
        }
    }

    fn is_const(&self) -> bool {
        match self {
            Validator::Borrowed(t) => t.is_const(),
            Validator::Owned(t) => t.is_const(),
        }
    }
}

#[derive(Debug)]
pub struct Tag {
    inner: Box<dyn ValidatorTrait>,
}

impl Tag {
    crate fn new(inner: impl ValidatorTrait + 'static) -> Tag {
        Tag {
            inner: Box::new(inner),
        }
    }
}

impl ValidatorTrait for Tag {
    fn value(&self) -> u64 {
        self.inner.value()
    }
}

#[derive(Debug, Clone)]
pub struct SharedTag {
    inner: Rc<RefCell<Tag>>,
}

impl SharedTag {
    crate fn new(inner: impl ValidatorTrait + 'static) -> SharedTag {
        SharedTag {
            inner: Rc::new(RefCell::new(Tag::new(inner))),
        }
    }
}

impl ValidatorTrait for SharedTag {
    fn value(&self) -> u64 {
        self.inner.borrow_mut().value()
    }
}

crate trait InnerTag: Eq + PartialEq {
    fn value(&self) -> u64;
}
