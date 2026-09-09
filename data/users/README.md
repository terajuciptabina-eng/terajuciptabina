# Temporary User Account Store

This directory is the temporary GitHub-backed account store for TERAJU WORKS.

- `homeowners/` contains one JSON record per Homeowner ID.
- `contractors/` contains one JSON record per Contractor ID.
- Passwords are not stored.
- Build Planner and Renovation Planner remain separate records/flows.
- `state` belongs inside each record, not in the path.
- `contractorId` remains the contractor's primary ID.

This store is temporary and is intended to be migrated later to the proper authentication/database system.
