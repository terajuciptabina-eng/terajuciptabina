# Contractor Data

This folder is the **GitHub-first contractor quotation database** for the experimental planner.

## Canonical storage

Each contractor is identified by a stable `contractorId`. The canonical records are stored separately from the registry:

```text
data/contractors/records/<contractorId>/
  profile.json
  build.json
  renovation.json
```

`build.json` and `renovation.json` contain the contractor's quotation-rate records for the two planners.

## Registry and schemas

- `data/contractor-profile.schema.json` — contractor profile validation schema.
- `data/contractors/record.schema.json` — canonical schema for build/renovation quotation records.
- `data/contractors/registry.js` — canonical record factory used by the contractor tools.
- `data/contractors/export-format.md` — canonical browser-export record format.
- `data/contractors/records/README.md` — canonical record storage rules.

There is intentionally **one canonical contractor rate-record model**. The old aggregate `database.json` / `database.schema.json` model has been removed to avoid two competing database structures.

## Planner flow

```text
Contractor Profile
      ↓
Stable contractorId + state
      ↓
Build / Renovation Planner
      ↓
Contractor Item Database (local working data)
      ↓
Canonical export record
      ↓
GitHub records/<contractorId>/build.json
GitHub records/<contractorId>/renovation.json
```

The browser currently prepares and exports the canonical JSON record. It does **not** write directly to GitHub. This keeps repository credentials out of the planner.

## Rate precedence

When calculating a quotation, the intended precedence is:

```text
Project-specific override
        ↓
Contractor rate
        ↓
State rate
        ↓
Default rate
```

## Contractor registration

The contractor registry remains empty until an actual contractor profile is registered. `CTR-DEMO-001` under `records/` is only a structural example and contains no real quotation rates.

## Security boundary

Do not store passwords, API keys, GitHub tokens, payment credentials or other secrets in this database. Authentication, write authorization and rate limiting will be added later through a secure write adapter without changing the record layout.
