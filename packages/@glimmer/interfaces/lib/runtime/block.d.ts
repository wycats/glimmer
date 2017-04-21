import { SymbolTable, BlockSymbolTable, ProgramSymbolTable } from "../tier1/symbol-table";

interface Compilable<S extends SymbolTable> {
  compileStatic(): { start: number, end: number };
  compileDynamic(): { start: number, end: number, symbolTable: S };
}

export type Block = Compilable<BlockSymbolTable>;
export type Program = Compilable<ProgramSymbolTable>;