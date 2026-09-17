'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Eye, EyeOff } from 'lucide-react'

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const [error, setError] = useState<string | null>(
    searchParams.error === 'confirmation_failed' ? 'Email confirmation failed. Please try again.' : null
  )
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await login(new FormData(e.currentTarget))
      if (result?.error) {
        // Server Actions can serialize unexpected failures as an object. Do
        // not render that object directly as `{}` in the login form.
        setError(
          typeof result.error === 'string'
            ? result.error
            : 'Sign-in could not be completed. Please try again.'
        )
        setLoading(false)
      }
    } catch (error) {
      console.error('[login] Server action failed:', error)
      setError('Sign-in could not be completed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="bg-blue-600 text-white rounded-2xl p-4 mb-4 shadow-sm">
            <DollarSign className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Money Board</h1>
          <p className="text-sm text-gray-400 mt-1">Your personal finance dashboard</p>
        </div>

        <Card className="border border-gray-100 shadow-md rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-xl font-semibold">Sign in</CardTitle>
            <CardDescription className="text-gray-400">Welcome back</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-5 mt-2">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                <Input
                  id="email" name="email" type="email" required
                  placeholder="you@example.com"
                  className="h-12 rounded-xl text-base border-gray-200 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Input
                    id="password" name="password" type={showPassword ? 'text' : 'password'} required
                    placeholder="••••••••"
                    className="h-12 rounded-xl pr-11 text-base border-gray-200 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-medium bg-blue-600 hover:bg-blue-700 mt-2"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              <div className="text-center mt-3">
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
              </div>
            </form>
            <p className="mt-6 text-center text-sm text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-blue-600 font-medium hover:underline">Sign up</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
