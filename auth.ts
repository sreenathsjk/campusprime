// src/lib/auth.ts
// JWT Authentication & Password Utilities

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!);

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  sessionId: string;
}

// ============================================
// PASSWORD UTILITIES
// ============================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// JWT UTILITIES
// ============================================

export async function signAccessToken(payload: Omit<JWTPayload, 'sessionId'> & { sessionId: string }): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRY || '15m')
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: { userId: string; sessionId: string }): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRY || '7d')
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return payload as any;
  } catch {
    return null;
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { school: true },
  });

  if (!user) throw new Error('User not found');

  // Create DB session
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await prisma.session.create({
    data: {
      userId,
      token: crypto.randomUUID(),
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: userId },
    data: { lastLogin: new Date() },
  });

  const jwtPayload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    schoolId: user.schoolId || undefined,
    sessionId: session.id,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(jwtPayload),
    signRefreshToken({ userId, sessionId: session.id }),
  ]);

  return { accessToken, refreshToken };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

// ============================================
// CURRENT USER (Server Component)
// ============================================

export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true },
    include: {
      school: {
        include: { subscription: true },
      },
    },
  });

  if (!user) return null;

  // Check school access
  if (user.schoolId && user.school) {
    if (user.school.status !== 'APPROVED') return null;
    if (user.school.subscription?.status === 'EXPIRED') return null;
  }

  return user;
}

export async function requireAuth(roles?: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  if (roles && !roles.includes(user.role)) throw new Error('FORBIDDEN');
  return user;
}

// ============================================
// EMAIL VERIFICATION
// ============================================

export function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
