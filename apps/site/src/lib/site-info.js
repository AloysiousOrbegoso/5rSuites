import { loadSettings } from '@5rsuites/server/settings';

// Business details shown in the top bar and footer on every page. Edited in the admin's
// Settings screen; anything not set there falls back to the wrangler.jsonc vars.
export async function siteInfo(env) {
  const s = await loadSettings(env.DB, env);
  const socials = [
    ['facebook', 'Facebook', s.facebook_url],
    ['instagram', 'Instagram', s.instagram_url],
    ['youtube', 'YouTube', s.youtube_url],
  ]
    .filter(([, , url]) => url)
    .map(([name, label, url]) => ({ name, label, url }));
  return {
    siteUrl: env.SITE_URL || 'https://www.5rsuites.com',
    bookingUrl: s.booking_url,
    schedulingUrl: s.scheduling_url,
    phone: s.contact_phone,
    email: s.contact_email,
    mailingAddress: s.mailing_address,
    privacyUrl: s.privacy_url,
    termsUrl: s.terms_url,
    shareImage: s.share_image,
    socials,
  };
}
