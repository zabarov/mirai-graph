# Multidimensional Relation Facts

Status: Mirai 2.1 development contract.

Binary source-target relations remain compatible. Mirai 2.1 normalizes them as relation facts with two participants and supports facts with more participants.

A relation fact can include participant roles, qualifiers, scope, conditions, validity interval, priority, authority, confidence, provenance, evidence and an activation rule. This allows one fact to connect an employee, operation, department, policy, risk and time boundary without flattening the meaning into unrelated pairs.

Qualifiers may not be dropped during export. A fact that is outside its scope or validity interval does not activate. Derived and proposal facts do not acquire canonical authority from confidence alone.
