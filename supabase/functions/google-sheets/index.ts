import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: credentials.token_uri,
    iat: now,
    exp: exp,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!credentialsJson) {
      throw new Error('Google Service Account credentials not configured');
    }

    const credentials: ServiceAccountCredentials = JSON.parse(credentialsJson);
    const accessToken = await getAccessToken(credentials);
    const targetFolderId = Deno.env.get('GOOGLE_DRIVE_TARGET_FOLDER_ID')?.trim() || undefined;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const spreadsheetId = url.searchParams.get('spreadsheetId');
    const range = url.searchParams.get('range') || 'Sheet1';

    // Some actions don't require spreadsheetId in URL params
    const actionsWithoutSpreadsheetId = new Set(['copy', 'quota', 'list', 'cleanup']);

    if (!action) {
      throw new Error('action is required');
    }

    if (!actionsWithoutSpreadsheetId.has(action) && !spreadsheetId) {
      throw new Error('spreadsheetId is required');
    }
    const baseUrl = spreadsheetId ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` : '';

    if (action === 'read') {
      const response = await fetch(`${baseUrl}/values/${encodeURIComponent(range)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Sheets API error: ${error}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'write') {
      const body = await req.json();
      const { values } = body;

      const response = await fetch(
        `${baseUrl}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Sheets API error: ${error}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'append') {
      const body = await req.json();
      const { values } = body;

      const response = await fetch(
        `${baseUrl}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Sheets API error: ${error}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'metadata') {
      const response = await fetch(baseUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Sheets API error: ${error}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'copy') {
      // Copy a spreadsheet using Google Drive API
      const body = await req.json();
      const { sourceSpreadsheetId, newTitle } = body;

      if (!sourceSpreadsheetId) {
        throw new Error('sourceSpreadsheetId is required for copy action');
      }

      const copyBody: Record<string, unknown> = { name: newTitle || 'Copy' };
      // If configured, place the copy inside a specific folder (recommended: a Shared Drive folder).
      if (targetFolderId) {
        copyBody.parents = [targetFolderId];
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${sourceSpreadsheetId}/copy?supportsAllDrives=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(copyBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Drive API error: ${error}`);
      }

      const data = await response.json();
      const newFileId = data.id;

      // Make the file accessible to anyone with the link
      const permissionRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${newFileId}/permissions?supportsAllDrives=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'writer',
            type: 'anyone',
          }),
        }
      );

      if (!permissionRes.ok) {
        console.warn('Failed to set permissions:', await permissionRes.text());
        // Continue anyway - file was created, just not shared
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'quota') {
      // Get Drive storage quota for the authenticated account (service account)
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/about?fields=storageQuota`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Drive API error: ${error}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'list') {
      // List spreadsheets available to the service account.
      // If a target folder is configured, restrict results to that folder.
      const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? 50), 1), 200);
      const nameContainsRaw = url.searchParams.get('nameContains') || '';
      const nameContains = nameContainsRaw.replace(/'/g, '').slice(0, 64);

      const folderClause = targetFolderId ? ` and '${targetFolderId}' in parents` : '';
      const nameClause = nameContains ? ` and name contains '${nameContains}'` : '';
      const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false${folderClause}${nameClause}`;

      const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
      listUrl.searchParams.set('q', q);
      listUrl.searchParams.set('pageSize', String(pageSize));
      listUrl.searchParams.set('orderBy', 'createdTime desc');
      listUrl.searchParams.set('fields', 'files(id,name,createdTime,owners(displayName,emailAddress))');
      listUrl.searchParams.set('supportsAllDrives', 'true');
      listUrl.searchParams.set('includeItemsFromAllDrives', 'true');

      const listRes = await fetch(listUrl.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!listRes.ok) {
        const error = await listRes.text();
        throw new Error(`Google Drive API error: ${error}`);
      }

      const listData = await listRes.json();
      return new Response(JSON.stringify({ targetFolderId: targetFolderId || null, ...listData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'cleanup') {
      // Cleanup old spreadsheets from the Drive to free space.
      // If a target folder is configured, only deletes files from that folder.
      const body = await req.json().catch(() => ({}));
      const rawNameContains = typeof body?.nameContains === 'string' ? body.nameContains : 'PI-TB';
      const nameContains = rawNameContains.replace(/'/g, '').slice(0, 64) || 'PI-TB';
      const maxToDelete = Math.min(Math.max(Number(body?.maxToDelete ?? 50), 1), 200);

      const folderClause = targetFolderId ? ` and '${targetFolderId}' in parents` : '';
      const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false${folderClause} and name contains '${nameContains}'`;
      const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
      listUrl.searchParams.set('q', q);
      listUrl.searchParams.set('pageSize', String(maxToDelete));
      listUrl.searchParams.set('orderBy', 'createdTime');
      listUrl.searchParams.set('fields', 'files(id,name,createdTime)');
      listUrl.searchParams.set('supportsAllDrives', 'true');
      listUrl.searchParams.set('includeItemsFromAllDrives', 'true');

      const listRes = await fetch(listUrl.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!listRes.ok) {
        const error = await listRes.text();
        throw new Error(`Google Drive API error: ${error}`);
      }

      const listData = await listRes.json();
      const files: Array<{ id: string; name: string; createdTime: string }> = Array.isArray(listData?.files)
        ? listData.files
        : [];

      const deleted: Array<{ id: string; name: string; createdTime: string }> = [];
      const failed: Array<{ id: string; name: string; createdTime: string; error: string }> = [];

      for (const f of files) {
        const delRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (delRes.ok) {
          deleted.push(f);
        } else {
          const error = await delRes.text();
          failed.push({ ...f, error });
        }
      }

      return new Response(
        JSON.stringify({
          targetFolderId: targetFolderId || null,
          nameContains,
          requested: maxToDelete,
          found: files.length,
          deletedCount: deleted.length,
          deleted,
          failedCount: failed.length,
          failed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'addSheet') {
      // Add a new sheet tab to the spreadsheet
      const body = await req.json();
      const { sheetTitle } = body;

      if (!sheetTitle) {
        throw new Error('sheetTitle is required for addSheet action');
      }

      const response = await fetch(
        `${baseUrl}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetTitle,
                  },
                },
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Sheets API error: ${error}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'delete') {
      // Delete a spreadsheet using Google Drive API
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?supportsAllDrives=true`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      // 404 means file already doesn't exist - that's fine for deletion
      if (!response.ok && response.status !== 404) {
        const error = await response.text();
        throw new Error(`Google Drive API error: ${error}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error('Invalid action. Use: read, write, append, metadata, copy, quota, list, cleanup, addSheet, or delete');
    }

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
