export { booted, memory as wasmMemory } from './lib/rust_bg';
export {
  Cursor,
  LazyTestEnvironment,
  ProgramTemplate,
  ProgramCompiler,
  VMHandle,
  TemplateIterator,
  parse_template,
  num_allocated,
  init_wasm_logger
} from './lib/rust';
