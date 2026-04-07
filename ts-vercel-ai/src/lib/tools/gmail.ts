import { tool } from 'ai';
import { z } from 'zod';
import { GmailCreateDraft, GmailSearch } from '@langchain/community/tools/gmail';

import { getAccessToken, withGmailRead, withGmailWrite } from '../auth0-ai';
import { parseGmailOutput } from './gmail-parser';

// Provide the access token to the Gmail tools
const gmailParams = {
  credentials: {
    accessToken: getAccessToken,
  },
};

const gmailSearch = new GmailSearch(gmailParams);

export const gmailSearchTool = withGmailRead(
  tool({
    description: 'Search Gmail for emails. Returns a list of emails matching the query with subject, sender, and snippet.',
    inputSchema: z.object({
      query: z.string().describe('Gmail search query (e.g., "is:unread", "from:someone@example.com", or empty string for recent emails)'),
      maxResults: z.number().optional().describe('Maximum number of results to return (default 10)'),
      resource: z.enum(['messages', 'threads']).optional().describe('Search messages or threads'),
    }),
    execute: async (args) => {
      try {
        const result = await gmailSearch._call(args);
        return parseGmailOutput(result);
      } catch (error: any) {
        const msg = error?.message ?? 'Unknown error';
        if (msg.includes('has not been used') || msg.includes('is disabled')) {
          return 'Gmail API is not enabled in Google Cloud. Please enable it at https://console.developers.google.com/apis/api/gmail.googleapis.com/overview and try again.';
        }
        if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
          return 'Gmail authorization expired. Please go to your Profile page and reconnect your Google account.';
        }
        return `Gmail error: ${msg}`;
      }
    },
  }),
);

const gmailDraft = new GmailCreateDraft(gmailParams);

export const gmailDraftTool = withGmailWrite(
  tool({
    description: gmailDraft.description,
    inputSchema: z.object({
      message: z.string(),
      to: z.array(z.string()),
      subject: z.string(),
      cc: z.array(z.string()).optional(),
      bcc: z.array(z.string()).optional(),
    }),
    execute: async (args) => {
      try {
        const result = await gmailDraft._call(args);
        return result;
      } catch (error: any) {
        const msg = error?.message ?? 'Unknown error';
        if (msg.includes('has not been used') || msg.includes('is disabled')) {
          return 'Gmail API is not enabled. Please enable it at https://console.developers.google.com/apis/api/gmail.googleapis.com/overview and try again.';
        }
        if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
          return 'Gmail authorization expired. Please reconnect your Google account from the Profile page.';
        }
        return `Failed to create draft: ${msg}`;
      }
    },
  }),
);
