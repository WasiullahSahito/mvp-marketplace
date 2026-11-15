import { describe, expect, it } from 'vitest';
import { calculatePrice, cartLineKey, discountPercent, formatPrice } from './pricing';

const BASE = 269.99;
const d = (priceDelta: number) => ({ priceDelta });

describe('calculatePrice (Prague Divan Bed, base £269.99)', () => {
  it('1. Small Single + No Storage + free headboard + Standard base = £359.99', () => {
    expect(calculatePrice(BASE, [d(90), d(0), d(0), d(0)])).toBe(359.99);
  });

  it('2. King + 4 Drawers + 54" headboard + Reinforced + Assembly = £679.98', () => {
    // 269.99 + 125 + 210 + 10 + 25 + 39.99
    expect(calculatePrice(BASE, [d(125), d(210), d(10), d(25), d(39.99)])).toBe(679.98);
  });

  it('3. Double 4FT6 + 2 Drawers Left + free headboard + Standard = £429.99', () => {
    expect(calculatePrice(BASE, [d(110), d(50), d(0), d(0)])).toBe(429.99);
  });

  it('4. Super King + 2 Drawers Foot End + 54" headboard + Reinforced = £609.99', () => {
    // 269.99 + 150 + 155 + 10 + 25
    expect(calculatePrice(BASE, [d(150), d(155), d(10), d(25)])).toBe(609.99);
  });

  it('5. Single 3FT + 2 Drawers Right + Assembly only = £449.98', () => {
    // 269.99 + 95 + 45 + 0 + 0 + 39.99
    expect(calculatePrice(BASE, [d(95), d(45), d(0), d(0), d(39.99)])).toBe(449.98);
  });

  it('6. Small Double + No Storage + 54" headboard + Standard = £379.99', () => {
    expect(calculatePrice(BASE, [d(100), d(0), d(10), d(0)])).toBe(379.99);
  });

  it('no options chosen = base price', () => {
    expect(calculatePrice(BASE, [])).toBe(269.99);
  });

  it('does not suffer from floating point drift', () => {
    expect(calculatePrice(0.1, [d(0.2)])).toBe(0.3);
  });
});

describe('discountPercent', () => {
  it('£269.99 vs £539.98 is 50% off', () => {
    expect(discountPercent(269.99, 539.98)).toBe(50);
  });
  it('no compare-at price means no badge', () => {
    expect(discountPercent(269.99, null)).toBe(0);
  });
  it('compare-at not higher than price means no badge', () => {
    expect(discountPercent(300, 250)).toBe(0);
  });
});

describe('cartLineKey', () => {
  it('same options in any order = same line', () => {
    expect(cartLineKey('p', ['b', 'a'])).toBe(cartLineKey('p', ['a', 'b']));
  });
  it('different options = different line', () => {
    expect(cartLineKey('p', ['a', 'b'])).not.toBe(cartLineKey('p', ['a', 'c']));
  });
});

describe('formatPrice', () => {
  it('shows pounds with 2 decimals', () => {
    expect(formatPrice(269.99)).toBe('£269.99');
    expect(formatPrice(300)).toBe('£300.00');
  });
});
