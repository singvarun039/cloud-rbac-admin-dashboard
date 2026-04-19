// Builds the array of pagination items (page numbers + ellipsis markers)
// for a bounded paginator with up to 7 visible items.
export function buildPaginationItems(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  let start = Math.max(2, page - 1);
  let end = Math.min(totalPages - 1, page + 1);

  if (page <= 3) {
    start = 2;
    end = 4;
  }
  if (page >= totalPages - 2) {
    start = totalPages - 3;
    end = totalPages - 1;
  }

  start = Math.max(2, start);
  end = Math.min(totalPages - 1, end);

  const items: Array<number | 'ellipsis'> = [1];
  if (start > 2) items.push('ellipsis');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push('ellipsis');
  items.push(totalPages);
  return items;
}
