/**
 * Claim Parser Tests
 */

import { describe, expect, it } from 'vitest';
import { parseClaim, parseMultipleClaims } from './claim-parser.js';

describe('parseClaim', () => {
  describe('rename claims', () => {
    it('parses "renamed X to Y"', () => {
      const result = parseClaim('I renamed UserService to AuthService');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('rename');
      expect(result.claim?.oldValue).toBe('UserService');
      expect(result.claim?.newValue).toBe('AuthService');
    });

    it('parses "renamed X to Y everywhere"', () => {
      const result = parseClaim('I renamed UserService to AuthService everywhere');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('rename');
      expect(result.claim?.oldValue).toBe('UserService');
      expect(result.claim?.newValue).toBe('AuthService');
      expect(result.claim?.scope).toBe('everywhere');
    });

    it('parses "changed X to Y"', () => {
      const result = parseClaim('Changed oldName to newName');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('rename');
      expect(result.claim?.oldValue).toBe('oldName');
      expect(result.claim?.newValue).toBe('newName');
    });

    it('parses with arrow syntax', () => {
      const result = parseClaim('Renamed config -> settings');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('rename');
      expect(result.claim?.oldValue).toBe('config');
      expect(result.claim?.newValue).toBe('settings');
    });

    it('parses quoted values', () => {
      const result = parseClaim('Renamed "oldValue" to "newValue"');
      expect(result.success).toBe(true);
      expect(result.claim?.oldValue).toBe('oldValue');
      expect(result.claim?.newValue).toBe('newValue');
    });
  });

  describe('remove claims', () => {
    it('parses "removed all X"', () => {
      const result = parseClaim('I removed all console.log statements');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('remove');
      expect(result.claim?.oldValue).toContain('console.log');
    });

    it('parses "deleted X"', () => {
      const result = parseClaim('Deleted debugger statements');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('remove');
    });

    it('parses "got rid of X"', () => {
      const result = parseClaim('Got rid of the legacy API calls');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('remove');
    });
  });

  describe('update claims', () => {
    it('parses "updated imports from X to Y"', () => {
      const result = parseClaim('Updated imports from lodash to lodash-es');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('update');
      expect(result.claim?.oldValue).toBe('lodash');
      expect(result.claim?.newValue).toBe('lodash-es');
    });

    it('parses "replaced X with Y"', () => {
      const result = parseClaim('Replaced axios with fetch');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('update');
      expect(result.claim?.oldValue).toBe('axios');
      expect(result.claim?.newValue).toBe('fetch');
    });

    it('parses "migrated X to Y"', () => {
      const result = parseClaim('Migrated moment to dayjs');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('update');
    });
  });

  describe('fallback parsing', () => {
    it('extracts quoted values as remove (single value)', () => {
      const result = parseClaim('Did something with "OldThing"');
      expect(result.success).toBe(true);
      expect(result.claim?.oldValue).toBe('OldThing');
      expect(result.claim?.action).toBe('remove');
    });

    it('extracts single quoted value as remove', () => {
      const result = parseClaim('Cleaned up `deprecatedFunction`');
      expect(result.success).toBe(true);
      expect(result.claim?.action).toBe('remove');
      expect(result.claim?.oldValue).toBe('deprecatedFunction');
    });
  });

  describe('empty/invalid input', () => {
    it('fails on empty string', () => {
      const result = parseClaim('');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails on whitespace only', () => {
      const result = parseClaim('   ');
      expect(result.success).toBe(false);
    });
  });
});

describe('parseMultipleClaims', () => {
  it('parses multiple claims from bullet list', () => {
    const text = `
      - Renamed UserService to AuthService
      - Removed all console.log statements
      - Updated lodash to lodash-es
    `;
    const results = parseMultipleClaims(text);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('parses claims from numbered list', () => {
    const text = `
      1. Renamed config to settings
      2. Deleted debug code
    `;
    const results = parseMultipleClaims(text);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('handles mixed format', () => {
    const text = `
      Fixed the bug by:
      - Renamed broken to fixed
      - Removed console.log statements
    `;
    const results = parseMultipleClaims(text);
    expect(results.length).toBeGreaterThan(0);
  });
});
