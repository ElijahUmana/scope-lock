// Parse the raw LangChain Gmail output into clean structured data.
// The raw output is a stringified JSON blob containing message objects
// with headers (Subject, From, Date) and body text mixed with HTML.

// Truncate a string to a max length, appending ellipsis if needed
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// Format a single email message object into a readable string
function formatEmail(msg: any, i: number): string {
  if (!msg || typeof msg !== 'object') return `${i + 1}. (unreadable email)`;
  const headers: Record<string, string> = {};
  if (Array.isArray(msg.headers)) {
    for (const h of msg.headers) {
      if (h && typeof h.name === 'string' && typeof h.value === 'string') {
        headers[h.name] = h.value;
      }
    }
  }
  const subject = headers['Subject'] || msg.subject || '(no subject)';
  const from = headers['From'] || msg.sender || msg.from || 'Unknown sender';
  const snippet = truncate(msg.snippet || '', 500);
  const date = headers['Date'] || '';
  return `${i + 1}. **${subject}**\n   From: ${from}${date ? `\n   Date: ${date}` : ''}\n   ${snippet}`;
}

export function parseGmailOutput(raw: string): string {
  // Handle empty/missing input
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return 'No emails found.';
  }

  try {
    // Check if the entire raw string is a single JSON object (not array) first.
    // This must come before the array regex to avoid the greedy regex matching
    // internal arrays (e.g. headers) inside a standalone email object.
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      const singleMsg = JSON.parse(trimmed);
      if (singleMsg && typeof singleMsg === 'object' && !Array.isArray(singleMsg)) {
        return formatEmail(singleMsg, 0);
      }
    }
  } catch {
    // Single-object parse failed, try array extraction next
  }

  try {
    // Try to extract individual email JSON objects from the result
    // LangChain returns: "Result for the query: [{"id":...},{"id":...}]" or similar
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return 'No emails found.';
        return parsed.map((msg: any, i: number) => formatEmail(msg, i)).join('\n\n');
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
        const from = fromMatches[i]?.[1] ?? 'Unknown sender';
        const snippet = truncate(snippetMatches[i]?.[1] ?? '', 500);
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
    .slice(0, 2000) || 'No readable email content found.';
}
