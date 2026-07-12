// Single source of truth for how an account name is displayed everywhere.
// Priority: nickname → official_name (title-cased) → name
export type AccountDisplayFields = {
  nickname?: string | null
  official_name?: string | null
  name: string
  mask?: string | null
}

const toTitleCase = (s: string) =>
  s.replace(/[®™…]/g, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim()

export function getAccountDisplayName(account: AccountDisplayFields): string {
  if (account.nickname) return account.nickname
  if (account.official_name) return toTitleCase(account.official_name)
  return account.name
}
