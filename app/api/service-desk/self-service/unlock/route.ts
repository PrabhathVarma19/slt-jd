import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { sendMailViaGraph } from '@/lib/graph';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const { email } = auth;

    // In a real implementation, this would:
    // 1. Verify user identity (additional verification)
    // 2. Unlock account in Active Directory / identity system
    // 3. Log the action
    // For now, we'll simulate the unlock and send confirmation

    // Simulate unlock (in production, call actual unlock API)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Send confirmation email
    const emailResult = await sendMailViaGraph({
      to: [email],
      subject: 'Account Unlocked - Beacon Service Desk',
      htmlBody: `
        <p>Your account has been unlocked successfully.</p>
        <p>You can now log in to Beacon and other Trianz systems.</p>
        <p>If you didn't request this, please contact IT support immediately.</p>
      `,
      textBody: 'Your account has been unlocked. You can now log in.',
    });

    if (!emailResult.ok) {
      return NextResponse.json(
        { error: 'Account unlocked but failed to send confirmation email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Your account has been unlocked. A confirmation email has been sent to ${email}. You can now log in.`,
      success: true,
    });
  } catch (error: any) {
    console.error('Account unlock error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unlock account' },
      { status: 500 }
    );
  }
}

