use runtime::reference::VmValue;
use runtime::std_references::ConstReference;
use runtime::std_references::Reference;

use std::ops::{Deref, DerefMut};

#[derive(Debug)]
crate struct Stack {
    entries: Vec<StackEntry>,
}

#[derive(Debug)]
crate enum StackEntry {
    Reference(Reference),
    Integer(i64),
    Float(f64),
    StackPointer(u32),
    FrameStart { ra: i32, fp: u32 },
    String(String),
}

impl Into<Reference> for StackEntry {
    fn into(self) -> Reference {
        match self {
            StackEntry::Reference(reference) => reference,
            rest => panic!("{:#?} wasn't a reference", rest),
        }
    }
}

crate enum ReferenceEntry<'stack> {
    Owned(Reference),
    InStack(&'stack mut Reference),
}

impl Deref for ReferenceEntry<'stack> {
    type Target = Reference;

    fn deref(&self) -> &Reference {
        match self {
            ReferenceEntry::Owned(reference) => reference,
            ReferenceEntry::InStack(reference) => reference
        }
    }
}

impl DerefMut for ReferenceEntry<'stack> {
    fn deref_mut(&mut self) -> &mut Reference {
        match self {
            ReferenceEntry::Owned(reference) => reference,
            ReferenceEntry::InStack(reference) => reference
        }
    }
}

impl Stack {
    crate fn new() -> Stack {
        Stack { entries: vec![] }
    }

    crate fn len(&self) -> u32 {
        self.entries.len() as u32
    }

    crate fn truncate(&mut self, len: u32) {
        self.entries.truncate(len as usize)
    }

    crate fn push_reference(&mut self, reference: Reference) {
        self.entries.push(StackEntry::Reference(reference));
    }

    crate fn at(&self, index: u32) -> &StackEntry {
        &self.entries[index as usize]
    }

    crate fn top(&self) -> &StackEntry {
        self.entries.last().unwrap()
    }

    crate fn top_mut(&mut self) -> &mut StackEntry {
        self.entries.last_mut().unwrap()
    }

    crate fn nth_ref(&mut self, at: usize) -> &mut Reference {
        let entries = &mut self.entries;
        nth_ref(entries, at)
    }

    crate fn top_ref(&mut self) -> &mut Reference {
        let len = self.entries.len();
        let entries = &mut self.entries;
        nth_ref(entries, len - 1)
    }

    crate fn pop_reference(&'stack mut self) -> ReferenceEntry<'stack> {
        let len = self.entries.len();
        let entries = &mut self.entries;
        let index = nth_ref_index(entries, len - 1);

        if index == len - 1 {
            ReferenceEntry::Owned(entries.pop().unwrap().into())
        } else {
            entries.pop();
            let reference = direct_nth_ref(entries, index);
            ReferenceEntry::InStack(reference)
        }
    }

    crate fn push(&mut self, entry: StackEntry) {
        self.entries.push(entry)
    }

    crate fn pop(&mut self) -> StackEntry {
        self.entries.pop().unwrap()
    }
}

enum RefPointer {
    Direct(u32),
    Indirect(u32),
}

fn nth_ref_index(entries: &mut [StackEntry], at: usize) -> usize {
    let pointer: RefPointer = {
        if at >= entries.len() {
            panic!("Indexed entries at {}, but its contents were {:?}", at, entries);
        }

        let entry = &mut entries[at];

        match entry {
            StackEntry::Reference(reference) => RefPointer::Direct(at as u32),
            StackEntry::StackPointer(pointer) => RefPointer::Indirect(*pointer as u32),
            rest => panic!("{:#?} wasn't a reference", rest),
        }
    };

    match pointer {
        RefPointer::Direct(pointer) => pointer as usize,
        RefPointer::Indirect(pointer) => nth_ref_index(entries, pointer as usize)
    }
}

fn nth_ref(entries: &mut [StackEntry], at: usize) -> &mut Reference {
    let pointer: RefPointer = {
        if at >= entries.len() {
            panic!("Indexed entries at {}, but its contents were {:?}", at, entries);
        }

        let entry = &mut entries[at];

        match entry {
            StackEntry::Reference(reference) => RefPointer::Direct(at as u32),
            StackEntry::StackPointer(pointer) => RefPointer::Indirect(*pointer as u32),
            rest => panic!("{:#?} wasn't a reference", rest),
        }
    };

    match pointer {
        RefPointer::Direct(pointer) => direct_nth_ref(entries, pointer as usize),
        RefPointer::Indirect(pointer) => nth_ref(entries, pointer as usize)
    }
}

fn direct_nth_ref(entries: &mut [StackEntry], at: usize) -> &mut Reference {
    if at >= entries.len() {
        panic!("Indexed entries at {}, but its contents were {:?}", at, entries);
    }

    let entry = &mut entries[at];

    match entry {
        StackEntry::Reference(reference) => return reference,
        rest => panic!("{:#?} wasn't a direct reference", rest),
    }
}
