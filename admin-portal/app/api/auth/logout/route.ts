import { NextResponse } from 'next/server';

export async function POST() {
  const cookieName = process.env.ADMIN_JWT_COOKIE_NAME || 'salonpro_admin_token';
  const res = NextResponse.json({ success: true });
  
  res.cookies.set(cookieName, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  
  return res;
}
