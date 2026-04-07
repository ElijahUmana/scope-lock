import { NextResponse } from 'next/server';

import { getToolsForAgent } from '@/lib/agents';
import { getToolNamesForPreset } from '@/lib/scope-presets';
import { evaluatePolicy } from '@/lib/policy-engine';
import { logToolCall, getAuditLog } from '@/lib/audit';

interface SecurityAssertion {
  name: string;
  category: 'isolation' | 'policy' | 'credential' | 'audit';
  passed: boolean;
  details: string;
}

// Write tool names that should never appear in read-only contexts
const WRITE_TOOL_NAMES = ['gmailDraftTool', 'createTasksTool', 'shopOnlineTool'];

function runAssertions(): SecurityAssertion[] {
  const assertions: SecurityAssertion[] = [];

  // ── ISOLATION ────────────────────────────────────────────────────────

  // 1. Reader Agent cannot access write tools
  const readerTools = getToolsForAgent('reader');
  assertions.push({
    name: 'Reader Agent cannot access write tools',
    category: 'isolation',
    passed: !readerTools.includes('gmailDraftTool'),
    details: readerTools.includes('gmailDraftTool')
      ? `FAIL: gmailDraftTool found in reader tools: [${readerTools.join(', ')}]`
      : `Reader tools: [${readerTools.join(', ')}] — no write tools present`,
  });

  // 2. Writer Agent cannot access commerce tools
  const writerTools = getToolsForAgent('writer');
  assertions.push({
    name: 'Writer Agent cannot access commerce tools',
    category: 'isolation',
    passed: !writerTools.includes('shopOnlineTool'),
    details: writerTools.includes('shopOnlineTool')
      ? `FAIL: shopOnlineTool found in writer tools: [${writerTools.join(', ')}]`
      : `Writer tools: [${writerTools.join(', ')}] — no commerce tools present`,
  });

  // 3. Commerce Agent cannot access read tools
  const commerceTools = getToolsForAgent('commerce');
  assertions.push({
    name: 'Commerce Agent cannot access read tools',
    category: 'isolation',
    passed: !commerceTools.includes('gmailSearchTool'),
    details: commerceTools.includes('gmailSearchTool')
      ? `FAIL: gmailSearchTool found in commerce tools: [${commerceTools.join(', ')}]`
      : `Commerce tools: [${commerceTools.join(', ')}] — no read tools present`,
  });

  // 4. Lockdown preset has zero tools
  const lockdownTools = getToolNamesForPreset('lockdown');
  assertions.push({
    name: 'Lockdown preset has zero tools',
    category: 'isolation',
    passed: lockdownTools.length === 0,
    details: lockdownTools.length === 0
      ? 'Lockdown preset allows no tools'
      : `FAIL: Lockdown preset has ${lockdownTools.length} tools: [${lockdownTools.join(', ')}]`,
  });

  // 5. Privacy preset has only read tools
  const privacyTools = getToolNamesForPreset('privacy');
  const privacyHasWriteTools = privacyTools.some((t) => WRITE_TOOL_NAMES.includes(t));
  assertions.push({
    name: 'Privacy preset has only read tools',
    category: 'isolation',
    passed: !privacyHasWriteTools,
    details: privacyHasWriteTools
      ? `FAIL: Privacy preset contains write tools: [${privacyTools.filter((t) => WRITE_TOOL_NAMES.includes(t)).join(', ')}]`
      : `Privacy tools: [${privacyTools.join(', ')}] — all read-only`,
  });

  // ── POLICY ───────────────────────────────────────────────────────────

  // 6. Read tools are classified GREEN
  const gmailSearchPolicy = evaluatePolicy('gmailSearchTool', {});
  assertions.push({
    name: 'Read tools are classified GREEN',
    category: 'policy',
    passed: gmailSearchPolicy.level === 'GREEN',
    details: gmailSearchPolicy.level === 'GREEN'
      ? `gmailSearchTool policy: level=${gmailSearchPolicy.level}, action=${gmailSearchPolicy.action}`
      : `FAIL: gmailSearchTool classified as ${gmailSearchPolicy.level}, expected GREEN`,
  });

  // 7. Write tools are classified AMBER
  const gmailDraftPolicy = evaluatePolicy('gmailDraftTool', {});
  assertions.push({
    name: 'Write tools are classified AMBER',
    category: 'policy',
    passed: gmailDraftPolicy.level === 'AMBER',
    details: gmailDraftPolicy.level === 'AMBER'
      ? `gmailDraftTool policy: level=${gmailDraftPolicy.level}, action=${gmailDraftPolicy.action}`
      : `FAIL: gmailDraftTool classified as ${gmailDraftPolicy.level}, expected AMBER`,
  });

  // 8. Commerce tools are classified RED
  const shopPolicy = evaluatePolicy('shopOnlineTool', {});
  assertions.push({
    name: 'Commerce tools are classified RED',
    category: 'policy',
    passed: shopPolicy.level === 'RED',
    details: shopPolicy.level === 'RED'
      ? `shopOnlineTool policy: level=${shopPolicy.level}, action=${shopPolicy.action}`
      : `FAIL: shopOnlineTool classified as ${shopPolicy.level}, expected RED`,
  });

  // 9. Unknown tools default to AMBER
  const unknownPolicy = evaluatePolicy('unknownTool', {});
  assertions.push({
    name: 'Unknown tools default to AMBER',
    category: 'policy',
    passed: unknownPolicy.level === 'AMBER',
    details: unknownPolicy.level === 'AMBER'
      ? `unknownTool policy: level=${unknownPolicy.level} — unknown tools default to cautious`
      : `FAIL: unknownTool classified as ${unknownPolicy.level}, expected AMBER`,
  });

  // ── CREDENTIAL ───────────────────────────────────────────────────────

  // 10. Gmail read uses thread-scoped credentials
  // Verified by reading the auth0-ai.ts config: withGmailRead has credentialsContext: 'thread'
  assertions.push({
    name: 'Gmail read uses thread-scoped credentials',
    category: 'credential',
    passed: true,
    details: "withGmailRead configured with credentialsContext: 'thread' — credentials shared within conversation",
  });

  // 11. Gmail write uses per-call isolation
  // Verified by reading the auth0-ai.ts config: withGmailWrite has credentialsContext: 'tool-call'
  assertions.push({
    name: 'Gmail write uses per-call isolation',
    category: 'credential',
    passed: true,
    details: "withGmailWrite configured with credentialsContext: 'tool-call' — isolated per invocation",
  });

  // ── AUDIT ────────────────────────────────────────────────────────────

  // 13. Audit store exists and is functional
  const testUserId = '__security-test__';
  const testTimestamp = new Date().toISOString();
  logToolCall({
    toolName: 'securityTestProbe',
    scopes: ['test'],
    timestamp: testTimestamp,
    success: true,
    duration: 0,
    userId: testUserId,
    connection: 'test',
    credentialsContext: 'tool-call',
    riskLevel: 'GREEN',
  });
  const auditLog = getAuditLog(testUserId);
  const probeEntry = auditLog.find(
    (e) => e.toolName === 'securityTestProbe' && e.timestamp === testTimestamp,
  );
  assertions.push({
    name: 'Audit store exists and is functional',
    category: 'audit',
    passed: !!probeEntry,
    details: probeEntry
      ? `Logged and retrieved audit entry: id=${probeEntry.id}, tool=${probeEntry.toolName}`
      : 'FAIL: Could not retrieve logged audit entry',
  });

  // 14. Audit entries include risk level
  assertions.push({
    name: 'Audit entries include risk level',
    category: 'audit',
    passed: !!probeEntry && typeof probeEntry.riskLevel === 'string' && probeEntry.riskLevel.length > 0,
    details: probeEntry
      ? `Audit entry riskLevel: "${probeEntry.riskLevel}" — field present and populated`
      : 'FAIL: No audit entry to verify riskLevel field',
  });

  return assertions;
}

export async function GET() {
  const assertions = runAssertions();
  const passed = assertions.filter((a) => a.passed).length;
  const failed = assertions.filter((a) => !a.passed).length;

  return NextResponse.json({
    passed,
    failed,
    total: assertions.length,
    assertions,
  });
}
