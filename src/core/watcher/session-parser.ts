/**
 * Session Parser
 * Parses AI assistant session logs (JSONL format from Claude Code)
 */

/**
 * A message from an AI session log
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/**
 * Result of parsing a session line
 */
export interface ParsedSessionLine {
  type: 'message' | 'tool_use' | 'tool_result' | 'unknown';
  message?: SessionMessage;
  raw: string;
}

/**
 * Parse a single JSONL line from a Claude Code session
 */
export function parseSessionLine(line: string): ParsedSessionLine {
  const trimmed = line.trim();
  if (!trimmed) {
    return { type: 'unknown', raw: line };
  }

  try {
    const data = JSON.parse(trimmed);

    // Claude Code JSONL format - check for message content
    if (data.type === 'assistant' || data.role === 'assistant') {
      const content = extractContent(data);
      if (content) {
        return {
          type: 'message',
          message: {
            role: 'assistant',
            content,
            timestamp: data.timestamp || data.ts,
          },
          raw: line,
        };
      }
    }

    // Check for tool use (these might contain claim-related info)
    if (data.type === 'tool_use' || data.tool_use) {
      return { type: 'tool_use', raw: line };
    }

    if (data.type === 'tool_result' || data.tool_result) {
      return { type: 'tool_result', raw: line };
    }

    // Generic message format
    if (data.message && typeof data.message === 'string') {
      return {
        type: 'message',
        message: {
          role: data.role || 'assistant',
          content: data.message,
          timestamp: data.timestamp,
        },
        raw: line,
      };
    }

    // Content array format (common in API responses)
    if (data.content && Array.isArray(data.content)) {
      const textContent = data.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text: string }) => c.text)
        .join('\n');

      if (textContent) {
        return {
          type: 'message',
          message: {
            role: data.role || 'assistant',
            content: textContent,
            timestamp: data.timestamp,
          },
          raw: line,
        };
      }
    }

    return { type: 'unknown', raw: line };
  } catch {
    // Not JSON - treat as plain text (could be a text log)
    return { type: 'unknown', raw: line };
  }
}

/**
 * Extract text content from various data formats
 */
function extractContent(data: Record<string, unknown>): string | null {
  // Direct content string
  if (typeof data.content === 'string') {
    return data.content;
  }

  // Content array (Claude API format)
  if (Array.isArray(data.content)) {
    const texts = data.content
      .filter((c): c is { type: string; text: string } =>
        typeof c === 'object' && c !== null && c.type === 'text' && typeof c.text === 'string'
      )
      .map((c) => c.text);

    return texts.length > 0 ? texts.join('\n') : null;
  }

  // Message field
  if (typeof data.message === 'string') {
    return data.message;
  }

  // Text field
  if (typeof data.text === 'string') {
    return data.text;
  }

  return null;
}

/**
 * Parse multiple lines from a session log
 */
export function parseSessionLines(lines: string[]): SessionMessage[] {
  const messages: SessionMessage[] = [];

  for (const line of lines) {
    const parsed = parseSessionLine(line);
    if (parsed.type === 'message' && parsed.message) {
      messages.push(parsed.message);
    }
  }

  return messages;
}

/**
 * Extract assistant messages from raw log content
 */
export function extractAssistantMessages(content: string): SessionMessage[] {
  const lines = content.split('\n');
  return parseSessionLines(lines).filter((m) => m.role === 'assistant');
}
