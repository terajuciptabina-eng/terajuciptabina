# Teraju Ciptabina Data Architecture

This folder is reserved for the future shared/cloud quotation data layer.

## Current phase

The live planners continue to use browser `localStorage` for Contractor Item Database data. Nothing in this folder is required by the current planner runtime.

## Future data hierarchy

Data is designed around:

- `contractorId` — stable unique contractor identifier; do not use contractor name as the primary key.
- `contractorName` — display name only.
- `state` — Malaysian state / federal territory used for regional costing.
- `projectType` — `build` or `renovation`.
- `itemId` — stable item identifier.
- `description` — quotation description.
- `unit` — quotation unit such as `sqft`, `unit`, `ls`, or `set`.
- `rate` — contractor/state rate.
- `quantity` — default or saved quantity where applicable.
- `included` — whether the custom item is included in estimates/quotations.
- `active` — whether the item remains available.
- `updatedAt` — last update timestamp.

## Planned rate precedence

When cloud sync is introduced, the intended rate resolution is:

`Project-specific override -> Contractor rate -> State rate -> Default rate`

This allows rates to vary by state while still allowing each contractor to maintain their own pricing.

## Future cloud storage

GitHub may be used as the first shared storage layer through a secure Vercel API. GitHub credentials/tokens must never be exposed in planner HTML or browser JavaScript.

A later migration to a proper central database (for example Postgres/Supabase) should preserve the same logical fields so the planner does not need a major rewrite.
