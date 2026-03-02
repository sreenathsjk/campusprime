// src/app/api/analytics/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, assertSchoolAccess, successResponse } from '@/middleware/auth.middleware';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'platform' | 'school'
    const schoolId = searchParams.get('schoolId') || user.schoolId;

    // ============================================
    // SUPER ADMIN - Platform Analytics
    // ============================================
    if (type === 'platform' && user.role === 'SUPER_ADMIN') {
      const [
        totalSchools,
        approvedSchools,
        pendingSchools,
        totalStudents,
        totalTeachers,
        schoolsByStatus,
        schoolsByPlan,
        recentRegistrations,
        monthlyGrowth,
      ] = await Promise.all([
        prisma.school.count(),
        prisma.school.count({ where: { status: 'APPROVED' } }),
        prisma.school.count({ where: { status: 'PENDING' } }),
        prisma.student.count(),
        prisma.teacher.count(),
        prisma.school.groupBy({ by: ['status'], _count: true }),
        prisma.subscription.groupBy({ by: ['plan'], _count: true }),
        prisma.school.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true, status: true, createdAt: true, principalName: true },
        }),
        // Monthly registrations for last 6 months
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('month', "createdAt") as month,
            COUNT(*) as count
          FROM "School"
          WHERE "createdAt" >= NOW() - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY month ASC
        `,
      ]);

      // Revenue calculation (based on active subscriptions)
      const activeSubscriptions = await prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { plan: true },
      });

      const planPrices = { BASIC: 49, PRO: 149, ENTERPRISE: 499 };
      const monthlyRevenue = activeSubscriptions.reduce(
        (sum, sub) => sum + (planPrices[sub.plan as keyof typeof planPrices] || 0),
        0
      );

      return successResponse({
        overview: {
          totalSchools,
          approvedSchools,
          pendingSchools,
          rejectedSchools: totalSchools - approvedSchools - pendingSchools,
          totalStudents,
          totalTeachers,
          monthlyRevenue,
          annualRevenue: monthlyRevenue * 12,
        },
        schoolsByStatus,
        schoolsByPlan,
        recentRegistrations,
        monthlyGrowth,
      });
    }

    // ============================================
    // SCHOOL DASHBOARD Analytics
    // ============================================
    if (schoolId) {
      assertSchoolAccess(user, schoolId);

      const [
        totalStudents,
        totalTeachers,
        totalClasses,
        todayAttendance,
        pendingFees,
        recentExams,
        announcements,
        subscription,
      ] = await Promise.all([
        prisma.student.count({ where: { schoolId, isActive: true } }),
        prisma.teacher.count({ where: { schoolId, isActive: true } }),
        prisma.class.count({ where: { schoolId, isActive: true } }),
        // Today's attendance rate
        prisma.attendance.groupBy({
          by: ['status'],
          where: {
            schoolId,
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
          _count: true,
        }),
        // Pending fee payments
        prisma.fee.aggregate({
          where: { schoolId, status: 'PENDING' },
          _count: true,
          _sum: { amount: true },
        }),
        // Recent exams
        prisma.exam.findMany({
          where: { schoolId },
          orderBy: { date: 'desc' },
          take: 5,
          include: { class: { select: { name: true } } },
        }),
        // Recent announcements
        prisma.announcement.findMany({
          where: { schoolId, isPublished: true },
          orderBy: { publishedAt: 'desc' },
          take: 5,
        }),
        // Subscription info
        prisma.subscription.findUnique({ where: { schoolId } }),
      ]);

      const presentCount = todayAttendance.find((a) => a.status === 'PRESENT')?._count || 0;
      const totalMarked = todayAttendance.reduce((sum, a) => sum + a._count, 0);

      return successResponse({
        overview: {
          totalStudents,
          totalTeachers,
          totalClasses,
          attendanceRate: totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0,
          pendingFeesCount: pendingFees._count,
          pendingFeesAmount: pendingFees._sum.amount || 0,
        },
        todayAttendance,
        recentExams,
        announcements,
        subscription: subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              maxStudents: subscription.maxStudents,
              maxTeachers: subscription.maxTeachers,
              usedStudents: totalStudents,
              usedTeachers: totalTeachers,
              endDate: subscription.endDate,
            }
          : null,
      });
    }

    return successResponse({});
  });
}
