// Parse the raw LangChain Gmail output into clean structured data.
//
// LangChain's GmailSearch._call() returns a string in this exact format:
//   "Result for the query <query>:\n<JSON array>"
//
// Each element in the JSON array has this shape (from parseMessages):
//   {
//     id: string,
//     threadId: string,
//     snippet: string,           // Gmail API snippet (plain text preview)
//     body: string,              // decoded base64 email body
//     subject: { name: "Subject", value: "..." } | undefined,
//     sender:  { name: "From",    value: "..." } | undefined,
//   }
//
// For threads (resource="threads"), the shape is:
//   {
//     id: string,
//     snippet: string,
//     body: string,
//     subject: { name: "Subject", value: "..." } | undefined,
//     sender:  { name: "From",    value: "..." } | undefined,
//   }

/** Truncate a string to a max length, appending ellipsis if needed. */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

/** Decode common HTML entities to their plain text equivalents. */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Strip HTML tags and decode common HTML entities to produce plain text. */
function stripHtml(html: string): string {
  const stripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a readable text preview from an email message object.
 * Prefers body (decoded email content) over snippet (Gmail's auto-generated preview).
 * Strips HTML if the body contains HTML tags.
 */
function getPreviewText(msg: any): string {
  const body = typeof msg.body === 'string' ? msg.body.trim() : '';
  const snippet = typeof msg.snippet === 'string' ? msg.snippet.trim() : '';

  if (body) {
    // If body contains HTML tags, strip them; otherwise just decode entities
    const hasHtmlTags = /<[a-z/][^>]*>/i.test(body);
    const cleaned = hasHtmlTags ? stripHtml(body) : decodeEntities(body);
    return truncate(cleaned, 500);
  }

  if (snippet) {
    return truncate(snippet, 500);
  }

  return '';
}

/**
 * Look up a header value from a `headers` array of {name, value} objects.
 * Returns undefined if the header is not found.
 */
function findHeader(msg: any, headerName: string): string | undefined {
  if (Array.isArray(msg.headers)) {
    const entry = msg.headers.find(
      (h: any) => typeof h === 'object' && h.name === headerName
    );
    if (entry && typeof entry.value === 'string') return entry.value;
  }
  return undefined;
}

/**
 * Extract subject from a Gmail message object.
 *
 * Supports multiple formats:
 *  - Raw Gmail API: headers array [{name:"Subject", value:"..."}]
 *  - LangChain parsed: subject as {name:"Subject", value:"..."} object
 *  - Plain string subject field
 */
function getSubject(msg: any): string {
  // Check headers array first (raw Gmail API format)
  const fromHeaders = findHeader(msg, 'Subject');
  if (fromHeaders) return fromHeaders;

  // LangChain parsed format: subject as header object
  if (msg.subject && typeof msg.subject === 'object' && msg.subject.value) {
    return msg.subject.value;
  }
  // Plain string
  if (typeof msg.subject === 'string') {
    return msg.subject;
  }
  return '(no subject)';
}

/**
 * Extract sender from a Gmail message object.
 *
 * Supports multiple formats:
 *  - Raw Gmail API: headers array [{name:"From", value:"..."}]
 *  - LangChain parsed: sender as {name:"From", value:"..."} object
 *  - Plain string sender or from field
 */
function getSender(msg: any): string {
  // Check headers array first (raw Gmail API format)
  const fromHeaders = findHeader(msg, 'From');
  if (fromHeaders) return fromHeaders;

  // LangChain parsed format: sender as header object
  if (msg.sender && typeof msg.sender === 'object' && msg.sender.value) {
    return msg.sender.value;
  }
  if (typeof msg.sender === 'string') {
    return msg.sender;
  }
  if (typeof msg.from === 'string') {
    return msg.from;
  }
  return 'Unknown sender';
}

/**
 * Extract date from a Gmail message object.
 * Checks headers array, then direct date/Date fields.
 */
function getDate(msg: any): string | undefined {
  const fromHeaders = findHeader(msg, 'Date');
  if (fromHeaders) return fromHeaders;

  if (typeof msg.date === 'string') return msg.date;
  if (typeof msg.Date === 'string') return msg.Date;
  return undefined;
}

/** Format a single email message object into a readable string. */
function formatEmail(msg: any, i: number): string {
  if (!msg || typeof msg !== 'object') return `${i + 1}. (unreadable email)`;

  const subject = getSubject(msg);
  const from = getSender(msg);
  const date = getDate(msg);
  const preview = getPreviewText(msg);

  let line = `${i + 1}. **${subject}**\n   From: ${from}`;
  if (date) line += `\n   Date: ${date}`;
  line += `\n   ${preview}`;
  return line;
}

export function parseGmailOutput(raw: string): string {
  // Handle empty/missing input
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return 'No emails found.';
  }

  // --- Primary path: parse the real LangChain format ---
  // LangChain returns: "Result for the query <query>:\n[{...},{...}]"
  // Extract the JSON array from the string.
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return 'No emails found.';
        return parsed.map((msg: any, i: number) => formatEmail(msg, i)).join('\n\n');
      }
    }
  } catch {
    // JSON array extraction failed, try other approaches
  }

  // --- Secondary path: single JSON object (e.g., from GmailGetMessage) ---
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      const singleMsg = JSON.parse(trimmed);
      if (singleMsg && typeof singleMsg === 'object' && !Array.isArray(singleMsg)) {
        return formatEmail(singleMsg, 0);
      }
    }
  } catch {
    // Single-object parse failed
  }

  // --- Tertiary path: LangChain GmailGetMessage format ---
  // GmailGetMessage returns: "Result for the prompt <id> \n{...}" with a flat JSON object
  // containing { subject, body, from, to, date, messageId } as plain string values.
  try {
    const jsonObjMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) {
      const parsed = JSON.parse(jsonObjMatch[0]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return formatEmail(parsed, 0);
      }
    }
  } catch {
    // Fall through
  }

  // --- Quaternary path: regex extraction for scattered {name, value} header objects ---
  // Some raw outputs contain individual header objects like:
  //   {"name":"Subject","value":"..."} {"name":"From","value":"..."}
  // that aren't wrapped in a parseable JSON structure.
  {
    const headerPattern = /\{"name"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"\}/g;
    const snippetPattern = /"snippet"\s*:\s*"([^"]+)"/;
    const headers: Record<string, string> = {};
    let match;
    while ((match = headerPattern.exec(raw)) !== null) {
      headers[match[1]] = match[2];
    }
    const snippetMatch = snippetPattern.exec(raw);
    if (Object.keys(headers).length > 0) {
      const subject = headers['Subject'] ?? '(no subject)';
      const from = headers['From'] ?? 'Unknown sender';
      const snippet = snippetMatch ? truncate(snippetMatch[1], 500) : '';
      let line = `1. **${subject}**\n   From: ${from}`;
      if (headers['Date']) line += `\n   Date: ${headers['Date']}`;
      if (snippet) line += `\n   ${snippet}`;
      return line;
    }
  }

  // --- Final fallback: strip HTML/JSON noise and return clean text ---
  const cleaned = stripHtml(raw)
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);

  return cleaned || 'No readable email content found.';
}
