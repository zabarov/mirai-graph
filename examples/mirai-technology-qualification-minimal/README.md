# Instruction Qualification Minimal Example

This synthetic example separates one technology into three operation classes:

- deterministic inspection is `executable`;
- evidence review is `verifiable`;
- acceptance is an owner-bound `decision`.

The result is `hybrid_ready`, not automatically executable. The generated
hybrid plan preserves all three steps and keeps `activation_allowed=false`
until a governed human coordination mechanism is supplied.

```bash
mirai technology qualify technology-draft.json --bindings bindings.json --out qualification-result.json
mirai technology hybrid-compile technology-draft.json --qualification qualification-result.json --out hybrid-plan.json
```

The unreviewed fixture produces `program_candidate`. The invalid advisory
effect fixture fails closed because human judgement cannot silently become an
adapter effect.
