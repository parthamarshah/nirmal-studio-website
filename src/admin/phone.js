// A WhatsApp number must carry its country code (wa.me/9106998434 reaches nobody).
// A 10-digit number starting 6–9 is an Indian mobile typed without it, so 91 is added.
// Run on blur, never per keystroke: halfway through typing 919106998434 the box holds
// 9191069984, which looks exactly like a 10-digit mobile.
export const withCountryCode = (v) => {
  if (typeof v !== 'string') return v
  const digits = v.replace(/\D/g, '')
  return /^[6-9]\d{9}$/.test(digits) ? '91' + digits : v
}
