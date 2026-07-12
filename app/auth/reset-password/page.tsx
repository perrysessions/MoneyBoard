'use client'

import { useState } from 'react'
import { updatePassword } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign } from 'lucide-react'

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    if (fd.get('password') !== fd.get('confirm')) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }
    const result = await updatePassword(fd)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-blue-600 text-white rounded-2xl p-4 mb-4 shadow-sm">
            <DollarSign className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Money Board</h1>
          <p className="text-sm text-gray-400 mt-1">Your personal finance dashboard</p>
        </div>

        <Card className="border border-gray-100 shadow-md rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-xl font-semibold">New password</CardTitle>
            <CardDescription className="text-gray-400">Choose a strong password</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} method="post" className="space-y-5 mt-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">New password</Label>
                <Input
                  id="password" name="password" type="password" required minLength={8}
                  placeholder="Min 8 characters"
                  className="h-12 rounded-xl text-base border-gray-200 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-sm font-medium text-gray-700">Confirm password</Label>
                <Input
                  id="confirm" name="confirm" type="password" required minLength={8}
                  placeholder="••••••••"
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
                className="w-full h-12 rounded-xl text-base font-medium bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Saving…' : 'Set new password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
