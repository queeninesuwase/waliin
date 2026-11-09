type PaginationProps = {
  page: number;
  pageCount: number;
  summary: string;
  onChange: (page: number) => void;
};

export default function Pagination({
  page,
  pageCount,
  summary,
  onChange,
}: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-base text-gray-500">
      <nav aria-label="Pages" className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="h-10 w-10 rounded-md hover:bg-gray-100 disabled:opacity-40"
        >
          ‹
        </button>
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            aria-current={number === page ? "page" : undefined}
            onClick={() => onChange(number)}
            className={`h-10 min-w-10 rounded-md px-2 ${
              number === page
                ? "bg-brand font-semibold text-white"
                : "hover:bg-gray-100"
            }`}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          className="h-10 w-10 rounded-md hover:bg-gray-100 disabled:opacity-40"
        >
          ›
        </button>
      </nav>
      <p>{summary}</p>
    </div>
  );
}
