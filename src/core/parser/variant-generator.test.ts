/**
 * Variant Generator Tests
 */

import { describe, expect, it } from 'vitest';
import { generateVariants } from './variant-generator.js';

describe('generateVariants', () => {
  it('generates variants for PascalCase input', () => {
    const result = generateVariants('UserService');

    expect(result.original).toBe('UserService');
    expect(result.all).toContain('UserService');
    expect(result.all).toContain('userService');
    expect(result.all).toContain('user_service');
    expect(result.all).toContain('USER_SERVICE');
    expect(result.all).toContain('user-service');
  });

  it('generates variants for camelCase input', () => {
    const result = generateVariants('getUserById');

    expect(result.all).toContain('getUserById');
    expect(result.all).toContain('GetUserById');
    expect(result.all).toContain('get_user_by_id');
    expect(result.all).toContain('GET_USER_BY_ID');
    expect(result.all).toContain('get-user-by-id');
  });

  it('generates variants for snake_case input', () => {
    const result = generateVariants('user_service');

    expect(result.all).toContain('user_service');
    expect(result.all).toContain('UserService');
    expect(result.all).toContain('userService');
    expect(result.all).toContain('USER_SERVICE');
    expect(result.all).toContain('user-service');
  });

  it('generates variants for SCREAMING_SNAKE_CASE input', () => {
    const result = generateVariants('USER_SERVICE');

    expect(result.all).toContain('USER_SERVICE');
    expect(result.all).toContain('UserService');
    expect(result.all).toContain('userService');
    expect(result.all).toContain('user_service');
  });

  it('generates variants for kebab-case input', () => {
    const result = generateVariants('user-service');

    expect(result.all).toContain('user-service');
    expect(result.all).toContain('UserService');
    expect(result.all).toContain('userService');
    expect(result.all).toContain('user_service');
  });

  it('handles single word', () => {
    const result = generateVariants('config');

    expect(result.all).toContain('config');
    expect(result.all).toContain('Config');
    expect(result.all).toContain('CONFIG');
  });

  it('handles acronyms in PascalCase', () => {
    const result = generateVariants('XMLParser');

    expect(result.all).toContain('XMLParser');
    // Should handle the acronym boundary
    expect(result.variants.length).toBeGreaterThan(0);
  });

  it('returns original in all array', () => {
    const result = generateVariants('TestValue');

    expect(result.all[0]).toBe('TestValue');
    expect(result.all.includes('TestValue')).toBe(true);
  });

  it('variants array does not include original', () => {
    const result = generateVariants('TestValue');

    expect(result.variants.includes('TestValue')).toBe(false);
  });

  it('handles single character', () => {
    const result = generateVariants('x');

    expect(result.original).toBe('x');
    expect(result.all.includes('x')).toBe(true);
  });
});
