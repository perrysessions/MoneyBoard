'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react'
import type { ImportRow } from '@/app/api/import/route'

type Account = { id: string; name: string; official_name: string | null; nickname: string | null; mask: string | null; institution: string | null }
type Format = 'chase' | 'chase_bank' | 'wells' | 'unknown'
type FileStatus = 'pending' | 'importing' | 'done' | 'error'

interface ParsedFile {
  id: string
  filename: string
  format: Format
  rows: ImportRow[]
  accountId: string
  dateMin: string
  dateMax: string
  status: FileStatus
  newCount?: number
  skippedCount?: number
  errorMsg?: string
}

// ── CSV parsing ────────────────────────────────────────────────────────────────

function detectFormat(header: string): Format {
  if (header.includes('Transaction Date') && header.includes('Post Date')) return 'chase'
  if (header.includes('Details') && header.includes('Posting Date')) return 'chase_bank'
  if (header.includes('DATE') && header.includes('DESCRIPTION') && header.includes('AMOUNT')) return 'wells'
  return 'unknown'
}

function parseDate(raw: string): string {
  // MM/DD/YYYY → YYYY-MM-DD
  const [m, d, y] = raw.trim().replace(/"/g, '').split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function cleanMerchant(raw: string): string {
  return raw.replace(/"/g, '').trim()
}

function syntheticId(source: string, date: string, amountCents: number, merchant: string, seen: Map<string, number>): string {
  const slug = merchant.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  const base = `import_${source}_${date.replace(/-/g, '')}_${amountCents}_${slug}`
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}_${count}`
}

function parseChase(text: string, accountId: string): ImportRow[] {
  const lines = text.trim().split('\n')
  const rows: ImportRow[] = []
  const seen = new Map<string, number>()
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 6) continue
    const [txDate, , description, , type, amountRaw] = cols
    if (!txDate || !description || !amountRaw) continue
    // Skip CC payments (just paying the bill — not real spend)
    if (type?.trim() === 'Payment') continue
    const date = parseDate(txDate)
    if (!date || date === '--') continue
    const amount_cents = Math.round(-parseFloat(amountRaw) * 100)
    if (isNaN(amount_cents)) continue
    const merchant_name = cleanMerchant(description)
    const merchant_normalized = merchant_name.toLowerCase().replace(/\s+/g, ' ').trim()
    rows.push({
      date,
      merchant_name,
      merchant_normalized,
      amount_cents,
      account_id: accountId,
      import_source: 'chase_csv',
      plaid_transaction_id: syntheticId('chase', date, amount_cents, merchant_normalized, seen),
    })
  }
  return rows
}

function parseChasBank(text: string, accountId: string): ImportRow[] {
  // Format: Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
  const lines = text.trim().split('\n')
  const rows: ImportRow[] = []
  const seen = new Map<string, number>()
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 5) continue
    const [, dateRaw, description, amountRaw, type] = cols
    if (!dateRaw || !description || !amountRaw) continue
    // Skip internal bank transfers
    if (type?.trim() === 'ACCT_XFER') continue
    const date = parseDate(dateRaw)
    if (!date || date === '--') continue
    // Amount: positive = credit (income), negative = debit (expense) → flip sign for our schema
    const amount_cents = Math.round(-parseFloat(amountRaw) * 100)
    if (isNaN(amount_cents)) continue
    const merchant_name = cleanMerchant(description)
    const merchant_normalized = merchant_name.toLowerCase().replace(/\s+/g, ' ').trim()
    rows.push({
      date,
      merchant_name,
      merchant_normalized,
      amount_cents,
      account_id: accountId,
      import_source: 'chase_csv',
      plaid_transaction_id: syntheticId('chase_bank', date, amount_cents, merchant_normalized, seen),
    })
  }
  return rows
}

function parseWells(text: string, accountId: string): ImportRow[] {
  const lines = text.trim().split('\n')
  const rows: ImportRow[] = []
  const seen = new Map<string, number>()
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 3) continue
    const [dateRaw, description, amountRaw] = cols
    if (!dateRaw || !description || !amountRaw) continue
    const date = parseDate(dateRaw)
    if (!date || date === '--') continue
    const amount_cents = Math.round(-parseFloat(amountRaw) * 100)
    if (isNaN(amount_cents)) continue
    // Collapse repeated spaces in Wells descriptions
    const merchant_name = cleanMerchant(description).replace(/\s{2,}/g, ' ')
    const merchant_normalized = merchant_name.toLowerCase().replace(/\s+/g, ' ').trim()
    rows.push({
      date,
      merchant_name,
      merchant_normalized,
      amount_cents,
      account_id: accountId,
      import_source: 'wells_csv',
      plaid_transaction_id: syntheticId('wells', date, amount_cents, merchant_normalized, seen),
    })
  }
  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(cur); cur = '' }
    else { cur += ch }
  }
  result.push(cur)
  return result.map(s => s.trim())
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ImportView({ accounts }: { accounts: Account[] }) {
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'previewing' | 'importing' | 'done'>('idle')
  const [floorDates, setFloorDates] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return
    Array.from(fileList).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        const firstLine = text.split('\n')[0]
        const format = detectFormat(firstLine)
        const tempRows = format === 'chase'
          ? parseChase(text, '')
          : format === 'chase_bank'
            ? parseChasBank(text, '')
            : format === 'wells'
              ? parseWells(text, '')
              : []
        const dates = tempRows.map(r => r.date).sort()
        setFiles(prev => [...prev, {
          id: `${file.name}-${Date.now()}`,
          filename: file.name,
          format,
          rows: tempRows,
          accountId: '',
          dateMin: dates[0] ?? '',
          dateMax: dates[dates.length - 1] ?? '',
          status: 'pending',
        }])
      }
      reader.readAsText(file)
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }, [])

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  const setAccount = (id: string, accountId: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, accountId } : f))
  }

  const allAssigned = files.length > 0 && files.every(f => f.accountId)

  // Step 1: fetch floor dates and show preview
  const preview = async () => {
    setGlobalStatus('previewing')
    const accountIds = [...new Set(files.map(f => f.accountId).filter(Boolean))]
    const res = await fetch(`/api/import?accountIds=${accountIds.join(',')}`)
    const floors: Record<string, string> = await res.json()
    setFloorDates(floors)
    setFiles(prev => prev.map(f => {
      const floor = floors[f.accountId]
      const newRows = f.rows.filter(r => !floor || r.date < floor)
      return { ...f, newCount: newRows.length, skippedCount: f.rows.length - newRows.length }
    }))
    setGlobalStatus('idle')
  }

  const hasPreviewed = files.some(f => f.newCount !== undefined)
  const totalNew = files.reduce((s, f) => s + (f.newCount ?? 0), 0)

  // Step 2: run the actual import
  const runImport = async () => {
    setGlobalStatus('importing')

    for (const file of files) {
      if (!file.accountId || file.status === 'done') continue
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'importing' } : f))

      const floor = floorDates[file.accountId]
      const toSend = file.rows
        .filter(r => !floor || r.date < floor)
        .map(r => ({ ...r, account_id: file.accountId }))

      if (!toSend.length) {
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done', newCount: 0 } : f))
        continue
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: toSend }),
      })
      const data = await res.json()

      if (data.error) {
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error', errorMsg: data.error } : f))
      } else {
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done', newCount: data.imported, skippedCount: data.skipped } : f))
      }
    }

    setGlobalStatus('done')
  }

  const accountLabel = (a: Account) =>
    `${a.nickname ?? a.official_name ?? a.name}${a.mask ? ` ···${a.mask}` : ''}`

  return (
    <div className="space-y-6">

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <Upload className="h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">Drop CSV files here, or click to browse</p>
        <p className="text-xs text-gray-400">Chase and Wells Fargo formats — multiple files OK</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={e => processFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map(file => (
            <div key={file.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-gray-300 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 truncate">{file.filename}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      file.format === 'chase' ? 'bg-blue-50 text-blue-600' :
                      file.format === 'chase_bank' ? 'bg-blue-50 text-blue-600' :
                      file.format === 'wells' ? 'bg-green-50 text-green-600' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {file.format === 'chase' ? 'Chase Credit' : file.format === 'chase_bank' ? 'Chase Bank' : file.format === 'wells' ? 'Wells Fargo' : 'Unknown format'}
                    </span>
                    <span className="text-xs text-gray-400">{file.rows.length} rows</span>
                    {file.dateMin && (
                      <span className="text-xs text-gray-400">{file.dateMin} → {file.dateMax}</span>
                    )}
                  </div>

                  {/* Account picker */}
                  {file.format !== 'unknown' && (
                    <div className="mt-2">
                      <select
                        value={file.accountId}
                        onChange={e => setAccount(file.id, e.target.value)}
                        disabled={file.status === 'importing' || file.status === 'done'}
                        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs"
                      >
                        <option value="">— Select account —</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Preview counts */}
                  {file.newCount !== undefined && file.status !== 'error' && (
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="text-green-600 font-medium">✓ {file.newCount} new to import</span>
                      {(file.skippedCount ?? 0) > 0 && (
                        <span className="text-gray-400">{file.skippedCount} already in Plaid — skipped</span>
                      )}
                    </div>
                  )}

                  {/* Status */}
                  {file.status === 'importing' && (
                    <p className="mt-2 text-xs text-blue-500 animate-pulse">Categorizing with Gemini AI and importing…</p>
                  )}
                  {file.status === 'done' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Imported {file.newCount} transactions
                    </div>
                  )}
                  {file.status === 'error' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {file.errorMsg ?? 'Import failed'}
                    </div>
                  )}
                </div>

                {file.status !== 'importing' && file.status !== 'done' && (
                  <button onClick={() => removeFile(file.id)} className="text-gray-300 hover:text-gray-500 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {files.length > 0 && globalStatus !== 'done' && (
        <div className="flex items-center gap-3">
          {!hasPreviewed ? (
            <button
              onClick={preview}
              disabled={!allAssigned || globalStatus === 'previewing'}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              {globalStatus === 'previewing' ? 'Checking…' : 'Preview'}
            </button>
          ) : (
            <button
              onClick={runImport}
              disabled={totalNew === 0 || globalStatus === 'importing'}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {globalStatus === 'importing' ? 'Importing…' : `Import ${totalNew} transactions`}
            </button>
          )}
          {!allAssigned && (
            <p className="text-xs text-gray-400">Assign an account to each file first</p>
          )}
        </div>
      )}

      {/* Done summary */}
      {globalStatus === 'done' && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-800">Import complete</p>
          <p className="text-xs text-green-600 mt-1">
            {files.reduce((s, f) => s + (f.newCount ?? 0), 0)} transactions imported across {files.length} file{files.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => { setFiles([]); setGlobalStatus('idle'); setFloorDates({}) }}
            className="mt-3 text-xs text-green-600 underline"
          >
            Import more files
          </button>
        </div>
      )}
    </div>
  )
}
