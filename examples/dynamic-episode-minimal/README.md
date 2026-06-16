# Dynamic Episode Minimal Example

Status: proposal/experimental synthetic example

This example shows how a Mirai Graph package can record a trace for one
AI-assisted code-generation episode.

The episode demonstrates:

- event input;
- graph object and relation activation;
- selected workflow path;
- blocked unsafe alternatives;
- gates;
- findings;
- feedback classification;
- Kaizen candidate;
- replay/regression placeholder;
- explicit `canonical_write_allowed=false`.

The example is synthetic. It does not claim real-world code-generation
improvement, production readiness or scientific proof.

Validate it with:

```bash
npm run validate:dynamic-episodes
```

Negative fixtures are intentionally invalid and are checked by:

```bash
npm run test:dynamic-episodes-negative
```
