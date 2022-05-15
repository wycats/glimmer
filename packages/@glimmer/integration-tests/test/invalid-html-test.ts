import { RenderTest, test, jitSuite, preprocess, syntaxErrorFor } from '..';

class CompileErrorTests extends RenderTest {
  static suiteName = 'compile errors';

  @test
  'A helpful error message is provided for unclosed elements'() {
    this.syntaxError(`\n<~#div#~ class="my-div" \n foo={{bar}}>\n<span>\n</span>\n'`, [
      'elements.unclosed-element',
      'div',
    ]);
    this.syntaxError('\n<div class="my-div">\n<~#span#~>\n', [`elements.unclosed-element`, 'span']);

    // this.assert.throws(() => {
    //   preprocess('\n<div class="my-div" \n foo={{bar}}>\n<span>\n</span>\n', {
    //     meta: { moduleName: 'test-module' },
    //   });
    // }, syntaxErrorFor('Unclosed element `div`', '<div class="my-div" \n foo={{bar}}>', 'test-module', 2, 0));
  }

  @test
  'A helpful error message is provided for unmatched end tags'() {
    this.syntaxError(`~#</p>#~`, ['elements.end-without-start-tag', 'p']);
    this.syntaxError('<em>{{ foo }}</em> \n {{ bar }}\n~#</div>#~', [
      'elements.end-without-start-tag',
      'div',
    ]);
    // this.assert.throws(() => {
    //   preprocess('</p>', { meta: { moduleName: 'test-module' } });
    // }, syntaxErrorFor('Closing tag </p> without an open tag', '</p>', 'test-module', 1, 0));

    // this.assert.throws(() => {
    //   preprocess('<em>{{ foo }}</em> \n {{ bar }}\n</div>', {
    //     meta: { moduleName: 'test-module' },
    //   });
    // }, syntaxErrorFor('Closing tag </div> without an open tag', '</div>', 'test-module', 3, 0));
  }

  @test
  'A helpful error message is provided for end tags for void elements'() {
    this.syntaxError(`<input>~#</input>#~`, ['elements.unnecessary-end-tag', 'input']);
    this.syntaxError(`<div>\n  <input>~#</input>#~\n</div>`, [
      'elements.unnecessary-end-tag',
      'input',
    ]);
    this.syntaxError(`\n\n~#</br>#~`, ['elements.unnecessary-end-tag', 'br']);
  }

  @test
  'A helpful error message is provided for end tags with attributes'() {
    this.syntaxError(
      `<div>\nSomething\n\n</div ~#foo="bar"#~>`,
      'elements.invalid-attrs-in-end-tag'
    );
  }

  @test
  'A helpful error message is provided for mismatched start/end tags'() {
    this.syntaxError(`<div>\n<p>\nSomething\n\n~#</div>#~`, [
      `elements.unbalanced-tags`,
      { open: 'p', close: 'div' },
    ]);
    // this.assert.throws(() => {
    //   preprocess('<div>\n<p>\nSomething\n\n</div>', { meta: { moduleName: 'test-module' } });
    // }, syntaxErrorFor('Closing tag </div> did not match last open tag <p> (on line 2)', '</div>', 'test-module', 5, 0));
  }

  @test
  'error line numbers include comment lines'() {
    this.syntaxError('<div>\n<p>\n{{! some comment}}\n\n~#</div>#~', [
      `elements.unbalanced-tags`,
      { open: 'p', close: 'div' },
    ]);
  }

  @test
  'error line numbers include mustache only lines'() {
    this.syntaxError('<div>\n<p>\n{{someProp}}\n\n~#</div>#~', [
      'elements.unbalanced-tags',
      { open: 'p', close: 'div' },
    ]);
  }

  @test
  'error line numbers include block lines'() {
    this.syntaxError('<div>\n<p>\n{{#some-comment}}\n{{/some-comment}}\n~#</div>#~', [
      'elements.unbalanced-tags',
      { open: 'p', close: 'div' },
    ]);
  }

  @test
  'error line numbers include whitespace control mustaches'() {
    this.syntaxError('<div>\n<p>\n{{someProp~}}\n\n~#</div>#~{{some-comment}}', [
      'elements.unbalanced-tags',
      { open: 'p', close: 'div' },
    ]);
  }

  @test
  'error line numbers include multiple mustache lines'() {
    this.syntaxError('<div>\n<p>\n{{some-comment}}~#</div>#~{{some-comment}}', [
      'elements.unbalanced-tags',
      { open: 'p', close: 'div' },
    ]);
  }

  @test
  'Unquoted attribute with expression throws an exception'() {
    this.syntaxError(`<img class=~#foo{{bar}}#~>`, 'attrs.invalid-attr-value');
    this.syntaxError(`<img class=~#{{foo}}{{bar}}#~>`, 'attrs.invalid-attr-value');
    this.syntaxError(`<img class=~#{{foo}}bar#~>`, 'attrs.invalid-attr-value');
    this.syntaxError(`<div \nclass\n=\n~#{{foo}}&amp;bar#~ ></div>`, 'attrs.invalid-attr-value');

    // this.assert.throws(
    //   () => preprocess('<img class=foo{{bar}}>', { meta: { moduleName: 'test-module' } }),
    //   expectedError('class=foo{{bar}}', 1, 5)
    // );
    // this.assert.throws(
    //   () => preprocess('<img class={{foo}}{{bar}}>', { meta: { moduleName: 'test-module' } }),
    //   expectedError('class={{foo}}{{bar}}', 1, 5)
    // );
    // this.assert.throws(
    //   () => preprocess('<img \nclass={{foo}}bar>', { meta: { moduleName: 'test-module' } }),
    //   expectedError('class={{foo}}bar', 2, 0)
    // );
    // this.assert.throws(
    //   () =>
    //     preprocess('<div \nclass\n=\n{{foo}}&amp;bar ></div>', {
    //       meta: { moduleName: 'test-module' },
    //     }),
    //   expectedError('class\n=\n{{foo}}&amp;bar', 2, 0)
    // );

    // function expectedError(code: string, line: number, column: number) {
    //   return syntaxErrorFor(
    //     `An unquoted attribute value must be a string or a mustache, preceded by whitespace or a '=' character, and followed by whitespace, a '>' character, or '/>'`,
    //     code,
    //     'test-module',
    //     line,
    //     column
    //   );
    // }
  }
}

jitSuite(CompileErrorTests);
