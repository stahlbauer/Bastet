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

import {Refiner, Unwrapper} from "../Refiner";
import {FrontierSet, ReachedSet} from "../../algorithms/StateSet";
import {ImplementMeException, ImplementMeForException} from "../../../core/exceptions/ImplementMeException";
import {AbstractElement, AbstractState} from "../../../lattices/Lattice";
import {AbstractionState, AbstractionStateLattice} from "./AbstractionAbstractDomain";
import {Preconditions} from "../../../utils/Preconditions";
import {
    BooleanFormula,
    FirstOrderFormula,
    FloatFormula,
    IntegerFormula,
    ListFormula,
    RealFormula,
    StringFormula
} from "../../../utils/ConjunctiveNormalForm";
import {PrecisionOperator} from "./AbstractionComputation";
import {PrecisionRole, PredicatePrecision, PredicatePrecisionLattice} from "../../AbstractionPrecision";
import {AccessibilityRelation, AccessibilityRelations} from "../Accessibility";
import {FirstOrderSolver} from "../../domains/FirstOrderDomain";
import {TransformerTheories} from "../../domains/MemoryTransformer";
import {BastetConfiguration} from "../../../utils/BastetConfiguration";
import {getAtMostOneElement, getTheOnlyElement} from "../../../utils/Collections";
import {AbstractionStateStates} from "./AbstractionStates";
import {Map as ImmMap} from "immutable"
import {SSAState} from "../ssa/SSAAbstractDomain";
import {SSAAbstractStates} from "../ssa/SSAAbstractStates";
import {DataAbstractStates} from "../data/DataAbstractStates";
import {PerfTimer} from "../../../utils/PerfTimer";


export class AbstractionRefinerConfig extends BastetConfiguration {

    constructor(dict: {}) {
        super(dict, ['AbstractionRefiner']);
    }

    get useLazyAbstraction(): boolean {
        return this.getBoolProperty('use-lazy-abstraction', false);
    }

    get dumpPathFormula(): boolean {
        return this.getBoolProperty('dump-path-formula', false);
    }
}

class InterpolationSolution {
    private readonly _targetState: AbstractState;
    private readonly _interpolants: FirstOrderFormula[];

    constructor(e: AbstractState, interpolants: FirstOrderFormula[]) {
        this._targetState = Preconditions.checkNotUndefined(e);
        this._interpolants = Preconditions.checkNotUndefined(interpolants);
    }

    get targetState(): AbstractState {
        return this._targetState;
    }

    get interpolants(): FirstOrderFormula[] {
        return this._interpolants;
    }
}

export class AbstractionRefiner implements Refiner<AbstractState>, PrecisionOperator<AbstractionState, PredicatePrecision> {

    private readonly _unwrapper: Unwrapper<AbstractState, AbstractElement>;

    private readonly _lattice: AbstractionStateLattice;
    private readonly _prover: FirstOrderSolver<FirstOrderFormula>;
    private readonly _theories: TransformerTheories<FirstOrderFormula, BooleanFormula, IntegerFormula, RealFormula, FloatFormula, StringFormula, ListFormula>;
    private _lastInterpolationSolution: InterpolationSolution;

    private _currentPrecision: PredicatePrecision;
    private readonly _precisionLattice: PredicatePrecisionLattice<FirstOrderFormula>;
    private readonly _config: AbstractionRefinerConfig;

    private _feasibilityCheck: number;

    constructor(config: {}, unwrapper: Unwrapper<AbstractState, AbstractElement>, lattice: AbstractionStateLattice, theories: TransformerTheories<FirstOrderFormula, BooleanFormula, IntegerFormula, RealFormula, FloatFormula, StringFormula, ListFormula>,
                precisionLattice: PredicatePrecisionLattice<FirstOrderFormula>, prover: FirstOrderSolver<FirstOrderFormula>) {
        this._config = new AbstractionRefinerConfig(config);
        this._unwrapper = Preconditions.checkNotUndefined(unwrapper);
        this._lattice = Preconditions.checkNotUndefined(lattice);
        this._prover = prover;
        this._theories = Preconditions.checkNotUndefined(theories);
        this._precisionLattice = Preconditions.checkNotUndefined(precisionLattice);
        this._currentPrecision = precisionLattice.bottom();
        this._feasibilityCheck = 0;
    }

    private neitherTrueNorFalse(f: FirstOrderFormula): boolean {
        return !(this._theories.boolTheory.trueBool().equals(f)
                || this._theories.boolTheory.falseBool().equals(f));
    }

    public checkIsFeasible(reached: ReachedSet<AbstractState>, ar: AccessibilityRelation<AbstractionState>, e: AbstractState, purpose?: string): boolean {
        this._feasibilityCheck++;

        // The previous interpolation solution gets invalidated with this call
        this.releaseInterpolationSolution();

        // 1. Build the abstract path formula (describes a set of paths)
        // 1.1 Extract the sequence of states for that a widening was computed along the
        // given accessibility relation.
        const wideningStateSeq: AbstractionState[] = this.getBlockStateSequence(ar, e);
        const alignedBlockFormulas: FirstOrderFormula[] = this.alignSsaIndices(wideningStateSeq, this.extractTraceBlockFormulas(wideningStateSeq));
        alignedBlockFormulas.forEach((f) => this._prover.incRef(f));
        console.log(`Trace with ${alignedBlockFormulas.length} block formulas`);
        Preconditions.checkState(wideningStateSeq.length == alignedBlockFormulas.length);

        // Use:
        //      isWideningState function
        //      DataAbstractStates.extractFrom(...)

        // ATTENTION: We assume that there is only one unique sequence of
        // abstraction states along the abstract reachability relation.

        // 2. Check the feasibility of the trace formula
        this._prover.push();
        try {
            const timer = this.logRefinementStart(purpose);

            for (const blockFormula of alignedBlockFormulas) {
                this._prover.assert(blockFormula);
            }

            this.dumpPathFormula(alignedBlockFormulas);

            const feasible = !this._prover.isUnsat();

            if (feasible) {
                console.log("Seems to be a feasible counterexample (a real Bug?)!");
            } else {
                console.log("Counterexample infeasible. Higher abstraction precision needed!");

                // Compute interpolant
                const interpolants: FirstOrderFormula[] = this._prover.collectInterpolants();
                interpolants.forEach(itp => this._prover.incRef(itp));

                console.group();
                console.log(`Identified ${interpolants.filter(itp => this.neitherTrueNorFalse(itp)).length} interpolants.`)
                // interpolants.forEach((itp) => console.log("Interpolant", this._theories.stringRepresentation(itp)));
                console.groupEnd();

                Preconditions.checkState(interpolants.length > 0,
                    "Assuming interpolants to be present for an infeasible counterexample");

                // FIXME: check this precondition
                // Preconditions.checkState(interpolants.length === alignedBlockFormulas.length - 1,
                //     "There should have been one interpolant for each intermediate point");

                this._lastInterpolationSolution = new InterpolationSolution(e, interpolants);
            }

            this.logRefinementStop(feasible, timer);

            return feasible;
        } finally {
            alignedBlockFormulas.forEach((f) => this._prover.decRef(f));
            this._prover.pop();
        }
    }

    private releaseInterpolationSolution() {
        if (this._lastInterpolationSolution) {
            // The following causes a Z3 memory issue:
            //      this._lastInterpolationSolution.interpolants.forEach(itp => this._prover.decRef(itp));
        }
    }

    private logRefinementStart(purpose?: string) {
        if (purpose) {
            console.group(`Feasibility Check (${purpose})...`);
        } else {
            console.group("Feasibility Check...");
        }

        const timer = new PerfTimer(null);
        timer.start();

        return timer;
    }

    private logRefinementStop(feasible, timer: PerfTimer) {
        timer.stop();
        console.log(`${feasible ? "Feasible" : "Infeasible"} ${timer.lastIntervalDuration}`)
        console.groupEnd();
    }

    private alignSsaIndices(wideningStateSeq: AbstractionState[], blockFormulas: FirstOrderFormula[]): FirstOrderFormula[] {
        Preconditions.checkArgument(wideningStateSeq.length == blockFormulas.length);
        const ssaMaps = wideningStateSeq.map((e) => new Map(getTheOnlyElement(SSAAbstractStates.extractFrom(e)).getSSA()));
        return this._theories.alignSsaIndices(blockFormulas, ssaMaps);
    }

    public refinePrecision(frontier: FrontierSet<AbstractState>, reached: ReachedSet<AbstractState>,
                           ar: AccessibilityRelation<AbstractionState>,
                           infeasibleState: AbstractState): [FrontierSet<AbstractState>, ReachedSet<AbstractState>] {
        try {
            // TODO: welchen Teil vom ReachedSet wegwerfen?
            //  -> Man wirft den Teil weg, der infeasible ist
            //  -> Und man wirft den Teil weg, für den die Precision zu niedrig war
            // TODO: welche Prädikate sollen zur AbstractionPrecision hinzugefügt werden?
            //  ->

            // Cache must have been filled before invoking this method.
            Preconditions.checkState(this._lastInterpolationSolution !== null);

            Preconditions.checkArgument(infeasibleState === this._lastInterpolationSolution.targetState);

            // TODO: Split interpolants, optionally, into their Boolean atoms

            this._currentPrecision = this._lastInterpolationSolution.interpolants
                .map((f) => new PredicatePrecision([f], PrecisionRole.INTERMEDIATE))
                .reduce((precision, last) => this._precisionLattice.join(precision, last),
                    this._currentPrecision);

            if (this._config.useLazyAbstraction) {
                throw new ImplementMeForException("Lazy abstraction not yet supported");
            } else {
                for (const e of ar.initial()) {
                    frontier.add(e);
                    reached.removeAll(ar.successorsOf(e));
                }
                return [frontier, reached];
            }
        } finally {
            this.releaseInterpolationSolution();
        }
    }

    /**
     * Determine whether or not a widening was performed for a given abstract state.
     *
     * @param state
     * @private
     */
    private isWideningState(state: AbstractionState) {
        return state.getWideningOf().isPresent();
    }

    public precisionFor(state: AbstractionState): PredicatePrecision {
        return state.getPrecision().stack.reduce((pi: PredicatePrecision, result: PredicatePrecision) =>
            this._lattice.precStacLattice.lattice.join(pi, result), this._currentPrecision);
    }

    private getBlockStateSequence(ar: AccessibilityRelation<AbstractState>, target: AbstractState): AbstractionState[] {
        return AccessibilityRelations.getWidenedSequence(ar, target)
            .map(e => getTheOnlyElement(AbstractionStateStates.extractFrom(e)));
    }

    private static getSingleAbstractionState(e: AbstractState): AbstractionState {
        return getTheOnlyElement(AbstractionStateStates.extractFrom(e));
    }

    private extractTraceBlockFormulas(wideningStateSeq: AbstractionState[]): FirstOrderFormula[] {
        const result: FirstOrderFormula[] = [];

        for (const abst of wideningStateSeq) {
            if (abst.getWideningOf().isPresent()) {
                result.push(getTheOnlyElement(DataAbstractStates.extractFrom(abst.getWideningOf().getValue())).blockFormula);
            } else {
                result.push(getTheOnlyElement(DataAbstractStates.extractFrom(abst)).blockFormula);
            }
        }

        return result;
    }

    private dumpPathFormula(alignedBlockFormulas: FirstOrderFormula[]) {
        if (!this._config.dumpPathFormula) {
            return;
        }

        const pathFormula = alignedBlockFormulas.reduce((f1, f2) => this._theories.boolTheory.and(f1, f2), this._theories.boolTheory.trueBool());
        const s = this._prover.stringRepresentation(pathFormula);

        let fs = require('fs');
        fs.writeFileSync(`output/refinement-${this._feasibilityCheck}-path.smt`, s);
    }
}
