import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    // Support multiple admin users
    const admins = [
      { username: Deno.env.get('ADMIN_USERNAME'), password: Deno.env.get('ADMIN_PASSWORD') },
      { username: Deno.env.get('ADMIN_USERNAME_2'), password: Deno.env.get('ADMIN_PASSWORD_2') },
    ].filter(a => a.username && a.password);

    console.log('Admin login attempt for username:', username);

    if (admins.length === 0) {
      console.error('Admin credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const matchedAdmin = admins.find(a => a.username === username && a.password === password);

    if (matchedAdmin) {
      // Generate a simple token with expiration (24 hours)
      const token = btoa(JSON.stringify({
        username,
        exp: Date.now() + 24 * 60 * 60 * 1000,
        secret: matchedAdmin.password!.slice(0, 8) // Use part of password as validation
      }));

      console.log('Admin login successful for:', username);
      return new Response(
        JSON.stringify({ success: true, token }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin login failed - invalid credentials');
    return new Response(
      JSON.stringify({ error: 'Invalid credentials' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
