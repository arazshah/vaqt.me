import { maskPhone } from './mask-phone';

describe('maskPhone', () => {
  it('masks the middle digits of a canonical number', () => {
    expect(maskPhone('+989123456789')).toBe('+98912***6789');
  });

  it('returns a fixed mask for short/invalid input', () => {
    expect(maskPhone('123')).toBe('***');
  });

  it('returns a fixed mask for an empty string', () => {
    expect(maskPhone('')).toBe('***');
  });
});
