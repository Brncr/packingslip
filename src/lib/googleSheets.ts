const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface SheetData {
  range: string;
  majorDimension: string;
  values: string[][];
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  properties: {
    title: string;
  };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }>;
}

export interface CopyResult {
  id: string;
  name: string;
  kind: string;
}

export async function readSheet(spreadsheetId: string, range: string = 'Sheet1'): Promise<SheetData> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=read&spreadsheetId=${spreadsheetId}&range=${encodeURIComponent(range)}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to read sheet');
  }

  return response.json();
}

export async function writeSheet(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=write&spreadsheetId=${spreadsheetId}&range=${encodeURIComponent(range)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to write to sheet');
  }
}

export async function appendToSheet(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=append&spreadsheetId=${spreadsheetId}&range=${encodeURIComponent(range)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to append to sheet');
  }
}

export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=metadata&spreadsheetId=${spreadsheetId}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get spreadsheet metadata');
  }

  return response.json();
}

export async function copySpreadsheet(sourceSpreadsheetId: string, newTitle: string): Promise<CopyResult> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=copy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceSpreadsheetId, newTitle }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to copy spreadsheet');
  }

  return response.json();
}

export async function addSheetTab(spreadsheetId: string, sheetTitle: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=addSheet&spreadsheetId=${spreadsheetId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetTitle }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add sheet tab');
  }
}

export async function deleteSpreadsheet(spreadsheetId: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=delete&spreadsheetId=${spreadsheetId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete spreadsheet');
  }
}

export interface DriveQuotaResult {
  storageQuota: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
  };
}

export async function getDriveQuota(): Promise<DriveQuotaResult> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=quota`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get Drive quota');
  }

  return response.json();
}

export interface DriveCleanupResult {
  nameContains: string;
  requested: number;
  found: number;
  deletedCount: number;
  failedCount: number;
  deleted: Array<{ id: string; name: string; createdTime: string }>;
  failed: Array<{ id: string; name: string; createdTime: string; error: string }>;
}

export async function cleanupDriveSpreadsheets(params?: {
  nameContains?: string;
  maxToDelete?: number;
}): Promise<DriveCleanupResult> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-sheets?action=cleanup`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nameContains: params?.nameContains ?? 'PI-TB',
        maxToDelete: params?.maxToDelete ?? 50,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cleanup Drive spreadsheets');
  }

  return response.json();
}
export function extractSpreadsheetId(urlOrId: string): string {
  // If it's already just an ID, return it
  if (!urlOrId.includes('/')) {
    return urlOrId;
  }
  
  // Extract ID from URL like https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  
  return urlOrId;
}
