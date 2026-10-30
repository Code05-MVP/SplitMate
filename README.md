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
│   └── src/
│       ├── auth/
│       ├── groups/
│       ├── expenses/
│       ├── settlements/
│       └── realtime/
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/
│       ├── api/
│       └── realtime/
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

## Local Setup

### 1. Clone the repository

```powershell
git clone https://github.com/Code05-MVP/SplitMate.git
cd SplitMate
```



### 2. Create the database

Create a MySQL database named `splitmate`.

```sql
CREATE DATABASE splitmate;
```

### 3. Configure the backend

Navigate to the backend directory:

```powershell
cd backend
npm install
```

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

Configure the required values in `backend/.env`, including:

- MySQL connection details.
- JWT authentication secrets.
- Refresh-token configuration.
- `SEED_DEMO_PASSWORD`.

Use secure values for your local environment. The demo password must contain at least 12 characters.

Never commit your `.env` file or expose credentials and authentication secrets.

### 4. Apply database migrations

Run the following commands from the `backend` directory:

```powershell
npx prisma migrate deploy
npx prisma generate
```

These commands apply the existing database migrations and generate the Prisma Client.

### 5. Seed demo data

Run:

```powershell
npm run db:seed
```

The seed script creates or verifies the following demo data:

| Name | Email | Role |
|---|---|---|
| Aarav Sharma | aarav.demo@splitmate.local | Owner |
| Priya Patel | priya.demo@splitmate.local | Member |

It also creates or verifies the group:

**Demo Shared Expenses**

The seed script:
- Uses Argon2id to hash the demo password.
- Uses Prisma `upsert` to avoid duplicate demo users and memberships.
- Preserves existing demo-user passwords.
- Ensures both demo accounts belong to the demo group.

**Note:** The current seed script creates demo users, a group, and group memberships. It does not create sample expenses or settlements.

### 6. Start the backend

From the `backend` directory:

```powershell
npm run start:dev
```

The backend is expected to run at:

`http://localhost:3000`

### 7. Start the frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL provided by Vite, normally:

`http://localhost:5173`

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
npm test
npm run build
```

### Frontend

Run from the `frontend` directory:

```powershell
npm run build
```

## Project Status

SplitMate is under active development.

Core workflows are being implemented and tested, including authentication, group management, expense splitting, balance calculations, settlements, activity history, and real-time communication.

## Demo Walkthrough

The planned demonstration covers:

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