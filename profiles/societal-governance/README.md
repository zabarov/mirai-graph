# Societal Governance Profile

Status: proposal/experimental profile

The societal-governance profile models governance systems where humans,
bounded AI avatars, norms, initiatives, decisions, execution and outcome
learning form a controlled evolutionary graph.

It extends the existing `organization_governance`, `character_layer`,
`process_control` and evidence-control patterns. It does not claim legal,
democratic, cryptographic or public-governance validity.

## Scope

Use this profile for synthetic or bounded shadow-governance models such as:

- organization governance experiments;
- SIMAI OS shadow governance;
- non-binding municipal or public-policy simulations;
- research fixtures for rights, consent, privacy, appeal and learning gates.

Do not use this profile as a production public-governance authority model.

## Typical Objects

- `governance_dna`
- `governance_level`
- `participant`
- `stakeholder_group`
- `ai_avatar`
- `avatar_contract`
- `delegation_scope`
- `consent_receipt`
- `private_decision_journal`
- `initiative`
- `simulation`
- `legitimacy_gate`
- `rights_gate`
- `privacy_gate`
- `affectedness_gate`
- `anti_capture_gate`
- `participation_signal`
- `decision`
- `decision_trace`
- `execution_mandate`
- `outcome_evidence`
- `appeal`
- `harm_report`
- `learning_proposal`
- `amendment_proposal`
- `evidence`

## Typical Relations

- `defined_by_dna`
- `member_of_level`
- `represented_by_avatar`
- `bound_by_contract`
- `delegates_scope_to`
- `has_consent_receipt`
- `requires_reconsent`
- `opens_initiative`
- `affects_group`
- `requires_gate`
- `passes_gate`
- `fails_gate`
- `uses_simulation`
- `uses_evidence`
- `casts_signal`
- `summarizes_private_proof`
- `supports_decision_trace`
- `authorizes_decision`
- `creates_execution_mandate`
- `assigned_to_executor`
- `produces_outcome`
- `has_appeal_path`
- `triggers_appeal`
- `reports_harm`
- `creates_learning_proposal`
- `proposes_dna_amendment`
- `approved_update_to`

## Governance Gates

- Rights before optimization.
- Consent before avatar action.
- Re-consent after model, scope or authority change.
- Privacy before public trace.
- Affectedness before weighted decision.
- Anti-capture before weight change.
- Human owner before binding action.
- Evidence before execution mandate.
- Appeal path before governed decision.
- Outcome evidence before learning update.
- Generated context is not authorization.
- Feedback is not automatic graph update.

## Conformance Levels

- `G0_concept`: model is described, no executable trace.
- `G1_structured_shadow`: non-binding traces on non-sensitive cases.
- `G2_assisted_internal`: human-owned internal decisions with AI-assisted
  traces.
- `G3_governed_internal`: bounded organizational governance with policy, audit,
  rollback and evidence.
- `G4_public_simulation`: public-policy simulations with no binding authority.
- `G5_limited_public_pilot`: legally and ethically reviewed civic pilot.
- `G6_constitutional_governance`: formal public governance; out of scope for
  current evidence.

This proposal profile is intended for `G0_concept` and `G1_structured_shadow`
fixtures until independent review and pilot evidence exist.

## Boundaries

- AI avatars can explain, recommend, summarize and submit signals only inside
  explicit consent and delegation scopes.
- AI avatars and generated context cannot authorize decisions.
- Contribution, expertise or implementation weights cannot override protected
  rights.
- Private decision journals must not be exposed in public traces.
- Decisions require appeal or reopen paths.
- Outcome evidence creates learning proposals; it does not update canonical
  graph state automatically.
- Public examples must remain synthetic and non-binding.

## Example

See [Societal Governance Minimal](../../examples/societal-governance-minimal/README.md).
