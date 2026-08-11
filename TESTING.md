# Testing Bastet

The test suite is split into a fast feedback tier and a required slow verification
tier. Both tiers must pass before a change is merged.

## Specification-Oriented Testing

Three constructs are central:

- `describe("the thing or the case we test") { .. }`: groups tests by subject or
  scenario. Groups may be nested.
    
- `beforeEach(() => { .. })`: optionally initializes the subject before each test.
    
- `it("the expected behavior", () => { .. })`: describes and checks observable
  behavior.

Tests that perform asynchronous work must return or `await` its promise. Do not mix
an `async` test with Jest's `done` callback, and do not catch and discard failures.
    
## Placement of Tests

Tests live under `test/` and normally mirror the structure under `src/`.

- Fast unit, parser, and transformation tests use the `*.test.ts` suffix outside
  the slow-tier directories.
- Solver tests live under `test/bastet/utils/smt/`.
- Verification fixtures live under `test/bastet/procedures/analyses/data/`.
- End-to-end tests live under `test/integration/`.
- Verification fixture names end in `_SAFE.sc` or `_UNSAFE.sc` and the test must
  assert the corresponding result.

Committed focused or skipped tests (`test.only`, `describe.only`, `test.skip`,
`it.skip`, `xtest`, or `xit`) are not permitted.

## Test Execution

Run the fast tier while developing:

```sh
pnpm run test:fast
```

It collects coverage only from handwritten Bastet TypeScript. Generated ANTLR and
Z3 bindings are excluded. The global threshold records the current risk-based
floor and should only move upward as coverage grows.

Run the required solver, fixture, and integration tier with:

```sh
pnpm run test:slow
```

Slow suites run one file per Jest process to isolate native Z3 state. Jest limits
each individual test to 120 seconds; the outer runner terminates any suite that
does not finish within 240 seconds. This prevents a synchronous solver call from
stalling CI indefinitely.

The complete local gate is:

```sh
pnpm test
```

CI exposes the fast and slow tiers as separate required jobs so failures remain
easy to diagnose.

## Literature

[1] https://www.bignerdranch.com/blog/why-do-javascript-test-frameworks-use-describe-and-beforeeach/
