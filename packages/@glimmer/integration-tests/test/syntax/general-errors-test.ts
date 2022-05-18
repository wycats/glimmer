import { RenderTest, jitSuite, test, preprocess, syntaxErrorFor } from '../..';

class SyntaxErrors extends RenderTest {
  static suiteName = 'general syntax errors';

  @test
  'context switching using ../ is not allowed'() {
    this.syntaxError(`<div><p>{{~#../value#~}}</p></div>`, `hbs.syntax.invalid-dotdot`);
  }

  @test
  'mixing . and / is not allowed'() {
    this.syntaxError(`<div><p>{{~#a/b.c#~}}</p></div>`, 'hbs.syntax.invalid-slash');
  }

  @test
  'explicit self ref with ./ is not allowed'() {
    this.syntaxError(`<div><p>{{~#./value#~}}</p></div>`, 'hbs.syntax.invalid-dotslash');
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
    this.syntaxError(`<x-bar as |x ~#"foo"#~|></x-bar>`, ['block-params.invalid-id', '"']);
    this.syntaxError(`<x-bar as |x ~#foo[bar]#~|></x-bar>`, ['block-params.invalid-id', '"']);
  }

  @test
  'Block params in HTML syntax - Throws an error on missing `as`'() {
    this.syntaxError(`<x-bar ~#|x|#~></x-bar>`, 'block-params.missing-as');
    this.syntaxError(`<x-bar><:baz ~#|x|#~></:baz></x-bar>`, 'block-params.missing-as');
  }
}

jitSuite(SyntaxErrors);
