// The public site's fixed forms. This is the one list of form types: the admin (labels,
// filters, CSV), the site (field specs, notification emails) and the "Form" block's
// dropdown all derive from it. A new form also needs: a CHECK-constraint migration for
// form_submissions.form_type, and a FORMS entry in apps/site/src/lib/form-specs.js.

export const FORM_TYPES = {
  contact: { label: 'Contact' },
  register_property: { label: 'Register Property' },
  careers: { label: 'Careers' },
};

export const FORM_TYPE_IDS = Object.keys(FORM_TYPES);

export const isFormType = (value) => Object.hasOwn(FORM_TYPES, value);

// Display name for a stored form_type; unknown values are shown as stored.
export const formLabel = (type) => FORM_TYPES[type]?.label ?? type;
