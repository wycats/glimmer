import { RenderTest, test, jitSuite } from '../..';

class LogTest extends RenderTest {
  static suiteName = '{{log}} keyword';

  originalLog?: () => void;
  logCalls: unknown[] = [];

  beforeEach() {
    /* eslint-disable no-console */
    this.originalLog = console.log;
    console.log = (...args: unknown[]) => {
      this.logCalls.push(...args);
      /* eslint-enable no-console */
    };
  }

  afterEach() {
    /* eslint-disable no-console */
    console.log = this.originalLog!;
    /* eslint-enable no-console */
  }

  assertLog(values: unknown[]) {
    this.assertHTML('');
    this.assert.strictEqual(
      this.logCalls.length,
      values.length,
      `expected log to be called ${values.length} times, but it was called ${this.logCalls.length}`
    );

    for (let i = 0, len = values.length; i < len; i++) {
      this.assert.strictEqual(
        this.logCalls[i],
        values[i],
        `${i}. mismatched log entry. expected log call to be ${stringify(
          values[i]
        )}, but it was ${stringify(this.logCalls[i])}`
      );
    }
  }

  @test
  ['correctly logs primitives']() {
    this.render(`{{log "one" 1 true}}`);

    this.assertLog(['one', 1, true]);
  }

  @test
  ['correctly logs a property']() {
    this.render(`{{log this.value}}`, {
      value: 'one',
    });

    this.assertLog(['one']);
  }

  @test
  ['correctly logs multiple arguments']() {
    this.render(`{{log "my variable:" this.value}}`, {
      value: 'one',
    });

    this.assertLog(['my variable:', 'one']);
  }

  @test
  ['correctly logs `this`']() {
    this.render(`{{log this}}`);

    this.assertLog([this.context]);
  }

  @test
  ['correctly logs as a subexpression']() {
    this.render(`{{if (log "one" 1 true) "Hello!"}}`);

    this.assertLog(['one', 1, true]);
  }

  @test
  ['correctly logs when values update']() {
    this.render(`{{log this.foo}}`, { foo: 123 });

    this.rerender({ foo: 456 });
    this.rerender({ foo: true });

    this.assertLog([123, 456, true]);
  }
}

jitSuite(LogTest);

function stringify(value: unknown) {
  if (typeof value === 'string') {
    return `"${value}"`;
  } else if (typeof value === 'number') {
    return `${value}`;
  } else if (typeof value === 'boolean') {
    return `${value}`;
  } else if (value === null) {
    return 'null';
  } else if (typeof value === 'object') {
    if (
      Object.getPrototypeOf(value) === null ||
      Object.getPrototypeOf(value) === Object.prototype ||
      ('toJSON' in (value as Record<string, unknown>) &&
        typeof (value as Record<string, unknown>).toJSON === 'function')
    ) {
      return JSON.stringify(value);
    } else {
      return String(value);
    }
  } else {
    return `${value}`;
  }
}
