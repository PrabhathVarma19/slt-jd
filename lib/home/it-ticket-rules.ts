export type ItTicketCategory =
  | 'vpn_access'
  | 'subscription'
  | 'software_install'
  | 'hardware_request'
  | 'network_issue'
  | 'password_account'
  | 'general';

export type ItTicketDraftLike = {
  requestType?: string;
  system?: string;
  impact?: string;
  reason?: string;
  details?: string;
  durationType?: string;
  durationUntil?: string;
};

export type ItTicketEvaluation = {
  category: ItTicketCategory;
  missingFields: string[];
};

const HARDWARE_KEYWORDS = [
  'laptop',
  'monitor',
  'mouse',
  'keyboard',
  'headset',
  'dock',
  'docking',
  'charger',
];

const NETWORK_KEYWORDS = [
  'network',
  'wifi',
  'wi-fi',
  'lan',
  'internet',
  'connectivity',
  'packet loss',
  'latency',
  'vpn not working',
];

const PASSWORD_KEYWORDS = ['password', 'reset', 'unlock', 'account locked', 'login issue'];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasDurationValue(durationType?: string, durationUntil?: string) {
  return !!(durationType || '').trim() || !!(durationUntil || '').trim();
}

export function detectItTicketCategory(draft: ItTicketDraftLike): ItTicketCategory {
  const requestType = (draft.requestType || '').toString().trim().toLowerCase();
  const system = (draft.system || '').toString().trim().toLowerCase();
  const details = (draft.details || '').toString().trim().toLowerCase();
  const combined = `${system} ${details}`.trim();

  if (requestType === 'access' && system.includes('vpn')) return 'vpn_access';
  if (requestType === 'subscription') return 'subscription';
  if (requestType === 'software') return 'software_install';
  if (requestType === 'hardware' || includesAny(combined, HARDWARE_KEYWORDS)) {
    return 'hardware_request';
  }
  if (includesAny(combined, NETWORK_KEYWORDS)) return 'network_issue';
  if (requestType === 'password' || includesAny(combined, PASSWORD_KEYWORDS)) {
    return 'password_account';
  }
  return 'general';
}

export function evaluateItTicketDraft(
  draft: ItTicketDraftLike,
  options?: { reasonValid?: boolean }
): ItTicketEvaluation {
  const category = detectItTicketCategory(draft);
  const missingFields: string[] = [];

  const system = (draft.system || '').toString().trim();
  const reason = (draft.reason || '').toString().trim();
  const details = (draft.details || '').toString().trim();
  const impact = (draft.impact || '').toString().trim();
  const durationType = (draft.durationType || '').toString().trim();
  const durationUntil = (draft.durationUntil || '').toString().trim();
  const reasonValid = options?.reasonValid ?? !!reason;

  const requireDetails = category !== 'password_account';
  if (requireDetails && !details) missingFields.push('details');

  if (category === 'vpn_access') {
    if (!system) missingFields.push('system');
    if (!reasonValid) missingFields.push('reason');
    if (!hasDurationValue(durationType, durationUntil)) missingFields.push('durationType');
    if (durationType.toLowerCase() === 'temporary' && !durationUntil) {
      missingFields.push('durationUntil');
    }
  }

  if (category === 'subscription') {
    if (!system) missingFields.push('system');
    if (!reasonValid) missingFields.push('reason');
    if (!hasDurationValue(durationType, durationUntil)) missingFields.push('durationType');
    if (durationType.toLowerCase() === 'temporary' && !durationUntil) {
      missingFields.push('durationUntil');
    }
  }

  if (category === 'software_install') {
    if (!system) missingFields.push('system');
    if (!reasonValid) missingFields.push('reason');
  }

  if (category === 'hardware_request') {
    if (!system) missingFields.push('system');
    if (!reasonValid) missingFields.push('reason');
    if (!details) missingFields.push('details');
  }

  if (category === 'network_issue') {
    if (!system) missingFields.push('system');
    if (!details) missingFields.push('details');
    if (!impact) missingFields.push('impact');
  }

  return {
    category,
    missingFields: Array.from(new Set(missingFields)),
  };
}
