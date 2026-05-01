/**
 * Crew + shore roles used in approval flows, drill sign-off, and access control.
 * Expand as new role-bound workflows land (e.g. ISM auditor, DPA).
 */
export type Role =
  | 'master'
  | 'chief_engineer'
  | 'engineer'
  | 'officer'
  | 'crew'
  | 'shore_admin'
  | 'shore_purchaser'
  | 'shore_qhse'
  | 'shore_finance';
