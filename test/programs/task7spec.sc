program Task7Spec

/**
 * ## Task 7 "Elephant“
 *
 * Task: The `elephant` should `dance`.
 *
 * Rewrite as bounded safety property:
 *      The elephant must switch costumes at least every 2 seconds.
 *
 * Precondition:
 *      There exists one actors with the role of
 *      the elephant.
 *
 * Interpretations and considerations:
 *
 * Rewrite without explicit actor names:
 *    Given at max one actor it always changes its costume after a repaint (?)
 *
 *   EXISTS a in _RUNTIME_getAllActors():
 *     FORALL trace in PROGRAM_TRACES:
 *       IF time_elapsed > 2000:
 *           changed_costume(b) == TRUE
 *
 */

actor DirectorObserver is Observer begin

    declare observer_state as enum ["INIT", "STARTUP_FINISHED"]

    declare actor_1_id as string
    declare actor_1_switched_costume as boolean

    declare actor_1_costume as string
    declare actor_1_prev_costume as string

    declare timestamp as number
    define timestamp as _RUMTIME_millis()

    define atomic checkBehaviorSatisfied () begin
        // (a) Attributes of the first actor
        define actor_1_costume as attribute "currentCostume" of actor_1_id
        define actor_1_switched_costume as false

        if not actor_1_costume = actor_1_prev_costume then begin
           define actor_1_switched_costume as true
        end
       // The actual invariant check

       if timestamp - _RUMTIME_millis > 2000
            assert (actor_1_switched_costume )
            define timestamp as _RUMTIME_millis()
       end
    end returns actor_1_switched_costume: boolean

    define atomic storeRelevantStateInfosForNext () begin
        define actor_1_prev_costume as actor_1_costume
    end

    script on startup do begin

    end

    script on startup finished do begin
        if observer_state = "INIT" then begin
        end else begin
            // First specification check (base condition)
            assert(checkBehaviorSatisfied())
        end

        // Store the relevant attributes
        storeRelevantStateInfosForNext()
    end

    script on statement finished do begin
        if observer_state = "INIT" then begin
        end else begin
            // The actual specification check
            assert(checkBehaviorSatisfied())
        end

        // Store the relevant attributes
        storeRelevantStateInfosForNext()
    end

end

