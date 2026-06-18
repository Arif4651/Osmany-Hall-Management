/**
 * PageSkeleton — generic full-page loading skeleton with shimmer animation.
 * Used as the Suspense fallback for lazy-loaded routes so users see a
 * meaningful layout instead of a blank screen.
 */
export default function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Loading page…">
      {/* Page header */}
      <div className="skeleton-header">
        <div className="skeleton-block skeleton-title" />
        <div className="skeleton-block skeleton-subtitle" />
      </div>

      {/* Toolbar / filter row */}
      <div className="skeleton-toolbar">
        <div className="skeleton-block skeleton-chip" />
        <div className="skeleton-block skeleton-chip" />
        <div className="skeleton-block skeleton-chip" style={{ marginLeft: 'auto' }} />
      </div>

      {/* Content cards */}
      <div className="skeleton-cards">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-block skeleton-card-title" />
            <div className="skeleton-block skeleton-card-body" />
            <div className="skeleton-block skeleton-card-body short" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <TableSkeleton rows={6} />
    </div>
  );
}

/**
 * TableSkeleton — reusable animated table placeholder.
 *
 * @param {{ rows?: number, cols?: number, showHeader?: boolean }} props
 */
export function TableSkeleton({ rows = 5, cols = 4, showHeader = true }) {
  return (
    <div className="skeleton-table-wrap" aria-busy="true" aria-label="Loading table…">
      {showHeader && (
        <div className="skeleton-table-header">
          {[...Array(cols)].map((_, i) => (
            <div key={i} className="skeleton-block skeleton-th" />
          ))}
        </div>
      )}
      {[...Array(rows)].map((_, rowIdx) => (
        <div key={rowIdx} className="skeleton-table-row">
          {[...Array(cols)].map((_, colIdx) => (
            <div
              key={colIdx}
              className="skeleton-block skeleton-td"
              style={{ width: colIdx === 0 ? '30%' : colIdx === cols - 1 ? '15%' : '20%' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
