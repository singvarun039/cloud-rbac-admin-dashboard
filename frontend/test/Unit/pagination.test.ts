import { describe, expect, it } from 'vitest';
import { buildPaginationItems } from '../../src/utils/pagination';

describe('buildPaginationItems', () => {
  it('returns every page when the total is small', () => {
    expect(buildPaginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('adds ellipses in the middle of larger ranges', () => {
    expect(buildPaginationItems(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  });

  it('anchors the start and end windows correctly', () => {
    expect(buildPaginationItems(2, 10)).toEqual([1, 2, 3, 4, 'ellipsis', 10]);
    expect(buildPaginationItems(9, 10)).toEqual([1, 'ellipsis', 7, 8, 9, 10]);
  });
});
