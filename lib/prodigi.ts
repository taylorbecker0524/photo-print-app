// Prodigi Print Fulfillment API
// Docs: https://www.prodigi.com/print-api/docs/reference/

const PRODIGI_URL = process.env.PRODIGI_API_URL ?? 'https://api.prodigi.com/v4.0'
const PRODIGI_KEY = process.env.PRODIGI_API_KEY!

const SKU_MAP: Record<string, string> = {
  '4x6':      'GLOBAL-PHO-4X6',
  '5x7':      'GLOBAL-PHO-5X7',
  '8x10':     'GLOBAL-PHO-8X10',
  'square-4': 'GLOBAL-PHO-4X4',
  'square-5': 'GLOBAL-PHO-5X5',
  'square-8': 'GLOBAL-PHO-8X8',
}

export type PhotoFinish = 'lustre' | 'gloss'

export type ProdigiOrderPayload = {
  merchantReference: string
  shippingMethod: 'Budget' | 'Standard' | 'Express' | 'Overnight'
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
    attributes?: Record<string, string>
    assets: Array<{
      printArea: 'default'
      url: string
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

export type ProdigiQuoteRequest = {
  shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight'
  destinationCountryCode: string
  currencyCode?: string
  items: Array<{
    sku: string
    copies: number
    attributes?: Record<string, string>
    assets?: Array<{ printArea: 'default' }>
  }>
}

export type ProdigiQuote = {
  shipmentMethod: string
  costSummary: {
    items: { amount: string; currency: string }
    shipping: { amount: string; currency: string }
    totalCost?: { amount: string; currency: string }
    totalTax?: { amount: string; currency: string }
  }
  shipments: Array<{
    carrier: { name: string; service: string }
    fulfillmentLocation: { countryCode: string; labCode: string }
    cost: { amount: string; currency: string }
    items: string[]
  }>
  items: Array<{
    id: string
    sku: string
    copies: number
    unitCost: { amount: string; currency: string }
    assets: Array<{ printArea: string }>
  }>
}

export type ProdigiQuoteResponse = {
  outcome: string
  quotes: ProdigiQuote[]
  issues?: Array<{ errorCode: string; description: string }>
}

export async function getProdigiShippingQuote({
  items,
  destinationCountryCode,
  finish,
  shippingMethod = 'Standard',
}: {
  items: Array<{ sku: string; copies: number }>
  destinationCountryCode: string
  finish: PhotoFinish
  shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight'
}): Promise<{ shippingCents: number; itemsCents: number; currency: string; method: string }> {
  const res = await fetch(`${PRODIGI_URL}/quotes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': PRODIGI_KEY,
    },
    body: JSON.stringify({
      shippingMethod,
      destinationCountryCode,
      currencyCode: 'USD',
      items: items.map(i => ({
        sku: i.sku,
        copies: i.copies,
        attributes: { finish },
        assets: [{ printArea: 'default' }],
      })),
    } as ProdigiQuoteRequest),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Prodigi quote failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as ProdigiQuoteResponse
  // Prodigi returns warnings (e.g. sales tax notice) with outcome 'CreatedWithIssues'.
  // Only fail if there are literally no quotes to use.
  if (!data.quotes?.length) {
    throw new Error(`Prodigi quote returned no quotes: ${JSON.stringify(data.issues ?? data)}`)
  }
  const cheapest = data.quotes.reduce((min, q) =>
    parseFloat(q.costSummary.shipping.amount) < parseFloat(min.costSummary.shipping.amount) ? q : min
  )
  return {
    shippingCents: Math.round(parseFloat(cheapest.costSummary.shipping.amount) * 100),
    itemsCents: Math.round(parseFloat(cheapest.costSummary.items.amount) * 100),
    currency: cheapest.costSummary.shipping.currency,
    method: cheapest.shipmentMethod,
  }
}
