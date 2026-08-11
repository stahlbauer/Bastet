import {Record as ImmRec} from "immutable";
import {AbstractElement} from "../../../src/bastet/lattices/Lattice";
import {Optional} from "../../../src/bastet/utils/Optional";

const ValueRecord = ImmRec({value: 0});

class ValueElement extends ValueRecord implements AbstractElement {
    constructor(value: number) {
        super({value});
    }
}

describe("Optional", () => {
    test("represents present and absent values", () => {
        const value = new ValueElement(1);

        expect(Optional.of(value).isPresent()).toBe(true);
        expect(Optional.of(value).getValue()).toBe(value);
        expect(Optional.absent<ValueElement>().isAbsent()).toBe(true);
        expect(Optional.of<ValueElement>(null).isAbsent()).toBe(true);
    });

    test("updates immutably", () => {
        const value = new ValueElement(1);
        const absent = Optional.absent<ValueElement>();
        const present = absent.withValue(value);

        expect(absent.isAbsent()).toBe(true);
        expect(present.getValue()).toBe(value);
        expect(present.withoutValue().isAbsent()).toBe(true);
    });
});
