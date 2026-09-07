# Contractor Records

This directory is the canonical storage location for contractor database records.

## Record path

Each contractor uses a stable `contractorId`:

```text
records/<contractorId>/profile.json
records/<contractorId>/build.json
records/<contractorId>/renovation.json
```

Example:

```text
records/CTR-AB12CD34/profile.json
records/CTR-AB12CD34/build.json
records/CTR-AB12CD34/renovation.json
```

## Rules

- `contractorId` is the stable identity for the contractor.
- `build.json` contains the contractor's Build Planner rate records.
- `renovation.json` contains the contractor's Renovation Planner rate records.
- `profile.json` contains non-secret contractor profile metadata required by the database.
- Do not store passwords, API keys, GitHub tokens, payment credentials or other secrets here.
- Browser export creates GitHub-ready JSON but does not authenticate or write to this directory automatically.

The secure write adapter can be connected later without changing this storage layout.
