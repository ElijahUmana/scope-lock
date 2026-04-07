import { describe, it, expect } from 'vitest';
import { parseGmailOutput } from '@/lib/tools/gmail-parser';

// These tests use the REAL format returned by LangChain's GmailSearch._call().
//
// GmailSearch._call() returns a string:
//   "Result for the query <query>:\n<JSON array>"
//
// Each element in the JSON array has this shape:
//   {
//     id: "msg_id",
//     threadId: "thread_id",
//     snippet: "plain text preview from Gmail API",
//     body: "decoded base64 email body (may be plain text or HTML)",
//     subject: { name: "Subject", value: "The Subject Line" },
//     sender:  { name: "From",    value: "sender@example.com" },
//   }

/** Build a realistic LangChain GmailSearch output string. */
function buildLangChainOutput(query: string, messages: any[]): string {
  return `Result for the query ${query}:\n${JSON.stringify(messages)}`;
}

/** Build a single message in the real LangChain format. */
function buildMessage(overrides: Partial<{
  id: string;
  threadId: string;
  snippet: string;
  body: string;
  subject: { name: string; value: string } | undefined;
  sender: { name: string; value: string } | undefined;
}> = {}) {
  return {
    id: overrides.id ?? '19abc123',
    threadId: overrides.threadId ?? '19abc123',
    snippet: overrides.snippet ?? 'Preview text from Gmail',
    body: overrides.body ?? 'Full decoded email body content.',
    subject: overrides.subject === undefined
      ? { name: 'Subject', value: 'Test Subject' }
      : overrides.subject,
    sender: overrides.sender === undefined
      ? { name: 'From', value: 'alice@example.com' }
      : overrides.sender,
  };
}

describe('Gmail Output Parser', () => {
  describe('empty/missing input', () => {
    it('returns "No emails found." for empty string', () => {
      expect(parseGmailOutput('')).toBe('No emails found.');
    });

    it('returns "No emails found." for whitespace-only string', () => {
      expect(parseGmailOutput('   ')).toBe('No emails found.');
    });

    it('returns "No emails found." for empty array', () => {
      const raw = buildLangChainOutput('is:unread', []);
      expect(parseGmailOutput(raw)).toBe('No emails found.');
    });
  });

  describe('real LangChain GmailSearch format', () => {
    it('parses a single message with subject/sender header objects', () => {
      const raw = buildLangChainOutput('from:alice', [
        buildMessage({
          subject: { name: 'Subject', value: 'Meeting Tomorrow' },
          sender: { name: 'From', value: 'alice@corp.com' },
          snippet: 'Reminder about the 10am meeting.',
          body: 'Hi team, just a reminder about the meeting tomorrow at 10am.',
        }),
      ]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('Meeting Tomorrow');
      expect(result).toContain('alice@corp.com');
      // Should use body (decoded content) over snippet
      expect(result).toContain('reminder about the meeting tomorrow');
    });

    it('parses multiple messages', () => {
      const raw = buildLangChainOutput('is:unread', [
        buildMessage({
          subject: { name: 'Subject', value: 'First Email' },
          sender: { name: 'From', value: 'one@test.com' },
          body: 'Body of first email.',
        }),
        buildMessage({
          subject: { name: 'Subject', value: 'Second Email' },
          sender: { name: 'From', value: 'two@test.com' },
          body: 'Body of second email.',
        }),
        buildMessage({
          subject: { name: 'Subject', value: 'Third Email' },
          sender: { name: 'From', value: 'three@test.com' },
          body: 'Body of third email.',
        }),
      ]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('3.');
      expect(result).toContain('First Email');
      expect(result).toContain('Second Email');
      expect(result).toContain('Third Email');
      expect(result).toContain('one@test.com');
      expect(result).toContain('two@test.com');
      expect(result).toContain('three@test.com');
    });

    it('falls back to snippet when body is empty', () => {
      const raw = buildLangChainOutput('label:inbox', [
        buildMessage({
          subject: { name: 'Subject', value: 'Snippet Only' },
          sender: { name: 'From', value: 'sender@test.com' },
          body: '',
          snippet: 'This is the snippet preview text.',
        }),
      ]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('Snippet Only');
      expect(result).toContain('This is the snippet preview text.');
    });

    it('handles missing subject (undefined)', () => {
      const raw = buildLangChainOutput('is:unread', [
        buildMessage({
          subject: undefined as any,
          sender: { name: 'From', value: 'nosub@test.com' },
          body: 'Email with no subject.',
        }),
      ]);
      // Force subject to actually be missing in the JSON
      const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)![0]);
      parsed[0].subject = undefined;
      const fixedRaw = `Result for the query is:unread:\n${JSON.stringify(parsed)}`;
      const result = parseGmailOutput(fixedRaw);
      expect(result).toContain('(no subject)');
      expect(result).toContain('nosub@test.com');
    });

    it('handles missing sender (undefined)', () => {
      const msg = buildMessage({
        subject: { name: 'Subject', value: 'No Sender' },
        body: 'Email without sender info.',
      });
      (msg as any).sender = undefined;
      const raw = buildLangChainOutput('is:unread', [msg]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('No Sender');
      expect(result).toContain('Unknown sender');
    });

    it('handles both subject and sender missing', () => {
      const msg = buildMessage({ body: 'Just a body.' });
      (msg as any).subject = undefined;
      (msg as any).sender = undefined;
      const raw = buildLangChainOutput('is:unread', [msg]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('(no subject)');
      expect(result).toContain('Unknown sender');
      expect(result).toContain('Just a body.');
    });
  });

  describe('HTML body handling', () => {
    it('strips HTML tags from body and shows clean text', () => {
      const raw = buildLangChainOutput('is:unread', [
        buildMessage({
          subject: { name: 'Subject', value: 'HTML Email' },
          sender: { name: 'From', value: 'html@test.com' },
          body: '<div><p>Hello <b>World</b></p><p>Second paragraph.</p></div>',
          snippet: 'Hello World Second paragraph.',
        }),
      ]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('Hello');
      expect(result).toContain('World');
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<b>');
    });

    it('strips style and script tags from HTML body', () => {
      const raw = buildLangChainOutput('is:unread', [
        buildMessage({
          body: '<style>.foo{color:red}</style><script>alert("x")</script><p>Actual content</p>',
          snippet: 'Actual content',
        }),
      ]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('Actual content');
      expect(result).not.toContain('color:red');
      expect(result).not.toContain('alert');
    });

    it('decodes HTML entities in body', () => {
      const raw = buildLangChainOutput('is:unread', [
        buildMessage({
          body: 'Price is &lt;$50&gt; &amp; that&#39;s a &quot;deal&quot;',
        }),
      ]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('<$50>');
      expect(result).toContain("& that's");
      expect(result).toContain('"deal"');
    });
  });

  describe('body truncation', () => {
    it('truncates very long body text to 500 chars', () => {
      const longBody = 'A'.repeat(600);
      const raw = buildLangChainOutput('is:unread', [
        buildMessage({ body: longBody }),
      ]);
      const result = parseGmailOutput(raw);
      expect(result).not.toContain(longBody);
      expect(result).toContain('...');
    });
  });

  describe('thread format', () => {
    // LangChain thread output has the same structure but without threadId
    it('parses thread output (no threadId field)', () => {
      const threadMsg = {
        id: 'thread_abc',
        snippet: 'Thread preview',
        body: 'First message in thread.',
        subject: { name: 'Subject', value: 'Thread Subject' },
        sender: { name: 'From', value: 'thread@test.com' },
      };
      const raw = `Result for the query is:unread:\n${JSON.stringify([threadMsg])}`;
      const result = parseGmailOutput(raw);
      expect(result).toContain('Thread Subject');
      expect(result).toContain('thread@test.com');
      expect(result).toContain('First message in thread.');
    });
  });

  describe('GmailGetMessage format', () => {
    // GmailGetMessage._call() returns:
    //   "Result for the prompt <id> \n{"subject":"...","body":"...","from":"...","to":"...","date":"...","messageId":"..."}"
    // Note: subject, from, body are plain string values (not header objects)
    it('parses GmailGetMessage single-message output', () => {
      const msg = {
        subject: 'Invoice #1234',
        body: 'Please find attached your invoice.',
        from: 'billing@company.com',
        to: 'me@example.com',
        date: 'Mon, 6 Apr 2026 10:00:00 GMT',
        messageId: '<msg123@company.com>',
      };
      const raw = `Result for the prompt abc123 \n${JSON.stringify(msg)}`;
      const result = parseGmailOutput(raw);
      expect(result).toContain('Invoice #1234');
      expect(result).toContain('billing@company.com');
      expect(result).toContain('Please find attached your invoice.');
    });
  });

  describe('error/malformed input', () => {
    it('handles completely non-JSON text without crashing', () => {
      const result = parseGmailOutput('this is not json at all');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles partial/broken JSON without crashing', () => {
      const result = parseGmailOutput('[{"subject": "broken');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles LangChain error message format', () => {
      const result = parseGmailOutput('Error while searching Gmail: Error: No messages returned from Gmail');
      expect(typeof result).toBe('string');
      expect(result).toContain('Error');
    });

    it('handles null-ish message objects in array gracefully', () => {
      const raw = buildLangChainOutput('is:unread', [null, undefined as any]);
      const result = parseGmailOutput(raw);
      expect(result).toContain('unreadable email');
    });
  });

  describe('plain text fallback', () => {
    it('strips HTML from non-JSON input and returns clean text', () => {
      const raw = '<div><p>Hello <b>World</b></p></div>';
      const result = parseGmailOutput(raw);
      expect(result).toContain('Hello');
      expect(result).toContain('World');
      expect(result).not.toContain('<div>');
    });
  });

  describe('robustness: alternative field formats', () => {
    it('handles subject as a plain string (not header object)', () => {
      const msg = {
        id: 'msg1',
        subject: 'Plain String Subject',
        sender: { name: 'From', value: 'test@example.com' },
        body: 'Body text.',
        snippet: 'Snippet text.',
      };
      const raw = `Result for the query test:\n${JSON.stringify([msg])}`;
      const result = parseGmailOutput(raw);
      expect(result).toContain('Plain String Subject');
    });

    it('handles sender as a plain string (not header object)', () => {
      const msg = {
        id: 'msg1',
        subject: { name: 'Subject', value: 'Test' },
        sender: 'plainstring@example.com',
        body: 'Body text.',
        snippet: 'Snippet text.',
      };
      const raw = `Result for the query test:\n${JSON.stringify([msg])}`;
      const result = parseGmailOutput(raw);
      expect(result).toContain('plainstring@example.com');
    });

    it('falls back to "from" field when "sender" is missing', () => {
      const msg = {
        id: 'msg1',
        subject: { name: 'Subject', value: 'Test' },
        from: 'fallback@example.com',
        body: 'Body text.',
        snippet: 'Snippet text.',
      };
      const raw = `Result for the query test:\n${JSON.stringify([msg])}`;
      const result = parseGmailOutput(raw);
      expect(result).toContain('fallback@example.com');
    });
  });
});
