import {ExpressionListExpression} from "../../../../src/bastet/syntax/ast/core/expressions/ListExpression";
import {ExpressionList} from "../../../../src/bastet/syntax/ast/core/expressions/ExpressionList";
import {StringLiteral} from "../../../../src/bastet/syntax/ast/core/expressions/StringExpression";
import {ListType, StringType} from "../../../../src/bastet/syntax/ast/core/ScratchType";

describe("ExpressionListExpression", () => {
    test("retains its elements and canonical list type", () => {
        const elements = new ExpressionList([new StringLiteral("item")]);
        const expression = new ExpressionListExpression(StringType.instance(), elements);

        expect(expression.elements).toBe(elements);
        expect(expression.expressionType).toBe(ListType.withElementType(StringType.instance()));
    });
});
