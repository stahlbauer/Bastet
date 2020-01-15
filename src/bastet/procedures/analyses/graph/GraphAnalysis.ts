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

import {ProgramAnalysis, WrappingProgramAnalysis} from "../ProgramAnalysis";
import {AbstractDomain} from "../AbstractDomain";
import {StateSet} from "../../algorithms/StateSet";
import {GraphAbstractDomain, GraphAbstractState} from "./GraphAbstractDomain";
import {ImplementMeException} from "../../../core/exceptions/ImplementMeException";
import {App} from "../../../syntax/app/App";

export class GraphAnalysis implements WrappingProgramAnalysis<GraphAbstractState> {

    private _abstractDomain: AbstractDomain<GraphAbstractState>;

    private _wrappedAnalysis: ProgramAnalysis<any>;

    constructor(wrappedAnalysis: ProgramAnalysis<any>) {
        this._wrappedAnalysis = wrappedAnalysis;
        this._abstractDomain = new GraphAbstractDomain();
    }

    abstractSucc(fromState: GraphAbstractState): Iterable<GraphAbstractState> {
        throw new ImplementMeException();
    }

    join(state1: GraphAbstractState, state2: GraphAbstractState): GraphAbstractState {
        throw new ImplementMeException();
    }

    merge(state1: GraphAbstractState, state2: GraphAbstractState): boolean {
        throw new ImplementMeException();
    }

    stop(state: GraphAbstractState, reached: StateSet<GraphAbstractState>): GraphAbstractState {
        throw new ImplementMeException();
    }

    target(state: GraphAbstractState): boolean {
        return this._wrappedAnalysis.target(state.wrappedState);
    }

    widen(state: GraphAbstractState): GraphAbstractState {
        throw new ImplementMeException();
    }

    get abstractDomain(): AbstractDomain<GraphAbstractState> {
        return this._abstractDomain;
    }

    get wrappedAnalysis(): ProgramAnalysis<any> {
        return this._wrappedAnalysis;
    }

    initialStatesFor(task: App): GraphAbstractState[] {
        const wrappedInitialStates = this._wrappedAnalysis.initialStatesFor(task);
        throw new ImplementMeException();
    }

}
