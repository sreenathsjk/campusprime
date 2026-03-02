# 🎓 Campus Prime
### Multi-Tenant School Management SaaS Platform

![Campus Prime](https://img.shields.io/badge/Campus_Prime-v1.0.0-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=for-the-badge&logo=firebase)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=for-the-badge&logo=postgresql)
![License](https://img.shields.io/badge/License-Commercial-red?style=for-the-badge)

---

## 📌 What is Campus Prime?

**Campus Prime** is a production-ready, multi-tenant SaaS platform built to help schools manage their entire operations — from student enrollment to exam results — all in one place.

Each school gets its own **isolated data environment**. One platform, hundreds of schools.

---

## ✨ Features

### 👑 Super Admin Panel
- View & manage all registered schools
- Approve / Reject / Suspend schools
- Manage subscription plans
- Revenue & analytics dashboard

### 🏫 School Admin Panel
- Student management (add, edit, promote)
- Teacher management
- Class & subject setup
- Fee structure & payment tracking
- Announcement broadcasting

### 👨‍🏫 Teacher Panel
- Mark daily attendance
- Enter exam marks
- View assigned classes & schedules

### 👨‍🎓 Student Panel
- View attendance records
- View exam results & report cards
- View announcements

### 👨‍👩‍👧 Parent Panel
- Track child's attendance
- View fee payment status
- Receive school announcements

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + ShadCN UI |
| Database | PostgreSQL + Prisma ORM |
| Realtime | Firebase Firestore |
| Storage | Firebase Storage |
| Auth | JWT + bcrypt |
| Email | Nodemailer (SMTP) |
| Deployment | Vercel |
| Container | Docker + Nginx |

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/campus-prime.git
cd campus-prime
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

### 4. Set up the database
```bash
npm run db:migrate
npm run db:seed
```

### 5. Start development server
```bash
npm run dev
```

Visit **http://localhost:3000** 🎉

---

## 🔐 Default Login Credentials

> After running the seed script, use these to log in:

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@campusprime.com | SuperAdmin@123! |
| School Admin | admin@greenvalley.edu | School@123! |
| Teacher | mchen@greenvalley.edu | Teacher@123! |
| Student | student1@greenvalley.edu | Student@123! |

---

## 📁 Project Structure

```
campus-prime/
├── prisma/
│   └── schema.prisma        # Database schema (19 tables)
├── src/
│   ├── app/
│   │   ├── api/             # All API routes
│   │   └── (dashboard)/     # Dashboard pages per role
│   ├── lib/
│   │   ├── auth.ts          # JWT + sessions
│   │   ├── firebase.ts      # Firebase client
│   │   ├── firebase-admin.ts # Firebase server
│   │   ├── firestore.service.ts # All DB operations
│   │   └── email.ts         # Email templates
│   ├── middleware/
│   │   └── auth.middleware.ts # RBAC + rate limiting
│   └── hooks/
│       └── useNotifications.ts # Real-time notifications
├── scripts/
│   └── seed.ts              # Database seeding
├── firestore.rules          # Firestore security rules
├── storage.rules            # Firebase Storage rules
├── docker-compose.yml       # Production deployment
├── Dockerfile               # Multi-stage build
└── .env.example             # Environment template
```

---

## 🌐 API Routes

```
POST   /api/auth/login              Login
POST   /api/auth/logout             Logout
POST   /api/schools/register        Register new school
GET    /api/super-admin/schools     List all schools
PATCH  /api/super-admin/schools     Update school status
GET    /api/students                List students
POST   /api/students                Add student
GET    /api/teachers                List teachers
POST   /api/teachers                Add teacher
GET    /api/attendance              Get attendance
POST   /api/attendance              Mark attendance
GET    /api/fees                    List fees
POST   /api/fees/pay                Record payment
GET    /api/exams                   List exams
POST   /api/results                 Enter marks
GET    /api/analytics               Dashboard analytics
```

---

## 💳 Subscription Plans

| Feature | Basic | Pro | Enterprise |
|---|---|---|---|
| Price | $49/mo | $149/mo | $499/mo |
| Students | 200 | 1,000 | Unlimited |
| Teachers | 20 | 100 | Unlimited |
| Storage | 5 GB | 50 GB | 500 GB |
| Parent Portal | ❌ | ✅ | ✅ |
| SMS Alerts | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |

---

## 🔒 Security

- ✅ Multi-tenant data isolation (per school)
- ✅ JWT authentication (15min access + 7day refresh)
- ✅ Role-based access control (RBAC)
- ✅ Rate limiting (100 req/15min general, 5 req/15min auth)
- ✅ Password hashing (bcrypt, cost 12)
- ✅ Input validation (Zod schemas)
- ✅ Secure HTTP headers
- ✅ Firestore security rules
- ✅ Firebase Storage rules

---

## ☁️ Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import repo on vercel.com
3. Add environment variables
4. Deploy ✅

### Docker
```bash
docker-compose up -d --build
```

---

## 🔥 Firebase Setup

1. Create project at console.firebase.google.com
2. Enable Firestore & Storage
3. Download service account key
4. Add Firebase config to `.env.local`
5. Deploy security rules:
```bash
firebase deploy --only firestore:rules,storage
```

---

## 📞 Support

- 📧 Email: support@campusprime.com
- 📖 Docs: docs.campusprime.com
- 🐛 Issues: GitHub Issues tab

---

## 📄 License

This is a **commercial product**. All rights reserved © 2025 Campus Prime.

---

<p align="center">Built with ❤️ for educators everywhere</p>
