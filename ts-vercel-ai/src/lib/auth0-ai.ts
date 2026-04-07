import { Auth0AI, getAccessTokenFromTokenVault } from '@auth0/ai-vercel';
import { AccessDeniedInterrupt } from '@auth0/ai/interrupts';

import { getRefreshToken, getUser } from './auth0';

// Get the access token for a connection via Auth0
export const getAccessToken = async () => getAccessTokenFromTokenVault();

const auth0AI = new Auth0AI();

// Progressive Authorization: Each service connection has isolated credentials
// with specific scope boundaries and credential lifecycle management.
//
// credentialsContext controls how long credentials are cached:
// - 'tool-call': Most restrictive — credentials valid for single invocation only
// - 'tool': Shared across multiple calls to the same tool within a thread
// - 'thread': Shared across all tools using the same authorizer in current thread
//
// Read operations use 'thread' (shared within conversation for performance)
// Write operations use 'tool-call' (isolated per invocation for security)
// External services use 'tool-call' (maximum isolation)

export const withGmailRead = auth0AI.withTokenVault({
  connection: 'google-oauth2',
  scopes: ['openid', 'https://www.googleapis.com/auth/gmail.readonly'],
  refreshToken: getRefreshToken,
  credentialsContext: 'thread',
});
export const withGmailWrite = auth0AI.withTokenVault({
  connection: 'google-oauth2',
  scopes: ['openid', 'https://www.googleapis.com/auth/gmail.compose'],
  refreshToken: getRefreshToken,
  credentialsContext: 'tool-call', // Write ops get per-invocation isolation
});
export const withCalendar = auth0AI.withTokenVault({
  connection: 'google-oauth2',
  scopes: ['openid', 'https://www.googleapis.com/auth/calendar.events'],
  refreshToken: getRefreshToken,
  credentialsContext: 'thread',
});

// Disabled integrations — retained because disabled tool files (list-gh-repos.ts,
// list-gh-events.ts, list-slack-channels.ts) still import these. Not wired into the chat route.
export const withGitHubConnection = auth0AI.withTokenVault({
  connection: 'github',
  scopes: [],
  refreshToken: getRefreshToken,
  credentialsContext: 'tool-call',
});

export const withSlack = auth0AI.withTokenVault({
  connection: 'sign-in-with-slack',
  scopes: ['channels:read', 'groups:read'],
  refreshToken: getRefreshToken,
  credentialsContext: 'tool-call',
});

export const withTasks = auth0AI.withTokenVault({
  connection: 'google-oauth2',
  scopes: ['https://www.googleapis.com/auth/tasks'],
  refreshToken: getRefreshToken,
  credentialsContext: 'thread',
});

// CIBA flow for user confirmation
export const withAsyncAuthorization = auth0AI.withAsyncAuthorization({
  userID: async () => {
    const user = await getUser();
    return user?.sub as string;
  },
  bindingMessage: async ({ product, qty }) => `Do you want to buy ${qty} ${product}`,
  scopes: ['openid', 'product:buy'],
  audience: process.env['SHOP_API_AUDIENCE']!,

  /**
   * Controls how long the authorization request is valid.
   */
  // requestedExpiry: 301,

  /**
   * The behavior when the authorization request is made.
   *
   * - `block`: The tool execution is blocked until the user completes the authorization.
   * - `interrupt`: The tool execution is interrupted until the user completes the authorization.
   * - a callback: Same as "block" but give access to the auth request and executing logic.
   *
   * Defaults to `interrupt`.
   *
   * When this flag is set to `block`, the execution of the tool awaits
   * until the user approves or rejects the request.
   * Given the asynchronous nature of the CIBA flow, this mode
   * is only useful during development.
   *
   * In practice, the process that is awaiting the user confirmation
   * could crash or timeout before the user approves the request.
   */
  onAuthorizationRequest: async (authReq, creds) => {
    console.log(`An authorization request was sent to your mobile device.`);
    await creds;
    console.log(`Thanks for approving the order.`);
  },

  onUnauthorized: async (e: Error) => {
    if (e instanceof AccessDeniedInterrupt) {
      return 'The user has denied the request';
    }
    return e.message;
  },
});
