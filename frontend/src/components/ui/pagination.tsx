import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "../../lib/utils";
import { buttonVariants } from "./button-variants";

// Renders the pagination navigation container.
const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

// Renders the pagination items list.
const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";

// Renders a pagination list item.
const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
));
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<"a">;

// Renders an individual pagination link.
const PaginationLink = ({
  className,
  isActive,
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({ variant: isActive ? "outline" : "ghost", size: "icon" }),
      className,
    )}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

type PaginationButtonProps = React.ComponentProps<"a">;

// Renders the previous-page pagination control.
const PaginationPrevious = ({ className, ...props }: PaginationButtonProps) => (
  <a
    aria-label="Go to previous page"
    className={cn(
      buttonVariants({ variant: "ghost" }),
      "gap-1 pl-2.5 pr-3",
      className,
    )}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </a>
);
PaginationPrevious.displayName = "PaginationPrevious";

// Renders the next-page pagination control.
const PaginationNext = ({ className, ...props }: PaginationButtonProps) => (
  <a
    aria-label="Go to next page"
    className={cn(
      buttonVariants({ variant: "ghost" }),
      "gap-1 pl-3 pr-2.5",
      className,
    )}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </a>
);
PaginationNext.displayName = "PaginationNext";

// Renders the collapsed pagination indicator.
const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
