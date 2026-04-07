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
      const result = await gmailSearch._call(args);
      return parseGmailOutput(result);
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
      const result = await gmailDraft._call(args);
      return result;
    },
  }),
);
