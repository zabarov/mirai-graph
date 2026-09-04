# Mirai Local Embedding Provider

Status: optional Mirai 2.4 alpha package

This package provides local `feature-extraction` embeddings through
`@huggingface/transformers`. It never downloads a model during ordinary search.
Preparation requires an explicit command and records cache, model-card, license
and files-digest evidence:

```bash
npx mirai-embedding-local prepare --allow-download --cache ~/.mirai/models
```

Production use should pin the model revision and verify the generated receipt
against the deployment's approved model and data-placement policy. See the
[Transformers.js environment documentation](https://huggingface.co/docs/transformers.js/api/env)
for the upstream cache and remote-model controls.
