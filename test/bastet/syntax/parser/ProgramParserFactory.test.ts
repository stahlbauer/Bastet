import {InvalidInputFormatException} from "../../../../src/bastet/core/exceptions/InvalidInputFormatException";
import {NotSupportedException} from "../../../../src/bastet/core/exceptions/NotSupportedException";
import {ParsingException} from "../../../../src/bastet/core/exceptions/ParsingException";
import {ProgramParserFactory} from "../../../../src/bastet/syntax/parser/ProgramParserFactory";
import {TextualProgramParser} from "../../../../src/bastet/syntax/parser/TextualProgramParser";

describe("ProgramParserFactory", () => {
    test.each(["program.sc", "program.le"])("selects the textual parser for %s", (filename) => {
        expect(ProgramParserFactory.createParserFor(filename)).toBeInstanceOf(TextualProgramParser);
    });

    test("rejects unsupported Scratch archives", () => {
        expect(() => ProgramParserFactory.createParserFor("program.sb2")).toThrow(NotSupportedException);
    });

    test("rejects unknown input formats and reports the filename", () => {
        expect(() => ProgramParserFactory.createParserFor("program.txt"))
            .toThrow(new InvalidInputFormatException("The given file does not map to a parser: program.txt"));
    });
});

describe("TextualProgramParser", () => {
    const parser = new TextualProgramParser();

    test("parses a minimal program", () => {
        const result = parser.parseSource("minimal.sc", "program MinimalProgram");

        expect(result.text).toBe("programMinimalProgram<EOF>");
    });

    test("wraps syntax failures in a ParsingException", () => {
        expect(() => parser.parseSource("invalid.sc", "actor without a program"))
            .toThrow(ParsingException);
    });
});
