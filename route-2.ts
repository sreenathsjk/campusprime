// src/app/api/super-admin/schools/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  withAuth,
  successResponse,
  errorResponse,
  paginatedResponse,
} from '@/middleware/auth.middleware';

// GET - List all schools
export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { principalName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        include: {
          subscription: true,
          _count: {
            select: { students: true, teachers: true, users: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.school.count({ where }),
    ]);

    return paginatedResponse(schools, total, page, pageSize);
  }, ['SUPER_ADMIN']);
}

// src/app/api/super-admin/schools/[id]/status/route.ts
// PATCH - Update school status
export async function PATCH(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    const body = await req.json();
    const { schoolId, status, rejectionReason, plan } = body;

    if (!schoolId || !status) {
      return errorResponse('schoolId and status are required');
    }

    const validStatuses = ['APPROVED', 'REJECTED', 'ON_HOLD', 'SUSPENDED', 'PENDING'];
    if (!validStatuses.includes(status)) {
      return errorResponse('Invalid status');
    }

    const updateData: any = {
      status,
      rejectionReason: rejectionReason || null,
    };

    if (status === 'APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = user.userId;
    }

    const school = await prisma.school.update({
      where: { id: schoolId },
      data: updateData,
      include: { subscription: true },
    });

    // Update subscription if plan provided
    if (plan && status === 'APPROVED') {
      const planLimits = {
        BASIC: { maxStudents: 200, maxTeachers: 20, storageGb: 10 },
        PRO: { maxStudents: 1000, maxTeachers: 100, storageGb: 50 },
        ENTERPRISE: { maxStudents: 99999, maxTeachers: 9999, storageGb: 500 },
      } as any;

      await prisma.subscription.update({
        where: { schoolId },
        data: {
          plan,
          status: 'ACTIVE',
          ...planLimits[plan],
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });
    }

    // Send email notification to school
    const { sendEmail } = await import('@/lib/email');
    const adminUser = await prisma.user.findFirst({
      where: { schoolId, role: 'SCHOOL_ADMIN' },
    });

    if (adminUser) {
      const emailContent: Record<string, { subject: string; message: string }> = {
        APPROVED: {
          subject: '🎉 Your School Has Been Approved - Campus Prime',
          message: `Congratulations! Your school <strong>${school.name}</strong> has been approved. You can now log in and start setting up your school.`,
        },
        REJECTED: {
          subject: 'Registration Update - Campus Prime',
          message: `We regret to inform you that your school registration was not approved. Reason: ${rejectionReason || 'Not specified'}`,
        },
        ON_HOLD: {
          subject: 'Account on Hold - Campus Prime',
          message: 'Your school account has been placed on hold. Please contact support for more information.',
        },
        SUSPENDED: {
          subject: 'Account Suspended - Campus Prime',
          message: 'Your school account has been suspended. Please contact support.',
        },
      };

      const content = emailContent[status];
      if (content) {
        await sendEmail({
          to: adminUser.email,
          subject: content.subject,
          html: `<p>${content.message}</p><br/><p>Campus Prime Team</p>`,
        });
      }
    }

    return successResponse(school);
  }, ['SUPER_ADMIN']);
}
