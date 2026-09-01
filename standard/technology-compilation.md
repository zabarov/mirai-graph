# Technology Draft And Compilation

Status: Mirai 2.1 development contract.

Text is not executable merely because an LLM can summarize it. Mirai first creates a `technology_draft` containing goal, roles, inputs, outputs, steps, branches, loops, waits, gates, effects, recovery, evidence and source spans.

The draft is proposal-only. Missing branch conditions, loop budgets, approval owners, capabilities, timeouts, error routes or terminal evidence are blocking diagnostics. The deterministic compiler does not invent these values. A reviewed, explicit draft compiles to the unchanged Mirai Program `1.0.0` contract.

This separation lets an LLM help with extraction while keeping executable semantics reproducible and reviewable.
