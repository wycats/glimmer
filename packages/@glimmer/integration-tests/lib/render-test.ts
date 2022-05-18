import { destroy } from '@glimmer/destroyable';
import {
  ComponentDefinitionState,
  Dict,
  DynamicScope,
  Helper,
  Maybe,
  Option,
  RenderResult,
} from '@glimmer/interfaces';
import { inTransaction } from '@glimmer/runtime';
import {
  ASTPluginBuilder,
  GlimmerSyntaxError,
  NormalizedPreprocessFields,
  NormalizedPreprocessOptions,
  preprocess,
  SourceSpan,
  SourceTemplate,
  symbolicMessage,
  SymbolicSyntaxError,
} from '@glimmer/syntax';
import { assert, clearElement, dict, existing } from '@glimmer/util';
import { dirtyTagFor } from '@glimmer/validator';
import { SimpleElement, SimpleNode } from '@simple-dom/interface';
import { createTemplate } from './compile';
import {
  ComponentBlueprint,
  ComponentKind,
  ComponentTypes,
  CURLY_TEST_COMPONENT,
  GLIMMER_TEST_COMPONENT,
} from './components';
import { assertElementShape, assertEmberishElement } from './dom/assertions';
import { assertElement, toInnerHTML } from './dom/simple-utils';
import { UserHelper } from './helpers';
import { TestModifierConstructor } from './modifiers';
import RenderDelegate from './render-delegate';
import { equalTokens, isServerMarker, NodesSnapshot, normalizeSnapshot } from './snapshot';

export interface IRenderTest {
  readonly count: Count;
  testType: ComponentKind;
  beforeEach?(): void;
  afterEach?(): void;
}

export class Count {
  private expected = dict<number>();
  private actual = dict<number>();

  expect(name: string, count = 1) {
    this.expected[name] = count;
    this.actual[name] = (this.actual[name] || 0) + 1;
  }

  assert() {
    QUnit.assert.deepEqual(this.actual, this.expected, 'TODO');
  }
}

export class RenderTest implements IRenderTest {
  testType!: ComponentKind;

  protected element: SimpleElement;
  protected assert = QUnit.assert;
  protected context: Dict = dict();
  protected renderResult: Option<RenderResult> = null;
  protected helpers = dict<UserHelper>();
  protected snapshot: NodesSnapshot = [];
  readonly count = new Count();

  constructor(protected delegate: RenderDelegate) {
    this.element = delegate.getInitialElement();
  }

  registerPlugin(plugin: ASTPluginBuilder): void {
    this.delegate.registerPlugin(plugin);
  }

  registerHelper(name: string, helper: UserHelper): void {
    this.delegate.registerHelper(name, helper);
  }

  registerInternalHelper(name: string, helper: Helper): void {
    this.delegate.registerInternalHelper(name, helper);
  }

  registerModifier(name: string, ModifierClass: TestModifierConstructor): void {
    this.delegate.registerModifier(name, ModifierClass);
  }

  registerComponent<K extends ComponentKind>(
    type: K,
    name: string,
    layout: string,
    Class?: ComponentTypes[K]
  ): void {
    this.delegate.registerComponent(type, this.testType, name, layout, Class);
  }

  buildComponent(blueprint: ComponentBlueprint): string {
    let invocation = '';
    switch (this.testType) {
      case 'Glimmer':
        invocation = this.buildGlimmerComponent(blueprint);
        break;
      case 'Curly':
        invocation = this.buildCurlyComponent(blueprint);
        break;
      case 'Dynamic':
        invocation = this.buildDynamicComponent(blueprint);
        break;
      case 'TemplateOnly':
        invocation = this.buildTemplateOnlyComponent(blueprint);
        break;

      default:
        throw new Error(`Invalid test type ${this.testType}`);
    }

    return invocation;
  }

  #syntaxError = (options: {
    compile: (source: AnnotatedSource) => void;
    input: string;
    error: SymbolicSyntaxError;
    options?: Partial<NormalizedPreprocessOptions>;
  }): void => {
    const annotated = AnnotatedSource.from(options.input, {
      module: { name: 'test-module', synthesized: false },
      ...options.options,
    });

    try {
      options.compile(annotated);
    } catch (e) {
      if (e instanceof GlimmerSyntaxError) {
        // this.assert.deepEqual(
        //   { span: e.location.loc, code: e.code },
        //   { span: annotated.span.loc, code: annotated.span.asString() }
        // );

        equalStrings(e.message, GlimmerSyntaxError.from(options.error, annotated.span).message);
      } else {
        this.assert.ok(false, `Expected GlimmerSyntaxError, got a different kind of error`);
        throw e;
      }
    }
  };

  componentSyntaxError(
    input: string,
    {
      error,
      mode,
      scope = {},
    }: {
      error: SymbolicSyntaxError;
      scope?: Record<string, unknown>;
      mode: 'strict' | 'loose' | 'both';
    }
  ) {
    if (mode === 'both') {
      this.componentSyntaxError(input, { error, mode: 'strict', scope });
      this.componentSyntaxError(input, { error, mode: 'loose', scope });
    } else {
      this.#syntaxError({
        compile: (annotated) => {
          createTemplate(
            annotated.source,
            { strictMode: mode === 'strict', meta: { moduleName: 'component-module' } },
            scope
          );
        },
        input,
        error,
        options: { module: { name: 'component-module', synthesized: false } },
      });
    }
  }

  syntaxError(
    input: string,
    error: SymbolicSyntaxError,
    options?: Partial<NormalizedPreprocessFields>
  ) {
    this.#syntaxError({
      compile: (annotated) => {
        preprocess.normalized(annotated.template, annotated.options);
      },
      input,
      error,
      options,
    });
  }

  private buildArgs(args: Dict): string {
    let { testType } = this;
    let sigil = '';
    let needsCurlies = false;

    if (testType === 'Glimmer' || testType === 'TemplateOnly') {
      sigil = '@';
      needsCurlies = true;
    }

    return `${Object.keys(args)
      .map((arg) => {
        let rightSide: string;

        let value = args[arg] as Maybe<string[]>;
        if (needsCurlies) {
          let isString = value && (value[0] === "'" || value[0] === '"');
          if (isString) {
            rightSide = `${value}`;
          } else {
            rightSide = `{{${value}}}`;
          }
        } else {
          rightSide = `${value}`;
        }

        return `${sigil}${arg}=${rightSide}`;
      })
      .join(' ')}`;
  }

  private buildBlockParams(blockParams: string[]): string {
    return `${blockParams.length > 0 ? ` as |${blockParams.join(' ')}|` : ''}`;
  }

  private buildElse(elseBlock: string | undefined): string {
    return `${elseBlock ? `{{else}}${elseBlock}` : ''}`;
  }

  private buildAttributes(attrs: Dict = {}): string {
    return Object.keys(attrs)
      .map((attr) => `${attr}=${attrs[attr]}`)
      .join(' ');
  }

  private buildAngleBracketComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      attributes = {},
      template,
      name = GLIMMER_TEST_COMPONENT,
      blockParams = [],
    } = blueprint;

    let invocation: string | string[] = [];

    invocation.push(`<${name}`);

    let componetArgs = this.buildArgs(args);

    if (componetArgs !== '') {
      invocation.push(componetArgs);
    }

    let attrs = this.buildAttributes(attributes);
    if (attrs !== '') {
      invocation.push(attrs);
    }

    let open = invocation.join(' ');
    invocation = [open];

    if (template) {
      let block: string | string[] = [];
      let params = this.buildBlockParams(blockParams);
      if (params !== '') {
        block.push(params);
      }
      block.push(`>`);
      block.push(template);
      block.push(`</${name}>`);
      invocation.push(block.join(''));
    } else {
      invocation.push(' ');
      invocation.push(`/>`);
    }

    return invocation.join('');
  }

  private buildGlimmerComponent(blueprint: ComponentBlueprint): string {
    let { tag = 'div', layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
    let invocation = this.buildAngleBracketComponent(blueprint);
    let layoutAttrs = this.buildAttributes(blueprint.layoutAttributes);
    this.assert.ok(
      true,
      `generated glimmer layout as ${`<${tag} ${layoutAttrs} ...attributes>${layout}</${tag}>`}`
    );
    this.delegate.registerComponent(
      'Glimmer',
      this.testType,
      name,
      `<${tag} ${layoutAttrs} ...attributes>${layout}</${tag}>`
    );
    this.assert.ok(true, `generated glimmer invocation as ${invocation}`);
    return invocation;
  }

  private buildCurlyBlockTemplate(
    name: string,
    template: string,
    blockParams: string[],
    elseBlock?: string
  ): string {
    let block: string[] = [];
    block.push(this.buildBlockParams(blockParams));
    block.push('}}');
    block.push(template);
    block.push(this.buildElse(elseBlock));
    block.push(`{{/${name}}}`);
    return block.join('');
  }

  private buildCurlyComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      layout,
      template,
      attributes,
      else: elseBlock,
      name = CURLY_TEST_COMPONENT,
      blockParams = [],
    } = blueprint;

    if (attributes) {
      throw new Error('Cannot pass attributes to curly components');
    }

    let invocation: string[] | string = [];

    if (template) {
      invocation.push(`{{#${name}`);
    } else {
      invocation.push(`{{${name}`);
    }

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(' ');
      invocation.push(componentArgs);
    }

    if (template) {
      invocation.push(this.buildCurlyBlockTemplate(name, template, blockParams, elseBlock));
    } else {
      invocation.push('}}');
    }
    this.assert.ok(true, `generated curly layout as ${layout}`);
    this.delegate.registerComponent('Curly', this.testType, name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated curly invocation as ${invocation}`);
    return invocation;
  }

  private buildTemplateOnlyComponent(blueprint: ComponentBlueprint): string {
    let { layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
    let invocation = this.buildAngleBracketComponent(blueprint);
    this.assert.ok(true, `generated fragment layout as ${layout}`);
    this.delegate.registerComponent('TemplateOnly', this.testType, name, `${layout}`);
    this.assert.ok(true, `generated fragment invocation as ${invocation}`);
    return invocation;
  }

  private buildDynamicComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      layout,
      template,
      attributes,
      else: elseBlock,
      name = GLIMMER_TEST_COMPONENT,
      blockParams = [],
    } = blueprint;

    if (attributes) {
      throw new Error('Cannot pass attributes to curly components');
    }

    let invocation: string | string[] = [];
    if (template) {
      invocation.push('{{#component this.componentName');
    } else {
      invocation.push('{{component this.componentName');
    }

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(' ');
      invocation.push(componentArgs);
    }

    if (template) {
      invocation.push(this.buildCurlyBlockTemplate('component', template, blockParams, elseBlock));
    } else {
      invocation.push('}}');
    }

    this.assert.ok(true, `generated dynamic layout as ${layout}`);
    this.delegate.registerComponent('Curly', this.testType, name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated dynamic invocation as ${invocation}`);

    return invocation;
  }

  shouldBeVoid(tagName: string) {
    clearElement(this.element);
    let html = '<' + tagName + " data-foo='bar'><p>hello</p>";
    this.delegate.renderTemplate(html, this.context, this.element, () => this.takeSnapshot());

    let tag = '<' + tagName + ' data-foo="bar">';
    let closing = '</' + tagName + '>';
    let extra = '<p>hello</p>';
    html = toInnerHTML(this.element);

    QUnit.assert.pushResult({
      result: html === tag + extra || html === tag + closing + extra,
      actual: html,
      expected: tag + closing + extra,
      message: tagName + ' should be a void element',
    });
  }

  render(template: string | ComponentBlueprint, properties: Dict<unknown> = {}): void {
    try {
      QUnit.assert.ok(true, `Rendering ${template} with ${JSON.stringify(properties)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    if (typeof template === 'object') {
      let blueprint = template as ComponentBlueprint;
      template = this.buildComponent(blueprint);

      if (this.testType === 'Dynamic' && properties['componentName'] === undefined) {
        properties['componentName'] = blueprint.name || GLIMMER_TEST_COMPONENT;
      }
    }

    this.setProperties(properties);

    this.renderResult = this.delegate.renderTemplate(template, this.context, this.element, () =>
      this.takeSnapshot()
    );
  }

  renderComponent(
    component: ComponentDefinitionState,
    args: Dict<unknown> = {},
    dynamicScope?: DynamicScope
  ): void {
    try {
      QUnit.assert.ok(true, `Rendering ${String(component)} with ${JSON.stringify(args)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    assert(
      this.delegate.renderComponent,
      'Attempted to render a component, but the delegate did not implement renderComponent'
    );

    this.renderResult = this.delegate.renderComponent(component, args, this.element, dynamicScope);
  }

  rerender(properties: Dict<unknown> = {}): void {
    try {
      QUnit.assert.ok(true, `rerender ${JSON.stringify(properties)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    this.setProperties(properties);

    let result = existing(this.renderResult, 'the test should call render() before rerender()');

    try {
      result.env.begin();
      result.rerender();
    } finally {
      result.env.commit();
    }
  }

  destroy(): void {
    let result = existing(this.renderResult, 'the test should call render() before destroy()');

    inTransaction(result.env, () => destroy(result));
  }

  protected set(key: string, value: unknown): void {
    this.context[key] = value;
    dirtyTagFor(this.context, key);
  }

  protected setProperties(properties: Dict<unknown>): void {
    for (let key in properties) {
      this.set(key, properties[key]);
    }
  }

  protected takeSnapshot(): NodesSnapshot {
    let snapshot: NodesSnapshot = (this.snapshot = []);

    let node = this.element.firstChild;
    let upped = false;

    while (node && node !== this.element) {
      if (upped) {
        if (node.nextSibling) {
          node = node.nextSibling;
          upped = false;
        } else {
          snapshot.push('up');
          node = node.parentNode;
        }
      } else {
        if (!isServerMarker(node)) snapshot.push(node);

        if (node.firstChild) {
          snapshot.push('down');
          node = node.firstChild;
        } else if (node.nextSibling) {
          node = node.nextSibling;
        } else {
          snapshot.push('up');
          node = node.parentNode;
          upped = true;
        }
      }
    }

    return snapshot;
  }

  protected assertStableRerender() {
    this.takeSnapshot();
    this.runTask(() => this.rerender());
    this.assertStableNodes();
  }

  protected assertHTML(html: string, elementOrMessage?: SimpleElement | string, message?: string) {
    if (typeof elementOrMessage === 'object') {
      equalTokens(elementOrMessage || this.element, html, message ? `${html} (${message})` : html);
    } else {
      equalTokens(this.element, html, elementOrMessage ? `${html} (${elementOrMessage})` : html);
    }
    this.takeSnapshot();
  }

  protected assertComponent(content: string, attrs: Object = {}) {
    let element = assertElement(this.element.firstChild);

    switch (this.testType) {
      case 'Glimmer':
        assertElementShape(element, 'div', attrs, content);
        break;
      default:
        assertEmberishElement(element, 'div', attrs, content);
    }

    this.takeSnapshot();
  }

  private runTask<T>(callback: () => T): T {
    return callback();
  }

  protected assertStableNodes(
    { except: _except }: { except: SimpleNode | SimpleNode[] } = {
      except: [],
    }
  ) {
    let except: Array<SimpleNode>;

    if (Array.isArray(_except)) {
      except = uniq(_except);
    } else {
      except = [_except];
    }

    let { oldSnapshot, newSnapshot } = normalizeSnapshot(
      this.snapshot,
      this.takeSnapshot(),
      except
    );

    this.assert.deepEqual(oldSnapshot, newSnapshot, 'DOM nodes are stable');
  }
}

function uniq(arr: any[]) {
  return arr.reduce((accum, val) => {
    if (accum.indexOf(val) === -1) accum.push(val);
    return accum;
  }, []);
}

class AnnotatedSource {
  static from(annotated: string, options?: Partial<NormalizedPreprocessFields>) {
    const open = annotated.indexOf('~#');

    if (open === -1) {
      throw new Error(`Expected to find a ~# in ${annotated}`);
    }

    const secondOpen = annotated.indexOf('~#', open + 1);

    if (secondOpen !== -1) {
      throw Error(`Expected only one ~# in ${annotated}`);
    }

    const close = annotated.indexOf('#~');

    if (close === -1) {
      throw new Error(`Expected to find a #~ in ${annotated}`);
    }

    const secondClose = annotated.indexOf('#~', close + 1);

    if (secondClose !== -1) {
      throw Error(`Expected only one #~ in ${annotated}`);
    }

    const before = annotated.slice(0, open);
    const after = annotated.slice(close + 2);
    const at = annotated.slice(open + 2, close);

    const source = `${before}${at}${after}`;

    const template = options
      ? SourceTemplate.fromNormalized(
          source,
          NormalizedPreprocessOptions.fromFields(options ?? {}, {
            name: 'test-module',
            synthesized: false,
          })
        )
      : SourceTemplate.from(source, 'test-module');

    const span = SourceSpan.forCharPositions(template, open, open + at.length);

    return new AnnotatedSource(template, source, span);
  }

  #template: SourceTemplate;
  #source: string;
  #span: SourceSpan;

  constructor(template: SourceTemplate, source: string, span: SourceSpan) {
    this.#template = template;
    this.#source = source;
    this.#span = span;
  }

  get template(): SourceTemplate {
    return this.#template;
  }

  get options(): NormalizedPreprocessOptions {
    return this.#template.options;
  }

  get module(): string {
    return this.#template.module;
  }

  get source(): string {
    return this.#source;
  }

  get span(): SourceSpan {
    return this.#span;
  }
}

function equalStrings(actual: string, expected: string, message?: string) {
  if (actual === expected) {
    QUnit.assert.strictEqual(actual, expected);
  } else {
    QUnit.assert.pushResult({
      result: false,
      actual: document.createTextNode(actual),
      expected: document.createTextNode(expected),
      message: message ?? `expected strings to be equal`,
    });
  }
}
