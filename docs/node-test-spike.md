# `node:test` migration spike

This document records the result of [GitHub issue #10](https://github.com/stahlbauer/Bastet/issues/10).
The measurements were taken on 2026-08-12 with Node 24.14.0, pnpm 11.21.0,
Jest 30.4.2, TypeScript 5.9.3, and tsx 4.23.11 on macOS.

## Decision

**Go:** migrate Bastet to `node:test`, using `node --import tsx --test` for both
fast and slow TypeScript suites. Keep the current outer process deadline and run
each native Z3 suite in its own Node process.

Do not use precompiled tests as the primary path. Their execution is modestly
faster, but a clean TypeScript compilation costs more than that saving and Z3's
relative runtime asset lookup requires a second copy of `src/lib`. The tsx path
executes the current source directly, reports TypeScript paths, and needs no
test-only build tree.

This is a spike only. Jest remains the behavioral oracle and no Jest configuration
or dependency is removed here. The follow-up migration issues can port suites in
small batches before the final cutover.

## Reproducing the spike

Run the complete spike after installing dependencies:

```sh
pnpm run test:node:spike
```

The individual probes are also available:

```sh
pnpm run test:node:spike:tsx
pnpm run test:node:spike:compiled
pnpm run test:node:spike:coverage
pnpm run test:node:spike:deadline
pnpm run test:node:spike:diagnostics
```

The representative native suites cover:

- a synchronous `Optional` utility suite;
- parser behavior and loop-generated parameterized cases;
- transformation imports plus current enums and constructor parameter properties;
- an asynchronous SAFE verifier fixture; and
- the native WebAssembly-backed Z3 solver.

Both execution paths passed all 12 representative tests. The tsx path also loaded
the existing `probe = require("probe-image-size")` import through an ES import
graph, confirming the project's CommonJS interoperability.

## Coverage contract

Node's native coverage include and exclude globs reproduce the intended file set:

- `src/bastet/**/*.ts` includes handwritten source, including files not imported
  by the representative suites;
- `src/bastet/syntax/parser/grammar/**` excludes generated ANTLR code; and
- `libz3.ts` and `ctypes.ts` exclude generated Z3 bindings.

The spike enforces the current 22% line, 16% branch, and 15% function floors with
Node's `--test-coverage-lines`, `--test-coverage-branches`, and
`--test-coverage-functions` flags. Node has no statement threshold; the existing
statement and line floors are both 22%, so the line floor is the continuity guard.

The numeric reports are not directly comparable. The representative Node run
reported 81.93% lines, 88.31% branches, and 61.98% functions, while the full Jest
fast tier reported 22.9% lines, 16.47% branches, and 15.87% functions. V8 and
Istanbul account for TypeScript declarations and branches differently. Therefore,
the existing low floors should remain during suite conversion, then be reset to
the complete native-suite baseline in the final coverage migration. Copying the
Jest percentages as the permanent Node contract would provide a much weaker gate.

## Isolation and hard deadlines

`node:test` timeouts cannot interrupt a synchronous native call. The spike runner
therefore starts each representative suite in a child process with a 240-second
outer `spawnSync` deadline, matching the current Jest slow-tier protection. A
deliberately non-terminating synchronous solver fixture was killed after the
probe's one-second outer deadline and the probe passed.

The migration should retain this per-file process wrapper for solver and verifier
suites. Fast suites can be passed to one `node --test` invocation, which still
provides file-level isolation by default.

## Runtime and diagnostics

These numbers are architecture checks, not a claim that a partially ported suite
is faster than the complete Jest suite. The native spike has 12 tests; the current
Jest fast tier has 67 tests.

| Execution | First measured run | Repeated run | Notes |
| --- | ---: | ---: | --- |
| Jest fast tier with coverage | 56.73s | 13.24s | 16 suites / 67 tests; first run followed dependency/cache replacement |
| `node:test` with tsx | 8.279s | 8.106s | 5 isolated suites / 12 tests |
| precompiled `node:test` | 6.610s | 6.226s | execution only |
| precompile step | 20.63s | 20.63s | full non-incremental source and spike-test compilation |

The precompiled path only wins when its build cost is already paid. For the normal
edit-test loop, tsx is the simpler and faster end-to-end choice.

The deliberate assertion-failure probe completed in 0.389s under `node:test` and
4.557s under Jest. Both reporters showed the test name, expected and actual values,
and the correct TypeScript stack location. Jest's inline source excerpt is more
polished; Node's output is shorter and includes structured assertion fields. The
tsx source-map stack points to the correct line even though Node's preliminary
`test at` location refers to transformed wrapper coordinates. This is acceptable
for the migration.

## Follow-up constraints

- Port assertions to `node:assert/strict` and import hooks from `node:test`.
- Replace `test.each` and `describe.each` with generated `test(...)` calls or
  native subtests.
- Keep solver suites in separate outer-deadline processes.
- Run native coverage on the direct tsx path so reports retain `.ts` filenames.
- Re-baseline all three supported coverage metrics only after every fast suite is
  running under `node:test`.
