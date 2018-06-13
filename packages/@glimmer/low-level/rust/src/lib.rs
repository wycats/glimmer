#![feature(rust_2018_preview)]
#![feature(proc_macro, wasm_custom_section, wasm_import_module, extern_prelude)]
#![feature(crate_visibility_modifier)]
#![feature(try_trait)]
#![feature(in_band_lifetimes)]
#![feature(integer_atomics)]
#![feature(nll)]
#![feature(splice)]

#[macro_use]
extern crate log;
extern crate serde_json;
#[macro_use]
extern crate derive_new;
extern crate itertools;
extern crate wasm_bindgen;
#[macro_use]
extern crate strum_macros;

use wasm_bindgen::prelude::*;

#[macro_use]
pub mod debug;
pub mod compiler;
pub mod ffi;
pub mod hir;
pub mod parse;
pub mod program;
pub mod runtime;
pub mod template;
pub mod test_support;
pub mod vm;

pub use crate::debug::init_wasm_logger;
pub use crate::program::VMHandle;
pub use crate::template::parse_template;
pub use crate::vm::VM;

#[wasm_bindgen]
pub fn num_allocated() -> u32 {
    0
}
