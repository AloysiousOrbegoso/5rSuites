// The fixed set of section types staff can place on a page.
//
// One definition per block drives three things:
//   - the admin editor form (fields are rendered from `fields`)
//   - API validation (`validateSection` cleans and checks data before it hits D1)
//   - the public site renderer (apps/site/src/components/blocks/<Type>.astro)
//
// To add a layout: add a definition here, add the type to the CHECK constraint in a
// new migration, and add a renderer on the site. Never add a raw HTML/custom code block.

export const ICONS = [
  'wifi', 'kitchen', 'laundry', 'parking', 'workspace', 'tv', 'gym', 'pool',
  'pets', 'cleaning', 'linens', 'utilities', 'security', 'support', 'location', 'calendar',
];

const text = (name, label, opts = {}) => ({ name, label, kind: 'text', max: 200, ...opts });
const textarea = (name, label, opts = {}) => ({ name, label, kind: 'textarea', max: 2000, ...opts });
const markdown = (name, label, opts = {}) => ({ name, label, kind: 'markdown', max: 20000, ...opts });
const url = (name, label, opts = {}) => ({ name, label, kind: 'url', max: 500, ...opts });
const image = (name, label, opts = {}) => ({ name, label, kind: 'image', ...opts });
const select = (name, label, options, opts = {}) => ({ name, label, kind: 'select', options, default: options[0], ...opts });
const number = (name, label, opts = {}) => ({ name, label, kind: 'number', min: 0, max: 1000, ...opts });
const list = (name, label, fields, opts = {}) => ({ name, label, kind: 'list', fields, max: 24, ...opts });

export const BLOCKS = {
  hero: {
    label: 'Hero',
    description: 'Banner at the top of a page. "Full" is the tall home-page hero with text and buttons; "Title" is the shorter banner used on inner pages.',
    fields: [
      select('variant', 'Style', ['full', 'title']),
      text('eyebrow', 'Small label above heading', { max: 80 }),
      text('heading', 'Heading', { required: true }),
      textarea('subheading', 'Text under the heading', { max: 1000 }),
      image('image', 'Background image'),
      text('cta_label', 'Primary button label', { max: 60 }),
      url('cta_url', 'Primary button link'),
      text('secondary_label', 'Secondary button label', { max: 60 }),
      url('secondary_url', 'Secondary button link'),
    ],
  },
  rich_text: {
    label: 'Text',
    description: 'Heading and formatted text, optionally beside a photo. Supports **bold**, *italic*, [links](https://…), lists and ## headings.',
    fields: [
      text('heading', 'Heading'),
      markdown('body', 'Body', { required: true }),
      image('image', 'Photo beside the text (optional)'),
      select('image_side', 'Photo position', ['right', 'left']),
      select('background', 'Background', ['white', 'cream', 'gold', 'navy']),
      select('align', 'Text alignment', ['left', 'center']),
      text('button_label', 'Button label', { max: 60 }),
      url('button_url', 'Button link'),
    ],
  },
  image_gallery: {
    label: 'Image gallery',
    description: 'A grid of photos, or a strip of partner logos.',
    fields: [
      text('heading', 'Heading'),
      select('variant', 'Style', ['grid', 'logo_strip']),
      list('images', 'Images', [
        image('image', 'Image', { required: true }),
        text('caption', 'Caption', { max: 200 }),
        url('link', 'Link (optional)'),
      ], { max: 40 }),
    ],
  },
  traveler_grid: {
    label: 'Numbered cards',
    description: 'Numbered cards (01, 02, 03…), e.g. “Ideal choice for” or partner benefits.',
    fields: [
      text('heading', 'Heading'),
      textarea('intro', 'Intro', { max: 600 }),
      select('background', 'Background', ['white', 'cream']),
      list('items', 'Cards', [
        text('title', 'Title', { required: true, max: 100 }),
        textarea('description', 'Description', { max: 800 }),
        image('image', 'Icon or image'),
      ]),
    ],
  },
  amenity_grid: {
    label: 'Amenity grid',
    description: 'Cards with an icon and a short label.',
    fields: [
      text('heading', 'Heading'),
      textarea('intro', 'Intro', { max: 800 }),
      list('items', 'Amenities', [
        select('icon', 'Icon', ICONS),
        text('label', 'Label', { required: true, max: 80 }),
        textarea('description', 'Description', { max: 300 }),
      ], { max: 32 }),
    ],
  },
  cta_banner: {
    label: 'Banner',
    description: 'A full-width coloured or photo band with a heading and a button.',
    fields: [
      text('heading', 'Heading', { required: true }),
      textarea('body', 'Text', { max: 600 }),
      text('button_label', 'Button label', { max: 60 }),
      url('button_url', 'Button link'),
      select('tone', 'Background', ['gold', 'navy', 'brown', 'photo']),
      image('image', 'Background photo (for “photo”)'),
      select('size', 'Size', ['normal', 'large']),
    ],
  },
  quote: {
    label: 'Quote',
    description: 'A testimonial or pull quote.',
    fields: [
      textarea('quote', 'Quote', { required: true, max: 1000 }),
      text('attribution', 'Name', { max: 120 }),
      text('role', 'Role / company', { max: 120 }),
      select('tone', 'Background', ['brown', 'white', 'navy']),
    ],
  },
  contact_strip: {
    label: 'Contact info',
    description: 'Address, phone and email in a card, optionally with a map.',
    fields: [
      text('heading', 'Heading'),
      textarea('address', 'Address', { max: 300 }),
      text('phone', 'Phone', { max: 40 }),
      text('email', 'Email', { max: 120 }),
      text('hours', 'Hours', { max: 120 }),
      select('style', 'Card colour', ['brown', 'white']),
      text('map_query', 'Show a map of (address or place, optional)', { max: 200 }),
    ],
  },
  faq_list: {
    label: 'FAQ list',
    description: 'Questions and answers. Content is managed under FAQ in the sidebar.',
    fields: [
      text('heading', 'Heading'),
      text('subheading', 'Subheading', { max: 200 }),
      text('category', 'Only show category (blank = all, with tabs per category)', { max: 80 }),
      number('limit', 'Max questions (0 = all)', { max: 200 }),
    ],
  },
  unit_grid: {
    label: 'Unit grid',
    description: 'Cards for active units. Units are managed under Units in the sidebar.',
    fields: [
      text('heading', 'Heading'),
      textarea('intro', 'Intro', { max: 600 }),
      text('city', 'Only show city (blank = all)', { max: 80 }),
      number('limit', 'Max units (0 = all)', { max: 200 }),
    ],
  },
  form: {
    label: 'Form',
    description: 'One of the site’s fixed forms. Fields are fixed; submissions appear under Submissions.',
    fields: [
      select('form', 'Which form', ['contact', 'register_property', 'careers']),
      text('heading', 'Heading'),
      textarea('intro', 'Intro', { max: 600 }),
    ],
  },
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Allowed link targets: site-relative paths, anchors, http(s), mailto and tel.
export function isSafeUrl(value) {
  if (value === '') return true;
  if (/^\/(?!\/)/.test(value) || value.startsWith('#')) return true;
  return /^(https?:\/\/|mailto:|tel:)[^\s]+$/i.test(value);
}

function cleanField(field, raw, path) {
  const where = `${path}${field.label}`;
  switch (field.kind) {
    case 'text':
    case 'textarea':
    case 'markdown':
    case 'url': {
      let v = raw == null ? '' : String(raw);
      v = field.kind === 'text' || field.kind === 'url' ? v.replace(/\s+/g, ' ').trim() : v.replace(/\r\n/g, '\n').trim();
      if (v.length > field.max) throw new ValidationError(`${where} must be ${field.max} characters or fewer.`);
      if (field.required && !v) throw new ValidationError(`${where} is required.`);
      if (field.kind === 'url' && !isSafeUrl(v)) {
        throw new ValidationError(`${where} must start with /, https://, mailto: or tel:.`);
      }
      return v;
    }
    case 'image': {
      if (raw === null || raw === undefined || raw === '') {
        if (field.required) throw new ValidationError(`${where} is required.`);
        return null;
      }
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`${where} is not a valid image.`);
      return id;
    }
    case 'select': {
      const v = raw == null || raw === '' ? field.default : String(raw);
      if (!field.options.includes(v)) throw new ValidationError(`${where} must be one of: ${field.options.join(', ')}.`);
      return v;
    }
    case 'number': {
      const n = raw === '' || raw == null ? 0 : Number(raw);
      if (!Number.isInteger(n) || n < field.min || n > field.max) {
        throw new ValidationError(`${where} must be a whole number between ${field.min} and ${field.max}.`);
      }
      return n;
    }
    case 'list': {
      const items = raw == null ? [] : raw;
      if (!Array.isArray(items)) throw new ValidationError(`${where} must be a list.`);
      if (items.length > field.max) throw new ValidationError(`${where} can have at most ${field.max} items.`);
      return items.map((item, i) => cleanObject(field.fields, item ?? {}, `${where} #${i + 1} › `));
    }
    default:
      throw new ValidationError(`Unknown field kind ${field.kind}`);
  }
}

function cleanObject(fields, data, path = '') {
  if (typeof data !== 'object' || Array.isArray(data)) throw new ValidationError(`${path || 'Section data'} must be an object.`);
  const out = {};
  // Unknown keys are dropped: only fields in the definition are stored.
  for (const field of fields) out[field.name] = cleanField(field, data[field.name], path);
  return out;
}

// Returns cleaned data for storage, or throws ValidationError.
export function validateSection(type, data) {
  const def = BLOCKS[type];
  if (!def) throw new ValidationError(`Unknown section type "${type}".`);
  return cleanObject(def.fields, data ?? {});
}

export function defaultData(type) {
  const def = BLOCKS[type];
  const out = {};
  for (const f of def.fields) {
    out[f.name] = f.kind === 'list' ? [] : f.kind === 'image' ? null : f.kind === 'number' ? 0 : f.kind === 'select' ? f.default : '';
  }
  return out;
}

// Every media id referenced anywhere in a section's data (for resolving image URLs in one query).
export function collectImageIds(type, data) {
  const ids = new Set();
  const walk = (fields, obj) => {
    for (const f of fields) {
      const v = obj?.[f.name];
      if (f.kind === 'image' && Number.isInteger(v)) ids.add(v);
      if (f.kind === 'list' && Array.isArray(v)) v.forEach((item) => walk(f.fields, item));
    }
  };
  if (BLOCKS[type]) walk(BLOCKS[type].fields, data);
  return ids;
}
