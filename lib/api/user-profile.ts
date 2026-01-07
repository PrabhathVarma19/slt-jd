/**
 * User Profile API Integration
 * Syncs user data from external Trianz API
 */

export interface UserProfileApiResponse {
  EmployeeId: number;
  EmpName: string;
  GradeCode: string;
  Email: string;
  Location: string;
  ProjectCode: string;
  ProjectName: string;
  PMID: number;
  PM: string;
  DMID: number;
  DM: string;
  SUPID: number;
  Supervisor: string;
  NewOrgGroup: string;
}

export interface SyncUserProfileOptions {
  email: string;
  employeeId?: number;
}

/**
 * Fetch user profile from external API
 */
export async function fetchUserProfile(
  options: SyncUserProfileOptions
): Promise<UserProfileApiResponse | null> {
  const apiUrl = process.env.USER_PROFILE_API_URL;
  const apiUsername = process.env.USER_PROFILE_API_USERNAME;
  const apiPassword = process.env.USER_PROFILE_API_PASSWORD;

  if (!apiUrl) {
    console.warn('USER_PROFILE_API_URL not configured, skipping profile sync');
    return null;
  }

  try {
    // Build request URL
    // API format: lmsapi.trianz.com/api/Values?PassKey=xxx&email=xxx
    // Extract base URL and PassKey from configured URL
    const urlObj = new URL(apiUrl.startsWith('http') ? apiUrl : `https://${apiUrl}`);
    const passKey = urlObj.searchParams.get('PassKey') || '';
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (passKey) {
      params.append('PassKey', passKey);
    }
    
    // Query by email or employeeId
    if (options.employeeId) {
      params.append('EmployeeId', options.employeeId.toString());
    } else {
      params.append('Email', options.email);
    }
    
    const url = `${baseUrl}?${params.toString()}`;

    // Build auth headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add Basic Auth if username/password provided
    if (apiUsername && apiPassword) {
      const authString = Buffer.from(`${apiUsername}:${apiPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    }

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
    };

    // For SSL certificate issues in corporate environments
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      // @ts-ignore - Node.js fetch option for SSL
      fetchOptions.rejectUnauthorized = false;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      console.error(`User Profile API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text().catch(() => '');
      console.error('API error response:', errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    
    // Handle different response formats
    // Option 1: Direct object
    if (data && typeof data === 'object' && 'EmployeeId' in data) {
      return data as UserProfileApiResponse;
    }
    
    // Option 2: Array with single item (most likely for this API)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        console.warn(`No user found for email: ${options.email}`);
        return null;
      }
      // Find matching user by email if multiple results
      const matchingUser = data.find(
        (item: any) => item.Email?.toLowerCase() === options.email.toLowerCase()
      ) || data[0];
      
      if (matchingUser && matchingUser.EmployeeId) {
        return matchingUser as UserProfileApiResponse;
      }
    }
    
    // Option 3: Nested in data property
    if (data && typeof data === 'object' && 'data' in data && data.data) {
      if (Array.isArray(data.data) && data.data.length > 0) {
        return data.data[0] as UserProfileApiResponse;
      }
      if (data.data.EmployeeId) {
        return data.data as UserProfileApiResponse;
      }
    }

    console.warn('Unexpected API response format:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Transform API response to UserProfile model format
 */
export function transformProfileData(
  apiData: UserProfileApiResponse,
  userId: string
): {
  userId: string;
  employeeId: number;
  empName: string;
  gradeCode: string;
  location: string;
  projectCode: string;
  projectName: string;
  orgGroup: string;
  pmEmail: string;
  dmEmail: string;
  supervisorEmail: string;
  rawPayloadJson: any;
  lastSyncedAt: Date;
} {
  return {
    userId,
    employeeId: apiData.EmployeeId,
    empName: apiData.EmpName,
    gradeCode: apiData.GradeCode,
    location: apiData.Location,
    projectCode: apiData.ProjectCode,
    projectName: apiData.ProjectName,
    orgGroup: apiData.NewOrgGroup,
    pmEmail: apiData.PM,
    dmEmail: apiData.DM,
    supervisorEmail: apiData.Supervisor,
    rawPayloadJson: apiData, // Store full response for reference
    lastSyncedAt: new Date(),
  };
}

