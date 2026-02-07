/**
 * Tests for color field validator
 */

import { validateColor } from '../../../src/validators/color';

describe('validateColor', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateColor(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateColor(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "blue"', () => {
      const result = validateColor('blue');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "cyan"', () => {
      const result = validateColor('cyan');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "green"', () => {
      const result = validateColor('green');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "yellow"', () => {
      const result = validateColor('yellow');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "magenta"', () => {
      const result = validateColor('magenta');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "red"', () => {
      const result = validateColor('red');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for unknown color', () => {
      const result = validateColor('purple');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got "purple".'
      );
    });

    it('returns invalid for empty string', () => {
      const result = validateColor('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got "".'
      );
    });

    it('returns invalid for "Blue" (case sensitive)', () => {
      const result = validateColor('Blue');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got "Blue".'
      );
    });

    it('returns invalid for "RED" (case sensitive)', () => {
      const result = validateColor('RED');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got "RED".'
      );
    });

    it('returns invalid for hex color code', () => {
      const result = validateColor('#ff0000');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got "#ff0000".'
      );
    });

    it('returns invalid for number type', () => {
      const result = validateColor(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validateColor(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got type "boolean".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validateColor(['blue']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got type "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateColor({ color: 'blue' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got type "object".'
      );
    });
  });

  describe('edge cases', () => {
    it('returns invalid for "blue" with leading space', () => {
      const result = validateColor(' blue');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got " blue".'
      );
    });

    it('returns invalid for "blue" with trailing space', () => {
      const result = validateColor('blue ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'color\' must be one of: blue, cyan, green, yellow, magenta, red. Got "blue ".'
      );
    });
  });
});
