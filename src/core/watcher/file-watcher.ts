/**
 * File Watcher
 * Monitors files for changes and emits events
 */

import { watch, type FSWatcher, type WatchEventType } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { extractAssistantMessages, type SessionMessage } from './session-parser.js';

/**
 * Configuration for the file watcher
 */
export interface FileWatcherConfig {
  /** File path to watch */
  filePath: string;
  /** Debounce delay in ms (default: 100) */
  debounceMs?: number;
  /** Parse as JSONL session log (default: true) */
  parseJsonl?: boolean;
}

/**
 * Events emitted by the file watcher
 */
export interface FileWatcherEvents {
  change: (data: { content: string; newContent: string }) => void;
  message: (message: SessionMessage) => void;
  error: (error: Error) => void;
  ready: () => void;
}

/**
 * File watcher that monitors a file for changes
 * Emits events when new content is detected
 */
export class FileWatcher extends EventEmitter {
  private config: Required<FileWatcherConfig>;
  private watcher: FSWatcher | null = null;
  private lastContent: string = '';
  private lastSize: number = 0;
  private debounceTimer: NodeJS.Timeout | null = null;
  private seenMessages: Set<string> = new Set();

  constructor(config: FileWatcherConfig) {
    super();
    this.config = {
      filePath: config.filePath,
      debounceMs: config.debounceMs ?? 100,
      parseJsonl: config.parseJsonl ?? true,
    };
  }

  /**
   * Start watching the file
   */
  async start(): Promise<void> {
    // Read initial content
    try {
      const stats = await stat(this.config.filePath);
      this.lastSize = stats.size;
      this.lastContent = await readFile(this.config.filePath, 'utf-8');

      // Mark existing messages as seen
      if (this.config.parseJsonl) {
        const messages = extractAssistantMessages(this.lastContent);
        for (const msg of messages) {
          this.seenMessages.add(this.messageKey(msg));
        }
      }
    } catch (error) {
      // File might not exist yet - that's OK
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Start watching
    this.watcher = watch(this.config.filePath, (eventType) => {
      this.handleChange(eventType);
    });

    this.watcher.on('error', (error) => {
      this.emit('error', error);
    });

    this.emit('ready');
  }

  /**
   * Stop watching the file
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Handle a file change event
   */
  private handleChange(eventType: WatchEventType): void {
    if (eventType !== 'change') return;

    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processChange().catch((error) => {
        this.emit('error', error);
      });
    }, this.config.debounceMs);
  }

  /**
   * Process a file change
   */
  private async processChange(): Promise<void> {
    try {
      const stats = await stat(this.config.filePath);

      // Only process if file grew (new content appended)
      if (stats.size <= this.lastSize) {
        // File might have been truncated/rewritten - reset
        if (stats.size < this.lastSize) {
          this.lastSize = stats.size;
          this.lastContent = await readFile(this.config.filePath, 'utf-8');
          this.seenMessages.clear();

          // Mark current messages as seen
          if (this.config.parseJsonl) {
            const messages = extractAssistantMessages(this.lastContent);
            for (const msg of messages) {
              this.seenMessages.add(this.messageKey(msg));
            }
          }
        }
        return;
      }

      // Read new content
      const content = await readFile(this.config.filePath, 'utf-8');
      const newContent = content.slice(this.lastContent.length);

      this.lastSize = stats.size;
      this.lastContent = content;

      // Emit raw change event
      this.emit('change', { content, newContent });

      // Parse and emit messages if JSONL mode
      if (this.config.parseJsonl && newContent.trim()) {
        const messages = extractAssistantMessages(newContent);

        for (const message of messages) {
          const key = this.messageKey(message);
          if (!this.seenMessages.has(key)) {
            this.seenMessages.add(key);
            this.emit('message', message);
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Generate a unique key for a message (for deduplication)
   */
  private messageKey(message: SessionMessage): string {
    // Use content hash + timestamp if available
    const content = message.content.slice(0, 500); // First 500 chars
    return `${message.role}:${message.timestamp || ''}:${content}`;
  }
}
