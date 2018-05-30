use runtime::reference::VmValue;
use runtime::std_references::ConstReference;
use runtime::std_references::Reference;

crate struct Stack {
    entries: Vec<StackEntry>,
}

#[derive(Debug)]
crate enum StackEntry {
    Reference(Reference),
    Integer(i64),
    Float(f64),
    StackPointer(u32),
    FrameStart { ra: i32, fp: i32 },
    String(String),
}

impl StackEntry {
    crate fn as_reference(&mut self) -> &mut Reference {
        match self {
            StackEntry::Reference(reference) => reference,
            rest => panic!("{:#?} wasn't a reference", rest),
        }
    }
}

impl Stack {
    crate fn new() -> Stack {
        Stack { entries: vec![] }
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

    crate fn push(&mut self, entry: StackEntry) {
        self.entries.push(entry)
    }
}
