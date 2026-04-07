import { describe, it, expect } from 'vitest';
import { parseGmailOutput } from '@/lib/tools/gmail-parser';

describe('Gmail Output Parser', () => {
  describe('empty/missing input', () => {
    it('returns "No emails found." for empty string', () => {
      expect(parseGmailOutput('')).toBe('No emails found.');
    });

    it('returns "No emails found." for whitespace-only string', () => {
      expect(parseGmailOutput('   ')).toBe('No emails found.');
    });
  });

  describe('JSON array with email objects', () => {
    it('parses correctly', () => {
      const input = JSON.stringify([
        {
          headers: [
            { name: 'Subject', value: 'Test Email' },
            { name: 'From', value: 'alice@example.com' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 10:00:00 GMT' },
          ],
          snippet: 'This is a test email body.',
        },
      ]);
      const result = parseGmailOutput(input);
      expect(result).toContain('Test Email');
      expect(result).toContain('alice@example.com');
      expect(result).toContain('Mon, 1 Jan 2024 10:00:00 GMT');
      expect(result).toContain('This is a test email body.');
    });

    it('extracts Subject, From, Date, and snippet', () => {
      const input = JSON.stringify([
        {
          headers: [
            { name: 'Subject', value: 'Meeting Tomorrow' },
            { name: 'From', value: 'bob@corp.com' },
            { name: 'Date', value: 'Tue, 2 Jan 2024 09:00:00 GMT' },
          ],
          snippet: 'Reminder about the meeting.',
        },
      ]);
      const result = parseGmailOutput(input);
      expect(result).toContain('Meeting Tomorrow');
      expect(result).toContain('bob@corp.com');
      expect(result).toContain('Tue, 2 Jan 2024 09:00:00 GMT');
      expect(result).toContain('Reminder about the meeting.');
    });

    it('handles empty array', () => {
      const result = parseGmailOutput('[]');
      expect(result).toBe('No emails found.');
    });

    it('handles multiple emails', () => {
      const input = JSON.stringify([
        {
          headers: [{ name: 'Subject', value: 'Email 1' }],
          snippet: 'First email',
        },
        {
          headers: [{ name: 'Subject', value: 'Email 2' }],
          snippet: 'Second email',
        },
      ]);
      const result = parseGmailOutput(input);
      expect(result).toContain('Email 1');
      expect(result).toContain('Email 2');
      expect(result).toContain('1.');
      expect(result).toContain('2.');
    });
  });

  describe('missing headers', () => {
    it('handles missing headers gracefully', () => {
      const input = JSON.stringify([
        {
          snippet: 'Email without headers',
        },
      ]);
      const result = parseGmailOutput(input);
      // Should still produce output without crashing
      expect(result).toContain('Email without headers');
    });

    it('uses fallback for missing subject', () => {
      const input = JSON.stringify([
        {
          headers: [{ name: 'From', value: 'sender@test.com' }],
          snippet: 'Body text',
        },
      ]);
      const result = parseGmailOutput(input);
      expect(result).toContain('(no subject)');
      expect(result).toContain('sender@test.com');
    });

    it('uses fallback for missing sender', () => {
      const input = JSON.stringify([
        {
          headers: [{ name: 'Subject', value: 'Test Subject' }],
          snippet: 'Body text',
        },
      ]);
      const result = parseGmailOutput(input);
      expect(result).toContain('Test Subject');
      expect(result).toContain('Unknown sender');
    });
  });

  describe('malformed JSON', () => {
    it('handles malformed JSON without crashing', () => {
      const result = parseGmailOutput('this is not json at all');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles partial JSON without crashing', () => {
      const result = parseGmailOutput('[{"subject": "broken');
      expect(typeof result).toBe('string');
    });
  });

  describe('snippet truncation', () => {
    it('truncates long snippets to 500 chars', () => {
      const longSnippet = 'x'.repeat(600);
      const input = JSON.stringify([
        {
          headers: [{ name: 'Subject', value: 'Long Email' }],
          snippet: longSnippet,
        },
      ]);
      const result = parseGmailOutput(input);
      // The snippet in the output should be truncated
      // The full 600-char string should NOT appear
      expect(result).not.toContain(longSnippet);
      expect(result).toContain('...');
    });
  });

  describe('single email object (not array)', () => {
    it('handles a single JSON object', () => {
      const input = JSON.stringify({
        headers: [
          { name: 'Subject', value: 'Solo Email' },
          { name: 'From', value: 'single@test.com' },
        ],
        snippet: 'Just one email',
      });
      const result = parseGmailOutput(input);
      expect(result).toContain('Solo Email');
      expect(result).toContain('single@test.com');
      expect(result).toContain('Just one email');
    });
  });

  describe('{"name":"Subject","value":"..."} header format', () => {
    it('handles the name/value header format in raw text', () => {
      // This tests the fallback regex parser for raw LangChain output
      const raw = 'Result: {"name":"Subject","value":"Important Update"} {"name":"From","value":"admin@company.com"} "snippet":"Please review the attached document"';
      const result = parseGmailOutput(raw);
      expect(result).toContain('Important Update');
      expect(result).toContain('admin@company.com');
    });
  });

  describe('HTML stripping (fallback path)', () => {
    it('strips HTML from output when JSON parsing fails', () => {
      // Non-JSON input with HTML tags
      const raw = '<div><p>Hello <b>World</b></p></div>';
      const result = parseGmailOutput(raw);
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });
  });

  describe('LangChain prefixed output', () => {
    it('extracts JSON array from "Result for the query: [...]" format', () => {
      const emails = [
        {
          headers: [
            { name: 'Subject', value: 'Prefixed Email' },
            { name: 'From', value: 'lang@chain.com' },
          ],
          snippet: 'From LangChain',
        },
      ];
      const raw = `Result for the query: ${JSON.stringify(emails)}`;
      const result = parseGmailOutput(raw);
      expect(result).toContain('Prefixed Email');
      expect(result).toContain('lang@chain.com');
      expect(result).toContain('From LangChain');
    });
  });
});
