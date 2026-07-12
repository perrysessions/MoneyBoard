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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white rounded-lg p-2">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Money Board</span>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Create account</CardTitle>
            <CardDescription>You&apos;ll need an invite passcode to sign up</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">{success}</p>
                <Link href="/login" className="text-sm text-blue-600 hover:underline">Back to sign in</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required placeholder="Min 8 characters" minLength={8} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="passcode">Invite passcode</Label>
                  <Input id="passcode" name="passcode" type="password" required placeholder="••••" />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            )}
            {!success && (
              <p className="mt-4 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
