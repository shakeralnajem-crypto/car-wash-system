import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173"
const EXTRA_ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

function buildCorsHeaders(req: Request) {
  const requestOrigin = req.headers.get("origin") ?? ""
  const allowedOrigins = new Set([
    FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    ...EXTRA_ALLOWED_ORIGINS,
  ])
  const allowOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : FRONTEND_URL

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
    Vary: "Origin",
  }
}

Deno.serve(async (req: Request) => {
  const CORS_HEADERS = buildCorsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const authorization = req.headers.get("Authorization") ?? ""
  const accessToken = authorization.replace(/^Bearer\s+/i, "")
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!clientId || !redirectUri || !supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing required environment variables" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // Generate a cryptographically secure random oauth_state
  const stateBytes = new Uint8Array(32)
  crypto.getRandomValues(stateBytes)
  const oauthState = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // State expires in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
  const appUser = authData.user

  if (authError || !appUser) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", appUser.id)
    .maybeSingle()

  if (profileError) {
    return new Response(
      JSON.stringify({ error: "Failed to verify access", detail: profileError.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (profile?.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // Upsert — safe on reconnect due to unique constraint on user_id
  const { error: dbError } = await supabase
    .from("google_connections")
    .upsert(
      {
        user_id: appUser.id,
        oauth_state: oauthState,
        oauth_state_expires_at: expiresAt,
        status: "pending",
      },
      { onConflict: "user_id" }
    )

  if (dbError) {
    return new Response(
      JSON.stringify({ error: "Failed to store OAuth state", detail: dbError.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state: oauthState,
  })

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return new Response(
    JSON.stringify({ url }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  )
})
