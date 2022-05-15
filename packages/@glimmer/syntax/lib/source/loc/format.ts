import { SourceLocation } from '../location';
import { SourceSpan } from './span';

export class FormatSpan {
  #span: SourceSpan;
  #loc: SourceLocation;
  #lines: string[];

  constructor(lines: string[], span: SourceSpan, loc: SourceLocation) {
    this.#span = span;
    this.#loc = loc;
    this.#lines = lines;
  }

  format(): string {
    const { start, end } = this.#loc;

    if (start.line === end.line) {
      const line = this.#lines[start.line - 1];

      const lines = new Lines([
        Line.create(line, start.line, { start: start.column, end: end.column }),
      ]);

      return lines.format(this.#span);
    } else {
      return format(this.#span.asString());
    }
  }
}

interface Annotation {
  columns: {
    start: number;
    end: number;
  };
}

class LineNumber {
  #number: number;

  constructor(number: number) {
    this.#number = number;
  }

  get raw() {
    return this.#number;
  }

  get size() {
    return String(this.#number).length;
  }

  get padding() {
    return ' '.repeat(this.size + 1);
  }

  format(max: LineNumber): string {
    return String(this.#number).padStart(max.size, ' ');
  }
}

class Line {
  static create(line: string, number: number, columns: Annotation['columns'] | undefined) {
    return new Line(line, new LineNumber(number), columns ? { columns } : undefined);
  }

  readonly #line: string;
  readonly #number: LineNumber;
  readonly #annotation: Annotation | undefined;

  constructor(line: string, number: LineNumber, annotation: Annotation | undefined) {
    this.#line = line;
    this.#number = number;
    this.#annotation = annotation;
  }

  get number(): LineNumber {
    return this.#number;
  }

  format(max: LineNumber): string[] {
    const lines = [`${this.#number.format(max)} | ${this.#line}`];

    if (this.#annotation) {
      const marker = formatMarker(this.#annotation.columns, this.#line.length);
      lines.push(`${max.padding}| ${marker}`);
    }

    return lines;
  }
}

class Lines {
  readonly #lines: Line[];
  readonly #max: LineNumber;

  constructor(lines: Line[]) {
    this.#lines = lines;
    this.#max = new LineNumber(Math.max(...lines.map((line) => line.number.raw)));
  }

  format(span: SourceSpan) {
    const lines = this.#lines.flatMap((line) => line.format(this.#max)).join('\n');
    return `\n\n${formatSpan(span)}\n${this.#max.padding}|\n${lines}\n${this.#max.padding}|\n\n`;
  }
}

export function format(code: string): string {
  return formatLines(code.split('\n'));
}

function formatLines(lines: string[], span?: SourceSpan): string {
  const allLines = span ? [formatSpan(span)] : [];
  allLines.push(...lines);

  const linesWithMargin = allLines.map((line) => `|  ${line}`);
  return `\n\n|\n${linesWithMargin.join('\n')}\n|\n\n`;
}

function formatSpan(span: SourceSpan): string {
  const {
    loc: { start, end },
    module,
  } = span;

  return `at ${module}:${start.line}:${start.column}-${end.line}:${end.column}`;
}

function formatMarker(columns: { start: number; end: number }, length: number): string {
  const size = columns.end - columns.start;
  const after = length - size - columns.start;

  return `${' '.repeat(columns.start)}${'~'.repeat(size)}${' '.repeat(after)}`;
}
