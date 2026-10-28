# SplitMate

SplitMate is a shared-expense management application that helps people organize group expenses, split costs fairlyGood! Your Git check confirms that **`backend/.env`** is protected from being committed, and both project folders (**`backend/`** and **`frontend/`**) are ready to be added to Git.

The **`??`** means **untracked**: Git sees these folders, but they haven't been included in a commit yet. That's normal for newly created project files.

Before committing, let's update the root **`README.md`** so your GitHub repository has clear, professional setup instructions., track balances, and manage settlements.

## Technology Stack

### Frontend

- React with Vite
- TypeScript
- Tailwind CSS
- React Router
- Axios and TanStack Query

### Backend

- NestJS and TypeScript
- Prisma ORM
- MySQL
- Argon2id password hashing
- JWT-based authentication
- Socket.IO for real-time communication

### Testing and API Documentation

- Jest and Supertest
- Vitest and React Testing Library
- Swagger / OpenAPI
- Postman

## Project Structure

```text
SplitMate/
├── backend/       # NestJS API and database
│   ├── prisma/    # Schema, migrations and seed script
│   └── src/       # Backend application
├── frontend/      # React + Vite application
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the project:

- Node.js 24 LTS
- npm
- MySQL 8
- Git

## Local Setup

### 1. Clone the repository

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd SplitMate
```

Replace the placeholder with your actual GitHub repository URL.

### 2. Configure the database

Create a MySQL database named `splitmate` using MySQL Workbench or your MySQL client:

```sql
CREATE DATABASE splitmate;
```

### 3. Configure the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Open `backend/.env` and replace the placeholder values with your local MySQL credentials and a strong, private demo password.

Do not commit `.env` or share its secrets.

### 4. Apply database migrations and seed demo data

Run these commands from the `backend` directory:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

The seed script creates or verifies two demo users and a demo group. Set `SEED_DEMO_PASSWORD` in your local `.env` before running it. Existing demo-user passwords are not changed by the seed script.

### 5. Start the backend

In the `backend` directory:

```powershell
npm run start:dev
```

The backend is expected to run at `http://localhost:3000`.

### 6. Start the frontend

Open a second terminal at the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Data and Security Design

- Monetary values are stored as integer paise to avoid floating-point rounding errors.
- Passwords are hashed using Argon2id.
- Refresh-token and access-token handling is designed around short-lived access tokens and refresh-token protection.
- Prisma migrations manage database schema changes.
- Database relationships and constraints help maintain data integrity.
- Group membership and ownership checks are important parts of authorization.

## Testing

Run backend tests from the `backend` directory:

```powershell
npm test
npm run build
```

Run the frontend production build from the `frontend` directory:

```powershell
npm run build
```

## Project Status

SplitMate is under active development. Features, tests, documentation, and end-to-end workflows are being verified as development progresses.

## Demo Preparation

The planned demo covers user authentication, group creation, adding members, equal and custom expense splits, balance updates, settlements, and real-time updates across two browser sessions.

## Environment Variables

Use `backend/.env.example` as the template for local configuration. Never commit actual credentials, access tokens, or other secrets.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE)
file for details.
