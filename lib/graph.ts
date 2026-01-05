const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const senderUpn = process.env.GRAPH_SENDER_UPN;

export interface GraphMailOptions {
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string[];
}

export function getGraphConfigError(): string | null {
  if (!tenantId || !clientId || !clientSecret || !senderUpn) {
    return 'Missing Graph configuration. Please set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and GRAPH_SENDER_UPN.';
  }
  return null;
}

async function getGraphAccessToken(): Promise<string> {
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Graph configuration is incomplete.');
  }

  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('scope', 'https://graph.microsoft.com/.default');
  params.set('grant_type', 'client_credentials');

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to obtain Graph token (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('Graph token response did not contain access_token.');
  }

  return json.access_token;
}

export async function sendMailViaGraph(options: GraphMailOptions): Promise<{ ok: boolean; error?: string }> {
  const configError = getGraphConfigError();
  if (configError) {
    return { ok: false, error: configError };
  }

  if (!senderUpn) {
    return { ok: false, error: 'GRAPH_SENDER_UPN is not configured.' };
  }

  if (!options.to || options.to.length === 0) {
    return { ok: false, error: 'No recipients provided for Graph email.' };
  }

  try {
    const token = await getGraphAccessToken();

    const message = {
      message: {
        subject: options.subject,
        body: {
          contentType: 'HTML',
          content: options.htmlBody,
        },
        toRecipients: options.to.map((address) => ({
          emailAddress: { address },
        })),
        ccRecipients: (options.cc || []).map((address) => ({
          emailAddress: { address },
        })),
        replyTo: (options.replyTo || []).map((address) => ({
          emailAddress: { address },
        })),
      },
      saveToSentItems: true,
    };

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUpn)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        error: `Graph sendMail failed (${res.status}): ${body}`,
      };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Graph sendMail error:', error);
    return { ok: false, error: error?.message || 'Unknown Graph error' };
  }
}
