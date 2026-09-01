git status# PayGuard — Payment Transaction Risk Analyzer

## Overview

PayGuard is a full-stack payment transaction monitoring application that simulates how a transaction monitoring system can identify potentially risky transactions using an explainable rule-based scoring engine.

> PayGuard is a portfolio project and does not represent a real banking fraud detection system. It is not intended to provide real-world fraud detection accuracy or production-grade financial security controls.

## Features

- Transaction monitoring
- SQLite persistence
- REST APIs
- Rule-based risk scoring
- Risk levels: LOW / MEDIUM / HIGH
- Explainable risk reasons
- Dashboard statistics
- Transaction trends
- Risk distribution
- Search
- Filtering
- Sorting
- Transaction details
- Add and delete transactions
- Responsive UI
- Error and loading states

## Tech Stack

### Frontend

- HTML
- CSS
- Vanilla JavaScript
- Chart.js

### Backend

- Node.js
- Express.js

### Database

- SQLite

### Development

- Git
- GitHub

## Architecture

```text
Browser
   |
   | HTTP / REST API
   v
Express.js Server
   |
   +---- Risk Engine
   |
   v
SQLite Database
```

The request flow is simple and matches the app behavior:

```text
User interacts with UI
        ↓
Vanilla JavaScript sends an HTTP request
        ↓
Express API receives the request
        ↓
Backend validates input and checks the database
        ↓
Risk engine calculates the transaction score
        ↓
SQLite stores or retrieves the transaction
        ↓
JSON response is returned to the browser
        ↓
UI updates with refreshed data
```

## Database Design

The application uses a single `transactions` table with these columns:

| Column | Purpose |
| --- | --- |
| id | Database primary key |
| transaction_id | Business transaction identifier |
| amount | Transaction amount |
| currency | Currency code |
| merchant | Merchant name |
| location | Transaction location |
| transaction_type | Type of payment |
| transaction_time | Transaction timestamp |
| status | Transaction status |
| risk_score | Calculated risk score |
| risk_level | LOW / MEDIUM / HIGH |
| created_at | Record creation timestamp |

## REST API

The app currently implements the following endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check backend health |
| GET | `/api/transactions` | Get all transactions |
| GET | `/api/transactions/:id` | Get one transaction by ID |
| POST | `/api/transactions` | Create a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/api/dashboard/risk-distribution` | Get risk distribution counts |
| GET | `/api/dashboard/trend` | Get transaction trend data |

For `POST /api/transactions`, the server validates required fields, checks for positive numeric amounts, calculates risk score and level, and inserts the record into SQLite.

## Risk Scoring Logic

The risk engine uses a simple deterministic rule-based approach. The current implementation calculates the following:

### Amount rules

- amount > 50,000 → +30
- amount > 10,000 → +15

Only one amount rule applies in a single transaction, depending on the threshold reached.

### Unusual time

Transactions between 00:00 and 05:00 receive:

- +20

### Unusual location

If the location is one of the current unusual values:

- Unknown
- International

then the score gets:

- +20

### Repeated transactions

If the same merchant appears multiple times in the current transaction set, the score gets:

- +15

### Final score mapping

```text
0–29   → LOW
30–59  → MEDIUM
60–100 → HIGH
```

The score is capped at 100, and a list of risk reasons is returned with the result.

## Why Rule-Based Risk Scoring?

A deterministic rule-based approach was chosen because it is:

- easy to understand
- explainable
- predictable
- simple to test
- appropriate for a portfolio demonstration

A production payment network would require much more sophisticated systems, operational controls, monitoring, and model governance. PayGuard is intentionally lightweight and educational rather than production-ready.

## Project Structure

```text
PayGuard/
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── database/
│   └── payguard.db
│
├── db.js
├── riskEngine.js
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
├── README.md
├── page.html
└── node_modules/
```

> Note: The SQLite database is generated locally and is not intended for Git tracking.

## Setup Instructions

1. Clone the repository:

```bash
git clone <repository-url>
cd PayGuard
```

2. Install dependencies:

```bash
npm install
```

3. Start the application:

```bash
npm start
```

4. Open the app in the browser:

```text
http://localhost:3000
```

SQLite initialization happens automatically when the server starts. If the local database file does not exist yet, it will be created automatically.

## API Testing Examples

### Get all transactions

```http
GET /api/transactions
```

### Create a transaction

```http
POST /api/transactions
Content-Type: application/json

{
  "transaction_id": "TXN-NEW-001",
  "amount": 2500,
  "currency": "INR",
  "merchant": "Corner Store",
  "location": "Delhi",
  "transaction_type": "POS",
  "transaction_time": "2026-09-01T12:00:00Z",
  "status": "Approved"
}
```

## Screenshots

No screenshots are currently included in the project.

A future screenshot section can be added later once visual captures are generated for the dashboard and transaction flows.

## Future Improvements

These are realistic next steps and are intentionally labeled as future improvements:

- authentication and authorization
- more sophisticated fraud detection
- machine learning models
- anomaly detection
- geolocation intelligence
- rate limiting
- audit logging
- production database setup
- automated tests
- deployment and hosting
- monitoring and observability

## Project Disclaimer

> This project is an educational portfolio project demonstrating full-stack development, REST API design, database integration, and explainable rule-based transaction risk analysis. It is not a production banking or fraud detection system.

