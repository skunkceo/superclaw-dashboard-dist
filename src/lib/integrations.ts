import { getProactivitySetting, setProactivitySetting } from './db';
import { google } from 'googleapis';

// ─── Integration Types ────────────────────────────────────────────────────────

export interface IntegrationStatus {
  configured: boolean;
  source: 'environment' | 'database' | 'none';
  error?: string;
  metadata?: Record<string, any>;
}

export interface GSCCredentials {
  clientEmail: string;
  privateKey: string;
}

export interface GA4Credentials {
  clientEmail: string;
  privateKey: string;
  propertyId: string;
}

export interface GitHubCredentials {
  token?: string;
  useGhCli: boolean;
}

export interface LinearCredentials {
  apiKey: string;
}

// ─── Credential Management ────────────────────────────────────────────────────

export function getGSCCredentials(): GSCCredentials | null {
  // Try environment first
  if (process.env.GA4_CLIENT_EMAIL && process.env.GA4_PRIVATE_KEY) {
    return {
      clientEmail: process.env.GA4_CLIENT_EMAIL,
      privateKey: process.env.GA4_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  // Try database
  const email = getProactivitySetting('integration_gsc_email');
  const key = getProactivitySetting('integration_gsc_key');
  
  if (email && key) {
    return {
      clientEmail: email,
      privateKey: key.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

export function getGA4Credentials(): GA4Credentials | null {
  // Try environment first
  if (process.env.GA4_CLIENT_EMAIL && process.env.GA4_PRIVATE_KEY && process.env.GA4_PROPERTY_ID) {
    return {
      clientEmail: process.env.GA4_CLIENT_EMAIL,
      privateKey: process.env.GA4_PRIVATE_KEY.replace(/\\n/g, '\n'),
      propertyId: process.env.GA4_PROPERTY_ID,
    };
  }

  // Try database
  const email = getProactivitySetting('integration_ga4_email');
  const key = getProactivitySetting('integration_ga4_key');
  const propertyId = getProactivitySetting('integration_ga4_property_id');

  if (email && key && propertyId) {
    return {
      clientEmail: email,
      privateKey: key.replace(/\\n/g, '\n'),
      propertyId,
    };
  }

  return null;
}

export function getGitHubCredentials(): GitHubCredentials {
  const token = getProactivitySetting('integration_github_token');
  return {
    token: token || undefined,
    useGhCli: !token,
  };
}

export function getLinearCredentials(): LinearCredentials | null {
  const apiKey = getProactivitySetting('integration_linear_key');
  return apiKey ? { apiKey } : null;
}

export function saveGSCCredentials(creds: GSCCredentials): void {
  setProactivitySetting('integration_gsc_email', creds.clientEmail);
  setProactivitySetting('integration_gsc_key', creds.privateKey);
}

export function saveGA4Credentials(creds: GA4Credentials): void {
  setProactivitySetting('integration_ga4_email', creds.clientEmail);
  setProactivitySetting('integration_ga4_key', creds.privateKey);
  setProactivitySetting('integration_ga4_property_id', creds.propertyId);
}

export function saveGitHubCredentials(creds: GitHubCredentials): void {
  if (creds.token) {
    setProactivitySetting('integration_github_token', creds.token);
  }
}

export function saveLinearCredentials(creds: LinearCredentials): void {
  setProactivitySetting('integration_linear_key', creds.apiKey);
}

// ─── Integration Status Checks ────────────────────────────────────────────────

export async function checkGSCStatus(): Promise<IntegrationStatus> {
  const creds = getGSCCredentials();
  
  if (!creds) {
    return { configured: false, source: 'none' };
  }

  const source = process.env.GA4_CLIENT_EMAIL ? 'environment' : 'database';

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const response = await searchconsole.sites.list();
    const sites = response.data.siteEntry || [];

    return {
      configured: true,
      source,
      metadata: {
        sitesCount: sites.length,
        sites: sites.map((s: any) => s.siteUrl),
      },
    };
  } catch (error: any) {
    return {
      configured: true,
      source,
      error: error.message || 'Failed to authenticate with Google Search Console',
    };
  }
}

export async function checkGA4Status(): Promise<IntegrationStatus> {
  const creds = getGA4Credentials();

  if (!creds) {
    return { configured: false, source: 'none' };
  }

  const source = process.env.GA4_PROPERTY_ID ? 'environment' : 'database';

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
    
    // Try to fetch a simple metric to validate credentials
    await analyticsdata.properties.runReport({
      property: creds.propertyId,
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [{ name: 'sessions' }],
      },
    });

    return {
      configured: true,
      source,
      metadata: {
        propertyId: creds.propertyId,
      },
    };
  } catch (error: any) {
    return {
      configured: true,
      source,
      error: error.message || 'Failed to authenticate with GA4',
    };
  }
}

export async function checkGitHubStatus(): Promise<IntegrationStatus> {
  const creds = getGitHubCredentials();

  if (creds.useGhCli) {
    // Check if gh CLI is authenticated
    try {
      const { execSync } = require('child_process');
      const result = execSync('gh auth status', { encoding: 'utf-8', timeout: 5000 });
      
      return {
        configured: true,
        source: 'environment',
        metadata: {
          method: 'gh CLI',
          authenticated: result.includes('Logged in'),
        },
      };
    } catch {
      return {
        configured: false,
        source: 'none',
        error: 'gh CLI not authenticated',
      };
    }
  }

  // Token-based auth
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${creds.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.ok) {
      const user = await response.json();
      return {
        configured: true,
        source: 'database',
        metadata: {
          method: 'Personal Access Token',
          username: user.login,
        },
      };
    } else {
      return {
        configured: true,
        source: 'database',
        error: 'Invalid GitHub token',
      };
    }
  } catch (error: any) {
    return {
      configured: true,
      source: 'database',
      error: error.message || 'Failed to verify GitHub token',
    };
  }
}

export async function checkLinearStatus(): Promise<IntegrationStatus> {
  const creds = getLinearCredentials();

  if (!creds) {
    return { configured: false, source: 'none' };
  }

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: creds.apiKey,
      },
      body: JSON.stringify({
        query: '{ viewer { id name email } }',
      }),
    });

    const data = await response.json();

    if (data.data?.viewer) {
      return {
        configured: true,
        source: 'database',
        metadata: {
          user: data.data.viewer.name,
          email: data.data.viewer.email,
        },
      };
    } else {
      return {
        configured: true,
        source: 'database',
        error: 'Invalid Linear API key',
      };
    }
  } catch (error: any) {
    return {
      configured: true,
      source: 'database',
      error: error.message || 'Failed to verify Linear credentials',
    };
  }
}
