// scripts/seed.ts
// Run with: npm run db:seed

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Campus Prime...\n');

  // ============================================
  // SUPER ADMIN
  // ============================================
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@campusprime.com';
  const existing = await prisma.user.findUnique({ where: { email: superAdminEmail } });

  if (!existing) {
    const passwordHash = await bcrypt.hash(
      process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123!',
      12
    );

    await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
        lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Admin',
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`✅ Super Admin created: ${superAdminEmail}`);
  } else {
    console.log(`⏭️  Super Admin already exists: ${superAdminEmail}`);
  }

  // ============================================
  // DEMO SCHOOL
  // ============================================
  const demoSchoolEmail = 'admin@greenvalley.edu';
  let school = await prisma.school.findUnique({ where: { email: demoSchoolEmail } });

  if (!school) {
    school = await prisma.school.create({
      data: {
        name: 'Green Valley Academy',
        email: demoSchoolEmail,
        phone: '+1-555-0100',
        address: '123 Education Blvd',
        city: 'Springfield',
        state: 'IL',
        country: 'US',
        zipCode: '62701',
        principalName: 'Dr. Sarah Johnson',
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });
    console.log(`✅ Demo school created: Green Valley Academy`);

    // Subscription
    await prisma.subscription.create({
      data: {
        schoolId: school.id,
        plan: 'PRO',
        status: 'ACTIVE',
        maxStudents: 1000,
        maxTeachers: 100,
        storageGb: 50,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // School Admin
    const schoolAdminHash = await bcrypt.hash('School@123!', 12);
    await prisma.user.create({
      data: {
        email: demoSchoolEmail,
        passwordHash: schoolAdminHash,
        role: 'SCHOOL_ADMIN',
        firstName: 'Sarah',
        lastName: 'Johnson',
        schoolId: school.id,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`✅ School Admin created: ${demoSchoolEmail} / School@123!`);

    // Subjects
    const subjects = await Promise.all(
      [
        { name: 'Mathematics', code: 'MATH101' },
        { name: 'English Language', code: 'ENG101' },
        { name: 'Science', code: 'SCI101' },
        { name: 'History', code: 'HIST101' },
        { name: 'Physical Education', code: 'PE101' },
        { name: 'Computer Science', code: 'CS101' },
      ].map((s) =>
        prisma.subject.create({
          data: { ...s, schoolId: school!.id },
        })
      )
    );
    console.log(`✅ ${subjects.length} subjects created`);

    // Classes
    const classes = await Promise.all(
      [
        { name: 'Grade 9-A', grade: 9, section: 'A', academicYear: '2024-2025' },
        { name: 'Grade 9-B', grade: 9, section: 'B', academicYear: '2024-2025' },
        { name: 'Grade 10-A', grade: 10, section: 'A', academicYear: '2024-2025' },
        { name: 'Grade 10-B', grade: 10, section: 'B', academicYear: '2024-2025' },
        { name: 'Grade 11-A', grade: 11, section: 'A', academicYear: '2024-2025' },
        { name: 'Grade 12-A', grade: 12, section: 'A', academicYear: '2024-2025' },
      ].map((c) =>
        prisma.class.create({
          data: { ...c, schoolId: school!.id, capacity: 30 },
        })
      )
    );
    console.log(`✅ ${classes.length} classes created`);

    // Teachers
    const teacherData = [
      { firstName: 'Michael', lastName: 'Chen', email: 'mchen@greenvalley.edu', employeeId: 'TCH001' },
      { firstName: 'Emily', lastName: 'Davis', email: 'edavis@greenvalley.edu', employeeId: 'TCH002' },
      { firstName: 'Robert', lastName: 'Wilson', email: 'rwilson@greenvalley.edu', employeeId: 'TCH003' },
    ];

    for (const t of teacherData) {
      const ph = await bcrypt.hash('Teacher@123!', 12);
      const u = await prisma.user.create({
        data: {
          email: t.email,
          passwordHash: ph,
          role: 'TEACHER',
          firstName: t.firstName,
          lastName: t.lastName,
          schoolId: school.id,
          isActive: true,
          emailVerified: true,
        },
      });
      await prisma.teacher.create({
        data: {
          userId: u.id,
          schoolId: school.id,
          employeeId: t.employeeId,
          joiningDate: new Date('2023-08-01'),
        },
      });
    }
    console.log(`✅ ${teacherData.length} teachers created (password: Teacher@123!)`);

    // Students (10 sample)
    for (let i = 1; i <= 10; i++) {
      const ph = await bcrypt.hash('Student@123!', 12);
      const u = await prisma.user.create({
        data: {
          email: `student${i}@greenvalley.edu`,
          passwordHash: ph,
          role: 'STUDENT',
          firstName: `Student`,
          lastName: `${i.toString().padStart(2, '0')}`,
          schoolId: school.id,
          isActive: true,
          emailVerified: true,
        },
      });
      await prisma.student.create({
        data: {
          userId: u.id,
          schoolId: school.id,
          admissionNo: `STU2024${i.toString().padStart(3, '0')}`,
          classId: classes[i % classes.length].id,
          gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
          admissionDate: new Date('2024-08-01'),
        },
      });
    }
    console.log(`✅ 10 sample students created (password: Student@123!)`);

    // Announcements
    await prisma.announcement.createMany({
      data: [
        {
          schoolId: school.id,
          title: 'Welcome Back to School!',
          content: 'We are excited to welcome all students and staff for the new academic year 2024-2025.',
          target: 'ALL',
        },
        {
          schoolId: school.id,
          title: 'Mid-Term Examinations Schedule',
          content: 'Mid-term exams will be held from October 15-22. Please review the schedule on the portal.',
          target: 'STUDENTS',
        },
        {
          schoolId: school.id,
          title: 'Parent-Teacher Meeting',
          content: 'Annual parent-teacher meeting scheduled for October 28. Please confirm your attendance.',
          target: 'PARENTS',
        },
      ],
    });
    console.log(`✅ Sample announcements created`);
  }

  console.log('\n🎉 Seeding complete!\n');
  console.log('📋 Login Credentials:');
  console.log('─'.repeat(50));
  console.log(`Super Admin: ${superAdminEmail}`);
  console.log(`Password: ${process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123!'}`);
  console.log(`\nSchool Admin: admin@greenvalley.edu`);
  console.log(`Password: School@123!`);
  console.log(`\nTeacher: mchen@greenvalley.edu`);
  console.log(`Password: Teacher@123!`);
  console.log(`\nStudent: student1@greenvalley.edu`);
  console.log(`Password: Student@123!`);
  console.log('─'.repeat(50));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
