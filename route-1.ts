// src/app/api/schools/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken } from '@/lib/auth';
import { errorResponse } from '@/middleware/auth.middleware';
import { sendEmail } from '@/lib/email';

const registerSchema = z.object({
  schoolName: z.string().min(3, 'School name must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Invalid phone number'),
  address: z.string().min(10, 'Please provide a complete address'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  country: z.string().default('US'),
  principalName: z.string().min(3, 'Principal name is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    // Check if school email already exists
    const existing = await prisma.school.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      return errorResponse('An account with this email already exists', 409);
    }

    const passwordHash = await hashPassword(data.password);
    const emailVerifyToken = generateToken();

    // Create school + admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create school
      const school = await tx.school.create({
        data: {
          name: data.schoolName,
          email: data.email.toLowerCase(),
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          principalName: data.principalName,
          status: 'PENDING',
        },
      });

      // Create school admin user
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          role: 'SCHOOL_ADMIN',
          firstName: data.principalName.split(' ')[0],
          lastName: data.principalName.split(' ').slice(1).join(' ') || 'Admin',
          phone: data.phone,
          schoolId: school.id,
          emailVerifyToken,
        },
      });

      // Create trial subscription
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial

      await tx.subscription.create({
        data: {
          schoolId: school.id,
          plan: 'BASIC',
          status: 'TRIAL',
          maxStudents: 50,
          maxTeachers: 5,
          storageGb: 2,
          trialEndsAt: trialEnd,
        },
      });

      return { school, user };
    });

    // Send notification to super admin
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (superAdmin) {
      await sendEmail({
        to: superAdmin.email,
        subject: `New School Registration: ${data.schoolName}`,
        html: `
          <h2>New School Registration Pending Approval</h2>
          <p><strong>School Name:</strong> ${data.schoolName}</p>
          <p><strong>Principal:</strong> ${data.principalName}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          <p><strong>Address:</strong> ${data.address}, ${data.city}, ${data.state}</p>
          <br/>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/super-admin/schools/${result.school.id}">
            Review Registration
          </a>
        `,
      });
    }

    // Send confirmation to school
    await sendEmail({
      to: data.email,
      subject: 'Registration Received - Campus Prime',
      html: `
        <h2>Thank you for registering with Campus Prime!</h2>
        <p>Dear ${data.principalName},</p>
        <p>Your school registration for <strong>${data.schoolName}</strong> has been received and is pending review.</p>
        <p>Our team will review your application within 1-2 business days. You'll receive an email once your account is approved.</p>
        <br/>
        <p>Best regards,<br/>Campus Prime Team</p>
      `,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful! Your application is pending review.',
        data: { schoolId: result.school.id },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400);
    }
    console.error('[School Register Error]', error);
    return errorResponse('Registration failed. Please try again.', 500);
  }
}
