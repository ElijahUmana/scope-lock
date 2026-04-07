import { tool } from 'ai';
import { z } from 'zod';
import { GmailCreateDraft, GmailSearch } from '@langchain/community/tools/gmail';

import { getAccessToken, withGmailRead, withGmailWrite } from '../auth0-ai';

// Parse the raw LangChain Gmail output into clean structured data.
// The raw output is a stringified JSON blob containing message objects
// with headers (Subject, From, Date) and body text mixed with HTML.
function parseGmailOutput(raw: string): string {
  try {
    // Try to extract individual email JSON objects from the result
    // LangChain returns: "Result for the query: [{"id":...},{"id":...}]" or similar
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const messages = JSON.parse(jsonMatch[0]);
      if (Array.isArray(messages)) {
        return messages.map((msg: any, i: number) => {
          const headers: Record<string, string> = {};
          if (Array.isArray(msg.headers)) {
            for (const h of msg.headers) {
              if (h.name && h.value) headers[h.name] = h.value;
            }
          }
          // Also check for top-level subject/sender fields
          const subject = headers['Subject'] || msg.subject || '(no subject)';
          const from = headers['From'] || msg.sender || msg.from || 'Unknown';
          const snippet = msg.snippet || '';
          const date = headers['Date'] || '';
          return `${i + 1}. **${subject}**\n   From: ${from}${date ? `\n   Date: ${date}` : ''}\n   ${snippet}`;
        }).join('\n\n');
      }
    }
  } catch {
    // JSON parsing failed, fall through to text cleaning
  }

  // Fallback: try to extract {name:value} header pairs from the raw text
  try {
    const emails: string[] = [];
    // Match patterns like {"name":"Subject","value":"..."}
    const subjectMatches = [...raw.matchAll(/\{"name":"Subject","value":"([^"]*?)"\}/g)];
    const fromMatches = [...raw.matchAll(/\{"name":"From","value":"([^"]*?)"\}/g)];
    const snippetMatches = [...raw.matchAll(/"snippet":"([^"]*?)"/g)];

    if (subjectMatches.length > 0) {
      for (let i = 0; i < subjectMatches.length; i++) {
        const subject = subjectMatches[i]?.[1] ?? '(no subject)';
        const from = fromMatches[i]?.[1] ?? 'Unknown';
        const snippet = snippetMatches[i]?.[1] ?? '';
        emails.push(`${i + 1}. **${subject}**\n   From: ${from}\n   ${snippet}`);
      }
      return emails.join('\n\n');
    }
  } catch {
    // Fall through to final cleanup
  }

  // Final fallback: strip all HTML and JSON noise, return truncated clean text
  return raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

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
