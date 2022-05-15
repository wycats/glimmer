import { PublicBuilders } from './lib/v1/public-builders';

export const builders = PublicBuilders.default();

export { Source } from './lib/source/source';
export * as ASTv1 from './lib/v1/api';
export * as ASTv2 from './lib/v2-a/api';
export { normalize } from './lib/v2-a/normalize';
export { SymbolTable, BlockSymbolTable, ProgramSymbolTable } from './lib/symbol-table';
export {
  generateSyntaxError,
  GlimmerSyntaxError,
  SymbolicSyntaxError,
  symbolicMessage,
} from './lib/syntax-error';
export { ASTPlugin, ASTPluginBuilder, ASTPluginEnvironment, Syntax } from './lib/parser/plugins';
export {
  TemplateIdFn,
  PrecompileOptions,
  PreprocessOptions,
  EmbedderLocals,
  NormalizedPreprocessOptions,
  normalize as normalizePreprocessOptions,
  preprocess,
} from './lib/parser/preprocess';
export { default as print } from './lib/generation/print';
export { sortByLoc } from './lib/generation/util';
export { default as Walker } from './lib/traversal/walker';
export { default as traverse } from './lib/traversal/traverse';
export { NodeVisitor } from './lib/traversal/visitor';
export { cannotRemoveNode, cannotReplaceNode } from './lib/traversal/errors';
export { default as WalkerPath } from './lib/traversal/path';
export { isKeyword, KeywordType, KEYWORDS_TYPES } from './lib/keywords';
export { getTemplateLocals } from './lib/get-template-locals';
export { SYNTAX_ERRORS, VoidSyntaxErrorName } from './lib/errors';

export { SourceSlice } from './lib/source/slice';
export { SourceSpan } from './lib/source/span';
export {
  SpanList,
  maybeLoc,
  MaybeHasSourceSpan,
  loc,
  HasSourceSpan,
  hasSpan,
} from './lib/source/span-list';

export { node } from './lib/v2-a/objects/node';

/** @deprecated use WalkerPath instead */
export { default as Path } from './lib/traversal/walker';

/** @deprecated use ASTv1 instead */
export * as AST from './lib/v1/api';
