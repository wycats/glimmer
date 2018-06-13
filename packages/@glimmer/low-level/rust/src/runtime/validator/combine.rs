use super::updatable::TagCache;
use super::{Tag, ValidatorTrait};

#[allow(unused)]
#[derive(Debug)]
crate struct TagsCombinator {
    tags: Vec<Tag>,
    cache: TagCache,
}

impl TagsCombinator {
    #[allow(unused)]
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
