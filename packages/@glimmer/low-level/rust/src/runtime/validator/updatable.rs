use super::INITIAL;
use super::{revision, ValidatorTrait};
use std::cmp::max;
use std::sync::atomic::{AtomicU32, Ordering};

#[derive(Debug)]
crate struct TagCache {
    last_checked: AtomicU32,
    last_value: AtomicU32,
}

impl TagCache {
    crate fn new() -> TagCache {
        TagCache {
            last_checked: AtomicU32::new(0),
            last_value: AtomicU32::new(0),
        }
    }

    crate fn value(&self, if_invalid: impl FnOnce() -> u64) -> u64 {
        if self.last_checked.load(Ordering::SeqCst) == revision() as u32 {
            self.last_value.load(Ordering::SeqCst) as u64
        } else {
            let value = if_invalid();
            self.last_checked.store(revision() as u32, Ordering::SeqCst);
            self.last_value.store(value as u32, Ordering::SeqCst);
            value
        }
    }
}

#[allow(unused)]
#[derive(Debug)]
crate struct UpdatableTag<Inner: ValidatorTrait> {
    inner: Inner,
    cache: TagCache,
    last_updated: u64,
}

impl<Inner: ValidatorTrait> UpdatableTag<Inner> {
    #[allow(unused)]
    crate fn new(tag: Inner) -> UpdatableTag<Inner> {
        UpdatableTag {
            inner: tag,
            cache: TagCache::new(),
            last_updated: INITIAL,
        }
    }

    #[allow(unused)]
    crate fn update(&mut self, tag: Inner) {
        self.inner = tag;
    }
}

impl<Inner: ValidatorTrait> ValidatorTrait for UpdatableTag<Inner> {
    fn value(&self) -> u64 {
        let UpdatableTag {
            inner,
            last_updated,
            cache,
        } = self;

        cache.value(|| max(*last_updated, inner.value()))
    }

    fn validate(&self, snapshot: u64) -> bool {
        self.value() == snapshot
    }

    fn is_const(&self) -> bool {
        false
    }
}
