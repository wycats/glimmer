use super::lazy_environment::LazyTestEnvironment;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct RenderResult {
    env: LazyTestEnvironment,
}

#[wasm_bindgen]
impl RenderResult {
    pub fn env(&self) -> LazyTestEnvironment {
        self.env.clone()
    }

    pub fn rerender(&mut self) {}
}

impl RenderResult {
    crate fn new(env: LazyTestEnvironment) -> RenderResult {
        RenderResult { env }
    }
}
