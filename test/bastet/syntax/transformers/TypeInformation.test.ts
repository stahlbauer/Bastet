import {Identifier} from "../../../../src/bastet/syntax/ast/core/Identifier";
import {DataLocations} from "../../../../src/bastet/syntax/app/controlflow/DataLocation";
import {VariableWithDataLocation} from "../../../../src/bastet/syntax/ast/core/Variable";
import {
    DeclarationScopeType,
    ScopeTypeInformation,
    TypeInformationStorage,
} from "../../../../src/bastet/syntax/DeclarationScopes";
import {BooleanType, IntegerType, ListType, StringType} from "../../../../src/bastet/syntax/ast/core/ScratchType";
import {IllegalArgumentException} from "../../../../src/bastet/core/exceptions/IllegalArgumentException";

describe('ScopeTypeInformation', function() {

    test('finds a variable in the current scope', function() {
        const actor = new ScopeTypeInformation(null, "actor1", DeclarationScopeType.ACTOR);

        actor.putVariable(new VariableWithDataLocation(DataLocations.createTypedLocation(
            Identifier.of("test"), IntegerType.instance())));

        expect(actor.getTypeOf(Identifier.of("test"))).toBe(IntegerType.instance());
    });

    test('inherits variables from parent scopes', function() {
        const actor = new ScopeTypeInformation(null, "actor1", DeclarationScopeType.ACTOR);
        actor.putTypeInformation(Identifier.of("value"), IntegerType.instance());

        const method = actor.beginMethodScope("method1");

        expect(method.getTypeOf(Identifier.of("value"))).toBe(IntegerType.instance());
        expect(method.endScope()).toBe(actor);
    });

    test('a child declaration shadows its parent', function() {
        const actor = new ScopeTypeInformation(null, "actor1", DeclarationScopeType.ACTOR);
        actor.putTypeInformation(Identifier.of("value"), IntegerType.instance());
        const method = actor.beginMethodScope("method1");
        method.putTypeInformation(Identifier.of("value"), BooleanType.instance());

        expect(method.getTypeOf(Identifier.of("value"))).toBe(BooleanType.instance());
        expect(actor.getTypeOf(Identifier.of("value"))).toBe(IntegerType.instance());
    });

    test('reuses a named child scope', function() {
        const actor = new ScopeTypeInformation(null, "actor1", DeclarationScopeType.ACTOR);

        const first = actor.beginMethodScope("method1");
        const second = actor.beginMethodScope("method1");

        expect(second).toBe(first);
        expect(actor.getChildScopes()).toEqual(["method1"]);
    });

    test('reports unknown variables with their identifier', function() {
        const actor = new ScopeTypeInformation(null, "actor1", DeclarationScopeType.ACTOR);

        expect(() => actor.getTypeOf(Identifier.of("missing")))
            .toThrow(new IllegalArgumentException('Variable "missing" and it\'s type are unknown. Declaration missing?'));
    });

    test('unions system and actor type information', function() {
        const left = new TypeInformationStorage();
        left.getSystemScope().putTypeInformation(Identifier.of("global"), IntegerType.instance());
        const right = new TypeInformationStorage();
        right.beginActorScope("actor1").putTypeInformation(Identifier.of("local"), BooleanType.instance());

        const union = TypeInformationStorage.union(left, right);

        expect(union.lookupTyped("global")).toBe(IntegerType.instance());
        expect(union.lookupTyped("actor1@local")).toBe(BooleanType.instance());
    });

    test('reuses list types for the same element type', function() {
        expect(ListType.withElementType(StringType.instance()))
            .toBe(ListType.withElementType(StringType.instance()));
        expect(ListType.withElementType(StringType.instance()))
            .not.toBe(ListType.withElementType(IntegerType.instance()));
    });
});
