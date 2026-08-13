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
- Native solver, verification-fixture, and end-to-end tests use the
  `*.node.test.ts` suffix in their existing slow-tier directories. Their
  `*.test.ts` counterparts remain temporarily as the Jest behavioral oracle.
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

Slow suites execute TypeScript directly with tsx. The runner starts one file per
process to isolate native Z3 state and defaults to one active process so
solver-heavy suites cannot overload CI. Node limits each individual test to 120
seconds; the outer runner terminates the suite's entire process group, including
descendants, if it does not finish within 240 seconds. Every run prints per-suite
and total elapsed times.

Run one or more selected native slow suites:

```sh
pnpm run test:slow:node:file -- \
  test/bastet/utils/smt/Z3-Boolean.node.test.ts \
  test/integration/DegToRad.node.test.ts
```

The runner accepts `--concurrency 1` through `--concurrency 4` after its runner
script when explicitly needed locally; CI and the documented commands remain
sequential. During the transition, compare the retained Jest tier with:

```sh
pnpm run test:slow:jest
```

Run the short process-tree deadline regression probe with:

```sh
pnpm run test:slow:deadline
```

The complete local gate is:

```sh
pnpm test
```

CI runs Jest and Node jobs for both the fast and slow tiers. The paired jobs run
against the same fixtures and report failures independently until the final
cutover removes the Jest oracle.

## Literature

[1] https://www.bignerdranch.com/blog/why-do-javascript-test-frameworks-use-describe-and-beforeeach/
