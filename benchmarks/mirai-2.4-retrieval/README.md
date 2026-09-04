# Mirai 2.4 Retrieval Evaluation

Status: controlled public-safe release evidence

This frozen corpus compares lexical, local semantic, graph-only, ordinary
hybrid and Mirai intent-aware retrieval across Federation, Larena-shaped,
AI Employee and organization-governance scenarios. It contains Russian,
English, cross-language and exact-identifier queries. Results remain bounded
engineering evidence, not proof of universal search superiority.

```bash
npm run generate:mirai-2.4-evaluation
node packages/embedding-local/prepare.js prepare \
  --allow-download --cache /tmp/mirai-e5-cache \
  --revision 761b726dd34fb83930e26aab4e9ac3899aa1fa78 --license MIT
MIRAI_REVISION=$(git rev-parse HEAD) npm run evaluate:mirai-2.4 -- \
  --model-cache /tmp/mirai-e5-cache
```

The index is disposable and remains under `project/.mirai/`. The model receipt
binds evaluation to an explicit model revision and cache digest. The committed
report includes raw per-query outcomes, real local latency observations,
limitations and four domain slices.
