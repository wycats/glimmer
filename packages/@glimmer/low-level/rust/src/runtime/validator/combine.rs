use super::{Validator, ValidatorTrait, InnerTag, revision};
use std::cmp::max;

crate struct CachedTag {
    last_checked: Option<u64>,
    last_value: Option<u64>,
    inner: Box<dyn InnerTag>
}

impl CachedTag {
    crate fn new(inner: impl InnerTag + 'static) -> CachedTag {
        CachedTag {
            last_checked: None,
            last_value: None,
            inner: Box::new(inner)
        }
    }

    crate fn into_validator(self) -> Validator {
        Validator::Cached(Box::new(self))
    }

    crate fn value(&mut self) -> u64 {
        match self.last_checked {
            Some(last) if last == revision() => last,
            _ => {
                self.last_checked = Some(revision());
                let value = self.inner.value();
                self.last_value = Some(value);
                value
            }
        }
    }
}

crate struct TagsPair {
    left: Validator,
    right: Validator
}

impl InnerTag for TagsPair {
    fn value(&mut self) -> u64 {
        max(self.left.value(), self.right.value())
    }
}

crate struct TagsCombinator {
    tags: Vec<Validator>
}

impl InnerTag for TagsCombinator {
    fn value(&mut self) -> u64 {
        self.tags.iter().map(|t| t.value()).max().unwrap()
    }
}