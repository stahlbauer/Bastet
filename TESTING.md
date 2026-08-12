# Testing Bastet

The test suite is split into a fast feedback tier and a required slow verification
tier. Both tiers must pass before a change is merged.

## Specification-Oriented Testing

Three constructs are central:

- `describe("the thing or the case we test") { .. }`: groups tests by subject or
  scenario. Groups may be nested.
    
- `beforeEach(() => { .. })`: optionally initializes the subject before each test.
    
- `test("the expected behavior", () => { .. })`: describes and checks observable
  behavior.

Native tests import their tests and hooks explicitly from `node:test` and assertions
from `node:assert/strict`. Tests that perform asynchronous work must return or
`await` their promise; do not catch and discard failures.
    
## Placement of Tests

Tests live under `test/` and normally mirror the structure under `src/`.

- Native fast unit, parser, and transformation tests use the `*.node.test.ts`
  suffix outside the slow-tier directories.
- The colocated `*.test.ts` fast suites remain temporarily as the Jest behavioral
  oracle while the migration is in progress.
- Solver tests live under `test/bastet/utils/smt/`.
- Verification fixtures live under `test/bastet/procedures/analyses/data/`.
- End-to-end tests live under `test/integration/`.
- Verification fixture names end in `_SAFE.sc` or `_UNSAFE.sc` and the test must
  assert the corresponding result.

Committed focused or skipped tests (`test.only`, `describe.only`, `test.skip`,
`it.skip`, `xtest`, or `xit`) are not permitted.

## Test Execution

Run the complete native fast tier while developing:

```sh
pnpm run test:fast
```

It executes TypeScript directly with tsx and collects Node V8 coverage only from
handwritten Bastet TypeScript. Generated ANTLR and Z3 bindings are excluded. Node
enforces the current line, branch, and function floors; these metrics will be
re-baselined after the complete test migration because V8 and Istanbul account for
TypeScript differently.

Run one selected native file:

```sh
pnpm run test:fast:node:file -- test/bastet/utils/Optional.node.test.ts
```

Run tests matching a name, optionally restricted to one file:

```sh
pnpm run test:fast:node:test -- "updates immutably" test/bastet/utils/Optional.node.test.ts
```

Run the native fast tier in watch mode:

```sh
pnpm run test:fast:node:watch
```

During the transition, compare the retained Jest tier with:

```sh
pnpm run test:fast:jest
```

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

CI runs the Jest and Node fast tiers as separate required jobs alongside the slow
job. This keeps the 16-suite, 67-test Jest result as the behavioral comparison
until the final cutover and reports failures independently.

## Literature

[1] https://www.bignerdranch.com/blog/why-do-javascript-test-frameworks-use-describe-and-beforeeach/
