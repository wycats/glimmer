#![feature(proc_macro, wasm_custom_section, wasm_import_module, extern_prelude)]
#![feature(crate_visibility_modifier)]
#![feature(try_trait)]
#![feature(in_band_lifetimes)]
#![feature(integer_atomics)]
#![feature(nll)]
#![allow(unused)]

#[macro_use]
extern crate log;
extern crate serde_json;
extern crate wasm_bindgen;
#[macro_use]
extern crate lazy_static;
extern crate itertools;

use wasm_bindgen::prelude::*;

#[macro_use]
pub mod debug;
pub mod ffi;
pub mod hir;
pub mod opcode_compiler;
pub mod parse;
pub mod program;
pub mod runtime;
pub mod template;
pub mod test_support;
pub mod vm;

pub use program::VMHandle;
pub use template::parse_template;
pub use vm::VM;
pub use debug::init_wasm_logger;

#[wasm_bindgen]
pub fn num_allocated() -> u32 {
    0
}
