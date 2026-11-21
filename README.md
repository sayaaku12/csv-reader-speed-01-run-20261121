# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/sayaaku12/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/sayaaku12/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast CSV parser for make.fun's "Read broken CSV files faster" bounty. `solve.js` is a single-pass parser built on `indexOf` jumps and slices that reproduces csv-reader 1.0.0's exact broken-CSV semantics — stray CRs, doubled quotes, unterminated quotes, quote junk, short/long rows — while running about 5× faster than the baseline on `run()` CPU (137–143 ms vs 676–870 ms on the 6 practice cases, ~10.2 MB of text). Output is byte-identical to the baseline: practice set 6/6, fresh differential tests 48/48, hand-crafted edge cases 51/51.

## Run it

```sh
node main.ts
```

`main.ts` (the house driver, Node 22) reads cases from `/input/cases.json`, answers each one with `run()` from `solve.js`, and writes `/output/answers.json`. Outside a container, set `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` to point at your own input and output folders.

---

<sub>Entered on [make.fun](https://make.fun/?ref=c0tz9ttj&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
