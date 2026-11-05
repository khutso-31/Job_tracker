# Job Application Tracker

A React, TypeScript, and Vite application for tracking job applications. JSON Server provides a local mock API while the application is being developed.

## Requirements

- Node.js (setup verified with v22.18.0)
- npm

## Getting started

Install dependencies:

```sh
npm install
```

Start the frontend and mock API in separate terminals:

```sh
npm run dev
```

```sh
npm run server
```

Vite runs at `http://localhost:5173` and JSON Server runs at `http://localhost:3001`. The jobs endpoint is `http://localhost:3001/jobs`.

The dashboard loads applications from JSON Server and supports creating, editing,
deleting, searching, and filtering applications by status. Data is stored locally
in `db.json`; keep the mock API running while using the app. To use another API
origin, set `VITE_API_URL` (the default is `http://localhost:3001`).

## Available scripts

- `npm run dev` — start the Vite development server
- `npm run build` — type-check and create a production build
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build
- `npm run server` — start JSON Server using `db.json`

## Source layout

- `src/assets/` — static application assets
- `src/components/` — reusable UI components
- `src/services/` — jobs API access
- `src/types/Job.ts` — job application data type
