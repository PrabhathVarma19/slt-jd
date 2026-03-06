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

interface GraphSiteResponse {
  id?: string;
}

interface GraphDrive {
  id: string;
  name: string;
}

interface GraphDriveListResponse {
  value?: GraphDrive[];
}

interface GraphDriveItem {
  id: string;
  name: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  '@microsoft.graph.downloadUrl'?: string;
}

interface GraphDriveChildrenResponse {
  value?: GraphDriveItem[];
  '@odata.nextLink'?: string;
}

export interface SharePointFileRef {
  id: string;
  name: string;
  downloadUrl: string;
  mimeType: string;
}

export function getGraphConfigError(): string | null {
  if (!tenantId || !clientId || !clientSecret || !senderUpn) {
    return 'Missing Graph configuration. Please set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and GRAPH_SENDER_UPN.';
  }
  return null;
}

export async function getGraphAccessToken(): Promise<string> {
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

async function graphGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Graph request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

function encodeGraphPath(pathValue: string): string {
  return pathValue
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeFolderPath(folderPath?: string | null): string | null {
  if (!folderPath) return null;
  const normalized = folderPath.replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, '');
  return normalized || null;
}

export async function getSharePointSiteId(siteUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    throw new Error('Invalid SharePoint site URL.');
  }

  const sitePath = parsed.pathname.replace(/\/+$/g, '');
  if (!sitePath || sitePath === '/') {
    throw new Error('SharePoint site URL must include a site path (example: /sites/assurance).');
  }

  const token = await getGraphAccessToken();
  const endpoint = `https://graph.microsoft.com/v1.0/sites/${parsed.hostname}:${sitePath}`;
  const site = await graphGet<GraphSiteResponse>(endpoint, token);

  if (!site.id) {
    throw new Error('Unable to resolve SharePoint site ID from the provided URL.');
  }

  return site.id;
}

export async function getSharePointDriveId(siteId: string, libraryName: string): Promise<string> {
  const trimmedName = libraryName.trim();
  if (!trimmedName) {
    throw new Error('Library name is required to resolve drive ID.');
  }

  const token = await getGraphAccessToken();
  const endpoint = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drives`;
  const drives = await graphGet<GraphDriveListResponse>(endpoint, token);

  const match = (drives.value || []).find(
    (drive) => drive.name?.toLowerCase() === trimmedName.toLowerCase()
  );

  if (!match?.id) {
    throw new Error(`Drive not found for library: ${trimmedName}`);
  }

  return match.id;
}

async function listDriveFolderFiles(
  siteId: string,
  driveId: string,
  token: string,
  folderItemId?: string
): Promise<SharePointFileRef[]> {
  const files: SharePointFileRef[] = [];
  const basePath = folderItemId ? `/items/${encodeURIComponent(folderItemId)}/children` : '/root/children';
  const params = new URLSearchParams({
    '$select': 'id,name,file,folder,@microsoft.graph.downloadUrl',
    '$top': '200',
  });

  let nextUrl = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}${basePath}?${params.toString()}`;

  while (nextUrl) {
    const page = await graphGet<GraphDriveChildrenResponse>(nextUrl, token);

    for (const item of page.value || []) {
      if (item.folder) {
        const nested = await listDriveFolderFiles(siteId, driveId, token, item.id);
        files.push(...nested);
        continue;
      }

      const downloadUrl = item['@microsoft.graph.downloadUrl'];
      if (!item.file || !downloadUrl) {
        continue;
      }

      files.push({
        id: item.id,
        name: item.name,
        downloadUrl,
        mimeType: item.file.mimeType || '',
      });
    }

    nextUrl = page['@odata.nextLink'] || '';
  }

  return files;
}

export async function listSharePointFiles(
  siteId: string,
  driveId: string,
  folderPath?: string | null
): Promise<SharePointFileRef[]> {
  const token = await getGraphAccessToken();
  const normalizedFolderPath = normalizeFolderPath(folderPath);

  if (!normalizedFolderPath) {
    return listDriveFolderFiles(siteId, driveId, token);
  }

  const encodedPath = encodeGraphPath(normalizedFolderPath);
  const folderEndpoint = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/root:/${encodedPath}`;
  const folder = await graphGet<GraphDriveItem>(folderEndpoint, token);

  if (!folder.id || !folder.folder) {
    throw new Error(`Folder path not found in drive: ${normalizedFolderPath}`);
  }

  return listDriveFolderFiles(siteId, driveId, token, folder.id);
}

export async function downloadSharePointFileAsText(
  downloadUrl: string,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  const loweredMime = (mimeType || '').toLowerCase();
  const loweredName = fileName.toLowerCase();

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status})`);
  }

  const isTextFile =
    loweredMime.startsWith('text/') || loweredName.endsWith('.txt') || loweredName.endsWith('.md');

  const isDocxFile =
    loweredName.endsWith('.docx') ||
    loweredMime.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  const isPdfFile = loweredName.endsWith('.pdf') || loweredMime.includes('application/pdf');

  if (isTextFile) {
    const rawText = await response.text();
    const normalized = rawText.replace(/\r\n/g, '\n').trim();
    return normalized || null;
  }

  if (isDocxFile) {
    const mammoth = await import('mammoth');
    const buffer = Buffer.from(await response.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    const normalized = (result.value || '').replace(/\r\n/g, '\n').trim();
    return normalized || null;
  }

  if (isPdfFile) {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;
    const buffer = Buffer.from(await response.arrayBuffer());
    const result = await pdfParse(buffer);
    const normalized = (result?.text || '').replace(/\r\n/g, '\n').trim();
    return normalized || null;
  }

  return null;
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
