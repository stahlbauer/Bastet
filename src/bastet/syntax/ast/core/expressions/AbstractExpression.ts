/*
 *   BASTET Program Analysis and Verification Framework
 *
 *   Copyright 2020 by University of Passau (uni-passau.de)
 *
 *   See the file CONTRIBUTORS.md for the list of contributors.
 *
 *   Please make sure to CITE this work in your publications if you
 *   build on this work. Some of our maintainers or contributors might
 *   be interested in actively CONTRIBUTING to your research project.
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

import {Expression, Expressions} from "./Expression";
import {AbstractNode, AstNode} from "../../AstNode";
import {ScratchType} from "../ScratchType";

export abstract class AbstractExpression extends AbstractNode implements Expression {

    private readonly _expressionType: ScratchType;
    private _refId: number;

    protected constructor(type: ScratchType, childs: AstNode[]) {
        super(childs);
        this._expressionType = type;
    }

    get expressionType(): ScratchType {
        return this._expressionType;
    }

    public getRefId(): number {
        if (!this._refId) {
            this._refId = Expressions.idFor(this);
        }
        return this._refId;
    }

}
