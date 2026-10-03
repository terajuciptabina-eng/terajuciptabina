# TerajuWorks

**TerajuWorks** is a construction technology platform developed by **Teraju Ciptabina Resources** to connect construction cost estimation, project planning and project control into one continuous workflow.

The platform is designed around:

`Project Input → Cost Estimate → Confirmed Project Value → Work Program → Progress → S-Curve → Project Insight`

TerajuWorks is being developed for two primary user groups:

- **Homeowner**
- **Contractor**

## Product Structure

### Homeowner Workspace

Designed to help homeowners understand and plan construction or renovation costs.

- BuildPlanner
- RenovationPlanner
- Cost Estimate
- Construction Budget
- Renovation Budget
- Cost Estimate History
- Simple and Detailed estimate/quotation outputs

### Contractor Workspace

Extends the estimation foundation into project execution and control.

- BuildPlanner
- RenovationPlanner
- Cost Estimate
- Contract / Invoice workflow
- Work Program
- Progress
- S-Curve
- Project Insight
- Contractor market and rate-related functions

## Core Planners

### BuildPlanner

BuildPlanner is designed for **new construction**. It converts project areas/rooms and calculation rules into quantities, cost estimates and construction budget information.

RM/sqft is represented as:

- Built-up Area
- RM/sqft

Because BuildPlanner represents new construction, it does not require an Existing/New RM/sqft split.

### RenovationPlanner

RenovationPlanner is designed specifically for **renovation projects**. Existing areas and newly added areas are kept separate:

- Existing Area
- Existing RM/sqft
- New Area
- New RM/sqft

Room/Area changes do **not** automatically regenerate the renovation budget. The user explicitly generates/regenerates the Renovation Budget when the project input is ready.

## Calculation Engine

TerajuWorks is moving toward a canonical calculation architecture where the same underlying calculation data drives different project outputs.

`Project Input → Calculation Rules → Quantity / Measurement → Cost Calculation → Budget → Cost Estimate → Project Control`

The goal is to avoid separate calculation logic being created for every screen.

## Cost Estimate

Cost Estimate is the bridge between planning and project control.

A project can contain different estimate presentation types, including:

- Simple
- Detailed

The estimate is associated with the project and its version so project history can be preserved.

The broader workflow is:

`Project → Estimate → Confirmed Estimate → Contract / Invoice → Work Program → Progress → S-Curve → Project Insight`

## Project Control

TerajuWorks extends beyond cost estimation into project execution control.

### Work Program

The Work Program is generated from the confirmed estimate item list. An immutable estimate item snapshot provides a clear source for the Work Program.

The interface is designed around weekly planning while retaining daily precision in the underlying schedule data.

### Progress

Progress is linked to the relevant Work Program, connecting planned work, scheduled work, completed work and project value.

### S-Curve

The S-Curve uses Work Program and Progress data to represent planned versus actual project progress over time.

### Project Insight

Project Insight is intended to convert project-control data into useful information for understanding project performance.

## Data & Persistence Architecture

The current architecture uses:

- **GitHub** as the primary source repository
- **GitHub main** as the source and project-control data foundation
- **GitHub Pages** for the frontend
- **Vercel** for API/server functions where required

Production Project Control API:

`https://terajuciptabina.vercel.app/api/project-control`

Important project-control data is designed not to depend only on browser localStorage. Server persistence is used so project information can survive browser/device changes.

## Admin

The Admin environment provides centralized management for the platform.

Current areas include:

- Insights Dashboard
- Admin Database
- Calculation Rules
- Rate Management
- Rate Comparison
- Admin Quotation
- Contractor Market
- Development Log

### Development Log

The Development Log records the development history of TerajuWorks directly in the repository data layer, including date, module, feature/milestone, status, summary, implementation details and related commit.

Its purpose is to make the development history traceable instead of relying only on chat history or developer memory.

## Rate Management

TerajuWorks is designed to support construction rate data by state. Contractor-submitted rate changes can be captured and reviewed by Admin before becoming part of the approved rate database.

`Contractor changes rate → Change captured → State identified → Admin review → Approval → Approved rate database`

## User Permissions

### Homeowner

The homeowner experience is designed to be primarily read-only for controlled construction cost information.

Examples:

- Rate is protected/blurred where appropriate
- Description is read-only
- Quantity is read-only
- Delete controls are unavailable
- Add New Item controls are unavailable

### Contractor

Contractors require a more complete working environment and, depending on the module, can edit items, quantities and rates, add/delete items and use project-control functions.

## Development Principles

### 1. Fix the source, not the symptom

TerajuWorks intentionally avoids a patch-over-patch development cycle. When a problem appears, the preferred approach is to trace the root cause and correct the canonical source.

### 2. Preserve working baselines

A `latest-working` baseline is maintained for rollback and recovery. It should not be moved casually and should only be promoted after the relevant feature has been tested and confirmed stable.

### 3. Keep calculation logic canonical

Budget, Cost Estimate and related outputs should use the same underlying calculation source whenever the business rule is the same.

### 4. Separate Build and Renovation logic where the business meaning differs

BuildPlanner and RenovationPlanner share the broader platform architecture but are not forced into identical calculation models when their construction meaning differs.

Key example:

- BuildPlanner → Built-up Area / RM/sqft
- RenovationPlanner → Existing Area / Existing RM/sqft + New Area / New RM/sqft

### 5. Preserve project history

Estimates, versions and confirmed project information should remain traceable so later project-control stages know exactly what source data they originated from.

## Current Development Direction

TerajuWorks is evolving from a construction cost-estimation tool into a broader construction project technology platform.

`TERAJUWORKS → HOMEOWNER / CONTRACTOR → BUILDPLANNER / RENOVATIONPLANNER → COST ESTIMATE → CONTRACT / INVOICE → WORK PROGRAM → PROGRESS → S-CURVE → PROJECT INSIGHT`

## Current Development Status

As of **October 2026**, the platform has progressed through:

- BuildPlanner
- RenovationPlanner
- V2 calculation/estimate architecture
- Calculation Rules
- Cost Estimate and versioning
- Construction/Renovation Budget
- Simple and Detailed estimate outputs
- Project Control
- Work Program
- Progress
- S-Curve
- Project Insight foundation
- Homeowner / Contractor workspace separation
- Admin management
- Server persistence
- Development Log
- TERAJUWORKS product/ecosystem branding

Current development also includes refinement of **RM/sqft as a canonical project metric**, with different treatment for new construction and renovation existing/new areas.

## Repository Structure

Important areas include:

`TerajuWorks/` — product frontend, planners, Admin and project-control interfaces  
`api/` — server/API functions  
`data/` — persistent application and development data

The exact file structure may evolve as the product architecture develops.

## Product Ownership

**TerajuWorks** is the technology product/ecosystem.

**Teraju Ciptabina Resources** is the parent company and owner.

`Teraju Ciptabina Resources → TerajuWorks → Homeowner / Contractor`

## Development History

The repository contains a persistent **Admin Development Log** documenting the evolution of TerajuWorks from the initial Renovation Budget Estimator through the current Project Control and platform architecture.

The development log is intended to remain part of the product's engineering record.

## Status

**TerajuWorks is an actively developed construction technology product.**

Architecture, calculation rules, user workflows and project-control modules continue to evolve through source-level development and validated working baselines.
