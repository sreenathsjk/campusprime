# Campus Prime — Complete Development & Deployment Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   CAMPUS PRIME SAAS                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │  Next.js    │    │  API Routes  │    │  Prisma    │  │
│  │  Frontend   │───▶│  (Auth,      │───▶│    ORM     │  │
│  │  (App Dir)  │    │  CRUD, etc.) │    │            │  │
│  └─────────────┘    └──────────────┘    └─────┬──────┘  │
│                                                │         │
│  ┌─────────────┐    ┌──────────────┐    ┌─────▼──────┐  │
│  │  JWT Auth   │    │  Multi-Tenant│    │ PostgreSQL  │  │
│  │  + Sessions │    │  Isolation   │    │  Database   │  │
│  └─────────────┘    └──────────────┘    └────────────┘  │
│                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │   Nodemailer│    │   Redis      │    │  Docker    │  │
│  │   (Email)   │    │  (Rate Limit)│    │  + Nginx   │  │
│  └─────────────┘    └──────────────┘    └────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## User Role Hierarchy

```
Super Admin (You)
│   ├── View ALL schools and data
│   ├── Approve/Reject/Suspend schools
│   ├── Manage subscriptions & billing
│   └── Platform analytics
│
School Admin (Per School)
│   ├── Manage students and teachers
│   ├── Configure fee structures
│   ├── View school analytics
│   └── Send announcements
│
Teacher
│   ├── Mark attendance
│   ├── Enter exam marks
│   └── View assigned classes
│
Student
│   ├── View own attendance
│   ├── View results
│   └── View announcements
│
Parent
│   ├── View child's attendance
│   ├── View child's results
│   └── View fee status
```

## Project File Structure

```
campus-prime/
├── prisma/
│   ├── schema.prisma          ← Complete DB schema (multi-tenant)
│   └── migrations/            ← Auto-generated migrations
│
├── src/
│   ├── app/
│   │   ├── (landing)/         ← Public pages (SSG)
│   │   │   └── page.tsx       ← Landing page
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/
│   │   │   ├── super-admin/   ← Super admin pages
│   │   │   ├── school-admin/  ← School admin pages
│   │   │   ├── teacher/       ← Teacher pages
│   │   │   ├── student/       ← Student pages
│   │   │   └── parent/        ← Parent pages
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── refresh/route.ts
│   │       │   └── forgot-password/route.ts
│   │       ├── super-admin/
│   │       │   └── schools/route.ts
│   │       ├── schools/
│   │       │   └── register/route.ts
│   │       ├── students/route.ts
│   │       ├── teachers/route.ts
│   │       ├── attendance/route.ts
│   │       ├── fees/route.ts
│   │       ├── exams/route.ts
│   │       └── analytics/route.ts
│   │
│   ├── components/
│   │   ├── ui/                ← ShadCN base components
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── StatCard.tsx
│   │   └── landing/
│   │       ├── Hero.tsx
│   │       └── PricingCard.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts          ← DB singleton
│   │   ├── auth.ts            ← JWT, sessions, password
│   │   └── email.ts           ← Nodemailer + templates
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts ← Auth, RBAC, rate limiting
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useAnalytics.ts
│   │
│   └── types/
│       └── index.ts           ← TypeScript type definitions
│
├── scripts/
│   └── seed.ts                ← Database seeding
│
├── docker/
│   ├── nginx.conf
│   └── init.sql
│
├── .env.example               ← Environment template
├── docker-compose.yml         ← Production deployment
├── Dockerfile                 ← Multi-stage build
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## Database Schema Overview

### Core Tables

| Table           | Purpose                            |
|----------------|-------------------------------------|
| User           | All users (all roles)               |
| Session        | JWT session tracking                |
| School         | Tenant — one row per school         |
| Subscription   | SaaS plan per school                |
| Class          | Grade/section combos                |
| Subject        | Academic subjects                   |
| Teacher        | Teacher profiles (extends User)     |
| Student        | Student profiles (extends User)     |
| Parent         | Parent profiles (extends User)      |
| Schedule       | Class timetable                     |
| Attendance     | Daily attendance records            |
| FeeStructure   | Fee types and amounts               |
| Fee            | Individual student fee records      |
| Payment        | Payment transactions                |
| Exam           | Exam definitions                    |
| Result         | Student exam results                |
| Announcement   | School communications               |
| AuditLog       | Full audit trail                    |
| Notification   | In-app notifications                |

### Multi-Tenant Isolation
Every table with school data has a `schoolId` field.
All queries are scoped with `WHERE schoolId = ?`.
The `assertSchoolAccess()` middleware enforces this.

## API Routes Reference

### Authentication
```
POST /api/auth/login          - Login with email+password
POST /api/auth/logout         - Invalidate session
POST /api/auth/refresh        - Refresh access token
POST /api/auth/forgot-password - Send reset email
POST /api/auth/reset-password  - Reset with token
POST /api/auth/verify-email    - Verify email address
```

### Super Admin
```
GET  /api/super-admin/schools           - List all schools (paginated)
PATCH /api/super-admin/schools          - Update school status/plan
DELETE /api/super-admin/schools/:id     - Delete school
GET  /api/analytics?type=platform      - Platform analytics
GET  /api/super-admin/revenue          - Revenue dashboard
```

### School Registration
```
POST /api/schools/register  - Public school registration
```

### Students (School-scoped)
```
GET    /api/students        - List students (paginated, filtered)
POST   /api/students        - Create student + user account
GET    /api/students/:id    - Student detail
PATCH  /api/students/:id    - Update student
DELETE /api/students/:id    - Deactivate student
POST   /api/students/promote - Promote to next class
```

### Teachers
```
GET    /api/teachers        - List teachers
POST   /api/teachers        - Add teacher
PATCH  /api/teachers/:id    - Update teacher
```

### Attendance
```
GET  /api/attendance        - Get attendance (by class/date/student)
POST /api/attendance        - Mark attendance (bulk)
GET  /api/attendance/report - Attendance report (CSV export)
```

### Fees
```
GET  /api/fees              - List fees/due payments
POST /api/fees              - Create fee record
POST /api/fees/pay          - Record payment + generate receipt
GET  /api/fees/receipt/:id  - Download receipt PDF
```

### Exams & Results
```
GET  /api/exams             - List exams
POST /api/exams             - Create exam
POST /api/results           - Enter/update marks (bulk)
POST /api/results/publish   - Publish results
GET  /api/results/report-card/:studentId - Download report card
```

### Analytics
```
GET /api/analytics?type=school&schoolId=xxx - School analytics
GET /api/analytics?type=platform          - Platform analytics (super admin)
```

## Subscription Plans

| Feature              | Basic  | Pro     | Enterprise |
|---------------------|--------|---------|------------|
| Price/Month         | $49    | $149    | $499       |
| Students            | 200    | 1,000   | Unlimited  |
| Teachers            | 20     | 100     | Unlimited  |
| Storage             | 5 GB   | 50 GB   | 500 GB     |
| Attendance          | ✓      | ✓       | ✓          |
| Fee Management      | Basic  | Full    | Full       |
| Exams & Results     | ✓      | ✓       | ✓          |
| Parent Portal       | ✗      | ✓       | ✓          |
| SMS Notifications   | ✗      | ✓       | ✓          |
| API Access          | ✗      | ✗       | ✓          |
| White Label         | ✗      | ✗       | ✓          |
| Dedicated Support   | ✗      | ✗       | ✓          |

## Security Implementation

### 1. Multi-Tenant Isolation
```typescript
// Every school-scoped query must use assertSchoolAccess()
assertSchoolAccess(userPayload, targetSchoolId);
// Throws if user tries to access another school's data
```

### 2. JWT Authentication
- Access tokens: 15-minute expiry (short-lived)
- Refresh tokens: 7-day expiry (httpOnly cookie)
- All tokens verified on every request via middleware

### 3. Password Security
- bcrypt with cost factor 12
- Password complexity enforced (uppercase, number, special char)
- Reset tokens expire in 1 hour

### 4. Rate Limiting
- General API: 100 requests / 15 minutes per IP
- Auth endpoints: 5 requests / 15 minutes per IP
- Production: Use Redis-backed rate limiting (ioredis)

### 5. Input Validation
- All inputs validated with Zod schemas
- TypeScript strict mode throughout

### 6. Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: ...
```

## Step-by-Step Setup

### 1. Clone & Install
```bash
git clone https://github.com/yourname/campus-prime.git
cd campus-prime
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

### 3. Database Setup
```bash
# Start PostgreSQL (or use Docker)
docker run -d --name campus-prime-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=campus_prime \
  -p 5432:5432 postgres:16-alpine

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 4. Development Server
```bash
npm run dev
# Visit http://localhost:3000
```

### 5. Login Credentials (after seed)
| Role         | Email                        | Password        |
|-------------|------------------------------|-----------------|
| Super Admin | admin@campusprime.com        | SuperAdmin@123! |
| School Admin| admin@greenvalley.edu        | School@123!     |
| Teacher     | mchen@greenvalley.edu        | Teacher@123!    |
| Student     | student1@greenvalley.edu     | Student@123!    |

## Production Deployment

### Option A: Docker Compose (Recommended)

```bash
# 1. Set production environment
cp .env.example .env.local
# Edit .env.local with production values

# 2. Build and deploy
docker-compose up -d --build

# 3. Run migrations
docker-compose exec app npx prisma migrate deploy

# 4. Seed (first time only)
docker-compose exec app npm run db:seed

# Logs
docker-compose logs -f app
```

### Option B: Vercel + Supabase

```bash
# 1. Push to GitHub
# 2. Connect to Vercel
# 3. Add all environment variables in Vercel dashboard
# 4. Use Supabase for PostgreSQL
# 5. Deploy automatically on push to main
```

### Option C: Railway / Render

Both platforms support Node.js + PostgreSQL with automatic deployments.

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name campusprime.com www.campusprime.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name campusprime.com www.campusprime.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Extending the Platform

### Adding CSV Import for Students
```typescript
// POST /api/students/import
// Uses papaparse to parse CSV
// Validates each row with Zod
// Creates users and students in bulk transaction
// Returns success/error summary
```

### Adding Stripe Billing
```typescript
// 1. Install stripe: npm install stripe
// 2. Add webhook handler: POST /api/webhooks/stripe
// 3. Handle events: customer.subscription.updated, invoice.payment_failed
// 4. Update Subscription table on webhook receipt
```

### Adding SMS (Twilio)
```typescript
import twilio from 'twilio';
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

await client.messages.create({
  body: `Attendance Alert: ${studentName} was absent today`,
  from: process.env.TWILIO_PHONE,
  to: parentPhone,
});
```

### Adding Report Card PDF
```typescript
// Use @react-pdf/renderer or puppeteer
// Template: Student info, Subject-wise marks, Grade, Attendance %
// Export: PDF download or email attachment
```

## Performance Optimizations

1. **Database Indexes** — Added on all foreign keys, status fields, and email
2. **Pagination** — All list endpoints paginated (default 20/page)
3. **Select fields** — Only fetch needed fields, not full objects
4. **Next.js Caching** — Static pages for landing, ISR for public data
5. **Connection pooling** — Prisma singleton prevents connection exhaustion
6. **Redis caching** — Cache analytics and dashboard counts (5-min TTL)

## Monitoring Checklist

- [ ] Set up Sentry for error tracking
- [ ] Configure Uptime Robot for availability monitoring
- [ ] Add Winston/Pino for structured logging
- [ ] Set up database backups (daily automated)
- [ ] Configure health check endpoint: GET /api/health
- [ ] Set up Grafana dashboard for metrics

---

**Campus Prime** — Built for scale. Ready to sell.
