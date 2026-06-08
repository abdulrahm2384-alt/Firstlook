# Secure Admin Analytics API System Documentation

Welcome to the Secure Admin Analytics API documentation. This system provides external clients, admin tools, and analytical engines with secure, real-time access to user registrations, financial transactions, subscription performance metrics, and audit logs.

## Base API Configuration

*   **API Base Route:** `/api/admin`
*   **Response Format:** `application/json` (All responses are guaranteed to be valid JSON)
*   **Port:** `3000`

---

## Security & Authentication

All API endpoints are strictly protected under administrative permissions. Any incoming request must satisfy the credential requirements described below:

### 1. Header Requirement
To authenticate, you must provide a valid `FOREX_API_SECRET` passphrase passed via the standard HTTP `Authorization` header as a `Bearer` token:

```http
Authorization: Bearer YOUR_FOREX_API_SECRET
```

### 2. Unauthorized Responses (401)
If the `Authorization` header is missing, incorrectly formatted, or the password does not match the server's registered security keys, the API returns a `401 Unauthorized` body:

```json
{
  "error": "Unauthorized: Invalid or missing administrative access credential."
}
```

### 3. Rate Limiting protection
To prevent automated denial of service attacks, administrative endpoints are protected with client IP rate limiting. Standard limiters enforce a maximum of **100 requests per minute**.
Exceeding this threshold yields a `429 Too Many Requests` status code:

```json
{
  "error": "Too Many Requests: Administrative access is limited to 100 requests per minute."
}
```

---

## Financial Analytics Endpoints

### 1. Get Financial Overview
Returns a complete overview of successful financial collections.
*   **Route:** `GET /api/admin/finance/overview`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/finance/overview
    ```
*   **Response (200 OK):**
    ```json
    {
      "today_payment": 125.50,
      "week_payment": 850.00,
      "month_payment": 3200.00,
      "year_payment": 15400.00,
      "overall_payment": 28500.00,
      "currency": "USD"
    }
    ```

### 2. Get Revenue by Plan
Returns distribution of user counts and historical payments grouped by product tier indices.
*   **Route:** `GET /api/admin/finance/revenue-by-plan`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/finance/revenue-by-plan
    ```
*   **Response (200 OK):**
    ```json
    {
      "free": {
        "users": 1000,
        "revenue": 0
      },
      "plus": {
        "users": 350,
        "revenue": 2400.00
      },
      "premium": {
        "users": 150,
        "revenue": 4500.00
      }
    }
    ```

### 3. Get Paginated Payments History
Lists all successful payment logs with filter properties and paging parameters.
*   **Route:** `GET /api/admin/finance/payments`
*   **Query Parameters:**
    *   `page` (optional): Default `1`. Current page index.
    *   `limit` (optional): Default `20`. Number of records returned.
    *   `plan` (optional): Filter payments by specific subscription tiers (`plus` or `premium`).
    *   `country` (optional): Filter payments by country names (e.g. `Nigeria`, `Ghana`).
    *   `start_date` (optional): Filter payments since date ISO-8601 (e.g. `2026-06-01T00:00:00.000Z`).
    *   `end_date` (optional): Filter payments prior to date ISO-8601 (e.g. `2026-06-30T23:59:59.000Z`).
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" "http://localhost:3000/api/admin/finance/payments?page=1&limit=2&plan=premium"
    ```
*   **Response (200 OK):**
    ```json
    {
      "currentPage": 1,
      "totalPages": 75,
      "totalPayments": 150,
      "limit": 2,
      "payments": [
        {
          "id": "pay_uuid_1",
          "user_id": "usr_uuid_1",
          "email": "trader_1@firstlook.com",
          "full_name": "Chinelo Okonkwo",
          "amount_usd": 20.00,
          "amount_local": 22000.00,
          "currency": "NGN",
          "plan": "premium",
          "country": "Nigeria",
          "reference": "FL-PAY-100001-0.1",
          "status": "success",
          "created_at": "2026-06-04T23:14:29.000Z"
        }
      ]
    }
    ```

### 4. Get Revenue Trends
Provides historical time series aggregation datasets for graphing.
*   **Route:** `GET /api/admin/finance/revenue-trends`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/finance/revenue-trends
    ```
*   **Response (200 OK):**
    ```json
    {
      "daily": [
        { "date": "2026-06-04", "revenue": 125.50 }
      ],
      "monthly": [
        { "month": "2026-06", "revenue": 3200.00 }
      ]
    }
    ```

---

## User Analytics Endpoints

### 1. Get Users Overview Mode
Provides total, active, free and upgraded metrics with registrations counts today/week/month.
*   **Route:** `GET /api/admin/users/overview`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/users/overview
    ```
*   **Response (200 OK):**
    ```json
    {
      "total_users": 1500,
      "active_users": 1120,
      "free_users": 1000,
      "plus_users": 350,
      "premium_users": 150,
      "new_users_today": 25,
      "new_users_this_week": 130,
      "new_users_this_month": 520
    }
    ```

### 2. Get Paginated Users List
Fetches full user lists along with plan settings, ex-renewals, and profiles.
*   **Route:** `GET /api/admin/users/list`
*   **Query Parameters:**
    *   `page` (optional): Default `1`.
    *   `limit` (optional): Default `20`.
    *   `plan` (optional): Specific query tier filter (`free`, `plus`, or `premium`).
    *   `country` (optional): Group by user source territory.
    *   `status` (optional): Active status indicators (`active` or `expired`).
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" "http://localhost:3000/api/admin/users/list?page=1&limit=2"
    ```
*   **Response (200 OK):**
    ```json
    {
      "currentPage": 1,
      "totalPages": 750,
      "totalUsers": 1500,
      "limit": 2,
      "users": [
        {
          "id": "usr_uuid_1",
          "email": "trader_1@firstlook.com",
          "username": "trader_1",
          "full_name": "Chinelo Okonkwo",
          "country": "Nigeria",
          "experience_level": "INTERMEDIATE",
          "created_at": "2026-06-04T23:06:29.000Z",
          "plan": "premium",
          "subscription_expiry": 1783296000000,
          "is_recurring": true
        }
      ]
    }
    ```

### 3. Get User Demographics
Provides structural user aggregations by product plan type and territory.
*   **Route:** `GET /api/admin/users/demographics`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/users/demographics
    ```
*   **Response (200 OK):**
    ```json
    {
      "plans": {
        "free": 1000,
        "plus": 350,
        "premium": 150
      },
      "countries": {
        "Nigeria": 650,
        "Ghana": 210,
        "Kenya": 180,
        "South Africa": 120,
        "Other": 340
      }
    }
    ```

### 4. Get User Growth Curves
Returns series charts grouped daily, weekly, monthly and yearly for registrations analysis.
*   **Route:** `GET /api/admin/users/growth`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/users/growth
    ```
*   **Response (200 OK):**
    ```json
    {
      "daily": [
        { "date": "2026-06-04", "count": 25 }
      ],
      "weekly": [
        { "date": "2026-06-04", "count": 25 }
      ],
      "monthly": [
        { "month": "2026-06", "count": 520 }
      ],
      "yearly": [
        { "month": "2026-06", "count": 520 }
      ]
    }
    ```

---

## Subscription Analytics Endpoints

### 1. Get Subscription Overview
Returns key metrics about subscription activations, expirations, cancels, and active renewals this month.
*   **Route:** `GET /api/admin/subscriptions/overview`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/subscriptions/overview
    ```
*   **Response (200 OK):**
    ```json
    {
      "active_subscriptions": 500,
      "expired_subscriptions": 50,
      "renewed_this_month": 120,
      "cancelled_this_month": 15
    }
    ```

### 2. Get Expiring Subscriptions
Lists active subscribers whose subscription expires in less than **7 days** and have automatic renewals disabled.
*   **Route:** `GET /api/admin/subscriptions/expiring`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/subscriptions/expiring
    ```
*   **Response (200 OK):**
    ```json
    [
      {
        "id": "usr_uuid_10",
        "email": "trader_10@firstlook.com",
        "username": "trader_10",
        "full_name": "Amani Njoroge",
        "country": "Kenya",
        "plan": "plus",
        "expiry": 1783857600000
      }
    ]
    ```

---

## Consolidated Dashboard Endpoint

### 1. Get Consolidated Dashboard Summary
A high-performance aggregator API designed to yield all critical metrics in a singular request load for primary dashboard renders.
*   **Route:** `GET /api/admin/dashboard`
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/dashboard
    ```
*   **Response (200 OK):**
    ```json
    {
      "financials": {
        "today_payment": 125.50,
        "week_payment": 850.00,
        "month_payment": 3200.00,
        "year_payment": 15400.00,
        "overall_payment": 28500.00,
        "currency": "USD"
      },
      "users": {
        "total_users": 1500,
        "active_users": 1120,
        "free_users": 1000,
        "plus_users": 350,
        "premium_users": 150,
        "new_users_today": 25,
        "new_users_this_week": 130,
        "new_users_this_month": 520
      },
      "subscriptions": {
        "active_subscriptions": 500,
        "expired_subscriptions": 50,
        "renewed_this_month": 120,
        "cancelled_this_month": 15
      },
      "revenueTrend": [
        { "date": "2026-06-04", "revenue": 125.50 }
      ],
      "expiringUsersCount": 3
    }
    ```

---

## Audit Logs Verification Endpoints

### 1. Get Audit Logs
Lists administrative API requests and signature tracking logs in descending chronological direction.
*   **Route:** `GET /api/admin/audit-logs`
*   **Query Parameters:**
    *   `limit` (optional): Default `100`. Limits requested logged history database queries.
*   **Request Example:**
    ```bash
    curl -H "Authorization: Bearer YOUR_FOREX_API_SECRET" http://localhost:3000/api/admin/audit-logs?limit=5
    ```
*   **Response (200 OK):**
    ```json
    [
      {
        "id": "audit_uuid_10293021",
        "endpoint": "/api/admin/dashboard",
        "method": "GET",
        "query_params": {},
        "ip_address": "127.0.0.1",
        "status_code": 200,
        "created_at": "2026-06-04T23:30:11.000Z"
      }
    ]
    ```

---

## Platform Diagnostics & Troubleshooting

*   **Zero-Dependency Fallback:** In the absence of an active CockroachDB cluster URL, the server operates on a fully functional, auto-seeded in-memory transaction replica. No data queries will crash or yield mock gaps during sandbox demonstrations.
*   **Secure Secrets Configuration:** The `FOREX_API_SECRET` can be configured easily through your workspace Secrets panel directly.
