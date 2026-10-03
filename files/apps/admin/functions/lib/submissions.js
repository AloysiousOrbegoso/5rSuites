import { isFormType } from '@5rsuites/blocks';

export const SUBMISSION_STATUSES = ['new', 'read', 'archived'];

// WHERE clause shared by the Submissions list and the CSV export, so both always show the
// same rows for the same filters: ?type=<form type>, ?status=new|read|archived|all.
// With no status the "Inbox" applies (new + read; archived hidden).
export function submissionFilter(searchParams) {
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const where = [];
  const binds = [];
  if (isFormType(type)) {
    where.push('form_type = ?');
    binds.push(type);
  }
  if (SUBMISSION_STATUSES.includes(status)) {
    where.push('status = ?');
    binds.push(status);
  } else if (status !== 'all') {
    where.push(`status != 'archived'`);
  }
  return { type: isFormType(type) ? type : null, clause: where.length ? `WHERE ${where.join(' AND ')}` : '', binds };
}
