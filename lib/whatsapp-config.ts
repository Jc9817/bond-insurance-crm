// Server-only. The WhatsApp screen's settings, all from Vercel environment
// variables (docs/whatsapp-ycloud-setup.md). Read nowhere else.
//
//   YCLOUD_API_KEY               sent as X-API-Key (media downloads, endpoint check)
//   YCLOUD_WEBHOOK_SECRET        the endpoint secret YCloud shows when the webhook is created
//   WHATSAPP_BUSINESS_NUMBER     the connected number, e.g. +60123456789; other numbers are ignored
//   WHATSAPP_STORE_AUDIO_VIDEO   "true" to keep voice notes and videos too (default: off)
//   WHATSAPP_SYNC_BUSINESS_APP   "true" to also show what staff send from the phone (default: off)
//   WHATSAPP_AI                  "true" to have the AI read messages and suggest a case (default: off —
//                                staff read the messages and files and file them by hand)

const on = (v: string | undefined) => (v ?? '').trim().toLowerCase() === 'true'

export function whatsappConfig() {
  return {
    apiKey: process.env.YCLOUD_API_KEY?.trim() ?? '',
    webhookSecret: process.env.YCLOUD_WEBHOOK_SECRET?.trim() ?? '',
    businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER?.trim() ?? '',
    storeAudioVideo: on(process.env.WHATSAPP_STORE_AUDIO_VIDEO),
    syncBusinessApp: on(process.env.WHATSAPP_SYNC_BUSINESS_APP),
    aiEnabled: on(process.env.WHATSAPP_AI),
  }
}

/** The names of the settings still missing (empty when WhatsApp is ready). */
export function missingWhatsappSettings(): string[] {
  const c = whatsappConfig()
  return [
    !c.apiKey && 'YCLOUD_API_KEY',
    !c.webhookSecret && 'YCLOUD_WEBHOOK_SECRET',
    !c.businessNumber && 'WHATSAPP_BUSINESS_NUMBER',
  ].filter((s): s is string => !!s)
}
