import { isFormType } from '@5rsuites/blocks';

export const SUBMISSION_STATUSES = ['new', 'read', 'archived'];

export function submissionFilter(searchParams) {
  const type = isFormType(searchParams.get('type')) ? searchParams.get('type') : null;
  const status = searchParams.get('status');
  const where = [];
  const binds = [];
  if (type) {
    where.push('form_type = ?');
    binds.push(type);
  }
  if (SUBMISSION_STATUSES.includes(status)) {
    where.push('status = ?');
    binds.push(status);
  } else if (status !== 'all') {
    where.push(`status != 'archived'`);
  }
  return { type, clause: where.length ? `WHERE ${where.join(' AND ')}` : '', binds };
}
