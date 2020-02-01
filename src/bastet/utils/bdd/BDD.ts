/*
 *   BDD Library.
 *
 *   Copyright 2020 by Andreas Stahlbauer
 *
 *   Maintained by Andreas Stahlbauer (firstname@lastname.net),
 *   see the file CONTRIBUTORS.md for the list of contributors.
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

import {Record as ImmRec, List as ImmList, Set as ImmSet, Map as ImmMap} from "immutable"
import {ImplementMeException} from "../../core/exceptions/ImplementMeException";
import {Preconditions} from "../Preconditions";

/**
 * The paper "Binary Decision Diagrams with Edge-Specified Reductions" by
 * Babar et al. (2019) presented a now generalized form of BDDs.
 *
 * This is our implementation of their approach. See the issue #25.
 */
export class BDD {

    /**
     * The BDD can have multiple rood notes (each
     * without incoming edges). One root node is formalized as p*.
     * To each root points a dangling edge with a reduction rule k*.
     */
    private readonly _roots: ImmList<BDDEdge>;

    /**
     * Returns the set of all BDD nodes that are reachable on forwards
     * edges from the given node.
     *
     * @param node
     */
    public nodesReachableFrom(node: BDDNode): Iterable<BDDNode> {
        throw new ImplementMeException();
    }

    get roots(): Iterable<BDDEdge> {
        return this._roots;
    }

    get rootNodes(): BDDNode[] {
        return [ ...this._roots.map((e) => { return e.targetNode; }) ];
    }

    get zeroNode(): BDDNode {
        throw new ImplementMeException();
    }

    get trueNode(): BDDNode {
        throw new ImplementMeException();
    }
}

/**
 * Reduction rule in
 *  [
 *      S,      // short edge
 *      L_0,    // zero-suppressed
 *      H_0,    // one-suppressed
 *      X       // fully-reduced
 *  ].
 * Specifies the meaning when skipping edges.
 */
export enum ReductionRule {
    UNDEFINED = 0,
    S = 1,
    L0 = 2,
    H0 = 3,
    X = 4
}

export interface BDDEdgeAttributes {

    /** Reduction rule */
    rule: ReductionRule;

    /** Node to which the edge points to */
    targetNode: BDDNode;

    /** It is a short edge if no levels are skipped */
    isShortEdge(): boolean;

    /** It is a long edge if levels are skipped */
    isLongeEdge(): boolean;

}

const BDDEdgeRecord = ImmRec({

    rule: ReductionRule.UNDEFINED,
    targetNode: null

});

export class BDDEdge extends BDDEdgeRecord implements BDDEdgeAttributes {

    constructor(rule: ReductionRule, targetNode: BDDNode) {
        super({rule: rule, targetNode: targetNode});
    }

    get rule(): ReductionRule {
        return this.get('rule');
    }

    get targetNode(): BDDNode {
        return this.get('targetNode');
    }

    isLongeEdge(): boolean {
        throw new ImplementMeException();
    }

    isShortEdge(): boolean {
        throw new ImplementMeException();
    }
}

export interface BDDNodeAttributes {

    level: number;

    falseEdge: BDDEdge;

    trueEdge: BDDEdge;

    leavingEdges(): Iterable<BDDEdge>;

    isFalseTerminalNode(): boolean;

    isTrueTerminalNode(): boolean;

    getTrueEdge(): BDDEdge;

    getFalseEdge(): BDDEdge;

}

const BDDNodeRecord = ImmRec({

    level: ReductionRule.UNDEFINED,
    falseEdge: null,
    trueEdge: null

});

export class BDDNode extends BDDNodeRecord implements BDDNodeAttributes {

    constructor(level: ReductionRule, trueEdge: BDDEdge, falseEdge: BDDEdge) {
        super({level: level, trueEdge: trueEdge, falseEdge: falseEdge});
    }

    get level(): number {
        return this.get('level');
    }

    getFalseEdge(): BDDEdge {
        return this.get('falseEdge');
    }

    getTrueEdge(): BDDEdge {
        return this.get('trueEdge');
    }

    isFalseTerminalNode(): boolean {
        throw new ImplementMeException();
    }

    isTrueTerminalNode(): boolean {
        throw new ImplementMeException();
    }

    leavingEdges(): Iterable<BDDEdge> {
        return [this.getFalseEdge(), this.getTrueEdge()];
    }

}

export function isDuplicat(node: BDDNode, ofNode: BDDNode) : boolean {
    throw new ImplementMeException();
}

export function isRedundant(node: BDDNode) : boolean {
    throw new ImplementMeException();
}

export function isHighZero(node: BDDNode) : boolean {
    throw new ImplementMeException();
}

export function isLowZero(node: BDDNode) : boolean {
    throw new ImplementMeException();
}

export function isReduced(bdd: BDD) : boolean {
    throw new ImplementMeException();
}

export class BDDReducer {

    private _bdd: BDD;
    private _zeroNode: BDDNode;
    private _trueNode: BDDNode;

    constructor(initial: BDD) {
        this._bdd = Preconditions.checkNotUndefined(initial);
        this._zeroNode = this._bdd.zeroNode;
        this._trueNode = this._bdd.trueNode;
    }

    private getAllReducibleNodes(): BDDNode[] {
        // `_bdd` nodes with a high-zero, low-zero, redundant, or duplicate node
        throw new ImplementMeException();
    }

    private reduceFrom(p: BDDNode) {
        const worklist: Set<BDDNode> = new Set<BDDNode>();
        for (const r of this._bdd.rootNodes) {
            worklist.add(r);
        }
        this.reduceFalseTerminal();

        function hasEdge(rule: ReductionRule, q: BDDNode): boolean {
            throw new ImplementMeException();
        }

        while (true) {
            const reducible = this.getAllReducibleNodes();
            if (reducible.length > 0) {
                const q: BDDNode = reducible[0];
                if (isDuplicat(q, p)) {
                    // Replace all <k,q> edges with <k,p>
                    this.redirectAllEdges(q, p);
                } else {
                    let kP: ReductionRule = null;
                    let dP: BDDNode = null;
                    if (isRedundant(q)) {
                        kP = ReductionRule.X;
                        dP = q.getTrueEdge().targetNode;
                    } else if (isHighZero(q)) {
                        kP = ReductionRule.H0;
                        dP = q.getFalseEdge().targetNode;
                    } else if (isLowZero(q)) {
                        kP = ReductionRule.L0;
                        dP = q.getTrueEdge().targetNode;
                    }

                    if (dP.isFalseTerminalNode()) {
                        // Replace all <k,q> edges with <X,FalseNode>
                        throw new ImplementMeException();
                        this.replaceAllEdgesTargeting(q, ReductionRule.X, this._zeroNode);
                    } else {
                        // Replace all <S,q> edges with <k', d'>
                        this.replaceEdgesWithBy(ReductionRule.X, q, kP, dP);

                        // Replace all <k',q> edges with <k', d'>
                        this.replaceEdgesWithBy(kP, q, kP, dP);

                        const checkRules: Set<ReductionRule> = new Set([ReductionRule.L0, ReductionRule.H0, ReductionRule.X, ReductionRule.S]);
                        checkRules.delete(kP);
                        for (const rule of checkRules) {
                            if (hasEdge(rule, q)) {
                                let trueEdge: BDDEdge;
                                let falseEdge: BDDEdge;
                                if (rule === ReductionRule.X) {
                                    falseEdge = new BDDEdge(kP, dP);
                                    trueEdge = new BDDEdge(kP, dP);
                                } else if (rule === ReductionRule.H0) {
                                    falseEdge = new BDDEdge(kP, dP);
                                    trueEdge = new BDDEdge(ReductionRule.X, this._zeroNode);
                                } else if (rule === ReductionRule.L0) {
                                    falseEdge = new BDDEdge(ReductionRule.X, this._zeroNode);
                                    trueEdge = new BDDEdge(kP, dP);
                                }
                                const qP = this.addNewNode(trueEdge, falseEdge);

                                // Replace all <k,q> edges with <k,q'> or <S,q'>
                                this.replaceLongEdgesWithBy(rule, q, rule, qP);
                                this.replaceShortEdgesWithBy(rule, q, ReductionRule.S, qP);
                            }
                        }

                    }
                }
                worklist.delete(q);
            }
        }
    }

    private replaceShortEdgesWithBy(rule: ReductionRule, q: BDDNode, S: ReductionRule, qP: any) {
        throw new ImplementMeException();
    }

    private replaceEdgesWithBy(X: ReductionRule, A: BDDNode, kP: ReductionRule, dP: BDDNode) {
        throw new ImplementMeException();
    }

    private replaceAllEdgesTargeting(q: BDDNode, X: ReductionRule, _zeroNode: BDDNode) {
        throw new ImplementMeException();
    }

    private redirectAllEdges(q: BDDNode, p: BDDNode) {
        throw new ImplementMeException();
    }

    public reduce(): BDD {
        for (const r of this._bdd.rootNodes) {
            this.reduceFrom(r);
        }
        return this._bdd;
    }

    private reduceFalseTerminal() {
        throw new ImplementMeException();
    }

    private addNewNode(trueEdge: BDDEdge, falseEdge: BDDEdge) {
        throw new ImplementMeException();
    }

    private replaceLongEdgesWithBy(rule: ReductionRule, q: BDDNode, rule2: ReductionRule, qP: void) {
        throw new ImplementMeException();
    }

}