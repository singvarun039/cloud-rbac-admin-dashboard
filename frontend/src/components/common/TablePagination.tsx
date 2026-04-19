import { Label } from '../ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { buildPaginationItems } from '../../utils/pagination';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  hasNext: boolean;
  limit: number;
  showingFrom: number;
  showingTo: number;
  total: number;
  resourceLabel: string;
  loading: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function TablePagination({
  page,
  totalPages,
  hasNext,
  limit,
  showingFrom,
  showingTo,
  total,
  resourceLabel,
  loading,
  onPageChange,
  onLimitChange,
}: TablePaginationProps) {
  const paginationItems = buildPaginationItems(page, totalPages);

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500">
        Showing {showingFrom}-{showingTo} of {total} {resourceLabel}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <Pagination className="sm:mx-0 sm:w-auto sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (loading || page <= 1) return;
                  onPageChange(Math.max(1, page - 1));
                }}
                className={loading || page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>

            {paginationItems.map((item, idx) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`e-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === page}
                    onClick={(e) => {
                      e.preventDefault();
                      if (loading) return;
                      onPageChange(item);
                    }}
                    className={loading ? 'pointer-events-none' : undefined}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (loading || !hasNext) return;
                  onPageChange(page + 1);
                }}
                className={loading || !hasNext ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-600">Page size</Label>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              onLimitChange(Number(value));
            }}
          >
            <SelectTrigger className="h-10 w-[92px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
