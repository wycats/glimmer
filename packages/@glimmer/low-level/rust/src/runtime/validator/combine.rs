use super::updatable::TagCache;
use super::{revision, InnerTag, Tag, ValidatorTrait};
use std::cmp::max;

#[derive(Debug)]
crate struct TagsPair<First: ValidatorTrait, Second: ValidatorTrait> {
    first: First,
    second: Second,
    cache: TagCache,
}

impl<First, Second> TagsPair<First, Second>
where
    First: ValidatorTrait,
    Second: ValidatorTrait,
{
    crate fn new(first: First, second: Second) -> TagsPair<First, Second> {
        TagsPair {
            first,
            second,
            cache: TagCache::new(),
        }
    }
}

impl<First, Second> ValidatorTrait for TagsPair<First, Second>
where
    First: ValidatorTrait,
    Second: ValidatorTrait,
{
    fn value(&self) -> u64 {
        let TagsPair {
            cache,
            first,
            second,
        } = self;

        cache.value(|| max(first.value(), second.value()))
    }
}

#[derive(Debug)]
crate struct TagsCombinator {
    tags: Vec<Tag>,
    cache: TagCache,
}

impl TagsCombinator {
    crate fn new(tags: Vec<Tag>) -> TagsCombinator {
        let tags = tags.into_iter().filter(|tag| !tag.is_const()).collect();
        TagsCombinator {
            tags,
            cache: TagCache::new(),
        }
    }
}

impl ValidatorTrait for TagsCombinator {
    fn value(&self) -> u64 {
        let TagsCombinator { cache, tags } = self;

        cache.value(|| tags.iter().map(|i| i.value()).max().unwrap())
    }
}
