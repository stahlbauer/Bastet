import {IllegalArgumentException} from "../../../src/bastet/core/exceptions/IllegalArgumentException";
import {IllegalStateException} from "../../../src/bastet/core/exceptions/IllegalStateException";
import {Preconditions} from "../../../src/bastet/utils/Preconditions";

describe("Preconditions", () => {
    test("returns valid values unchanged", () => {
        const dictionary = {value: 1};

        expect(Preconditions.checkIsDic(dictionary)).toBe(dictionary);
        expect(Preconditions.checkNotEmpty("value")).toBe("value");
        expect(Preconditions.checkNotUndefined(dictionary)).toBe(dictionary);
        expect(Preconditions.checkNotUndefined("")).toBe("");
    });

    test.each([null, [], new Date(0)])("rejects non-dictionaries", (value) => {
        expect(() => Preconditions.checkIsDic(value)).toThrow(IllegalArgumentException);
    });

    test("uses supplied argument and state messages", () => {
        expect(() => Preconditions.checkArgument(false, "bad argument"))
            .toThrow(new IllegalArgumentException("bad argument"));
        expect(() => Preconditions.checkState(false, "bad state"))
            .toThrow(new IllegalStateException("bad state"));
    });

    test("uses stable default messages", () => {
        expect(() => Preconditions.checkArgument(false)).toThrow("Illegal argument!");
        expect(() => Preconditions.checkState(false)).toThrow("Illegal state!");
        expect(() => Preconditions.checkNotEmpty("")).toThrow("String must not be empty");
        expect(() => Preconditions.checkNotUndefined(undefined)).toThrow("Reference must not be undefined.");
    });
});
