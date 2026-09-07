# Contractor Data

This folder is the **GitHub-first contractor quotation database** for the experimental planner.

## Storage model

Each contractor is identified by a stable `contractorId`. Contractor data is separated by:

```text
contractorId
  state
    projectType
      items
```

Supported project types:

- `build`
- `renovation`

Supported states/territories are defined in `data/states.json` and registered in `data/contractors/database.json`.

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

## Database files

- `data/contractors/database.json` — GitHub database registry/index and the 16 Malaysian states/territories.
- `data/contractors/database.schema.json` — validation schema for the database structure.
- `data/contractors/sample-record.json` — example record only; not a real contractor.
- `data/contractor-profile.schema.json` — contractor profile validation schema.

## Recording contractor data

A real contractor record is added under the `contractors` array using a stable `contractorId`. Each contractor can have one or more states, and each state can contain separate `build` and `renovation` item rates.

Example structure:

```text
contractors[]
  contractorId
  contractorName
  states[]
    state
    projectTypes
      build.items[]
      renovation.items[]
```

The database is intentionally empty until an actual contractor profile is registered. No fake contractor data is inserted into the live registry.

## Important

GitHub is the storage layer for this experimental phase. Authentication, write authorization, rate limiting and other security controls will be added later.

The planner should never contain a GitHub token or other repository credentials.

For now, the database structure is prepared and recorded in GitHub first. A secure write adapter can be connected later without changing the database model.
