'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign } from 'lucide-react'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const result = await signup(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.success)
    }
    setLoading(false)
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
            <CardTitle className="text-xl font-semibold">Create account</CardTitle>
            <CardDescription className="text-gray-400">You&apos;ll need an invite passcode</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {success ? (
              <div className="mt-2 text-center space-y-4">
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-4">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
                <Link href="/login" className="text-sm text-blue-600 font-medium hover:underline">Back to sign in</Link>
              </div>
            ) : (
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
                  <Input
                    id="password" name="password" type="password" required
                    placeholder="Min 8 characters" minLength={8}
                    className="h-12 rounded-xl text-base border-gray-200 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passcode" className="text-sm font-medium text-gray-700">Invite passcode</Label>
                  <Input
                    id="passcode" name="passcode" type="password" required
                    placeholder="••••"
                    className="h-12 rounded-xl text-base border-gray-200 focus:border-blue-500"
                  />
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
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            )}
            {!success && (
              <p className="mt-6 text-center text-sm text-gray-400">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
