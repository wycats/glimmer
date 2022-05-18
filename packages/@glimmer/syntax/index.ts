export { SYNTAX_ERRORS, VoidSyntaxErrorName } from './lib/errors';
export { default as print } from './lib/generation/print';
export { sortByLoc } from './lib/generation/util';
export { getTemplateLocals } from './lib/get-template-locals';
export { isKeyword, KEYWORDS_TYPES, KeywordType } from './lib/keywords';
export { ASTPlugin, ASTPluginBuilder, ASTPluginEnvironment, Syntax } from './lib/parser/plugins';
export {
  EmbedderLocals,
  normalize as normalizePreprocessOptions,
  NormalizedPreprocessFields,
  NormalizedPreprocessOptions,
  PrecompileOptions,
  preprocess,
  PreprocessOptions,
  TemplateIdFn,
  optionsWithDefaultModule,
} from './lib/parser/preprocess';
export { SourceSlice } from './lib/source/slice';
export { SourceTemplate } from './lib/source/source';
export { SourceSpan } from './lib/source/span';
export {
  HasSourceSpan,
  hasSpan,
  loc,
  MaybeHasSourceSpan,
  maybeLoc,
  SpanList,
} from './lib/source/span-list';
export { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from './lib/symbol-table';
export {
  generateSyntaxError,
  GlimmerSyntaxError,
  symbolicMessage,
  SymbolicSyntaxError,
} from './lib/syntax-error';
export { cannotRemoveNode, cannotReplaceNode } from './lib/traversal/errors';
export { default as WalkerPath } from './lib/traversal/path';
export { default as traverse } from './lib/traversal/traverse';
export { NodeVisitor } from './lib/traversal/visitor';
export { default as Path, default as Walker } from './lib/traversal/walker';
export * as ASTv1 from './lib/v1/api';
export { PublicBuilders as Buildersv1 } from './lib/v1/public-builders';
export * as AST from './lib/v1/api';
export * as ASTv2 from './lib/v2-a/api';
export { normalize } from './lib/v2-a/normalize';
export { node } from './lib/v2-a/objects/node';
