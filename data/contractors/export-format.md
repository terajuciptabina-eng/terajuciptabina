# Contractor Database Export Format

This document defines the GitHub record format produced from a contractor's planner rate database.

## Canonical record

Each planner export represents one contractor and one project type:

```text
records/<contractorId>/build.json
records/<contractorId>/renovation.json
```

The `state` is stored as a field inside the record; it is not a required directory level.

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

The planner reads its current Contractor Item Database from local storage and prepares this canonical record. It may download the JSON for manual GitHub recording, but it must not contain a GitHub token or repository credential.

Automatic GitHub writes will be connected later through a secure write adapter.

## Local-to-canonical mapping

The planner's working fields are normalised into the canonical record as follows:

```text
id / itemId       -> id + itemId
qty               -> quantity
rate              -> rate
included          -> included
active            -> active
description       -> description
unit              -> unit
updatedAt         -> updatedAt
```

Missing item IDs are assigned a deterministic export position ID (`item-1`, `item-2`, etc.) so every exported item has an identifier.
