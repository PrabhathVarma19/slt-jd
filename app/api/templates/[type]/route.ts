import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getPublishedTemplate } from '@/lib/comms/templates';
import { CommsTemplateType } from '@/types/comms-templates';

const TEMPLATE_TYPES: CommsTemplateType[] = [
  'security_advisory',
  'it_incident',
  'policy_update',
  'travel_advisory',
  'leadership_update',
];

export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    await requireAuth();
    const type = params.type as CommsTemplateType;
    if (!TEMPLATE_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid template type' }, { status: 400 });
    }

    const template = await getPublishedTemplate(type);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Template fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
      { status: 500 }
    );
  }
}
