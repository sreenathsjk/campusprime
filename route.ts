// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';
import { authRateLimiter, errorResponse } from '@/middleware/auth.middleware';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';

  // Rate limit auth attempts
  if (!authRateLimiter(ip)) {
    return errorResponse('Too many login attempts. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        school: {
          include: { subscription: true },
        },
      },
    });

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    if (!user.isActive) {
      return errorResponse('Your account has been deactivated', 401);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return errorResponse('Invalid email or password', 401);
    }

    // Check school status for school users
    if (user.schoolId && user.school) {
      if (user.school.status !== 'APPROVED') {
        const statusMessages: Record<string, string> = {
          PENDING: 'Your school registration is pending approval.',
          REJECTED: 'Your school registration was rejected.',
          ON_HOLD: 'Your school account is on hold. Please contact support.',
          SUSPENDED: 'Your school account has been suspended.',
        };
        return errorResponse(
          statusMessages[user.school.status] || 'School access denied',
          403
        );
      }

      if (user.school.subscription?.status === 'EXPIRED') {
        return errorResponse('Your subscription has expired. Please renew to continue.', 402);
      }
    }

    // Create session
    const { accessToken, refreshToken } = await createSession(
      user.id,
      ip,
      req.headers.get('user-agent') || undefined
    );

    // Set cookies
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          schoolId: user.schoolId,
          avatar: user.avatar,
        },
        accessToken,
      },
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookies.set('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60, // 15 minutes
    });

    response.cookies.set('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400);
    }
    console.error('[Login Error]', error);
    return errorResponse('An error occurred during login', 500);
  }
}
