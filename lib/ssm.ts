import type { Customer } from './types'

// Customer matching (fix list 3.4). The SSM registration number is the
// customer key: one customer per number. People write it many ways —
// "201901012345", "2019-0101-2345", "201901012345 (1234567-A)" — so it is
// compared through ssmKey(): the 12-digit number when there is one,
// otherwise the old-style number with punctuation removed ("1234567A").
//
// Keep in step with the generated column customers.ssm_key
// (supabase/migrations/20261024110000_customer_ssm_key.sql), which applies
// the same rule in the database and backs the unique index.

export function ssmKey(raw?: string | null): string | null {
  if (!raw) return null
  const twelveDigits = raw.replace(/[\s-]/g, '').match(/\d{12}/)
  if (twelveDigits) return twelveDigits[0]
  const compact = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return compact || null
}

/** The customer already holding this SSM number, if any (ignoring exceptId — the one being edited). */
export function findCustomerBySsm(customers: Customer[], raw: string, exceptId?: string): Customer | undefined {
  const key = ssmKey(raw)
  if (!key) return undefined
  return customers.find(c => c.id !== exceptId && ssmKey(c.companyRegistrationNo) === key)
}

/** Company name reduced for comparison: case, punctuation and "Sdn Bhd"/"Berhad" ignored. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(sdn\.?\s*bhd\.?|sendirian berhad|berhad|bhd\.?|plt|enterprise|ent\.?)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Best existing customer for an SSM number and/or name: SSM first, then name. */
export function matchCustomer(customers: Customer[], q: { ssm?: string; name?: string }): Customer | undefined {
  if (q.ssm) {
    const bySsm = findCustomerBySsm(customers, q.ssm)
    if (bySsm) return bySsm
  }
  const key = q.name ? nameKey(q.name) : ''
  return key ? customers.find(c => nameKey(c.customerName) === key) : undefined
}
