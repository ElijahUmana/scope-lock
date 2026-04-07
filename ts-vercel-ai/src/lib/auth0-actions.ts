// Auth0 Actions for Scope Lock.
// These are exported as string constants so they can be displayed
// in the Insights page as reference implementations.
// In production, these would be deployed as Auth0 Actions in the Auth0 Dashboard.

/**
 * Post-Login Action
 *
 * Runs after every successful login. Enriches the ID token with custom claims
 * under the 'https://scopelock.dev' namespace so the frontend can display
 * connected-account metadata, agent permissions, and scope-grant counts
 * without an extra API call.
 */
export const POST_LOGIN_ACTION = `
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://scopelock.dev';

  // Count federated identities (Google, GitHub, Slack, etc.)
  const connectedAccounts = (event.user.identities || []).length;

  // Scopes the user has previously granted to agents
  const scopeGrants = event.user.app_metadata?.scope_grants || [];

  // Which agents this user has authorized
  const agentAccess = event.user.app_metadata?.agent_access || [
    'email-reader',
    'calendar-assistant',
  ];

  // Set custom claims on the ID token
  api.idToken.setCustomClaim(\`\${namespace}/connected_accounts\`, connectedAccounts);
  api.idToken.setCustomClaim(\`\${namespace}/last_login\`, event.request.date || new Date().toISOString());
  api.idToken.setCustomClaim(\`\${namespace}/agent_access\`, agentAccess);
  api.idToken.setCustomClaim(\`\${namespace}/scope_grants_count\`, scopeGrants.length);

  // Persist login timestamp in app_metadata for audit
  api.user.setAppMetadata('last_login', new Date().toISOString());
};
`.trim();

/**
 * Token Exchange Action (Token Vault)
 *
 * Runs during a Token Vault credential exchange. Logs every scope request
 * for audit purposes and blocks high-risk scopes (write, compose, financial)
 * unless the user has completed step-up authentication in the current session.
 */
export const TOKEN_EXCHANGE_ACTION = `
exports.onExecuteCredentialExchange = async (event, api) => {
  const requestedScopes = event.request.requested_scopes || [];
  const connection = event.request.connection || 'unknown';
  const userId = event.user.user_id;

  // ── Audit: log every token exchange attempt ──
  console.log(JSON.stringify({
    action: 'token_vault_exchange',
    userId,
    connection,
    requestedScopes,
    timestamp: new Date().toISOString(),
    ip: event.request.ip,
    userAgent: event.request.user_agent,
  }));

  // ── High-risk scope detection ──
  const HIGH_RISK_SCOPES = [
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
    'product:buy',
    'repo:write',
  ];

  const riskyScopes = requestedScopes.filter(
    (scope) => HIGH_RISK_SCOPES.includes(scope)
  );

  if (riskyScopes.length === 0) {
    // Read-only scopes: allow without step-up
    return;
  }

  // Check whether step-up auth was completed in this session
  const stepUpCompleted =
    event.user.app_metadata?.step_up_completed_at &&
    (Date.now() - new Date(event.user.app_metadata.step_up_completed_at).getTime()) < 300_000; // 5-minute window

  if (!stepUpCompleted) {
    console.log(JSON.stringify({
      action: 'token_vault_exchange_blocked',
      userId,
      connection,
      riskyScopes,
      reason: 'Step-up authentication required for high-risk scopes',
    }));

    api.access.deny(
      'step_up_required',
      'High-risk scopes require step-up authentication. ' +
      'Complete CIBA verification before retrying.'
    );
    return;
  }

  // Step-up verified: allow the exchange
  console.log(JSON.stringify({
    action: 'token_vault_exchange_approved',
    userId,
    connection,
    riskyScopes,
    stepUpAge: Date.now() - new Date(event.user.app_metadata.step_up_completed_at).getTime(),
  }));
};
`.trim();
