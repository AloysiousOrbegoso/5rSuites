import { escapeHtml, sendEmail, simpleEmailHtml } from '@5rsuites/server/email';
import { loadSettings } from '@5rsuites/server/settings';
import { estimateProperty, getCityMarket, guestsFor, parseRooms } from './airroi.js';
import { geocode } from './geocode.js';
import { renderReportPdf } from './pdf.js';
import { assessQuality, buildReport } from './template.js';

// Register Property: address → Census geocoder → AirROI (property estimate + cached city
// figures) → fixed template → branded PDF → emailed to the submitter with a scheduling link.
// Runs after the submission is already saved in D1.
//
// Paid AirROI calls per report: Estimate Listing Revenue Potential ($0.20) every time;
// Find Market by Coordinates + Get Market Summary ($0.11) only when the city isn't cached.
//
// There is no human review step. To limit the "weak report for an unusual address" risk,
// reports that fail assessQuality() are HELD: the submitter gets a plain thank-you, the team
// gets an alert, and the submission shows "Report held — needs review" in the admin.
// Failures are never retried automatically, so nothing is billed twice.

export async function runRegisterPropertyPipeline(env, { id, data }) {
  // “Book a call” link: the Settings screen (which itself falls back to the wrangler var).
  const settings = await loadSettings(env.DB, env).catch(() => ({}));
  const schedulingUrl = settings.scheduling_url || '';
  const address = `${data.street}, ${data.city}, ${data.state} ${data.zip}`;
  let metrics = null;
  let city = null;
  let location = null;
  let status;
  let error = null;
  let quality = null;

  try {
    location = await geocode(address);
    if (!location) throw new Error('the address could not be found by the U.S. Census geocoder');

    const bedrooms = parseRooms(data.bedrooms);
    metrics = await estimateProperty(env, {
      lat: location.lat,
      lng: location.lng,
      bedrooms,
      baths: parseRooms(data.bathrooms),
      guests: guestsFor(bedrooms),
    });

    // City comparison is a bonus: if it fails, the report still goes out property-only.
    try {
      city = await getCityMarket(env, { city: data.city, state: data.state, lat: location.lat, lng: location.lng });
    } catch (err) {
      console.error('[report] city market lookup failed', id, err);
    }

    quality = assessQuality(metrics, { minComps: Number(env.REPORT_MIN_COMPS) || 5, city });

    if (quality.ok) {
      const report = buildReport({ data, metrics, city, schedulingUrl });
      const pdf = await renderReportPdf(report);
      const sent = await sendEmail(env, {
        to: data.email,
        subject: 'Your 5R Suites market report',
        html: simpleEmailHtml(`Your market report for ${data.street}`, [
          `Hi ${data.name}, thanks for telling us about your property.`,
          'Your short-term rental market report is attached. It shows what comparable rentals near you have earned, and how that compares with your city.',
          schedulingUrl ? 'When you’re ready, book a call with our team to talk through the numbers and next steps.' : 'Our team will be in touch shortly to talk through the numbers and next steps.',
        ], schedulingUrl ? { label: 'Book a call', url: schedulingUrl } : undefined),
        attachments: [{ filename: '5R-Suites-Market-Report.pdf', content: toBase64(pdf) }],
      });
      status = sent.ok ? 'sent' : 'failed';
      if (!sent.ok) error = `Report email failed: ${sent.error}`;
    } else {
      status = 'held';
      error = `Held for review: ${quality.reasons.join('; ')}`;
    }
  } catch (err) {
    status = 'held';
    error = `Held — report could not be generated: ${err?.message || err}`;
  }

  if (status === 'held') {
    // Still acknowledge the submitter; a person follows up with the numbers.
    await sendEmail(env, {
      to: data.email,
      subject: 'Thanks for registering your property with 5R Suites',
      html: simpleEmailHtml('Thanks — we’re on it', [
        `Hi ${data.name}, thanks for telling us about your property at ${data.street}.`,
        'A member of our team is preparing your market report and will be in touch shortly.',
      ], schedulingUrl ? { label: 'Book a call', url: schedulingUrl } : undefined),
    });
    if (env.TEAM_ALERT_EMAIL) {
      await sendEmail(env, {
        to: env.TEAM_ALERT_EMAIL,
        subject: `Market report held — ${address}`,
        html: `<div style="font-family:system-ui,sans-serif"><p>The automated market report for submission #${id} (${escapeHtml(data.name)}, ${escapeHtml(address)}) was <strong>not sent</strong>.</p><p>${escapeHtml(error)}</p><p>The submitter received a thank-you and was told the team will follow up. See Submissions in the admin.</p></div>`,
      });
    }
  }

  await env.DB.prepare('UPDATE form_submissions SET report_status = ?, report_data = ?, report_error = ? WHERE id = ?')
    .bind(status, JSON.stringify({ metrics, city: city && { name: city.name, cached: city.cached, ...city.summary }, location, quality, source: 'AirROI', generated_at: new Date().toISOString() }), error, id)
    .run();
}

function toBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}
