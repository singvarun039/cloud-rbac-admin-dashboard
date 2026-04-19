export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

export type PageSizeOption = 10 | 20 | 50 | 100;

export const PAGE_SIZE_OPTIONS: PageSizeOption[] = [10, 20, 50, 100];
