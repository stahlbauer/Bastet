/*
 *   BASTET Program Analysis and Verification Framework
 *
 *   Copyright 2019 by University of Passau (uni-passau.de)
 *
 *   Maintained by Andreas Stahlbauer (firstname@lastname.net)
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */

import {AbstractNode, AstNode} from "./AstNode";
import {IllegalArgumentException} from "../../core/exceptions/IllegalArgumentException";

export class AstNodeList<E extends AstNode> extends AbstractNode {

    private readonly _elements: E[];

    constructor(elements: E[]) {
        super(elements);
        this._elements = elements;
    }

    public isEmpty(): boolean {
        return this._elements.length == 0;
    }

    get elements(): E[] {
        return this._elements;
    }

    public getIth(index: number): E {
        if (index >= this._elements.length) {
            throw new IllegalArgumentException("Element index out of bounds!");
        }
        return this._elements[index];
    }

    [Symbol.iterator](): IterableIterator<E> {
        return this._elements[Symbol.iterator]();
    }

}
