import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? ""
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? ""
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") ?? ""
  const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173"

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !redirectUri) {
    return Response.redirect(`${frontendUrl}?google=error&reason=missing_env`, 302)
  }

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) {
    return Response.redirect(`${frontendUrl}?google=error&reason=${encodeURIComponent(errorParam)}`, 302)
  }

  if (!code || !state) {
    return Response.redirect(`${frontendUrl}?google=error&reason=missing_params`, 302)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Validate state — must match the stored state and not be expired
  const now = new Date().toISOString()
  const { data: connection, error: stateError } = await supabase
    .from("google_connections")
    .select("user_id, refresh_token, oauth_state_expires_at")
    .eq("oauth_state", state)
    .gt("oauth_state_expires_at", now)
    .maybeSingle()

  if (stateError || !connection?.user_id) {
    return Response.redirect(`${frontendUrl}?google=error&reason=invalid_state`, 302)
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error("Token exchange failed:", errText)
    return Response.redirect(`${frontendUrl}?google=error&reason=token_exchange`, 302)
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, token_type, scope, expires_in } = tokens

  if (!access_token) {
    return Response.redirect(`${frontendUrl}?google=error&reason=no_access_token`, 302)
  }

  const expiryDate = new Date(Date.now() + ((expires_in ?? 3600) * 1000)).toISOString()

  // Fetch Google account email
  let googleEmail: string | null = null
  try {
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (userInfoRes.ok) {
      const info = await userInfoRes.json()
      googleEmail = info.email ?? null
    }
  } catch {
    // non-fatal — continue without email
  }

  const nextRefreshToken = refresh_token ?? connection.refresh_token ?? null

  // Store tokens in google_connections
  const { data: savedRow, error: saveError } = await supabase
    .from("google_connections")
    .update({
      access_token,
      refresh_token: nextRefreshToken,
      token_type: token_type ?? "Bearer",
      scope: scope ?? null,
      expiry_date: expiryDate,
      google_email: googleEmail,
      status: "connected",
      oauth_state: null,
      oauth_state_expires_at: null,
    })
    .eq("user_id", connection.user_id)
    .eq("oauth_state", state)
    .select("user_id")
    .maybeSingle()

  if (saveError || !savedRow) {
    console.error("Failed to save tokens:", saveError?.message ?? "No row updated")
    return Response.redirect(`${frontendUrl}?google=error&reason=token_save`, 302)
  }

  // Verify connection: list up to 5 calendars
  let calendarTestOk = false
  try {
    const calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=5",
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    calendarTestOk = calRes.ok
  } catch {
    calendarTestOk = false
  }

  const emailParam = googleEmail ? `&email=${encodeURIComponent(googleEmail)}` : ""
  return Response.redirect(
    `${frontendUrl}?google=success${emailParam}&calendar_ok=${calendarTestOk}`,
    302
  )
})
