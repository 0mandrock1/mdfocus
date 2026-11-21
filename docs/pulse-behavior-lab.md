# PULSE CODE · By example interaction lab (21 November 2026)

URL: https://tools.mandrock.me/mdfocus/pulse-by-example-20261121.html

Purpose: test one narrow interaction hypothesis from the attached Claude Design PULSE CODE prototype: **discover a numeric operation by specifying input and desired output rather than typing its name**, apply it to a selected expression, then change a nested argument without a precise text cursor.

This is **not** the full Claude prototype and intentionally does not touch its attached HTML. The original prototype has a restricted AST and a small hard-coded By Example operator catalog. This experiment tests behavior discovery with a larger **parameterized** catalog.

## Interactive scenarios

A. `loss`, probes `-8 → 0`, `7 → 7`: discover and apply `Math.max(0, loss)`.
B. `Math.max(0, loss)`, probes `250 → 100`, `7 → 7`: discover and apply `Math.min(100, Math.max(0, loss))`.
C. `Math.min(100, Math.max(0, loss))`: edit outer parameter `100 → 50`, preserving the nested expression, then Undo.
D. `loss`, probes `-8 → 8`, `7 → 7`: discover `Math.abs(loss)` without naming it in input.

Tasks are independent; state persists per scenario in localStorage. Every scenario can be reset with confirmation. User data never reaches a VPS API.

## Catalog and evaluation limitations

Exactly 415 distinct registered **numeric transforms/parameterizations**, not 415 independent TypeScript operators or APIs. Built from Math operations, arithmetic, bounds, rounding, conditions and constants. Their evaluators execute in local JavaScript, without dynamic eval or arbitrary code execution. Every candidate is actually evaluated on each provided example. The UI reports how many candidates match and never claims that a finite set of examples proves functional equivalence.

Results are ranked using a manually designed complexity score; this is a discoverability experiment, not a mathematically optimal operation search. For a small sample, multiple operations may fit; provide additional probes. The recommended next probe tries to maximize output diversity among currently matching candidates.

Code composition uses a deliberately restricted typed expression AST with explicit `symbol` and `operation` nodes and immutable subtree replacement. Rendered TypeScript is compiled as a syntactic check in tests. **No tsserver, real TypeScript parsing, type inference, Git or remote saving.** A green task status means only that the result matched ten numeric probe values, not a proof of correctness for all inputs.

## Verification

- `node --test tests/pulse-behavior.test.js` validates all IDs, evaluators, example matching, nested AST replacement, and generated expressions.
- `node demo/qa-pulse-behavior.cjs` executes all four scenarios in Chromium on 320×568 and 390×844, including one physical touchscreen tap, Undo, and state recovery after reload.
- Compile generated TS catalog: `tsc --noEmit --strict --target ES2022 --lib ES2022 /tmp/pulse-behavior-catalog-20261121.ts` (the temp file is constructed from the 415 registered transforms for validation).
- Need manual iPhone Safari testing for inertial horizontal carousels, accessibility and browser eviction.

## What feedback to capture

Could the user locate the desired action without naming it? How many constraints did they need? Were the suggestions meaningful or noisy? Did multiple behaviors remain ambiguous? Could they edit the nested constant with a single thumb and regain context after a pause? Results should be grounded in these observed interactions, not graphic polish.
