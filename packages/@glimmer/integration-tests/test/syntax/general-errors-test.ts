import { RenderTest, jitSuite, test, preprocess, syntaxErrorFor } from '../..';

class SyntaxErrors extends RenderTest {
  static suiteName = 'general syntax errors';

  @test
  'context switching using ../ is not allowed'() {
    this.assert.throws(() => {
      preprocess('<div><p>{{../value}}</p></div>', { meta: { moduleName: 'test-module' } });
    }, syntaxErrorFor('Changing context using "../" is not supported in Glimmer', '../value', 'test-module', 1, 10));
  }

  @test
  'mixing . and / is not allowed'() {
    this.assert.throws(() => {
      preprocess('<div><p>{{a/b.c}}</p></div>', { meta: { moduleName: 'test-module' } });
    }, syntaxErrorFor("Mixing '.' and '/' in paths is not supported in Glimmer; use only '.' to separate property paths", 'a/b.c', 'test-module', 1, 10));
  }

  @test
  'explicit self ref with ./ is not allowed'() {
    this.assert.throws(() => {
      preprocess('<div><p>{{./value}}</p></div>', { meta: { moduleName: 'test-module' } });
    }, syntaxErrorFor('Using "./" is not supported in Glimmer and unnecessary', './value', 'test-module', 1, 10));
  }

  @test
  'Block params in HTML syntax - Throws exception if given zero parameters'() {
    this.syntaxError(`<x-bar as ~#||#~>foo</x-bar>`, 'block-params.empty');
    this.syntaxError(`<x-bar as ~#| |#~>foo</x-bar>`, 'block-params.empty');
  }

  @test
  'Block params in HTML syntax - Throws an error on invalid block params syntax'() {
    this.syntaxError(`<x-bar as ~#|x y#~>{{x}},{{y}}</x-bar>`, 'block-params.unclosed');
    this.syntaxError(`<x-bar as |x| ~#y#~>{{x}},{{y}}</x-bar>`, 'block-params.extra-attrs');
    this.syntaxError(`<x-bar as |x| ~#y|#~>{{x}},{{y}}</x-bar>`, 'block-params.extra-pipes');
    this.syntaxError(
      `<x-bar as |x| ~#y| z#~>{{x}},{{y}}</x-bar>`,
      'block-params.extra-pipes-and-attrs'
    );
  }

  @test
  'Block params in HTML syntax - Throws an error on invalid identifiers for params'() {
    this.syntaxError(`<x-bar as |x ~#foo.bar#~|></x-bar>`, ['block-params.invalid-id', 'foo.bar']);
    this.syntaxError(`<x-bar as |x ~#"#~foo"|></x-bar>`, ['block-params.invalid-id', '"']);
    this.syntaxError(`<x-bar as |x ~#foo[bar]#~|></x-bar>`, ['block-params.invalid-id', '"']);
  }

  @test
  'Block params in HTML syntax - Throws an error on missing `as`'() {
    this.syntaxError(`<x-bar ~#|x|#~></x-bar>`, 'block-params.missing-as');
    this.syntaxError(`<x-bar><:baz ~#|x|#~></:baz></x-bar>`, 'block-params.missing-as');
  }
}

jitSuite(SyntaxErrors);
