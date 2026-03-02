// src/middleware/auth.middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, JWTPayload } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

// ============================================
// RATE LIMITING (In-memory for demo; use Redis in prod)
// ============================================

const rateLimit = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(limit = 100, windowMs = 15 * 60 * 1000) {
  return (identifier: string): boolean => {
    const now = Date.now();
    const entry = rateLimit.get(identifier);

    if (!entry || entry.resetAt < now) {
      rateLimit.set(identifier, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  };
}

export const apiRateLimiter = rateLimiter(100, 15 * 60 * 1000);
export const authRateLimiter = rateLimiter(5, 15 * 60 * 1000);

// ============================================
// AUTH MIDDLEWARE
// ============================================

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, user: JWTPayload) => Promise<NextResponse>,
  allowedRoles?: UserRole[]
): Promise<NextResponse> {
  // Rate limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  if (!apiRateLimiter(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Extract token
  const authHeader = request.headers.get('authorization');
  const cookieToken = request.cookies.get('access_token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Verify token
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Check roles
  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Check school status (for school-scoped users)
  if (payload.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: payload.schoolId },
      include: { subscription: true },
    });

    if (!school || school.status !== 'APPROVED') {
      return NextResponse.json({ error: 'School access denied' }, { status: 403 });
    }

    if (school.subscription?.status === 'EXPIRED') {
      return NextResponse.json({ error: 'Subscription expired' }, { status: 402 });
    }
  }

  return handler(request, payload);
}

// ============================================
// TENANT ISOLATION HELPER
// ============================================

export function assertSchoolAccess(userPayload: JWTPayload, targetSchoolId: string): void {
  if (userPayload.role === UserRole.SUPER_ADMIN) return; // Super admin can access all
  if (userPayload.schoolId !== targetSchoolId) {
    throw new Error('Access denied: cross-tenant access not allowed');
  }
}

// ============================================
// RESPONSE HELPERS
// ============================================

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// ============================================
// SECURITY HEADERS
// ============================================

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  return response;
}
