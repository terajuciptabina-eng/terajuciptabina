# Contractor Database Export Format

This document defines the GitHub record format produced from a contractor's planner rate database.

## Canonical hierarchy

```text
contractorId
  state
    projectType
      items
```

## Record fields

- `schemaVersion` — database schema version.
- `contractorId` — stable contractor identifier.
- `contractorName` — contractor display name.
- `state` — Malaysian state/territory.
- `projectType` — `build` or `renovation`.
- `updatedAt` — ISO 8601 timestamp.
- `items` — quotation rate records.

Each item contains:

- `id`
- `contractorId`
- `contractorName`
- `state`
- `projectType`
- `itemId`
- `description`
- `unit`
- `rate`
- `quantity`
- `included`
- `active`
- `updatedAt`

## Browser-to-GitHub boundary

The planner may prepare and validate this canonical record, but it must not contain a GitHub token or repository credential. Automatic GitHub writes will be connected later through a secure write adapter.
