import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { sendMailViaGraph } from '@/lib/graph';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const { email } = auth;

    // In a real implementation, this would:
    // 1. Generate a secure reset token
    // 2. Store it in database with expiration
    // 3. Send reset email with link
    // For now, we'll send a placeholder email

    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=PLACEHOLDER`;

    const emailResult = await sendMailViaGraph({
      to: [email],
      subject: 'Password Reset Request - Beacon Service Desk',
      htmlBody: `
        <p>You requested a password reset for your Beacon account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      textBody: `You requested a password reset. Visit: ${resetLink}`,
    });

    if (!emailResult.ok) {
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Password reset email sent to ${email}. Please check your inbox and follow the instructions.`,
      success: true,
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process password reset' },
      { status: 500 }
    );
  }
}

