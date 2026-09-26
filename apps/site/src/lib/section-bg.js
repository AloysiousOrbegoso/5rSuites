// Background colour at the top/bottom edge of each section, so wave edges can blend
// into the neighbouring section's colour.
const COLORS = { white: '#ffffff', cream: '#f3ecd9', gold: '#d4c284', navy: '#183b5f', brown: '#846438', photo: '#555b63' };

export function sectionBg(section) {
  const d = section.data || {};
  switch (section.type) {
    case 'rich_text':
    case 'traveler_grid':
      return COLORS[d.background] || COLORS.white;
    case 'cta_banner':
      return COLORS[d.tone] || COLORS.gold;
    case 'quote':
      return COLORS[d.tone] || COLORS.brown;
    case 'unit_grid':
      return COLORS.cream;
    case 'hero':
      return COLORS.photo;
    default:
      return COLORS.white;
  }
}
