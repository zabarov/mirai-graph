# Societal Governance Profile Proposal

Status: proposal-level profile prepared in repository.

## Summary

This transfer adds a public-safe `societal_governance` proposal profile derived
from the Mirai AI Governance research track. It is intended for synthetic
fixtures, non-binding shadow governance and bounded organizational simulation.

The profile extends existing Mirai Graph concepts:

- `organization_governance` for organization-level policy and decision rights;
- `character_layer` for bounded AI avatar behavior;
- `process_control` for explicit lifecycle and false-transition guards;
- evidence and governance gates for traceable decisions and controlled
  evolution.

## Included Scope

- `profiles/societal-governance/README.md`
- `profiles/societal-governance/profile.json`
- `examples/societal-governance-minimal/`
- invalid fixtures for:
  - avatar action without consent;
  - private trace exposure;
  - rights overridden by weights;
  - generated context treated as authorization;
  - missing appeal path;
  - automatic learning update.

## Claim Boundary

This proposal does not claim legal validity, democratic legitimacy,
cryptographic completeness, production governance safety or state-scale
readiness.

It only claims that Mirai Graph now has a validator-backed proposal shape for
representing bounded governance traces as synthetic, non-binding graph packages.

## Next Evidence Step

The next research/product step is a SIMAI OS shadow pilot on non-sensitive,
non-binding organizational decisions, with human owner review and no automatic
canonical updates.
