// Rich Authorization Requests (RFC 9396) for Scope Lock.
// Standard CIBA sends a flat binding message ("Do you want to buy 3 widgets?").
// RAR replaces that with a structured, machine-readable authorization detail
// that includes amounts, currencies, creditor info, and action types.
// This enables audit trails, PSD2 compliance, and Open Banking interop.

/**
 * A single authorization detail object per RFC 9396.
 * Each detail describes one resource or transaction the client is requesting access to.
 */
export interface RichAuthorizationDetail {
  /** URI identifying the authorization type (e.g. "payment_initiation", "account_information") */
  type: string;
  /** Actions the client wants to perform (e.g. ["initiate", "confirm"]) */
  actions?: string[];
  /** Resource locations/URIs the actions apply to */
  locations?: string[];
  /** Monetary amount for payment-type requests */
  instructedAmount?: {
    currency: string;
    amount: string;
  };
  /** Name of the payment creditor */
  creditorName?: string;
  /** Account identifier of the creditor (e.g. IBAN) */
  creditorAccount?: string;
}

/**
 * Format an array of RAR details into a human-readable string.
 * Used in the consent UI to show the user exactly what they are authorizing.
 */
export function formatRARForDisplay(details: RichAuthorizationDetail[]): string {
  if (details.length === 0) {
    return 'No authorization details provided.';
  }

  const sections: string[] = [];

  for (let i = 0; i < details.length; i++) {
    const d = details[i];
    const lines: string[] = [];

    lines.push(`Authorization Detail ${i + 1}`);
    lines.push(`  Type: ${d.type}`);

    if (d.actions && d.actions.length > 0) {
      lines.push(`  Actions: ${d.actions.join(', ')}`);
    }

    if (d.locations && d.locations.length > 0) {
      lines.push(`  Resources: ${d.locations.join(', ')}`);
    }

    if (d.instructedAmount) {
      lines.push(`  Amount: ${d.instructedAmount.currency} ${d.instructedAmount.amount}`);
    }

    if (d.creditorName) {
      lines.push(`  Creditor: ${d.creditorName}`);
    }

    if (d.creditorAccount) {
      lines.push(`  Account: ${d.creditorAccount}`);
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}
