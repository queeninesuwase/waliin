# Wallin

**A collaborative biomedical equipment maintenance and fault-management platform.**

Wallin helps organize the reporting, assessment, prioritization, and follow-up of equipment faults. The system includes an API, an engineer-facing web application, and a management dashboard.

> **Project background:** Wallin was developed collaboratively by the Solvya team. This repository is a portfolio copy of the integrated team project, with contributions from multiple team members.

## Project overview

| Component | Purpose |
| --- | --- |
| `backend/` | API, data models, authentication, fault and maintenance workflows |
| `frontend/` | Engineer-facing application for fault requests and related workflows |
| `dashboard/` | Maintenance overview, reports, priority tracking, and management views |

## Main functionality

- Biomedical equipment fault reporting and request tracking
- Engineer-oriented fault-request views
- Fault assessment and maintenance prioritization
- Equipment maintenance records and reporting workflows
- Dashboard summaries and operational views
- Authentication and role-aware access to system features
- API integration between the backend and web interfaces

Specific features and permissions depend on the configured environment and the version of each component.

## Technology overview

| Area | Technologies used |
| --- | --- |
| Backend | Python and FastAPI |
| Web applications | React, TypeScript, and Next.js-based frontend tooling |
| API communication | HTTP / REST APIs |
| Data storage | SQL database configured through environment variables |
| Validation and quality | Automated tests included in the source tree |

See the individual `package.json` and Python dependency files for exact versions and packages.

## Repository structure

    wallin/
    ├── backend/
    ├── frontend/
    ├── dashboard/
    ├── .gitignore
    └── README.md

## Getting started

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Configure the environment variables used by the backend, including the database connection and authentication settings. Use the backend's actual application entry point to start the API after verifying its setup files.

### 2. Engineer-facing frontend

```bash
cd frontend
npm install
```

Review `.env.example` and `package.json`. Create a local `.env` file with the URL of your own backend and run the development script defined by the project.

### 3. Management dashboard

```bash
cd dashboard
npm install
```

Review `.env.example` and `package.json`, configure the backend API URL, and run the appropriate development script.

The frontend, dashboard, and backend must be configured to communicate with compatible API endpoints. Database schema setup or migrations may be required before backend workflows can run.

## Testing

The repository includes authentication, security, and database URL tests alongside application code. Test fixtures may contain deliberately fictional usernames, passwords, and database URLs. Run the tests using the relevant component's configured tools and dependencies.

## Security and configuration

- Never commit live credentials, `.env` files, signing keys, or private keys.
- Use credentials and services that you control when running this portfolio copy.
- Review the provided `.env.example` files before creating local environment settings.
- Do not assume the source-code snapshot is production-ready or independently security-audited.

## My contributions

My contributions included engineer fault-request and API integration work, fault assessment and maintenance reporting features, and dashboard work related to maintenance priorities and reporting. This repository also includes the work of other Solvya team members as part of the integrated project.

## Project status

This is a **portfolio source-code snapshot** of a collaborative project. Running the full system requires appropriate backend, database, and application configuration.

## Acknowledgment

Developed collaboratively by the **Solvya team**. Original copyright, license, and third-party notices, where applicable, remain subject to their respective terms.
