'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Supabase intentionally does not distinguish an unknown email from an
      // incorrect password, so we keep this message equally non-revealing.
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        return { error: 'Email or password is incorrect.' }
      }

      console.error('[auth/login] Supabase rejected sign-in:', {
        email,
        code: error.code,
        status: error.status,
        message: error.message,
      })
      return { error: error.message }
    }
  } catch (error) {
    // The full cause is retained in Vercel Function Logs. Never log passwords.
    console.error('[auth/login] Unable to reach Supabase Auth:', {
      email,
      error,
    })
    return {
      error: 'Couldn’t reach the sign-in service. Please try again in a moment. If it continues, check the Vercel Function Logs for [auth/login].',
    }
  }

  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const passcode = formData.get('passcode') as string

  if (passcode !== process.env.SIGNUP_PASSCODE) {
    return { error: 'Invalid passcode.' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/confirm` },
  })
  if (error) return { error: error.message }
  return { success: 'Check your email to confirm your account.' }
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/auth/reset-password`,
  })
  if (error) return { error: error.message }
  return { success: 'Check your email for a password reset link.' }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
