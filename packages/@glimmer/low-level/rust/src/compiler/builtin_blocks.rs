use super::opcode_compiler::{Encoder, EncoderFrame, Opcode};
use crate::debug::WasmUnwrap;
use crate::hir::{Call, InlineBlock};

#[derive(Copy, Clone, Debug)]
crate struct CompileBlock<'input> {
    crate call: &'input Call,
    crate default: &'input Option<InlineBlock>,
    crate alternative: &'input Option<InlineBlock>,
}

impl CompileBlock<'input> {
    fn default(&self) -> &'input InlineBlock {
        self.default.as_ref().wasm_expect("Expected default block")
    }
}

#[derive(Debug)]
crate enum BuiltinResult {
    Compiled,
    NotCompiled,
}

crate fn try_compile_block(
    compile_block: CompileBlock,
    encoder: &mut EncoderFrame,
) -> BuiltinResult {
    match &compile_block.call.name[..] {
        "if" => compile_if(&compile_block, encoder),

        _ => BuiltinResult::NotCompiled,
    }
}

fn compile_if(compile_block: &CompileBlock, encoder: &mut EncoderFrame) -> BuiltinResult {
    encoder.goto_block(
        |encoder| {
            encoder.compile_expression(&compile_block.call.assert_positional().expressions[0]);
            encoder.push(Opcode::ToBoolean);
            1
        },
        |encoder| encoder.compile_block(&compile_block.default().statements),
    );

    BuiltinResult::Compiled
}
