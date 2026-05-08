// Prodigi Print Fulfillment API
// Docs: https://www.prodigi.com/print-api/docs/reference/

const PRODIGI_URL = process.env.PRODIGI_API_URL ?? 'https://api.prodigi.com/v4.0'
const PRODIGI_KEY = process.env.PRODIGI_API_KEY!

// Map our size keys to Prodigi SKUs
const SKU_MAP: Record<string, string> = {
  '4x6':      'GLOBAL-PHO-4X6',
  '5x7':      'GLOBAL-PHO-5X7',
  '8x10':     'GLOBAL-PHO-8X10',
  'square-4': 'GLOBAL-PHO-4X4',
  'square-5': 'GLOBAL-PHO-5X5',
  'square-8': 'GLOBAL-PHO-8X8',
}

export type ProdigiOrderPayload = {
  merchantReference: string       // your internal order ID
  shippingMethod: 'Standard' | 'Express'
  recipient: {
    name: string
    address: {
      line1: string
      line2?: string
      postalOrZipCode: string
      countryCode: string
      townOrCity: string
      stateOrCounty?: string
    }
    email: string
  }
  items: Array<{
    merchantReference: string
    sku: string
    copies: number
    sizing: 'fillPrintArea'
    assets: Array<{
      printArea: 'default'
      url: string             // signed Supabase URL (short-lived)
    }>
  }>
}

export async function createProdigiOrder(payload: ProdigiOrderPayload) {
  const res = await fetch(`${PRODIGI_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': PRODIGI_KEY,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Prodigi order failed: ${res.status} ${err}`)
  }

  return res.json() as Promise<{ outcome: string; order: { id: string } }>
}

export async function getProdigiOrder(prodigiOrderId: string) {
  const res = await fetch(`${PRODIGI_URL}/orders/${prodigiOrderId}`, {
    headers: { 'X-API-Key': PRODIGI_KEY },
  })
  return res.json()
}

export function getSku(size: string) {
  return SKU_MAP[size] ?? 'GLOBAL-PHO-4X6'
}
