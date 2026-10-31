// Closing a workshop keeps its data for this long so a mistake can be undone; then it is erased for good.
export const CLOSURE_GRACE_DAYS = 30;

export const CLOSED_BY = ['owner', 'saas_admin'] as const;
export type ClosedBy = (typeof CLOSED_BY)[number];

/** The workshop's administrator closing their own account. */
export interface CloseAccountRequest {
  /** The administrator's current password. */
  password: string;
  /** The workshop name, typed to confirm. */
  confirmName: string;
}

export interface CloseAccountResponse {
  /** When the data is erased for good if nobody restores the account. */
  purgeAfter: string;
}

/** The SaaS manager closing a workshop. */
export interface AdminCloseRequest {
  reason?: string | null;
}

/** The SaaS manager erasing a closed workshop for good, by typing its name. */
export interface AdminPurgeRequest {
  confirmName: string;
}
