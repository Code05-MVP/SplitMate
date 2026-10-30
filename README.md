# SplitMate

SplitMate is a full-stack shared-expense management application that helps people organize group expenses, split costs fairly, track balances, and manage settlements.

It provides group management, equal and custom expense splitting, balance calculations, activity tracking, and real-time updates so that group members stay synchronized.

## Technology Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- Axios
- TanStack Query
- React Context API

### Backend
- NestJS
- TypeScript
- Prisma ORM
- MySQL
- Argon2id password hashing
- JWT authentication
- Socket.IO

### Testing and API Documentation
- Jest
- Supertest
- Vitest
- React Testing Library
- Swagger / OpenAPI
- Postman

## Key Features

- User registration and authentication.
- Secure password hashing using Argon2id.
- JWT-based authentication with access-token refresh.
- HttpOnly refresh-token cookies and short-lived access tokens.
- Group creation and member management.
- Equal and custom expense splitting.
- Expense creation, editing, and deletion.
- Group balance calculation.
- Simplified debt calculations.
- Manual partial and full settlements.
- Personal and group activity history.
- Dashboard with overall financial summaries.
- Real-time expense, balance, and activity updates.
- Automatic WebSocket reconnection and recovery.

## Project Structure

```text
SplitMate/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── auth/
│   │   ├── groups/
│   │   ├── expenses/
│   │   ├── settlements/
│   │   └── realtime/
│   ├── package.json
│   ├── package-lock.json
│   ├── prisma.config.ts
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── api/
│   │   └── realtime/
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
├── LICENSE
└── README.md
```

## Prerequisites

Install the following before running the project:

- Node.js 24 LTS
- npm
- MySQL 8
- Git

You can verify your installations using:

```powershell
node --version
npm --version
git --version
```

## Local Setup

Follow these steps to run SplitMate locally.

### 1. Clone the repository

```powershell
git clone https://github.com/Code05-MVP/SplitMate.git
cd SplitMate
```

### 2. Install frontend dependencies

Open a terminal in the project root:

```powershell
cd frontend
npm ci
```

This installs the frontend dependencies using the committed package-lock.json file.

### 3. Install backend dependencies

Open another terminal in the project root:

```powershell
cd backend
npm ci
```

This installs NestJS, Prisma, Prisma Client, the MySQL adapter, Argon2, Socket.IO, and other backend dependencies.

No separate global Prisma installation is required.

### 4. Create the MySQL database

Start your MySQL server and create a database named `splitmate`.

You can execute the following SQL in MySQL Workbench or your MySQL client:

```sql
CREATE DATABASE splitmate;
```

### 5. Configure environment variables

From the backend directory, create your local environment file:

```powershell
Copy-Item .env.example .env
```

Open `backend/.env` and configure the required values.

These include:

- MySQL connection details.
- JWT authentication secrets.
- Refresh-token configuration.
- `SEED_DEMO_PASSWORD`.

Use your own secure local credentials and secrets.

The demo password must contain at least 12 characters.

**Important:** Never commit your `.env` file or expose database credentials, JWT secrets, or other sensitive configuration.

The `.env.example` file contains the configuration template required by other developers.

### 6. Generate Prisma Client and apply migrations

Run these commands from the backend directory:

```powershell
npx prisma generate
npx prisma migrate deploy
```

These commands:

- Generate Prisma Client for database access.
- Apply the committed database migrations.
- Prepare the database schema.

### 7. Seed demo data

Run:

```powershell
npm run db:seed
```

The seed script creates or updates the following demo users:

| Name | Email | Role |
|---|---|---|
| Aarav Sharma | aarav.demo@splitmate.local | Owner |
| Priya Patel | priya.demo@splitmate.local | Member |

It also creates or verifies the group:

**Demo Shared Expenses**

The seed script creates two sample expenses:

| Expense | Amount | Split Type |
|---|---:|---|
| Goa hotel booking | ₹1,200 | Equal |
| Dinner and food | ₹900 | Custom |

Expected initial net balance:

**Priya owes Aarav ₹300.**

The seed script:
- Uses Argon2id to hash the demo password.
- Uses Prisma `upsert` to avoid duplicate demo users, memberships, and expenses.
- Sets both demo users' passwords using `SEED_DEMO_PASSWORD`.
- Ensures both demo accounts belong to the demo group.
- Creates or updates the sample expenses and their splits.

**Important:** Running the seed script again resets both demo users' passwords to the current `SEED_DEMO_PASSWORD` value. Both demo accounts use the same configured demo password.

### 8. Start the backend

From the backend directory:

```powershell
npm run start:dev
```

The backend runs at:

`http://localhost:3000`

### 9. Start the frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm run dev
```

Open the local URL provided by Vite, normally:

`http://localhost:5173`

You can now register your own accounts or use the seeded demo accounts.

## Data and Security Design

### Monetary Calculations

- Monetary values are stored as integer paise.
- Integer-based calculations avoid floating-point precision problems.
- Rupee values are formatted for display in the frontend.
- Equal and custom splits are supported.
- Leftover paise are distributed deterministically.

### Authentication

- Passwords are hashed using Argon2id.
- Short-lived access tokens are maintained in frontend memory.
- Refresh tokens are stored in HttpOnly cookies.
- Refresh tokens are hashed before being stored in MySQL.
- Refresh-token rotation is implemented.
- Previous refresh tokens are revoked during rotation.
- Multiple active sessions are supported.
- Logout revokes the corresponding refresh token.

### Authorization

- Protected API endpoints require authentication.
- Group membership is checked before allowing access to group resources.
- Group ownership and membership permissions are enforced by the backend.
- WebSocket group subscriptions also validate membership.

### Database Management

- Prisma ORM manages database access.
- Prisma Migrate manages schema changes.
- Foreign-key constraints maintain referential integrity.
- Transactions are used for operations that require coordinated database changes.

## Real-Time Communication

SplitMate uses Socket.IO for real-time communication instead of relying on periodic polling.

### WebSocket Authentication

- Socket connections are authenticated using access tokens.
- The backend validates the token when a socket connects.
- The authenticated user ID is associated with the socket.
- Group membership is checked before allowing a socket to join a group room.

### Group-Based Communication

- Each group has its own Socket.IO room.
- Clients use the `group:join` event to request access to a group room.
- The backend verifies membership before accepting the request.
- Expense, balance, settlement, and activity events are broadcast to relevant group members.

### Reconnection and Recovery

- Automatic Socket.IO reconnection is enabled.
- If the backend becomes temporarily unavailable, the client attempts to reconnect.
- After reconnecting, the dashboard requests to join the user's group rooms again.
- The backend validates group membership before allowing room access.
- Relevant data is fetched again after reconnection to recover updates missed during disconnection.
- The dashboard refreshes its balance summary and recent activity.
- The group expenses component fetches the latest expenses after reconnecting.
- If the server disconnects a socket because of authentication expiry, the frontend attempts to refresh the access token.
- If token refresh fails, the application dispatches a session-expired event.

## Testing

### Backend

Run from the `backend` directory:

```powershell
npm test -- --runInBand
npm run build
```

### Frontend

Run from the `frontend` directory:

```powershell
npm run build
```

## Project Status

SplitMate is under active development.

The project includes core workflows for authentication, group management, expense splitting, balance calculations, settlements, activity history, and real-time communication.

Automated backend tests and frontend/backend production builds are included.

## Demo Walkthrough

The project demonstration covers:

1. Registering and logging in with two users.
2. Creating a group and adding another member.
3. Adding equal-split and custom-split expenses.
4. Viewing group balances and simplified debts.
5. Editing and deleting expenses.
6. Recording settlements.
7. Viewing dashboard summaries and activity history.
8. Demonstrating real-time updates across two browser sessions.
9. Testing automatic WebSocket reconnection and recovery.

## Future Improvements

- More comprehensive automated end-to-end testing.
- Docker-based development environment.
- Production deployment.
- Additional expense-splitting options.
- Performance and security improvements.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
