# TERAJU Rate Master

The quotation rate master is state-aware, with an independent rate set for every Malaysian state and Federal Territory.

## Current architecture

```text
rates/
├── default.json
└── states/
    ├── johor.json
    ├── kedah.json
    ├── kelantan.json
    ├── melaka.json
    ├── negeri-sembilan.json
    ├── pahang.json
    ├── perak.json
    ├── perlis.json
    ├── pulau-pinang.json
    ├── sabah.json
    ├── sarawak.json
    ├── selangor.json
    ├── terengganu.json
    ├── kuala-lumpur.json
    ├── putrajaya.json
    └── labuan.json
```

- `default.json` is the master/template rate set.
- Every state / Federal Territory has its own JSON rate set.
- State rate sets were initialized from the current Default Rate.
- After initialization, state rates are independent. Changing one state does not change another state or the Default Rate.
- `states/index.json` maps each state to its own JSON source.
- Planner users must select the project state before entering quotation details.
- The planner resolver uses the selected project state to load that state's rate set.

## Rate updates

Use **Rate Management** in the admin area to select `Default Rate` or an individual state / Federal Territory and edit its rates.

Saving `Default Rate` changes only the master/template values. It does not automatically propagate to state files.

Saving a state changes only that state's rate file.

## Quotation history

A saved quotation retains the rate snapshot used for that quotation. Later rate-master or state-rate changes must not silently rewrite historical quotations.
