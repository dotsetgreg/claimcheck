/**
 * Context Detector Tests
 */

import { describe, expect, it } from 'vitest';
import { detectContext } from './context-detector.js';

describe('detectContext', () => {
  describe('code detection', () => {
    it('detects code in function call', () => {
      const result = detectContext('const x = UserService.get();', 10, 'UserService', 'src/app.ts');
      expect(result.context).toBe('code');
      expect(result.priority).toBe('high');
    });

    it('detects code in class definition', () => {
      const result = detectContext('class UserService {', 6, 'UserService', 'src/service.ts');
      expect(result.context).toBe('code');
      expect(result.priority).toBe('high');
    });
  });

  describe('import detection', () => {
    it('detects ES6 import', () => {
      const result = detectContext(
        "import { UserService } from './services';",
        9,
        'UserService',
        'src/app.ts'
      );
      expect(result.context).toBe('import');
      expect(result.priority).toBe('high');
    });

    it('detects CommonJS require', () => {
      const result = detectContext(
        "const UserService = require('./services');",
        6,
        'UserService',
        'src/app.js'
      );
      expect(result.context).toBe('import');
      expect(result.priority).toBe('high');
    });
  });

  describe('comment detection', () => {
    it('detects single-line comment (//)', () => {
      const result = detectContext(
        '// UserService handles auth',
        3,
        'UserService',
        'src/app.ts'
      );
      expect(result.context).toBe('comment');
      expect(result.priority).toBe('low');
    });

    it('detects single-line comment (#)', () => {
      const result = detectContext(
        '# UserService handles auth',
        2,
        'UserService',
        'src/app.py'
      );
      expect(result.context).toBe('comment');
      expect(result.priority).toBe('low');
    });

    it('detects JSDoc comment', () => {
      const result = detectContext(
        ' * @param {UserService} service',
        11,
        'UserService',
        'src/app.ts'
      );
      expect(result.context).toBe('comment');
      expect(result.priority).toBe('low');
    });

    it('detects documentation files', () => {
      const result = detectContext(
        'The UserService handles authentication.',
        4,
        'UserService',
        'docs/architecture.md'
      );
      expect(result.context).toBe('comment');
      expect(result.priority).toBe('low');
    });
  });

  describe('string detection', () => {
    it('detects match inside double quotes', () => {
      const result = detectContext(
        'const name = "UserService";',
        14,
        'UserService',
        'src/app.ts'
      );
      expect(result.context).toBe('string');
      expect(result.priority).toBe('low');
    });

    it('detects match inside single quotes', () => {
      const result = detectContext(
        "const name = 'UserService';",
        14,
        'UserService',
        'src/app.ts'
      );
      expect(result.context).toBe('string');
      expect(result.priority).toBe('low');
    });

    it('gives medium priority to strings in test files', () => {
      const result = detectContext(
        "describe('UserService', () => {",
        10,
        'UserService',
        'src/app.test.ts'
      );
      expect(result.context).toBe('string');
      expect(result.priority).toBe('medium');
    });

    it('handles escaped quotes correctly', () => {
      // The escaped quote should not start a string
      const result = detectContext(
        'const x = "foo\\"bar"; UserService.get();',
        23,
        'UserService',
        'src/app.ts'
      );
      expect(result.context).toBe('code');
      expect(result.priority).toBe('high');
    });

    it('handles escaped backslashes before quotes', () => {
      // The \\ escapes itself, so the quote after it ends the string
      const result = detectContext(
        'const x = "foo\\\\"; UserService.get();',
        20,
        'UserService',
        'src/app.ts'
      );
      expect(result.context).toBe('code');
      expect(result.priority).toBe('high');
    });
  });

  describe('test file detection', () => {
    it('identifies .test.ts files', () => {
      const result = detectContext(
        "const service = 'UserService';",
        18,
        'UserService',
        'src/services/auth.test.ts'
      );
      expect(result.context).toBe('string');
      expect(result.priority).toBe('medium');
    });

    it('identifies .spec.js files', () => {
      const result = detectContext(
        "const service = 'UserService';",
        18,
        'UserService',
        'src/services/auth.spec.js'
      );
      expect(result.context).toBe('string');
      expect(result.priority).toBe('medium');
    });

    it('identifies __tests__ directory', () => {
      const result = detectContext(
        "const service = 'UserService';",
        18,
        'UserService',
        'src/__tests__/auth.ts'
      );
      expect(result.context).toBe('string');
      expect(result.priority).toBe('medium');
    });
  });
});
