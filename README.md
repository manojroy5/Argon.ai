# Argon AI

Argon AI is an image intake application that validates portrait uploads and separates them into accepted and rejected collections with clear, real-time feedback.

## Current status

The frontend upload workflow is implemented with local validation and a simulated processing service. The backend provides a secured Express REST API, a versioned Prisma schema, PostgreSQL persistence, cursor pagination, validation, status history, and image-metadata CRUD operations. Object storage, background processing, HEIC conversion, similarity detection, blur detection, and face validation will be added in later milestones.

## Project structure

```text
argon-ai/
├── backend/             Express REST API
│   ├── prisma/           Schema and versioned migrations
│   └── src/              Routes, services, validation, and middleware
├── frontend/            React + Vite application
│   └── src/
├── compose.yml          Local PostgreSQL infrastructure
├── package.json         Shared workspace commands
└── README.md
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

Docker Desktop is used for the local PostgreSQL database. Redis and S3-compatible storage will be added with the processing worker milestone.

> **Important:** Argon AI PostgreSQL does **not** use the default host port `5432`. It is exposed on host port **`5433`** because another PostgreSQL service already occupies `5432` on the development machine.

## Setup

Install all frontend, backend, and root dependencies from the repository root:

```bash
npm install
```

Start the project database and apply all migrations:

```bash
npm run infra:up
npm run db:migrate
```

Local database connection:

```text
postgresql://argon:argon_dev_password@localhost:5433/argon?schema=public
```

Docker maps host port `5433` to PostgreSQL's normal container port `5432`. Use `5433` from the backend, Prisma, database clients, and other programs running on the host.

Start the frontend and backend together:

```bash
npm run dev
```

The services run at:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Liveness: http://localhost:3000/api/health/live
- Readiness: http://localhost:3000/api/health/ready

You can also start either service independently:

```bash
npm run dev:frontend
npm run dev:backend
```

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run frontend and backend concurrently |
| `npm run dev:frontend` | Run only the Vite frontend |
| `npm run dev:backend` | Run only the Express API in watch mode |
| `npm run infra:up` | Start the local PostgreSQL container |
| `npm run infra:down` | Stop local infrastructure without deleting its data volume |
| `npm run db:migrate` | Create/apply a development Prisma migration |
| `npm run db:generate` | Regenerate Prisma Client from the schema |
| `npm run db:studio` | Open Prisma's local database browser |
| `npm run build` | Create the production frontend build |
| `npm run lint` | Lint the frontend source |
| `npm start` | Start the backend without watch mode |

## Frontend validation

The browser currently performs immediate checks for:

- JPG, PNG, and HEIC extensions and MIME types
- File size between 20 KB and 15 MB
- Minimum 600 × 600 resolution for browser-readable JPEG and PNG files
- Exact duplicate file selections

HEIC dimensions and all security-sensitive checks must be verified on the backend. The current upload progress is simulated in `frontend/src/services/imageApi.js` until the REST API is connected.

## Planned backend processing

The API will use PostgreSQL with Prisma, S3-compatible object storage, and a Redis-backed worker queue. Workers will securely verify file signatures, convert HEIC images, and perform resolution, similarity, blur, and face validations asynchronously.

## REST API

All image endpoints use the `/api/v1/images` base path.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/images` | Create image metadata and a pending upload record |
| `GET` | `/api/v1/images` | List active images with status filtering and cursor pagination |
| `GET` | `/api/v1/images/:id` | Retrieve image metadata, rejection reasons, and status history |
| `PATCH` | `/api/v1/images/:id` | Update the original filename metadata |
| `DELETE` | `/api/v1/images/:id` | Soft-delete an image record |

Example metadata request:

```json
{
  "originalFilename": "portrait.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 125000
}
```

The API currently records an S3-ready storage key but does not issue an upload URL yet. File bytes remain in the frontend until the object-storage milestone is connected.
