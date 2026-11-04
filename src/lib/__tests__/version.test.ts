import { compareVersions, isUpdateRequired } from '../version';

describe('version gate', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
  });
  it('requires an update only when below the minimum', () => {
    expect(isUpdateRequired('1.0.0', '1.0.0')).toBe(false);
    expect(isUpdateRequired('1.0.0', '1.1.0')).toBe(true);
    expect(isUpdateRequired('1.0.0', null)).toBe(false);
  });
});
