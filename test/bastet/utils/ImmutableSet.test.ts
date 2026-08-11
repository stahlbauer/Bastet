import {ImmutableSet} from "../../../src/bastet/utils/ImmutableSet";

describe("ImmutableSet", () => {
    test("deduplicates its input and exposes the readonly set contract", () => {
        const subject = new ImmutableSet([1, 2, 2]);

        expect(subject.size).toBe(2);
        expect(subject.has(1)).toBe(true);
        expect([...subject]).toEqual([1, 2]);
        expect([...subject.keys()]).toEqual([1, 2]);
        expect([...subject.values()]).toEqual([1, 2]);
        expect([...subject.entries()]).toEqual([[1, 1], [2, 2]]);
    });

    test("copies without sharing later source mutations", () => {
        const source = new Set([1]);
        const subject = ImmutableSet.copyOf(source);
        source.add(2);

        expect([...subject]).toEqual([1]);
    });

    test("forEach honors the supplied receiver", () => {
        const receiver = {sum: 0};
        new ImmutableSet([1, 2]).forEach(function (value) {
            this.sum += value;
        }, receiver);

        expect(receiver.sum).toBe(3);
    });
});
