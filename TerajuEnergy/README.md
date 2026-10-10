# TerajuEnergy — Phase 1 MVP

Standalone solar calculator, package comparison and proposal print/PDF preview.

## Scope
- Dedicated `TerajuEnergy/` path; does not modify TerajuWorks modules.
- Reference packages sourced from the supplied ZendaSolar proposals:
  - On-grid: RM18,000 after company discount; company discount RM3,772.84; implied original price RM21,772.84.
  - Hybrid: RM28,000 after company discount; company discount RM6,907.84; implied original price RM34,907.84.
  - Conditional rebate: RM3,000 only when package/customer eligibility is confirmed.
- The interface is responsive and uses a navy/gold premium style, with original Teraju logo URL.
- Proposal can be printed or saved as PDF via browser print.

## Important limitations
- This is a frontend MVP only. No backend, database, authentication, admin controls, contractor workspace, proposal persistence, or live TNB tariff integration has been connected.
- Energy generation is an estimate based on user-entered peak sun hours and days; it does not model losses or guarantee output.
- Savings output is a simple illustrative estimate, not an official tariff/ATAP/NEM calculation. Do not issue as a final commercial proposal until a validated billing model is implemented.
- Source PDF labels battery as 16.00 kW; usable energy capacity (kWh) and battery specifications need supplier confirmation.
- Rebate must be confirmed before it is applied; checkbox in this prototype is a demonstration control, not an actual eligibility verification.
- Confirm current applicable scheme names, eligibility and rules with relevant authorities before production use.

## Deploy/test
This branch is `terajuenergy-mvp`, based on `main`. Review and test the page before merging or publishing. `latest-working` was not modified.
