# TERAJU Rate Master

The quotation rate master is now state-aware.

## Current phase

- `default.json` is the current master figure set.
- Every Malaysian state and Federal Territory has its own `rateSetId` in `states/index.json`.
- For the initial rollout, every state uses the same figures as `default.json`.
- Johor, Kedah, Kelantan and Melaka already have explicit state JSON records; the remaining states currently fall back to the default master through the registry.
- Planner users must select the project state before entering quotation details.

## Future phase

When a state needs different rates, its state record can be populated without changing the quotation structure. The resolver should use:

`selected project state -> state rate set -> default fallback`

A saved quotation must retain the rate snapshot used when it was generated so a later rate-master update does not silently change an old quotation.
