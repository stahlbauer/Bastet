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


import {ProgramAnalysis} from "../ProgramAnalysis";
import {MemAbstractState} from "./MemAbstractDomain";
import {AbstractDomain} from "../AbstractDomain";
import {StateSet} from "../../algorithms/StateSet";
import {App} from "../../../syntax/app/App";

export class MemAnalysis implements ProgramAnalysis<MemAbstractState> {

    abstractDomain: AbstractDomain<MemAbstractState>;

    abstractSucc(fromState: MemAbstractState): Iterable<MemAbstractState> {
        return undefined;
    }

    join(state1: MemAbstractState, state2: MemAbstractState): MemAbstractState {
        return undefined;
    }

    merge(state1: MemAbstractState, state2: MemAbstractState): boolean {
        return false;
    }

    stop(state: MemAbstractState, reached: StateSet<MemAbstractState>): MemAbstractState {
        return undefined;
    }

    target(state: MemAbstractState): boolean {
        return false;
    }

    widen(state: MemAbstractState): MemAbstractState {
        return undefined;
    }

    initialStatesFor(task: App): MemAbstractState[] {
        return [];
    }

}
