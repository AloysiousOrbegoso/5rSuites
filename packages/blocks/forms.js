export const FORM_TYPES = {
  contact: { label: 'Contact' },
  register_property: { label: 'Register Property' },
  careers: { label: 'Careers' },
};

export const FORM_TYPE_IDS = Object.keys(FORM_TYPES);

export const isFormType = (value) => Object.hasOwn(FORM_TYPES, value);

export const formLabel = (type) => FORM_TYPES[type].label;
