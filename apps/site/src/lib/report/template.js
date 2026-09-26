// The market report's words. Fixed, pre-written sentence structures with numbers slotted
// in — no AI-generated or freeform text. Edit wording here; the PDF layout is in pdf.js.
//
// Two views of the numbers:
//   property  — AirROI Estimate Listing Revenue Potential (comparable nearby listings)
//   city      — AirROI Get Market Summary (city-wide averages, cached per city)

const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = (n) => `${Math.round(n * 100)}%`;

// City figures are optional: if they're missing the report still goes out, property-only.
export const hasCity = (city) => Boolean(city && city.summary && city.summary.adr !== null && city.summary.occupancy !== null);

// Quality gate. There's no human review before the report is emailed, so anything that
// looks thin or implausible is held for the team instead of sent (see pipeline.js).
export function assessQuality(m, { minComps = 5, city = null } = {}) {
  const reasons = [];
  if (m.revenue === null || m.occupancy === null || m.adr === null || m.revpar === null) reasons.push('AirROI returned incomplete property data');
  if (m.comps === null || m.comps < minComps) reasons.push(`only ${m.comps ?? 0} comparable listings (minimum ${minComps})`);
  if (m.occupancy !== null && (m.occupancy <= 0.05 || m.occupancy > 1)) reasons.push(`implausible occupancy (${m.occupancy})`);
  if (m.adr !== null && (m.adr < 25 || m.adr > 5000)) reasons.push(`implausible nightly rate (${m.adr})`);
  if (m.revenue !== null && (m.revenue < 1000 || m.revenue > 2_000_000)) reasons.push(`implausible annual revenue (${m.revenue})`);
  // A property estimate wildly out of line with its own city usually means bad comps.
  if (hasCity(city) && m.adr !== null && city.summary.adr > 0) {
    const ratio = m.adr / city.summary.adr;
    if (ratio > 3 || ratio < 1 / 3) reasons.push(`nightly rate ${usd(m.adr)} is far from the ${city.name} average of ${usd(city.summary.adr)}`);
  }
  return { ok: reasons.length === 0, reasons };
}

// "8% above", "12% below", "in line with"
export function compare(value, average) {
  const diff = Math.round(((value - average) / average) * 100);
  if (Math.abs(diff) < 2) return 'in line with';
  return `${Math.abs(diff)}% ${diff > 0 ? 'above' : 'below'}`;
}

export function buildReport({ data, metrics, city = null, schedulingUrl, date = new Date() }) {
  const address = `${data.street}, ${data.city}, ${data.state} ${data.zip}`;
  const rooms = data.bedrooms === 'Studio' ? 'studio' : `${data.bedrooms}-bedroom`;
  const withCity = hasCity(city);
  const c = withCity ? city.summary : null;

  const paragraphs = [
    `Comparable ${rooms} rentals near ${address} earned an estimated ${usd(metrics.revenue)} over the last twelve months.`,
    `These properties were booked ${pct(metrics.occupancy)} of available nights at an average daily rate (ADR) of ${usd(metrics.adr)}, or ${usd(metrics.revpar)} in revenue per available night (RevPAR).`,
  ];
  if (withCity) {
    paragraphs.push(
      `Across ${city.name}, short-term rentals averaged ${pct(c.occupancy)} occupancy at ${usd(c.adr)} a night (RevPAR ${usd(c.revpar ?? c.adr * c.occupancy)}).`,
      `Your property’s projected nightly rate is ${compare(metrics.adr, c.adr)} the ${city.name} average.`,
    );
  }
  paragraphs.push(`This estimate is based on ${metrics.comps} comparable listings in the surrounding area.`);

  return {
    title: 'Short-Term Rental Market Report',
    preparedFor: data.name,
    address,
    date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    tilesLabel: 'Your property',
    tiles: [
      { label: 'Est. annual revenue', value: usd(metrics.revenue) },
      { label: 'Occupancy', value: pct(metrics.occupancy) },
      { label: 'Avg. daily rate', value: usd(metrics.adr) },
      { label: 'RevPAR', value: usd(metrics.revpar) },
    ],
    cityLabel: withCity ? `${city.name} average` : null,
    cityTiles: withCity
      ? [
          { label: 'Avg. annual revenue', value: c.revenue !== null ? usd(c.revenue) : '—' },
          { label: 'Occupancy', value: pct(c.occupancy) },
          { label: 'Avg. daily rate', value: usd(c.adr) },
          { label: 'RevPAR', value: usd(c.revpar ?? c.adr * c.occupancy) },
        ]
      : null,
    paragraphs,
    nextSteps: [
      'Corporate housing typically trades a little nightly rate for longer, steadier stays and less turnover.',
      'Our team will walk you through what 5R Suites could do with your property — furnishing, guest placement and day-to-day management.',
    ],
    schedulingUrl,
    disclaimer:
      'Figures are estimates derived from third-party market data (AirROI) for comparable short-term rentals and city-wide averages. They are not a guarantee of future performance. Actual results depend on the property, its condition, pricing and market changes.',
  };
}
