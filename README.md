# SplitMate

SplitMate is a full-stack shared-expense management application that helps people organize group expenses, split costs fairly, track balances, and manage settlements.

It provides group management, equal and custom expense splitting, balance calculations, activity tracking, and real-time updates so that group members stay synchronized.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Data Model and Relationships](#data-model-and-relationships)
- [Data and Security Design](#data-and-security-design)
- [Real-Time Communication](#real-time-communication)
- [Testing](#testing)
- [Challenges and Solutions](#challenges-and-solutions)
- [Known Issues and Limitations](#known-issues-and-limitations)
- [Future Improvements](#future-improvements)
- [AI Tools and Learning](#ai-tools-and-learning)
- [Demo Walkthrough](#demo-walkthrough)
- [License](#license)

## Technology Stack

### Frontend

- React – Component-based user interface.
- Vite – Fast development server and build tooling.
- TypeScript – Static typing and improved maintainability.
- Tailwind CSS – Utility-based styling.
- React Router – Client-side navigation.
- Axios – HTTP communication with the backend.
- TanStack Query – Server-state management and caching.
- React Context API – Authentication state management.

### Backend

- NestJS – Structured and modular backend architecture.
- TypeScript – Type safety across the application.
- Prisma ORM – Database access and schema management.
- MySQL – Relational database.
- Argon2id – Secure password hashing.
- JWT – Authentication using access and refresh tokens.
- Socket.IO – Real-time communication.

### Testing and API Documentation

- Jest – Backend unit testing.
- Supertest – Backend API testing.
- Vitest – Frontend testing.
- React Testing Library – Component testing.
- Swagger / OpenAPI – API documentation.
- Postman – API testing and verification.

### Why This Stack?

The stack was selected to provide a consistent TypeScript-based development experience across the frontend and backend.

- **React and Vite** provide a component-based frontend with a fast development workflow.
- **NestJS** provides a modular structure that separates authentication, groups, expenses, settlements, and real-time functionality.
- **MySQL** provides relational data storage for users, group memberships, expenses, splits, and settlements.
- **Prisma** simplifies database queries, schema management, migrations, and transactional operations.
- **Argon2id and JWT** support password security and token-based authentication.
- **Socket.IO** enables real-time updates without relying on periodic polling.
- **TanStack Query** manages server data, caching, and refetching, while React Context manages authentication state.

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

Verify your installations:

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

This installs the frontend dependencies using the committed `package-lock.json` file.

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

Execute the following SQL in MySQL Workbench or your MySQL client:

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
- Refresh-token configuration, if required by the application.
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

Run from the backend directory:

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

## Data Model and Relationships

SplitMate uses a relational database structure to maintain relationships between users, groups, expenses, splits, and settlements.

The main logical entities are:

### User

Represents a registered application account.

A user can:

- Create multiple groups.
- Join multiple groups.
- Create expenses.
- Pay for expenses.
- Participate in expense splits.
- Record and receive settlements.

### Group

Represents a shared expense group, such as a trip or a group of roommates.

A group has an owner and multiple members. It contains expenses, settlements, and group activity records.

### Membership

Connects users and groups through a many-to-many relationship.

A user can belong to multiple groups, and a group can contain multiple users.

Membership records are used to determine whether a user is authorized to access group resources.

### Expense

Represents an expense recorded within a group.

An expense is associated with:

- The group where it was created.
- The user who created it.
- The member who paid.
- Its description and monetary amount.
- Its individual split records.

### Expense Split

Stores how much of an expense is assigned to each participating member.

An expense can have multiple split records, one for each member included in the split.

The sum of all split amounts must equal the original expense amount.

### Settlement

Records a payment between two members of a group.

It tracks the member making the payment, the member receiving it, the amount, and the associated group.

### Relationship Overview

```text
User
 |
 |--- creates multiple Groups
 |--- joins Groups through Membership
 |
Group
 |
 |--- has multiple Memberships
 |--- contains multiple Expenses
 |--- contains Settlements
 |--- contains Activity records
 |
Expense
 |
 |--- belongs to one Group
 |--- has a Creator
 |--- has a Payer
 |--- contains multiple Expense Splits
 |
Expense Split
 |
 |--- belongs to one Expense
 |--- references one User
 |
Settlement
 |
 |--- belongs to one Group
 |--- references a Paying User
 |--- references a Receiving User
```

The database uses foreign-key relationships and Prisma transactions to maintain data consistency.

## Data and Security Design

### Monetary Calculations

SplitMate uses integer-based monetary calculations to avoid floating-point precision problems.

- Monetary values are stored as integer paise.
- ₹1 is represented as 100 paise.
- Floating-point arithmetic is avoided for monetary calculations.
- Rupee values are formatted for display in the frontend.
- Equal and custom splits are supported.
- The sum of all shares must exactly equal the expense amount.

**Rounding rule for equal splits:**

When an amount cannot be divided equally, the backend calculates the base share using integer division.

For example:

₹100 divided among three members:

- Base share: ₹33 each.
- Remaining amount: ₹1.
- The remaining paise is distributed one at a time in deterministic member order.

Final distribution:

| Member | Share |
|---|---:|
| Member 1 | ₹33.34 |
| Member 2 | ₹33.33 |
| Member 3 | ₹33.33 |
| **Total** | **₹100.00** |

This ensures that no paise are lost or created during an equal split.

Custom splits are validated to ensure that the sum of all entered shares exactly matches the expense amount.

### Authentication

SplitMate uses JWT-based authentication with a refresh-token mechanism.

- Passwords are hashed using Argon2id.
- Short-lived access tokens are maintained in frontend memory.
- Refresh tokens are stored in HttpOnly cookies.
- Refresh tokens are hashed before being stored in MySQL.
- Refresh-token rotation is implemented.
- Previous refresh tokens are revoked during rotation.
- Multiple active sessions are supported.
- Logout revokes the corresponding refresh token.

**Refresh-token lifecycle:**

1. A user logs in with valid credentials.
2. The backend issues an access token and a refresh token.
3. The access token is maintained in frontend memory.
4. The refresh token is sent through an HttpOnly cookie.
5. The backend stores the hashed refresh token in MySQL.
6. When an access token expires, the frontend attempts to obtain a new access token using the refresh-token endpoint.
7. The backend validates the refresh token and its stored session record.
8. A successful refresh rotates the refresh token and issues a new access token.
9. The previous refresh-token record is revoked.
10. If refresh fails or the session is revoked, the user must authenticate again.

HttpOnly cookies prevent frontend JavaScript from directly reading the refresh token.

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

This prevents unauthorized users from receiving group-specific updates through a global broadcast.

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

The application therefore does not depend on the WebSocket connection for loading the latest persisted data.

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

The project includes automated backend tests and frontend/backend production builds.

## Challenges and Solutions

### 1. Database Connectivity and Configuration

Configuring Prisma with the MySQL adapter required understanding how the database connection settings and authentication options work together.

I investigated connection errors, checked the database configuration, and adjusted the local connection setup to establish a working connection.

### 2. Expense Splitting and Balance Accuracy

Expense splitting requires more than dividing an amount. Every share must add up to the original expense, and editing an expense must correctly affect the group's balances.

I focused on integer-based monetary calculations, exact share validation, and recalculating balances from the updated expense and split records.

### 3. Real-Time Synchronization

Keeping multiple users' screens synchronized requires more than emitting a WebSocket event.

I used group-specific Socket.IO rooms and backend membership validation. The frontend also refetches relevant data after reconnecting so that missed updates do not leave the interface showing stale information.

## Known Issues and Limitations

- The project is currently intended for local development and has not been prepared as a production deployment.
- Docker-based one-command setup is not included.
- Additional end-to-end test coverage would improve confidence across complete user workflows.
- Production infrastructure, monitoring, and deployment configuration would require further work.

## Future Improvements

- More comprehensive automated end-to-end testing.
- Docker-based development environment.
- Production deployment.
- Additional expense-splitting options, such as percentage-based splits.
- Performance and security improvements.
- More extensive real-time and multi-session testing.

## AI Tools and Learning

AI tools were used selectively during development as productivity and problem-solving assistants.

Some areas where they helped include:

- **Documentation and research:** Quickly exploring library documentation, configuration options, and implementation approaches.
- **Debugging:** Analyzing error messages, investigating configuration issues, and exploring possible solutions.
- **Edge-case analysis:** Reviewing scenarios involving uneven expense splits, balance recalculation, and concurrent updates.
- **Code quality:** Identifying potential improvements in code structure, validation, error handling, and maintainability.
- **Development workflow:** Improving technical documentation and speeding up repetitive development tasks.

AI-assisted suggestions were reviewed, tested, and adapted to the project's requirements rather than accepted blindly.

The experience reinforced the importance of validating solutions, understanding implementation trade-offs, and writing maintainable code.

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

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.