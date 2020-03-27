/*
 *   BASTET Program Analysis and Verification Framework
 *
 *   Copyright 2019 by University of Passau (uni-passau.de)
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

import {LabeledTransferRelation, TransferRelation, Transfers} from "../TransferRelation";
import {
    ControlAbstractState,
    IndexedThread,
    MethodCall,
    RelationLocation,
    ThreadComputationState, ThreadId,
    ThreadState,
    ThreadStateFactory
} from "./ControlAbstractDomain";
import {AbstractElement, Lattices} from "../../../lattices/Lattice";
import {ControlAnalysisConfig} from "./ControlAnalysis";
import {App} from "../../../syntax/app/App";
import {Preconditions} from "../../../utils/Preconditions";
import {ImplementMeException} from "../../../core/exceptions/ImplementMeException";
import {
    TransitionLoop,
    TransitionRelation,
    TransitionRelations,
    TransitionTo
} from "../../../syntax/app/controlflow/TransitionRelation";
import {Actor, ActorId} from "../../../syntax/app/Actor";
import {
    OperationId,
    ProgramOperation,
    ProgramOperationFactory,
    ProgramOperations,
    RawOperation
} from "../../../syntax/app/controlflow/ops/ProgramOperation";
import {List as ImmList, Map as ImmMap, Set as ImmSet} from "immutable";
import {ScopeTransformerVisitor} from "./DataLocationScoping";
import {mapExpand} from "../../../utils/Functional";
import {CallStatement} from "../../../syntax/ast/core/statements/CallStatement";
import {MethodIdentifiers} from "../../../syntax/app/controlflow/MethodIdentifiers";
import {Properties, Property} from "../../../syntax/Property";
import {Method} from "../../../syntax/app/controlflow/Method";
import {
    BeginAtomicStatement,
    EndAtomicStatement,
    ReturnStatement
} from "../../../syntax/ast/core/statements/ControlStatement";
import {BroadcastMessageStatement} from "../../../syntax/ast/core/statements/BroadcastMessageStatement";
import {BroadcastAndWaitStatement} from "../../../syntax/ast/core/statements/BroadcastAndWaitStatement";
import {WaitUntilStatement} from "../../../syntax/ast/core/statements/WaitUntilStatement";
import {WaitSecsStatement} from "../../../syntax/ast/core/statements/WaitSecsStatement";
import {Logger} from "../../../utils/Logger";
import {ExpressionList} from "../../../syntax/ast/core/expressions/ExpressionList";
import {Statement, StatementList} from "../../../syntax/ast/core/statements/Statement";
import {ParameterDeclaration} from "../../../syntax/ast/core/ParameterDeclaration";
import {Expression} from "../../../syntax/ast/core/expressions/Expression";
import {VariableWithDataLocation} from "../../../syntax/ast/core/Variable";
import {DataLocation, DataLocations} from "../../../syntax/app/controlflow/DataLocation";
import {DeclareStackVariableStatement} from "../../../syntax/ast/core/statements/DeclarationStatement";
import {StoreEvalResultToVariableStatement} from "../../../syntax/ast/core/statements/SetStatement";
import {
    extractStringLiteral,
    StringExpression,
    StringLiteral
} from "../../../syntax/ast/core/expressions/StringExpression";
import {AfterStatementMonitoringEvent, MessageReceivedEvent} from "../../../syntax/ast/core/CoreEvent";
import {Concern, Concerns} from "../../../syntax/Concern";
import {IllegalStateException} from "../../../core/exceptions/IllegalStateException";
import {Script, ScriptId} from "../../../syntax/app/controlflow/Script";
import {getTheNextElement, getTheOnlyElement} from "../../../utils/Collections";
import {LocationId} from "../../../syntax/app/controlflow/ControlLocation";
import {BOOTSTRAP_FINISHED_MESSAGE, SystemMessage} from "../../../syntax/ast/core/Message";
import {ActorType, NumberType} from "../../../syntax/ast/core/ScratchType";
import {
    LocateActorExpression,
    StartCloneActorExpression,
    UsherActorExpression
} from "../../../syntax/ast/core/expressions/ActorExpression";
import {IllegalArgumentException} from "../../../core/exceptions/IllegalArgumentException";
import {BooleanExpression, NumGreaterEqualExpression} from "../../../syntax/ast/core/expressions/BooleanExpression";
import {Identifier} from "../../../syntax/ast/core/Identifier";
import {OptionalAstNode} from "../../../syntax/ast/AstNode";
import {SignalTargetReachedStatement} from "../../../syntax/ast/core/statements/InternalStatement";
import {AbstractDomain} from "../../domains/AbstractDomain";
import {ConcreteElement} from "../../domains/ConcreteElements";
import {GLOBAL_TIME_MICROS_VAR} from "../time/TimeTransferRelation";
import {
    MultiplyExpression,
    NumberExpression, NumberLiteral,
    NumberVariableExpression,
    PlusExpression
} from "../../../syntax/ast/core/expressions/NumberExpression";
import {freshId} from "../../../utils/Seq";
import {RelationBuildingVisitor} from "../../../syntax/app/controlflow/RelationBuildingVisitor";

class StepInformation {

    private readonly _steppedThread: IndexedThread;

    private readonly _isInnerAtomic: boolean;

    private readonly _ops: ProgramOperation[];

    private readonly _succLoc: RelationLocation;

    private readonly _succCallStack: ImmList<MethodCall>;

    private readonly _succScopeStack: ImmList<string>;

    constructor(steppedThread: IndexedThread, succLoc: RelationLocation, isInnerAtomic: boolean, ops: ProgramOperation[],
                succReturnCallTo: ImmList<MethodCall>, succScopeStack: ImmList<string>) {
        this._steppedThread = steppedThread;
        this._succLoc = succLoc;
        this._isInnerAtomic = isInnerAtomic;
        this._ops = Preconditions.checkNotUndefined(ops);
        this._succCallStack = Preconditions.checkNotUndefined(succReturnCallTo);
        this._succScopeStack = Preconditions.checkNotUndefined(succScopeStack);
    }

    get steppedThread(): IndexedThread {
        return this._steppedThread;
    }

    get succLoc(): RelationLocation {
        return this._succLoc;
    }

    get isInnerAtomic(): boolean {
        return this._isInnerAtomic;
    }

    get ops(): ProgramOperation[] {
        return this._ops;
    }

    get succCallStack(): ImmList<MethodCall> {
        return this._succCallStack;
    }

    get succScopeStack(): ImmList<string> {
        return this._succScopeStack;
    }
}

class AccelInfo {

    private readonly _id: number;

    private readonly _actorId: ActorId;

    private readonly _condition: BooleanExpression;

    private readonly _variantVariable: NumberVariableExpression;

    private readonly _accelerateTo: NumberExpression;

    constructor(actor: ActorId, condition: BooleanExpression, variantVariable: NumberVariableExpression, accelerateTo: NumberExpression) {
        this._actorId = actor;
        this._condition = Preconditions.checkNotUndefined(condition);
        this._variantVariable = Preconditions.checkNotUndefined(variantVariable);
        this._accelerateTo = Preconditions.checkNotUndefined(accelerateTo);
        this._id = freshId();
    }

    get id(): number {
        return this._id;
    }

    get actorId(): ActorId {
        return this._actorId;
    }

    get condition(): BooleanExpression {
        return this._condition;
    }

    get variantVariable(): NumberVariableExpression {
        return this._variantVariable;
    }

    get accelerateTo(): NumberExpression {
        return this._accelerateTo;
    }
}

enum LoopActionType {
    NONE,
    ENTERING,
    LEAVING
}

class LoopAction {

    private readonly _type: LoopActionType;

    private readonly _loop: TransitionLoop;

    private readonly _loopHead: RelationLocation;

    constructor(type: LoopActionType, loop: TransitionLoop, loopHead: RelationLocation) {
        this._type = type;
        this._loop = loop;
        this._loopHead = loopHead;
    }

    get loopHead(): RelationLocation {
        return this._loopHead;
    }

    get type(): LoopActionType {
        return this._type;
    }

    get loop(): TransitionLoop {
        return this._loop;
    }
}

/**
 * Mimics the green-threading of the Scratch VM.
 * Adds special scheduling of some (types of) threads.
 */
export class ControlTransferRelation implements TransferRelation<ControlAbstractState> {

    private readonly _wrappedDomain: AbstractDomain<ConcreteElement, AbstractElement>;

    private readonly _wrappedTransferRelation: LabeledTransferRelation<AbstractElement>;

    private readonly _config: ControlAnalysisConfig;

    private readonly _task: App;

    private readonly _threadWaitUntilMicrosVariable: VariableWithDataLocation;

    private readonly _globalTimeMicrosVariable: VariableWithDataLocation;

    private readonly _accelInfoMap: Map<ScriptId, AccelInfo>;

    constructor(config: ControlAnalysisConfig, task: App, wrappedTransferRelation: LabeledTransferRelation<AbstractElement>,
                wrappedDomain: AbstractDomain<ConcreteElement, AbstractElement>) {
        this._task = Preconditions.checkNotUndefined(task);
        this._config = Preconditions.checkNotUndefined(config);
        this._wrappedTransferRelation = Preconditions.checkNotUndefined(wrappedTransferRelation);
        this._wrappedDomain = Preconditions.checkNotUndefined(wrappedDomain);
        this._accelInfoMap = new Map();

        // TODO: Move the declaration of the following variables to the `App`/`AppBuilder`/`Actor`
        this._threadWaitUntilMicrosVariable = new VariableWithDataLocation(
            DataLocations.createTypedLocation(new Identifier("__wait_until_micros"), NumberType.instance()));
        this._task.typeStorage.getScopeOf(this._threadWaitUntilMicrosVariable.qualifiedName).putVariable(this._threadWaitUntilMicrosVariable);

        // The following var is currently registered by the `TimeAnalysis`
        this._globalTimeMicrosVariable = new VariableWithDataLocation(
            DataLocations.createTypedLocation(new Identifier(GLOBAL_TIME_MICROS_VAR), NumberType.instance()));
    }

    abstractSucc(fromState: ControlAbstractState): Iterable<ControlAbstractState> {
        Preconditions.checkNotUndefined(fromState);
        Preconditions.checkNotUndefined(fromState.wrappedState);

        if (fromState.getIsTargetFor().size > 0) {
            // No successor states after target states
            return [];
        }

        if (this._config.aggregateAtomicTransitions) {
            // Do not provide intermediate abstract states for atomic operations?
            // This might cause problems if interpolation procedures are applied.
            // It would be better tu just use a projection of the ARG in case
            // details of atomic code blocks should be hidden (to the user).
            throw new IllegalStateException("We always produce intermediate states of atomic code blocks for given reasons.");
        } else {
            return this.abstractSuccSingleStep(fromState);
        }
    }

    abstractSuccSingleStep(fromState: ControlAbstractState): Iterable<ControlAbstractState> {
        let result: ControlAbstractState[] = [];

        // Choose threads to step.
        // - Typically all those threads that have been previously scheduled to run.
        // - Running specification (observer) threads become executed first
        const threadsToStep: IndexedThread[] = this.chooseThreadsToStep(fromState);
        Preconditions.checkState(threadsToStep.length <= 1,
            "For now, we assume that only one thread is executed concurrently");

        for (const threadToStep of threadsToStep) {
            Preconditions.checkState(threadToStep.threadStatus.getComputationState() === ThreadComputationState.THREAD_STATE_RUNNING);

            // Determine the operations to execute on for the given thread
            const leavingOps: StepInformation[] = this.resolveLeavingOps(fromState, threadToStep);
            Preconditions.checkState(leavingOps.length > 0,
                "A thread with no leaving ops must NOT be in state THREAD_STATE_RUNNING");

            for (const op of leavingOps) { // Multiple leaving ops in case of branchings
                // Interpret the operation `op` for thread `threadToStep` in state `fromState`
                const succStates0: ControlAbstractState[] = this.interprete(fromState, threadToStep, op);

                // Wake up threads (set status YIELD) that have been waiting for a condition to be reached
                const succStates1: ControlAbstractState[] = mapExpand(succStates0, (e) => this.awaikConditionCheckThreads(e));

                // Schedule the threads to run in the next iterations
                for (const succState of succStates1) {
                    result = result.concat(this.schedule(fromState, succState, threadToStep.threadIndex));
                }
            }
        }

        return result;
    }

    /**
     * Get the list of indices of threads in the list of threads
     * that should make a step.
     *
     * @param fromState
     */
    private chooseThreadsToStep(fromState: ControlAbstractState): IndexedThread[] {
        Preconditions.checkNotUndefined(fromState);
        Preconditions.checkArgument(fromState.getThreadStates().size > 0);

        const result: IndexedThread[] = [];
        let index = 0;
        for (const t of fromState.getThreadStates()) {
            if (t.getComputationState() == ThreadComputationState.THREAD_STATE_RUNNING) {
                result.push(new IndexedThread(t, index));
            }
            index++;
        }

        return result;
    }

    private buildScopeStack(actorName: string, relationName: string): ImmList<string> {
        return ImmList([actorName, relationName]);
    }

    /**
     * Returns either a singleton-list or the empty list.
     */
    private resolveLeavingOps(fromState: ControlAbstractState, thread: IndexedThread): StepInformation[] {
        const threadState = thread.threadStatus;
        const fromLocation: RelationLocation = threadState.getRelationLocation();
        const fromRelation: TransitionRelation = this._task.getTransitionRelationById(fromLocation.getRelationId());
        const threadActor: Actor = this._task.getActorByName(threadState.getActorId());

        let result: StepInformation[] = [];
        for (const t of fromRelation.transitionsFrom(fromLocation.getLocationId())) {
            const isAtomic = false;
            const op: ProgramOperation = ProgramOperations.withID(t.opId);
            const statementTarget = new RelationLocation(threadActor.ident, fromRelation.ident, t.target);
            Preconditions.checkNotUndefined(op);

            const scopeStack: ImmList<string> = this.buildScopeStack(threadActor.ident, fromRelation.name);

            result.push(new StepInformation(thread, statementTarget, isAtomic,
                this.scopeOperations([op], fromState.getActorScopes(), scopeStack, scopeStack),
                    threadState.getCallStack(), scopeStack));
        }

        return result;
    }

    private scopeOperations(ops: ProgramOperation[], actorScopes: ImmMap<DataLocation, string>, readFromScope: ImmList<string>,
                            writeToScope: ImmList<string>): ProgramOperation[] {
        const scoper = new ScopeTransformerVisitor(this._task, actorScopes, readFromScope, writeToScope);
        return ops.map((o) => ProgramOperationFactory.createFor(o.ast.accept(scoper)));
    }

    private interprete(fromState: ControlAbstractState, threadToStep: IndexedThread,
                       step: StepInformation): ControlAbstractState[] {
        const result: ControlAbstractState[] = [];

        // Interpretation by this analysis
        const withControlResults: [ControlAbstractState, boolean][] = this.interpreteLocal(fromState, threadToStep, step);

        for (const [r, considerInterpretationFinished] of withControlResults){
            // Interpret the wrapped state by the wrapped analysis
            const threadToStepPrime = r.getIndexedThreadState(threadToStep.threadIndex);
            const ops = threadToStepPrime.threadStatus.getOperations().map((oid) => ProgramOperation.for(oid));
            const opsConcern = this._task.getActorByName(threadToStepPrime.threadStatus.getActorId()).concern;

            const wrappedAnalysisResults: Iterable<AbstractElement> = considerInterpretationFinished
                ? [r.getWrappedState()]
                : Transfers.withIntermediateOps(this._wrappedTransferRelation, r.wrappedState, ops, opsConcern);

            // Combine the result
            Preconditions.checkNotUndefined(r);
            for (const w of wrappedAnalysisResults) {
                Preconditions.checkNotUndefined(w);
                const properties = this.extractFailedForProperties(r.getThreadStates());
                result.push(r.withWrappedState(w)
                    .withSteppedFor([step.steppedThread.threadIndex])
                    .withIsTargetFor(properties));
            }
        }

        // Set states do DONE if on the last location and RUNNING
        return result.map((cs) => this.switchToTerminated(cs));
    }

    private switchToTerminated(cs: ControlAbstractState) {
        let result: ControlAbstractState = cs;

        for (const [ti, ts] of result.threadStates.entries()) {
            if (ts.getComputationState() != ThreadComputationState.THREAD_STATE_FAILURE) {
                const leaving = this.resolveLeavingOps(cs, new IndexedThread(ts, ti));
                if (leaving.length == 0) {
                    result = result.withThreadStateUpdate(ti, (ts) => ts.withComputationState(ThreadComputationState.THREAD_STATE_DONE));
                }
            }
        }

        return result;
    }

    private extractFailedForProperties(sched: ImmList<ThreadState>): ImmSet<Property> {
        const properties = [];
        for (const t of sched) {
            for (const p of t.getFailedFor()) {
                properties.push(p);
            }
        }
        return ImmSet(properties);
    }

    private interpreteLocal(fromState: ControlAbstractState, threadToStep: IndexedThread,
                            step: StepInformation): [ControlAbstractState, boolean][] {
       const result0: [ControlAbstractState, boolean][] = this.interpreteLocal0(fromState, threadToStep, step);

       const resultPrime: [ControlAbstractState, boolean][] = [];
       for (const [cs, handled] of result0) {
          if (handled) {
              resultPrime.push([cs, handled]);
          } else {
              const threadToStepPrime = cs.getIndexedThreadState(threadToStep.threadIndex).threadStatus;
              const stepOps = threadToStepPrime.getOperations().map((oid) => ProgramOperation.for(oid));

              let unhandledOps: ImmList<OperationId> = ImmList();
              let csPrime = cs;
              for (const stepOp of stepOps) {
                  if (stepOp.ast instanceof StoreEvalResultToVariableStatement) {
                      // TODO: Check if some of this code can be moved to the
                      //      Scratch library to allow for a symbolic encoding.
                      if (stepOp.ast.variable.variableType == ActorType.instance()) {
                          const variableToSet = stepOp.ast.variable;
                          let setTo: ActorId = null;

                          if (stepOp.ast.toValue instanceof VariableWithDataLocation) {
                              const actorIdentifier: ActorId = fromState.getActorScopes().get(stepOp.ast.toValue.dataloc);
                              setTo = Preconditions.checkNotUndefined(actorIdentifier);

                          } else if (stepOp.ast.toValue instanceof LocateActorExpression) {
                              const expr = stepOp.ast.toValue as LocateActorExpression;
                              const searchFor = extractStringLiteral(expr.actorName);

                              // This loop only ensures that an actor with the given name exists.
                              for (const [actorVar, id] of fromState.getActorScopes().entries()) {
                                  if (id == searchFor) {
                                      setTo = id;
                                  }
                              }

                          } else if (stepOp.ast.toValue instanceof StartCloneActorExpression) {
                              throw new ImplementMeException();

                          } else if (stepOp.ast.toValue instanceof UsherActorExpression) {
                              throw new ImplementMeException();

                          } else {
                              throw new ImplementMeException();
                          }

                          if (!setTo) {
                              throw new IllegalArgumentException("Actor expression did not evaluate to a valid result for: "
                                  + stepOp.ast.toTreeString());
                          }
                          const actorScopesPrime = csPrime.getActorScopes().set(variableToSet.dataloc, setTo);
                          csPrime = csPrime.withActorScopes(actorScopesPrime);

                      } else {
                          unhandledOps = unhandledOps.push(stepOp.ident);
                      }
                  } else {
                      unhandledOps = unhandledOps.push(stepOp.ident);
                  }
              }

              csPrime = csPrime.withThreadStateUpdate(threadToStep.threadIndex,
                  (ts) => ts.withOperations(unhandledOps));

              resultPrime.push([csPrime, unhandledOps.size == 0])
          }
       }

       return resultPrime;
    }

    private createConditionCheckThread(actorId: ActorId, condition: BooleanExpression): ThreadState {
        const threadId = ThreadStateFactory.freshId();
        const actor: Actor = this._task.getActorByName(actorId);
        const script: Script = this._task.getConditionCheckScript(actor, condition);
        const entryLocation: RelationLocation = new RelationLocation(actor.ident, script.transitions.ident, getTheOnlyElement(script.transitions.entryLocationSet));

        return new ThreadState(threadId, actorId, script.id, ImmList(), entryLocation, ThreadComputationState.THREAD_STATE_YIELD,
            ImmSet(), ImmSet(), ImmList(), ImmList(), ImmMap(), 1);
    }

    private getLoopAction(predRelLoc: RelationLocation, succRelLoc: RelationLocation): LoopAction {
        const predRel = this._task.getTransitionRelationById(predRelLoc.getRelationId());
        const succRel = this._task.getTransitionRelationById(succRelLoc.getRelationId());

        if (predRel.isLoopHead(predRelLoc.location)) {
            const predIsLoopHeadOf: TransitionLoop = predRel.getIsInLoopBodyOf(predRelLoc.getLocationId());
            const predLoop: TransitionLoop = predRel.getIsInLoopBodyOf(predRelLoc.getLocationId());
            const succLoop: TransitionLoop = succRel.getIsInLoopBodyOf(succRelLoc.getLocationId());

            if (predIsLoopHeadOf == succLoop) {
                // case 1: succ is in the same loop --> entering or re-entering the loop
                return new LoopAction(LoopActionType.ENTERING, succLoop, predRelLoc);
            } else {
                // case 2: succ is not the same loop --> leaving the loop
                return new LoopAction(LoopActionType.LEAVING, predIsLoopHeadOf, predRelLoc);
            }
        } else {
            return new LoopAction(LoopActionType.NONE, null, null);
        }
    }

    private interpreteLocal0(fromState: ControlAbstractState, threadToStep: IndexedThread,
                       step: StepInformation): [ControlAbstractState, boolean][] {
        Preconditions.checkNotUndefined(fromState);
        Preconditions.checkNotUndefined(threadToStep);
        Preconditions.checkNotUndefined(step);

        Preconditions.checkArgument(step.ops.length === 1);
        const stepOp = step.ops[0];
        const steppedActor = this._task.getActorByName(step.steppedThread.threadStatus.getActorId());
        const fromLocation = step.steppedThread.threadStatus.getRelationLocation();
        const fromRelation = this._task.getTransitionRelationById(fromLocation.getRelationId());

        // Set the new control location
        let result: ControlAbstractState = fromState.withThreadStateUpdate(threadToStep.threadIndex,
            (ts) =>
                ts.withLocation(step.succLoc)
                .withOperations(ImmList(step.ops.map(o => o.ident)))
                .withCallStack(step.succCallStack));

        // A new loop iteration? Or a loop iteration ended?
        const predRelLoc = step.steppedThread.threadStatus.getRelationLocation();
        const succRelLoc = step.succLoc;
        const predLoopStack = step.steppedThread.threadStatus.getLoopStack();

        const loopAction = this.getLoopAction(predRelLoc, succRelLoc);
        switch (loopAction.type) {
            case LoopActionType.ENTERING: {
                const newLoopStack: ImmList<RelationLocation> = predLoopStack.push(loopAction.loopHead);
                result = result.withThreadStateUpdate(threadToStep.threadIndex,
                    (ts) =>
                        ts.withLoopStack(newLoopStack));
                break;
            }
            case LoopActionType.LEAVING: {
                const newLoopStack = this.popLoop(predLoopStack);
                result = result.withThreadStateUpdate(threadToStep.threadIndex,
                    (ts) =>
                        ts.withLoopStack(newLoopStack));
                break;
            }
        }

        // TODO: Where and how to handle the `clone` statement?

        //
        // Handle different statements that start other threads and wait for them
        //
        if (stepOp.ast instanceof SignalTargetReachedStatement) {
            const properties: ImmSet<Property> = Properties.fromArguments(stepOp.ast.targetCharacteristics);
            return [[result.withThreadStateUpdate(threadToStep.threadIndex, (ts) =>
                ts.withComputationState(ThreadComputationState.THREAD_STATE_FAILURE)
                    .withFailedFor(properties)), true]];

        } else if (stepOp.ast instanceof BeginAtomicStatement) {
            return [[result.withThreadStateUpdate(threadToStep.threadIndex,
                (ts) => ts.withIncrementedAtomic()), true]];

        } else if (stepOp.ast instanceof EndAtomicStatement) {
            return [[result.withThreadStateUpdate(threadToStep.threadIndex,
                (ts) => ts.withDecrementedAtomic()), true]];

        } else if (stepOp.ast instanceof CallStatement) {
            // The following lines realize the inter-procedural analysis.
            const calledMethodName = stepOp.ast.calledMethod.text;

            if (steppedActor.isExternalMethod(calledMethodName)) {
                const call = stepOp.ast as CallStatement;
                if (call.calledMethod.text == MethodIdentifiers._RUNTIME_signalFailure) {
                    throw new IllegalArgumentException("Call should have been transformed to a SignalTargetReachedStatement");

                } else if (call.calledMethod.text == MethodIdentifiers._RUNTIME_waitSeconds) {
                    // const timeCond: BooleanExpression = this.createTimeCond(stmt.secs);
                    // const waitfor: ThreadState = this.createTemporaryCheckThreadFor(timeCond);
                    Preconditions.checkArgument(call.args.elements.length == 1);
                    const secondsExpression = call.args.getIth(0);

                    const ops: ProgramOperation[] = [
                        new CallStatement(Identifier.of(MethodIdentifiers._RUNTIME_micros),
                            new ExpressionList([]), OptionalAstNode.with(this._threadWaitUntilMicrosVariable)),
                        new StoreEvalResultToVariableStatement(this._threadWaitUntilMicrosVariable,
                            new PlusExpression(this._threadWaitUntilMicrosVariable, new MultiplyExpression(secondsExpression, NumberLiteral.of(1000000))))
                    ].map((ast) => ProgramOperationFactory.createFor(ast));

                    const waitUntilCond = new NumGreaterEqualExpression(this._globalTimeMicrosVariable, this._threadWaitUntilMicrosVariable);
                    const accelInfo = new AccelInfo(threadToStep.threadStatus.getActorId(),
                        waitUntilCond, new NumberVariableExpression(this._globalTimeMicrosVariable),
                        new PlusExpression(this._threadWaitUntilMicrosVariable, NumberLiteral.of(1)));

                    const checkThread: ThreadState = this.createConditionCheckThread(steppedActor.ident, waitUntilCond);
                    this._accelInfoMap.set(checkThread.getScriptId(), accelInfo);

                    const currentScopeStack = this.buildScopeStack(steppedActor.ident, fromRelation.name);
                    return [[result.withAddedConditionState(checkThread)
                        .withThreadStateUpdate(threadToStep.threadIndex, (ts) =>
                        ts.withAddedWaitingFor(checkThread)
                          .withComputationState(ThreadComputationState.THREAD_STATE_WAIT)
                          .withOperations(ImmList(this.scopeOperations(ops, fromState.getActorScopes(),
                            currentScopeStack, currentScopeStack).map(op => op.ident)))), false]];
                }

            } else {
                const steppedThread = threadToStep.threadStatus;
                const calledMethod: Method = steppedActor.getMethod(calledMethodName);
                const interProcOps: ProgramOperation[] = this.createPassArgumentsOps(calledMethod, stepOp.ast.args);
                const succCallStack = steppedThread.getCallStack()
                    .push(new MethodCall(fromLocation, step.succLoc));

                const resultList: [ControlAbstractState, boolean][] = [];

                for (const entryLocId of calledMethod.transitions.entryLocationSet) {
                    const callToRelationLoc: RelationLocation = new RelationLocation(
                        steppedActor.ident, calledMethod.transitions.ident, entryLocId);
                    const currentScopeStack = this.buildScopeStack(steppedActor.ident, fromRelation.name);
                    const succRelation = this._task.getTransitionRelationById(callToRelationLoc.getRelationId());
                    const succScopeStack = this.buildScopeStack(steppedActor.ident, succRelation.name);

                    resultList.push([result.withThreadStateUpdate(threadToStep.threadIndex, (ts) =>
                        ts.withOperations(ImmList(this.scopeOperations(interProcOps, fromState.getActorScopes(), currentScopeStack, succScopeStack).map(op => op.ident)))
                            .withLocation(callToRelationLoc)
                            .withCallStack(succCallStack)), false]);
                }

                return resultList;
            }

        } else if (stepOp.ast instanceof ReturnStatement) {
            const steppedThread = threadToStep.threadStatus;
            const callInformation: MethodCall = steppedThread.getCallStack().get(steppedThread.getCallStack().size-1);
            const succReturnCallsTo: ImmList<MethodCall> = steppedThread.getCallStack().pop();
            const succRelation = this._task.getTransitionRelationById(callInformation.getReturnTo().getRelationId());
            const predScopeStack = this.buildScopeStack(steppedActor.ident, fromRelation.name);
            const succScopeStack = this.buildScopeStack(steppedActor.ident, succRelation.name);

            // Assign the result to the variable that was referenced in the `CallStatement`
            const interProcOps: ProgramOperation[] = this.createStoreCallResultOps(steppedThread, callInformation, stepOp.ast as ReturnStatement);

            return [[result.withThreadStateUpdate(threadToStep.threadIndex, (ts) =>
                ts.withOperations(ImmList(this.scopeOperations(interProcOps, fromState.actorScopes, predScopeStack, succScopeStack).map(o => o.ident)))
                    .withLocation(callInformation.getReturnTo())
                    .withCallStack(succReturnCallsTo)), false]];

        } else if (stepOp.ast instanceof BroadcastMessageStatement) {
            const stmt: BroadcastMessageStatement = stepOp.ast as BroadcastMessageStatement;
            const waitFor: IndexedThread[] = this.getAllMessageReceiverThreadsFrom(result, stmt.msg);

            // Prepare the waiting threads for running
            for (const waitForThread of waitFor) {
                result = this.restartThread(result, waitForThread.threadIndex);
            }

            return [[result, true]]

        } else if (stepOp.ast instanceof BroadcastAndWaitStatement) {
            const steppedThread = threadToStep.threadStatus;
            const stmt: BroadcastAndWaitStatement = stepOp.ast as BroadcastAndWaitStatement;
            const waitFor: IndexedThread[] = this.getAllMessageReceiverThreadsFrom(result, stmt.msg);

            // Prepare the waiting threads for running
            for (const waitForThread of waitFor) {
                result = this.restartThread(result, waitForThread.threadIndex);
            }

            if (waitFor.length > 0) {
                result = result.withThreadStateUpdate(threadToStep.threadIndex, (ts) =>
                    ts.withComputationState(ThreadComputationState.THREAD_STATE_WAIT));
            }

            if (stepOp.ast.msg.isEqualTo(BOOTSTRAP_FINISHED_MESSAGE)) {
                result = this.activateAfterStepMonitoring(result);
            }

            // Wait for all triggered threads to finish
            return [[result.withThreadStateUpdate(threadToStep.threadIndex, (ts) =>
                ts.withWaitingForThreads(
                        steppedThread
                            .getWaitingForThreads()
                            .union(waitFor.map((t) => t.threadStatus.getThreadId())))), true]];

        } else if (stepOp.ast instanceof WaitUntilStatement) {
            const stmt: WaitUntilStatement = stepOp.ast as WaitUntilStatement;

        } else if (stepOp.ast instanceof WaitSecsStatement) {
            throw new ImplementMeException();

            // TODO:
            //   Since (1) the `WaitSecsStatement` can be parameterized with
            //   a number expression, and (2) the condition is relative to the
            //   time the statement was invoked, a more elaborated logic is needed here.
            Logger.potentialUnsound("wait N seconds might have to be considered in the scheduling.")

        } else if (stepOp.ast instanceof WaitUntilStatement) {
            throw new ImplementMeException();

        } else if (stepOp.ast instanceof WaitSecsStatement) {
            throw new ImplementMeException();
        }

        // TODO: Hats to activate:
        //  - StartedAsClone

        // TODO: Mouse inputs, keyboard inputs, microphone inputs, others?

        // TODO: Produce a state with THREAD_STATE_RUNNING_ATOMIC if isInnerAtomic

        return [[result, false]];
    }

    private getCallingStatement(callInformation: MethodCall): CallStatement {
        const callFromRelation = this._task.getTransitionRelationById(callInformation.getCallFrom().getRelationId());
        const returnToRelation = this._task.getTransitionRelationById(callInformation.getReturnTo().getRelationId());
        Preconditions.checkArgument(callFromRelation === returnToRelation);

        const fromTransitions: Array<TransitionTo> = callFromRelation.transitionsFrom(callInformation.getCallFrom().getLocationId());
        Preconditions.checkArgument(fromTransitions.length == 1);

        return ProgramOperations.withID(fromTransitions[0].opId).ast as CallStatement;
    }

    private createStoreCallResultOps(thread: ThreadState, callInformation: MethodCall, ast: ReturnStatement): ProgramOperation[] {
        const result: Statement[] = [];

        // Store the result in the caller scope's target variable
        if (ast.resultVariable.isPresent()) {
            const callStmt: CallStatement = this.getCallingStatement(callInformation);
            if (callStmt.assignResultTo.isPresent()) {
                const variableWithReturnValue: VariableWithDataLocation = ast.resultVariable.value();
                const storeResultTo: VariableWithDataLocation = callStmt.assignResultTo.value();

                result.push(new StoreEvalResultToVariableStatement(storeResultTo, variableWithReturnValue));
            }
        } else {
            // Nothing to do
        }

        return result.map((s) => new RawOperation(s));
    }

    private createPassArgumentsOps(calledMethod: Method, args: ExpressionList): ProgramOperation[] {
        Preconditions.checkArgument(calledMethod.parameters.elements.length == args.elements.length);
        const result: Statement[] = [];

        let index = 0;
        while (index < calledMethod.parameters.elements.length) {
            const p: ParameterDeclaration = calledMethod.parameters.getIth(index);
            const a: Expression = args.getIth(index);

            // 1. Add declarations of the parameter variables (callee scope)
            const variable = new VariableWithDataLocation(DataLocations.createTypedLocation(p.ident, p.type));
            result.push(new DeclareStackVariableStatement(variable));

            // 2. Assign the arguments (caller scope) to the parameters (callee scope)
            result.push(new StoreEvalResultToVariableStatement(variable, a));

            index++;
        }

        return result.map((s) => new RawOperation(s));
    }

    private isProgramConcern(concern: Concern) {
        return concern == Concerns.defaultProgramConcern();
    }

    private getStepConcern(toState: ControlAbstractState): Concern {
        let result: Concern = null;
        for (const threadIndex of toState.getSteppedFor()) {
            const threadState = toState.getThreadStates().get(threadIndex);
            const actorConcern = this._task.getActorByName(threadState.getActorId()).concern;
            if (result == null) {
                result = actorConcern;
            } else {
                Preconditions.checkState(result == actorConcern);
            }
        }

        return result;
    }

    private awaikConditionCheckThreads(inState: ControlAbstractState): ControlAbstractState[] {
        let result: ControlAbstractState = inState;

        const concern = this.getStepConcern(inState);

        //  1. Activate the specification check thread (`after statement finished`)
        if (this.isProgramConcern(concern)) {
            for (const [threadIndex, threadState] of inState.getThreadStates().entries()) {
                const actor: Actor = this._task.getActorByName(threadState.getActorId());
                const isSpecificationThread = actor.isObserver;
                const script = actor.getScript(threadState.getScriptId());

                if (script.event instanceof AfterStatementMonitoringEvent) {
                    if (threadState.getComputationState() != ThreadComputationState.THREAD_STATE_DISABLED) {
                        result = this.restartThread(inState, threadIndex);
                    }
                }
            }
        }

        // 2. Wake-up threads if all threads they have been waiting for are finished now
        // TODO: What if 'wait for 0 seconds' is used?
        for (const [threadIndex, threadState] of inState.getThreadStates().entries()) {
            let stillWaitingFor = threadState.getWaitingForThreads();
            if (stillWaitingFor.size > 0) {
                for (const waitingForThreadId of threadState.getWaitingForThreads()) {
                    const waitingFor = inState.findThreadWithId(waitingForThreadId);
                    if (waitingFor) { // <-- can be NULL, condition-check-threads are in a different list of threads
                        if (waitingFor.threadStatus.computationState == ThreadComputationState.THREAD_STATE_DONE) {
                            stillWaitingFor = stillWaitingFor.remove(waitingForThreadId);
                        }
                    }
                }

                result = result.withThreadStateUpdate(threadIndex, (ts) => ts.withWaitingForThreads(stillWaitingFor));
                if (stillWaitingFor.size == 0) {
                    result = result.withThreadStateUpdate(threadIndex, (ts) => ts.withComputationState(ThreadComputationState.THREAD_STATE_YIELD));
                }
            }
        }

        // 3. Check if threads that wait for certain conditions can continue to run
        //    (assume certain conditions to hold if this accelerates the analysis without being unsound)

        return this.runStateCheckThreads(result);
    }

    private hasNonWaitingRunnable(threads: ImmList<ThreadState>): boolean {
        return threads.filter((ts) => ts.getComputationState() == ThreadComputationState.THREAD_STATE_YIELD
            || ts.getComputationState() == ThreadComputationState.THREAD_STATE_RUNNING).size > 0;
    }

    private runStateCheckThreads(state: ControlAbstractState): ControlAbstractState[] {
        if (state.getConditionStates().size == 0) {
            return [state];
        } else {
            const waitingThreads = state.getThreadStates().filter((ts) => ts.getComputationState() == ThreadComputationState.THREAD_STATE_WAIT);

            if (this.hasNonWaitingRunnable(state.getThreadStates())) {
                return this.checkConditionAndWakeUpIfSatisfied(state);

            } else {
                // Acceleration applicable

                // Group the conditions by the variant variable (which should be accelerated)
                // (assuming that there is no dependency between the variables to accelerate)
                const acceleratable: AccelInfo[] = this.filterAcceleratableConditionThreads(state.getConditionStates());

                // For now, we only consider an acceleration based on the time variable
                const timeAccel = acceleratable.filter((ac) => ac.variantVariable.variable == this._globalTimeMicrosVariable);
                if (timeAccel.length == 1) {
                    // We can immediately accelerate in this case
                    const accelInfo = timeAccel[0];
                    return this.checkConditionAndWakeUpIfSatisfied(getTheOnlyElement(this.accelerateTo(state, accelInfo)));
                }

                throw new ImplementMeException();
            }
        }
    }

    private checkConditionAndWakeUpIfSatisfied(state: ControlAbstractState): ControlAbstractState[] {
        // No acceleration applicable
        const conditionCheckThreadIDs = new Set<ThreadId>();
        const condThreadIdToIndex = new Map<number, number>();
        const condThreadIdToState = new Map<number, ThreadState>();
        for (const [index, ts] of state.getConditionStates().entries()) {
            conditionCheckThreadIDs.add(ts.getThreadId());
            condThreadIdToState.set(ts.getThreadId(), ts);
            condThreadIdToIndex.set(ts.getThreadId(), index);
        }

        let threadSuccStates: ImmMap<number, ImmList<ThreadState>> = ImmMap();

        // For all waiting threads: Check if they are waiting for a condition thread
        for (const [threadIndex, threadState] of state.getThreadStates().entries()) {
            Preconditions.checkNotUndefined(threadState);
            if (threadState.getComputationState() == ThreadComputationState.THREAD_STATE_WAIT) {
                const waitingForCondThreadIDs = threadState.getWaitingForThreads().union(conditionCheckThreadIDs);
                Preconditions.checkState(waitingForCondThreadIDs.size == 1);
                const waitingForCondThreadID: ThreadId = getTheOnlyElement(waitingForCondThreadIDs);

                // Check condition
                const condThread: ThreadState = condThreadIdToState.get(waitingForCondThreadID);
                const wrappedCondStates: [AbstractElement, boolean][] = this.runConditionThread(state, condThread);
                //

                let succStates: ImmList<ThreadState> = ImmList();
                for (const [condCheckedState, checkResult] of wrappedCondStates) {
                    if (checkResult) {
                        succStates = succStates.push(threadState
                            .withComputationState(ThreadComputationState.THREAD_STATE_YIELD)
                            .withRemovedWaitingFor(waitingForCondThreadID))
                    } else {
                        succStates = succStates.push(threadState);
                    }
                }
                threadSuccStates = threadSuccStates.set(threadIndex, succStates);
            }
        }

        const updatedThreadLists: ImmList<ThreadState>[] = this.expandToUpdatedThreadLists(state, threadSuccStates);

        // Create the list of successor states
        let result: ControlAbstractState[] = [];
        for (const threadList of updatedThreadLists) {
            result.push(state.withThreadStates(threadList));
        }

        // Remove the cond threads no main thread is waiting for
        return result.map((cs) => this.removeIrrelevantCondThreads(cs));
    }

    private accelerateTo(state: ControlAbstractState, accelInfo: AccelInfo): ControlAbstractState[] {
        Preconditions.checkNotUndefined(state);
        Preconditions.checkNotUndefined(accelInfo);

        const accelStmts = new StatementList([
            new StoreEvalResultToVariableStatement(accelInfo.variantVariable.variable, accelInfo.accelerateTo)]);
        const accelTr: TransitionRelation = TransitionRelations.eliminateEpsilons(accelStmts.accept(new RelationBuildingVisitor()));
        this._task.registerTrasitionRelation(accelTr);

        const conditionScopeStack = this.buildScopeStack(accelInfo.actorId, accelTr.name);

        const wrappedResult: [AbstractElement, boolean][] = Transfers.transferAlongTransitionSystem(this._wrappedTransferRelation,
            state.getWrappedState(), accelTr, getTheOnlyElement(accelTr.entryLocationSet), Concerns.highestPriorityConcern(),
            (op) => {return this.scopeOperations([op], state.getActorScopes(),
                conditionScopeStack, conditionScopeStack)[0]});

        return wrappedResult.map(([w,t]) => new ControlAbstractState(state.getThreadStates(),
            state.getConditionStates(), w, state.getIsTargetFor(), state.getSteppedFor(), state.getActorScopes()));
    }

    private filterAcceleratableConditionThreads(conditionStates: ImmList<ThreadState>): AccelInfo[] {
        return Array.from(conditionStates
            .filter((ts) => this._accelInfoMap.has(ts.getScriptId()))
            .map((ts) => this._accelInfoMap.get(ts.getScriptId())));
    }

    private removeIrrelevantCondThreads(cs: ControlAbstractState): ControlAbstractState {
        const stillWaitingFor: ImmSet<ThreadId> = cs.getThreadStates().map((ts) => ts.getWaitingForThreads())
            .reduce((acc, value) => value.union(acc), ImmSet<ThreadId>());

        return cs.withConditionStates(cs.getConditionStates()
            .filter((cts) => stillWaitingFor.contains(cts.threadId)));
    }

    private expandToUpdatedThreadLists(state: ControlAbstractState, threadSuccStates: ImmMap<number, ImmList<ThreadState>>): ImmList<ThreadState>[] {
        const worklist: [ImmList<ThreadState>, ImmMap<number, ImmList<ThreadState>>][] = [];
        worklist.push([state.getThreadStates(), threadSuccStates]);

        const result: ImmList<ThreadState>[] = [];
        while (worklist.length > 0) {
            const [workBaseList, workListUpdates]: [ImmList<ThreadState>, ImmMap<number, ImmList<ThreadState>>] = worklist.pop();
            if (workListUpdates.size == 0) {
                Preconditions.checkState(workBaseList.size == state.getThreadStates().size);
                result.push(workBaseList);
            } else {
                const indexToUpdate: number = getTheNextElement(workListUpdates.keys());
                const alternatives: ImmList<ThreadState> = workListUpdates.get(indexToUpdate);
                const workListUpdatesPrime: ImmMap<number, ImmList<ThreadState>> = workListUpdates.delete(indexToUpdate);
                for (const alt of alternatives) {
                    Preconditions.checkNotUndefined(alt);
                    worklist.push([workBaseList.set(indexToUpdate, alt), workListUpdatesPrime]);
                }
            }
        }

        return result;
    }

    private runConditionThread(state: ControlAbstractState, condThreadState: ThreadState): [AbstractElement, boolean][] {
        Preconditions.checkNotUndefined(state);
        Preconditions.checkNotUndefined(condThreadState);

        const script: TransitionRelation = this._task.getTransitionRelationById(
            condThreadState.getRelationLocation().getRelationId());
        Preconditions.checkArgument(script != null, "Condition script must have been registered!");
        const conditionScopeStack = this.buildScopeStack(condThreadState.actorId, script.name);

        const checkResult: [AbstractElement, boolean][] = Transfers.transferAlongTransitionSystem(this._wrappedTransferRelation,
            state.getWrappedState(), script, getTheOnlyElement(script.entryLocationSet), Concerns.highestPriorityConcern(),
            (op) => {return this.scopeOperations([op], state.getActorScopes(),
                conditionScopeStack, conditionScopeStack)[0]});

        return checkResult.filter((([e, t]) => Lattices.isFeasible(e, this._wrappedDomain.lattice)));
    }

    private restartThread(baseState: ControlAbstractState, threadIndex: number): ControlAbstractState {
        const threadState: ThreadState = baseState.getThreadStates().get(threadIndex);
        const script: Script = this._task.getActorByName(threadState.getActorId()).getScript(threadState.getScriptId());
        const startLocation: LocationId = getTheOnlyElement(script.transitions.entryLocationSet);

        return baseState.withThreadStateUpdate(threadIndex,
            (ts) => ts.withComputationState(ThreadComputationState.THREAD_STATE_YIELD)
                .withLocation(ts.getRelationLocation().withLocationId(startLocation)));
    }

    private schedule(predState: ControlAbstractState, succState: ControlAbstractState,
                     steppedThreadIndex: number): ControlAbstractState[] {
        let result: ControlAbstractState = succState;
        const steppedThread: IndexedThread = succState.getIndexedThreadState(steppedThreadIndex);

        const nextOps = this.resolveLeavingOps(predState, steppedThread);
        if (nextOps.length > 0 && steppedThread.threadStatus.getInAtomicMode() > 0) {
            // Finish the atomic operations without interruptions by another thread
            return [result.withThreadStateUpdate(steppedThread.threadIndex, (ts) =>
                ts.withComputationState(ThreadComputationState.THREAD_STATE_RUNNING))];
        }

        if (nextOps.length == 0) {
            // Set to THREAD_STATE_DONE if on a terminating location
            result = result.withThreadStateUpdate(steppedThread.threadIndex, (ts) =>
                ts.withComputationState(ThreadComputationState.THREAD_STATE_DONE));

        } else {
            // YIELD the current state if it is not yet on a terminating control location of the script.
            if (steppedThread.threadStatus.getComputationState() == ThreadComputationState.THREAD_STATE_RUNNING) {
                result = result.withThreadStateUpdate(steppedThread.threadIndex, (ts) =>
                    ts.withComputationState(ThreadComputationState.THREAD_STATE_YIELD));
            }
        }

        // Determine and set the next thread to step
        const continueWithNextThreadAt: number = this.determineNextThreadToStep(result, steppedThread.threadIndex);
        if (continueWithNextThreadAt > -1) {
            result = result.withThreadStateUpdate(continueWithNextThreadAt, (ts) =>
                ts.withComputationState(ThreadComputationState.THREAD_STATE_RUNNING));
        }

        this.checkSchedule(result);
        return [result];
    }

    private determineNextThreadToStep(resultBase: ControlAbstractState, steppedThreadIdx: number): number {
        const threads = resultBase.getThreadStates();

        let programThreadToRun: number = -1;

        let indexToCheck = (steppedThreadIdx + 1) % threads.size;
        let checked = 0;
        while (checked <= threads.size) {
            indexToCheck = (indexToCheck + 1) % threads.size;
            const threadAtIndex = threads.get(indexToCheck);
            if (threadAtIndex.getComputationState() === ThreadComputationState.THREAD_STATE_YIELD) {
                if (this.isObserverThread(threadAtIndex)) {
                    return indexToCheck;
                } else {
                    programThreadToRun = indexToCheck;
                }
            }
            checked++;
        }

        if (programThreadToRun > -1) {
            return programThreadToRun;
        }

        // Continue to execute the previously stepped thread if no other
        // is ready to be stepped.
        const stepped = threads.get(steppedThreadIdx);
        if (this.isSteppable(stepped)) {
            return steppedThreadIdx;
        } else {
            return -1;
        }
    }

    private isSteppable(thread: ThreadState): boolean {
        return thread.getComputationState() == ThreadComputationState.THREAD_STATE_RUNNING
            || thread.getComputationState() == ThreadComputationState.THREAD_STATE_YIELD;
    }

    private isObserverThread(thread: ThreadState) {
        const actor = this._task.getActorByName(thread.getActorId());
        return actor.isObserver;
    }

    private checkSchedule(schedOf: ControlAbstractState) {
        let threadIndex = 0;
        let running = 0;
        for (const ts of schedOf.getThreadStates()) {
            const ops = this.resolveLeavingOps(schedOf, new IndexedThread(ts, threadIndex));
            if (ts.getComputationState() == ThreadComputationState.THREAD_STATE_RUNNING) {
                running++;
                if (ops.length == 0) {
                   throw new IllegalStateException(`Thread for actor ${ts.getActorId()}, script ${ts.getScriptId()}, on location ${ts.getRelationLocation().getLocationId()} does not have leaving ops.`);
                }
            }
            threadIndex++;
        }
        Preconditions.checkState(running <= 1);
    }

    private getAllMessageReceiverThreadsFrom(abstractState: ControlAbstractState, msg: SystemMessage): IndexedThread[] {
        const result: IndexedThread[] = [];
        let index = 0;
        for (const t of abstractState.getThreadStates()) {
            const script = this._task.getActorByName(t.getActorId()).getScript(t.getScriptId());
            if (!script) {
                continue;
            }

            if (script.event instanceof MessageReceivedEvent) {
                const ev: MessageReceivedEvent = script.event as MessageReceivedEvent;
                if (this.matchesMessage(ev.message, ev.namespace, msg)) {
                    result.push(new IndexedThread(t, index));
                }
            }
            index++;
        }
        return result;
    }

    private evaluateToConcreteMessage(msg: StringExpression): string {
        if (msg instanceof StringLiteral) {
            const lit = msg as StringLiteral;
            return lit.text;
        }
        throw new ImplementMeException();
    }

    private matchesMessage(message: StringExpression, namespace: StringExpression, msg: SystemMessage) {
        const msg1_namespace: string = this.evaluateToConcreteMessage(msg.namespace);
        const msg1_message: string = this.evaluateToConcreteMessage(msg.messageid);

        const msg2_message: string = this.evaluateToConcreteMessage(message);

        return msg1_message == msg2_message;
    }

    /**
     * Threads that observe state transitions must become active after the boostrapping
     * process has been finished and not prior to it.
     *
     * This function awakes the observing threads and is typically called
     * after bootstrapping has been finished.
     *
     * @param state
     */
    private activateAfterStepMonitoring(state: ControlAbstractState) {
        let result: ControlAbstractState = state;

        for (const [ti, ts] of state.getThreadStates().entries()) {
            if (ts.getComputationState() == ThreadComputationState.THREAD_STATE_DISABLED) {
                const threadActor = this._task.getActorByName(ts.getActorId());
                const threadScript = threadActor.getScript(ts.getScriptId());
                if (threadScript.event instanceof AfterStatementMonitoringEvent) {
                    result = result.withThreadStateUpdate(ti,
                        (t) => t.withComputationState(
                            ThreadComputationState.THREAD_STATE_DONE));
                }
            }
        }

        return result;
    }

    private popLoop(predLoopStack: ImmList<RelationLocation>): ImmList<RelationLocation> {
        // TODO: Write tests for this method
        if (predLoopStack.size > 1) {
            let i = predLoopStack.size-1;
            const topElement = predLoopStack.get(i);

            while (i > 0) {
                if (!predLoopStack.get(i).equals(topElement)) {
                    break;
                }
                i--;
            }
            return predLoopStack.slice(0, i);

        } else {
            return ImmList();
        }
    }

}
