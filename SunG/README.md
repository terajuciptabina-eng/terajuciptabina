# SunG Solution — Solar Planning MVP

Standalone solar calculator, package comparison and customer proposal PDF.

## Brand and scope
- Product brand: **SunG Solution**.
- All project files belong inside `/SunG/`; do not keep this product under `/TerajuEnergy/`.
- Interface uses a dedicated SunG Solution wordmark/mark and no longer uses the Teraju Ciptabina Resources logo.
- Reference package data from supplied supplier proposals:
  - On-grid: RM18,000 after company discount; discount RM3,772.84; implied original RM21,772.84.
  - Hybrid: RM28,000 after company discount; discount RM6,907.84; implied original RM34,907.84.
  - Conditional rebate: RM3,000 only when eligibility is confirmed.
- PDF generation is intended to download a proposal directly, without requiring the browser print dialog.

## Limitations
- Frontend MVP only: no backend, database, authentication, admin panel, contractor workspace, proposal persistence or live tariff integration.
- Generation is an estimate based on user-entered peak sun hours and days. Savings are a rough model, not an official TNB tariff/ATAP/NEM calculation or a guarantee.
- Supplier PDF describes the battery as 16.00 kW; capacity in kWh and full specification need supplier confirmation.
- Rebate checkbox is a demo input, not eligibility verification. Do not treat this prototype as a final commercial quote.

## Isolation rule — mandatory
- All SunG Solution source code, UI, styles, scripts, assets, APIs, database schemas/migrations, admin/auth/config/docs/tests must live under `/SunG/`.
- Do not add or edit brand-specific files in repository root, shared `/api/`, `/data/`, `/admin/`, or TerajuWorks folders.
- Do not reuse TerajuWorks accounts, records, APIs, admin permissions, database collections or storage paths.
- Do not edit root deployment configuration (including `vercel.json`) without explicit approval. If deployment cannot be configured under `/SunG/`, stop and report the limitation first.
- Continue on branch `terajuenergy-mvp` until reviewed. Do not merge to `main` or modify `latest-working` without explicit approval.
