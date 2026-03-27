/**
 * seed-users.js
 * Creates all Supabase Auth users + profiles in one shot.
 * Run from project root: node scripts/seed-users.js
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

// ── Load supabase/.env.local ─────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../supabase/.env.local')

function parseEnv(filePath) {
  const env = {}
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const env = parseEnv(envPath)
const SUPABASE_URL = env.SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in supabase/.env.local')
  process.exit(1)
}

// ── Staff list ────────────────────────────────────────────────────────────────
const STAFF = [
  { displayName: 'Bager',              email: 'bager@newmanbil.local',              password: 'Linn2020', role: 'admin'    },
  { displayName: 'Eva Karlsson',       email: 'eva.karlsson@newmanbil.local',       password: '123456',   role: 'manager'  },
  { displayName: 'Simon Johansson',    email: 'simon.johansson@newmanbil.local',    password: '123456',   role: 'manager'  },
  { displayName: 'Fredrik Axelsson',   email: 'fredrik.axelsson@newmanbil.local',   password: '123456',   role: 'employee' },
  { displayName: 'Fredrik Ranehammar', email: 'fredrik.ranehammar@newmanbil.local', password: '123456',   role: 'employee' },
  { displayName: 'Helén Richter',      email: 'helen.richter@newmanbil.local',      password: '123456',   role: 'employee' },
  { displayName: 'Helena Olsson',      email: 'helena.olsson@newmanbil.local',      password: '123456',   role: 'employee' },
  { displayName: 'Huni Hallsson',      email: 'huni.hallsson@newmanbil.local',      password: '123456',   role: 'employee' },
  { displayName: 'Klas Johansson',     email: 'klas.johansson@newmanbil.local',     password: '123456',   role: 'employee' },
  { displayName: 'Lars Olsson',        email: 'lars.olsson@newmanbil.local',        password: '123456',   role: 'employee' },
  { displayName: 'Lorenz Hansen',      email: 'lorenz.hansen@newmanbil.local',      password: '123456',   role: 'employee' },
  { displayName: 'Sofie Svensson',     email: 'sofie.svensson@newmanbil.local',     password: '123456',   role: 'employee' },
  { displayName: 'Tilda Ekenstierna',  email: 'tilda.ekenstierna@newmanbil.local',  password: '123456',   role: 'employee' },
  { displayName: 'Ulf Nilsson',        email: 'ulf.nilsson@newmanbil.local',        password: '123456',   role: 'employee' },
]

// ── Profiles table DDL (idempotent) ──────────────────────────────────────────
const CREATE_PROFILES_SQL = `
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'employee'
                   CHECK (role IN ('admin', 'manager', 'employee')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- get_my_role: used in RLS policies (security definer avoids recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
`

// ── Main ──────────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`\nConnecting to: ${SUPABASE_URL}\n`)

  // 1. Check profiles table is reachable (DDL must be run separately in Supabase SQL editor)
  console.log('Checking profiles table...')
  const { error: tableCheckError } = await supabase.from('profiles').select('id').limit(1)
  if (tableCheckError) {
    console.warn('  profiles table not found or not accessible.')
    console.warn('  Run the DDL SQL in your Supabase SQL editor first (from the earlier migration step).')
    console.warn('  Continuing — profile upserts will fail gracefully if the table is missing.\n')
  } else {
    console.log('  OK\n')
  }

  // 2. Fetch existing auth users once to build email → id map
  console.log('Fetching existing Auth users...')
  const allUsers = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.error('  listUsers failed:', error.message); break }
    allUsers.push(...data.users)
    if (data.users.length < 1000) break
    page++
  }
  const existingByEmail = Object.fromEntries(allUsers.map(u => [u.email, u.id]))
  console.log(`  Found ${allUsers.length} existing user(s)\n`)

  // 3. Create / update each staff member
  const results = []

  for (const staff of STAFF) {
    let userId = existingByEmail[staff.email]
    let action

    if (userId) {
      // User exists — update password to keep it in sync
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: staff.password,
        user_metadata: { display_name: staff.displayName },
      })
      action = error ? `SKIP (update failed: ${error.message})` : 'UPDATED'
    } else {
      // Create new confirmed user
      const { data, error } = await supabase.auth.admin.createUser({
        email: staff.email,
        password: staff.password,
        email_confirm: true,
        user_metadata: { display_name: staff.displayName },
      })
      if (error) {
        results.push({ email: staff.email, status: `FAILED: ${error.message}` })
        console.error(`  ✗ ${staff.email} — ${error.message}`)
        continue
      }
      userId = data.user.id
      action = 'CREATED'
    }

    // 4. Upsert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, display_name: staff.displayName, role: staff.role },
        { onConflict: 'id' }
      )

    if (profileError) {
      results.push({ email: staff.email, status: `${action}, PROFILE FAILED: ${profileError.message}` })
      console.warn(`  ⚠ ${staff.email} — auth ${action}, profile upsert failed: ${profileError.message}`)
    } else {
      results.push({ email: staff.email, role: staff.role, status: action, userId })
      console.log(`  ✓ ${staff.email.padEnd(42)} role=${staff.role.padEnd(8)} ${action}`)
    }
  }

  // 5. Summary
  console.log('\n── Summary ──────────────────────────────────────────────────────')
  const ok = results.filter(r => r.status === 'CREATED' || r.status === 'UPDATED')
  const failed = results.filter(r => r.status.startsWith('FAILED') || r.status.includes('PROFILE FAILED'))
  console.log(`  Created/updated : ${ok.length}`)
  console.log(`  Failed          : ${failed.length}`)
  if (failed.length) {
    console.log('\n  Failed entries:')
    failed.forEach(r => console.log(`    ${r.email} — ${r.status}`))
  }
  console.log('\nDone.\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
