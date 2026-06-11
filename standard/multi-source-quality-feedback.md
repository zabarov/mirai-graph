# Multi-Source Quality Feedback

Multi-Source Quality Feedback is a Mirai Graph pattern for combining quality signals from tests, validators, cockpit instruments, human review, runtime feedback, and Kaizen into one classified transition input.

It exists because passing tests alone can miss process violations, semantic gaps, unsafe assumptions, and technology drift.

## Pattern

```text
work evidence
-> source-specific feedback
-> normalized findings
-> classification
-> blocking decision
-> transition route
-> Kaizen or proposal path
```

## Sources

Recommended feedback sources include:

- automated tests;
- static or schema validators;
- process-transition validation;
- technology quality feedback;
- development cockpit signals;
- feature implementation traceability;
- human expert review;
- runtime observations;
- user or stakeholder feedback.

Each source should declare evidence references and limitations. A source can support a decision, but no single source silently overrides the required gate.

## Finding Classification

Findings should be classified with reusable categories:

- `accepted`;
- `work_fix_required`;
- `test_gap`;
- `spec_gap`;
- `graph_update_proposal`;
- `process_improvement`;
- `release_blocker`;
- `security_blocker`;
- `defer_with_reason`.

Blocking findings stop the transition they block. Non-blocking findings must still declare a route: continue, fix, defer, proposal, or Kaizen.

## Transition Use

A multi-source feedback report should make the transition decision explicit:

- `accepted_for_transition`;
- `changes_requested`;
- `blocked`;
- `defer_with_reason`;
- `proposal_required`.

The report can calibrate a decision, but it is not a canonical update and does not replace approval.

## Kaizen Use

When feedback reveals a repeatable weakness in the work technology, it should route to Kaizen:

```text
finding -> classified improvement -> prevention mechanism -> next governed cycle
```

The prevention mechanism should be durable: checklist update, validator change, template improvement, reviewer instruction, gate refinement, or documented limitation.
