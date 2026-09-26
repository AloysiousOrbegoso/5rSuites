// Field definitions for the public forms. The same spec renders the form
// (components/forms/SiteForm.astro) and validates the submission (pages/api/forms/[form].js).
// Fields mirror the forms on the previous Wix site.
//
// Field types: text, email, tel, url, number, date, select, textarea, radio, checkboxes,
// consent (single checkbox), file, and heading (a sub-heading inside the form, not a field).

const first = { name: 'first_name', label: 'First Name', required: true, max: 60, autocomplete: 'given-name' };
const last = { name: 'last_name', label: 'Last Name', required: true, max: 60, autocomplete: 'family-name' };
const phone = { name: 'phone', label: 'Phone Number', type: 'tel', required: true, max: 40, autocomplete: 'tel' };
const email = { name: 'email', label: 'Enter Your Email', type: 'email', required: true, max: 200, autocomplete: 'email' };
const message = (required = true) => ({ name: 'message', label: 'Write Your Message Here...', type: 'textarea', required, max: 5000, full: true });
const consent = { name: 'sms_consent', label: 'By checking this box you agree to receive text messages from 5R Suites', type: 'consent', full: true };

export const FORMS = {
  contact: {
    submitLabel: 'Send',
    success: 'Thanks for submitting! We’ll be in touch soon.',
    fields: [first, last, phone, email, { name: 'subject', label: 'Enter Your Subject', max: 200, full: true }, message(), consent],
  },
  register_property: {
    submitLabel: 'Send',
    success: 'Thanks for submitting! Check your inbox — we’re preparing your free market report.',
    fields: [
      first, last, phone, email,
      { name: 'property_website', label: 'Property Website', type: 'url', max: 300, full: true },
      { type: 'heading', label: 'Property Information' },
      { name: 'street', label: 'Street Address', required: true, max: 200, autocomplete: 'street-address' },
      { name: 'city', label: 'City', required: true, max: 80, autocomplete: 'address-level2' },
      { name: 'state', label: 'Region/State/Province', required: true, max: 80, autocomplete: 'address-level1' },
      { name: 'zip', label: 'ZIP / Postal Code', required: true, max: 12, autocomplete: 'postal-code' },
      { name: 'property_type', label: 'Property Type', type: 'select', required: true, full: true,
        options: ['Apartment', 'Condo', 'House', 'Townhouse', 'Other'] },
      { type: 'heading', label: 'Property Description' },
      { name: 'monthly_rent', label: 'Monthly Rent', type: 'number', max: 12 },
      { name: 'security_deposit', label: 'Security Deposit', type: 'number', max: 12 },
      { name: 'available_date', label: 'Available Date', type: 'date', max: 10 },
      { name: 'lease_duration', label: 'Lease Duration', max: 80 },
      { name: 'bedrooms', label: 'Bedrooms', type: 'select', required: true, options: ['Studio', '1', '2', '3', '4', '5+'] },
      { name: 'bathrooms', label: 'Bathrooms', type: 'select', required: true, options: ['1', '1.5', '2', '2.5', '3', '3+'] },
      { name: 'size_sqft', label: 'Size (ft²)', type: 'number', max: 8 },
      { name: 'parking', label: 'Parking', type: 'select', options: ['None', 'Street', '1 space', '2+ spaces', 'Garage'] },
      { type: 'heading', label: 'Specification' },
      { name: 'pets_allowed', label: 'Pets Allowed', type: 'radio', required: true, options: ['Yes', 'No'] },
      { name: 'attachment', label: 'Upload File', type: 'file', accept: '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx' },
      { name: 'amenities', label: 'Amenities', type: 'checkboxes', group: true,
        options: ['Swimming Pool', 'Balcony', 'Barbeque Grill', 'Lobby', 'Study/Common Area', 'Party Rooms'] },
      { name: 'appliances', label: 'Appliances', type: 'checkboxes', group: true,
        options: ['A/C', 'Refrigerator', 'Dish Washer', 'Stove', 'Kitchen Ware', 'Washer/Dryer'] },
      { name: 'front_door', label: 'Front Door', type: 'checkboxes', group: true,
        options: ['Butterfly MX', 'Doorking Call Box', 'Keys', 'Others'] },
      message(false),
      consent,
    ],
  },
  careers: {
    submitLabel: 'Submit',
    success: 'Thanks for applying! We’ll review your application and get back to you.',
    fields: [
      first, last, { ...email, label: 'Email' }, phone,
      { name: 'resume', label: 'Upload Your Resume', type: 'file', required: true, accept: '.pdf,.doc,.docx' },
      { name: 'subject', label: 'Enter Your Subject', required: true, max: 200 },
      message(), consent,
    ],
  },
};

export const ATTACHMENT_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const fileField = (type) => FORMS[type].fields.find((f) => f.type === 'file') || null;

// Returns { data } or { error }.
export function validateForm(type, formData) {
  const spec = FORMS[type];
  const data = {};
  for (const f of spec.fields) {
    if (f.type === 'file' || f.type === 'heading') continue;
    const label = f.label.replace(/^Enter Your |^Write Your /, '').replace(/ Here\.*$/, '').replace(/\.+$/, '');
    if (f.type === 'checkboxes') {
      const values = formData.getAll(f.name).map(String).filter((v) => f.options.includes(v));
      if (f.required && !values.length) return { error: `Please choose at least one option for ${label}.` };
      data[f.name] = values.join(', ');
      continue;
    }
    if (f.type === 'consent') {
      data[f.name] = formData.get(f.name) ? 'Yes' : 'No';
      continue;
    }
    let v = formData.get(f.name);
    v = typeof v === 'string' ? v.trim() : '';
    if (f.type !== 'textarea') v = v.replace(/\s+/g, ' ');
    if (f.required && !v) return { error: `${label} is required.` };
    if (v.length > (f.max ?? 200)) return { error: `${label} is too long.` };
    if (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: 'Please enter a valid email address.' };
    if (v && (f.type === 'select' || f.type === 'radio') && !f.options.includes(v)) return { error: `Please choose one of the options for ${label}.` };
    if (v && f.type === 'number' && !/^\d+(\.\d{1,2})?$/.test(v)) return { error: `${label} must be a number.` };
    if (v && f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${label} must be a date.` };
    if (v && f.type === 'url' && !/^https?:\/\/\S+$/i.test(v)) return { error: `${label} must start with https://` };
    data[f.name] = v;
  }
  data.name = [data.first_name, data.last_name].filter(Boolean).join(' ');
  return { data };
}
