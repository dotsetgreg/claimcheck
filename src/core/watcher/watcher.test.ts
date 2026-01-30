/**
 * Tests for the watcher module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseSessionLine,
  parseSessionLines,
  extractAssistantMessages,
} from './session-parser.js';
import { FileWatcher } from './file-watcher.js';

describe('Session Parser', () => {
  describe('parseSessionLine', () => {
    it('parses a simple assistant message with content string', () => {
      const line = JSON.stringify({
        type: 'assistant',
        content: 'I renamed UserService to AuthService',
      });

      const result = parseSessionLine(line);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('I renamed UserService to AuthService');
    });

    it('parses Claude API format with content array', () => {
      const line = JSON.stringify({
        role: 'assistant',
        content: [
          { type: 'text', text: 'I renamed UserService to AuthService' },
        ],
      });

      const result = parseSessionLine(line);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('I renamed UserService to AuthService');
    });

    it('returns unknown for tool_use entries', () => {
      const line = JSON.stringify({
        type: 'tool_use',
        name: 'read_file',
        input: { path: 'test.ts' },
      });

      const result = parseSessionLine(line);

      expect(result.type).toBe('tool_use');
      expect(result.message).toBeUndefined();
    });

    it('handles non-JSON lines', () => {
      const result = parseSessionLine('This is plain text');

      expect(result.type).toBe('unknown');
      expect(result.raw).toBe('This is plain text');
    });

    it('handles empty lines', () => {
      const result = parseSessionLine('');

      expect(result.type).toBe('unknown');
    });

    it('extracts timestamp when available', () => {
      const line = JSON.stringify({
        type: 'assistant',
        content: 'Hello',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const result = parseSessionLine(line);

      expect(result.message?.timestamp).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('parseSessionLines', () => {
    it('parses multiple lines and returns messages', () => {
      const lines = [
        JSON.stringify({ type: 'assistant', content: 'First message' }),
        JSON.stringify({ type: 'tool_use', name: 'test' }),
        JSON.stringify({ type: 'assistant', content: 'Second message' }),
      ];

      const messages = parseSessionLines(lines);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
    });
  });

  describe('extractAssistantMessages', () => {
    it('extracts assistant messages from raw log content', () => {
      const content = [
        JSON.stringify({ type: 'user', content: 'Hello' }),
        JSON.stringify({ type: 'assistant', content: 'I renamed X to Y' }),
        JSON.stringify({ type: 'tool_use', name: 'test' }),
        JSON.stringify({ role: 'assistant', content: [{ type: 'text', text: 'Done!' }] }),
      ].join('\n');

      const messages = extractAssistantMessages(content);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('I renamed X to Y');
      expect(messages[1].content).toBe('Done!');
    });
  });
});

describe('FileWatcher', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `claimcheck-test-${Date.now()}`);
    testFile = join(testDir, 'test.jsonl');
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true });
    }
  });

  it('emits ready event when started', async () => {
    // Create test file first
    await writeFile(testFile, '');

    const watcher = new FileWatcher({ filePath: testFile });
    const readyPromise = new Promise<void>((resolve) => {
      watcher.on('ready', resolve);
    });

    await watcher.start();
    await readyPromise;

    watcher.stop();
  });

  it('emits message event for new JSONL content', async () => {
    // Create initial file
    await writeFile(testFile, '');

    const watcher = new FileWatcher({ filePath: testFile, debounceMs: 10 });
    const messages: { content: string }[] = [];

    watcher.on('message', (msg) => {
      messages.push(msg);
    });

    await watcher.start();

    // Wait a bit then append content
    await new Promise((r) => setTimeout(r, 50));
    await writeFile(
      testFile,
      JSON.stringify({ type: 'assistant', content: 'I renamed UserService to AuthService' }) + '\n'
    );

    // Wait for debounce and processing
    await new Promise((r) => setTimeout(r, 150));

    watcher.stop();

    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].content).toBe('I renamed UserService to AuthService');
  });

  it('deduplicates messages', async () => {
    // Create file with existing content
    const existingContent = JSON.stringify({ type: 'assistant', content: 'Existing message' }) + '\n';
    await writeFile(testFile, existingContent);

    const watcher = new FileWatcher({ filePath: testFile, debounceMs: 10 });
    const messages: { content: string }[] = [];

    watcher.on('message', (msg) => {
      messages.push(msg);
    });

    await watcher.start();

    // Append new content (same message again)
    await new Promise((r) => setTimeout(r, 50));
    await writeFile(
      testFile,
      existingContent + JSON.stringify({ type: 'assistant', content: 'Existing message' }) + '\n'
    );

    await new Promise((r) => setTimeout(r, 150));

    watcher.stop();

    // Should not emit the duplicate
    expect(messages.length).toBe(0);
  });
});
