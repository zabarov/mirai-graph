# Mirai Local Embedding Provider

Status: optional Mirai 2.4 alpha package

This package provides local `feature-extraction` embeddings through
`@huggingface/transformers`. It never downloads a model during ordinary search.
Preparation requires an explicit command and records cache, model-card, license
and files-digest evidence:

```bash
npx mirai-embedding-local prepare --allow-download --cache ~/.mirai/models \
  --revision <approved-model-commit> --license <approved-license>
```

Ordinary offline use constructs the provider with the receipt's `revision` and
`files_digest`; cache tampering then fails before model loading. Production use
must verify the receipt against the deployment's approved model, license and
data-placement policy. See the
[Transformers.js environment documentation](https://huggingface.co/docs/transformers.js/api/env)
for the upstream cache and remote-model controls.
