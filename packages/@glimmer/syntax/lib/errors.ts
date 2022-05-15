export const SYNTAX_ERRORS = {
  'block-params.empty': `Empty block params are not allowed`,
  'block-params.unclosed': `Unclosed block parameters`,
  'block-params.extra-pipes-and-attrs': `Extra pipes and attributes after block parameters. The closing pipe after the last block parameter must be the last thing in a tag with block parameters`,
  'block-params.extra-pipes': `Extra pipes after block parameters. The closing pipe after the last block parameter must be the last thing in a tag with block parameters`,
  'block-params.extra-attrs': `Extra attributes after block parameters. The closing pipe after the last block parameter must be the last thing in a tag with block parameters`,
  'block-params.missing-pipe': 'The `as` keyword must immediately precede a pipe character',
  'block-params.missing-as': 'Block params must be immediately preceded by `as`',
  'block-params.missing-as-before-unclosed-pipe':
    'The `|` character, which begins block parameters, must be preceded by `as`, closed by another `|`, and be the last thing in an opening tag',
  'elements.invalid-attrs-in-end-tag': `Invalid end tag: closing tag must not have attributes`,
  'attrs.invalid-attr-value': `An unquoted attribute value must be a string or a mustache, preceded by whitespace or a '=' character, and followed by whitespace, a '>' character, or '/>`,

  'block-params.invalid-id': (name: string) => `Invalid identifier for block parameters, '${name}'`,
  'elements.unclosed-element': (tag: string) => `Unclosed element ${tag}`,
  'elements.end-without-start-tag': (tag: string) => `Closing tag </${tag}> without an open tag`,
  'elements.unnecessary-end-tag': (tag: string) =>
    `<${tag}> elements do not need end tags. You should remove it`,
  'elements.unbalanced-tags': ({ open, close }: { open: string; close: string }) =>
    `Closing tag </${close}> did not match last open tag <${open}>`,
  'attrs.invalid-char': (char: string) => `${char} is not a valid character within attribute names`,
} as const;
export type SYNTAX_ERRORS = typeof SYNTAX_ERRORS;

export type VoidSyntaxErrors = {
  [P in keyof SYNTAX_ERRORS]: SYNTAX_ERRORS[P] extends string ? SYNTAX_ERRORS[P] : never;
};

export type VoidSyntaxErrorName = {
  [P in keyof VoidSyntaxErrors]: VoidSyntaxErrors[P] extends never ? never : P;
}[keyof VoidSyntaxErrors];

export type ParameterizedSyntaxErrors = {
  [P in keyof SYNTAX_ERRORS]: SYNTAX_ERRORS[P] extends <T>(arg: T) => string
    ? SYNTAX_ERRORS[P]
    : never;
};

export type SyntaxErrorName<V> = {
  [P in keyof SYNTAX_ERRORS]: SYNTAX_ERRORS[P] extends V ? P : never;
}[keyof SYNTAX_ERRORS];
