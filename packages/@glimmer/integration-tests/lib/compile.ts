import { precompileJSON } from '@glimmer/compiler';
import { SerializedTemplateWithLazyBlock, Template, TemplateFactory } from '@glimmer/interfaces';
import { templateFactory } from '@glimmer/opcode-compiler';
import { optionsWithDefaultModule, PrecompileOptions } from '@glimmer/syntax';

// TODO: This fundamentally has little to do with testing and
// most tests should just use a more generic preprocess, extracted
// out of the test environment.
export function preprocess(templateSource: string, options?: PrecompileOptions): Template {
  return createTemplate(templateSource, options)({});
}

let templateId = 0;

export function createTemplate(
  templateSource: string,
  options: PrecompileOptions = {},
  scopeValues: Record<string, unknown> = {}
): TemplateFactory {
  options.locals = options.locals ?? Object.keys(scopeValues ?? {});
  const id = String(templateId++);
  const withModule = optionsWithDefaultModule(options, `(unknown ember template)`);
  let [block, usedLocals] = precompileJSON(templateSource, withModule);
  let reifiedScopeValues = usedLocals.map((key) => scopeValues[key]);

  let templateBlock: SerializedTemplateWithLazyBlock = {
    id: String(id),
    block: JSON.stringify(block),
    moduleName: withModule.meta.moduleName,
    scope: reifiedScopeValues.length > 0 ? () => reifiedScopeValues : null,
    isStrictMode: options.strictMode ?? false,
  };

  return templateFactory(templateBlock);
}

export function syntaxErrorFor(
  syntaxError: string,
  code: string,
  moduleName: string,
  line: number,
  column: number
): Error {
  let quotedCode = code ? `\n\n|\n|  ${code.split('\n').join('\n|  ')}\n|\n\n` : '';

  let error = new Error(
    `${syntaxError}: ${quotedCode}(error occurred in '${moduleName}' @ line ${line} : column ${column})`
  );

  error.name = 'SyntaxError';

  return error;
}
