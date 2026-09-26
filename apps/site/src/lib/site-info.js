// Business details shown in the top bar and footer on every page.
// Set in wrangler.jsonc "vars" (changing them needs a deploy, not a CMS edit).
export function siteInfo(env) {
  const socials = [
    ['facebook', 'Facebook', env.FACEBOOK_URL],
    ['instagram', 'Instagram', env.INSTAGRAM_URL],
    ['youtube', 'YouTube', env.YOUTUBE_URL],
  ]
    .filter(([, , url]) => url)
    .map(([name, label, url]) => ({ name, label, url }));
  return {
    siteUrl: env.SITE_URL || 'https://www.5rsuites.com',
    bookingUrl: env.BOOKING_URL || 'https://5rsuites.holidayfuture.com',
    phone: env.CONTACT_PHONE || '',
    email: env.CONTACT_EMAIL || '',
    mailingAddress: env.MAILING_ADDRESS || '',
    privacyUrl: env.PRIVACY_URL || '',
    termsUrl: env.TERMS_URL || '',
    socials,
  };
}
