import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const response = await axios.post(`${API_URL}/api/admin/login`, {
      email,
      password,
    });

    const { token, expiresIn } = response.data;
    const cookieName = process.env.ADMIN_JWT_COOKIE_NAME || 'salonpro_admin_token';

    const res = NextResponse.json({ success: true, token });
    
    // Store in httpOnly cookie
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn || 86400, // default 1 day
    });

    return res;
  } catch (error: any) {
    console.error('Authentication proxy error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.msg || 'Authentication failed';
    return NextResponse.json({ msg: message }, { status });
  }
}
