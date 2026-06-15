import { useEffect, useState, useMemo } from 'react';
import { Megaphone, ChevronDown, ChevronUp, LoaderCircle } from 'lucide-react';
import { noticeService } from '../../services/noticeService';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const ITEMS_PER_PAGE = 5;

export default function StudentNoticeBoard() {
  useDocumentTitle('Notice Board');
  const [notices, setNotices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded card state
  const [expandedIds, setExpandedIds] = useState(new Set());

  const fetchNotices = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await noticeService.getNotices();
      setNotices(data);
      localStorage.setItem('lastNoticeBoardVisit', new Date().toISOString());
      // Automatically expand the first notice if exists
      if (data.length > 0) {
        setExpandedIds(new Set([data[0].id]));
      }
    } catch (err) {
      setError(err.message || 'Failed to load notices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Pagination Math
  const paginatedNotices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return notices.slice(start, start + ITEMS_PER_PAGE);
  }, [notices, currentPage]);

  const totalPages = Math.ceil(notices.length / ITEMS_PER_PAGE) || 1;

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="notice-board-page">
      <header className="notice-board-header">
        <div>
          <h1>Notice Board</h1>
          <p>Important announcements and notices for your wing</p>
        </div>
      </header>

      {error && <div className="student-message student-message-error">{error}</div>}

      {isLoading ? (
        <div className="notice-empty-state">
          <LoaderCircle size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
          <p>Loading notices...</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="notice-empty-state">
          <Megaphone size={36} style={{ strokeWidth: 1.5, margin: '0 auto 0.8rem', color: '#94a3b8' }} />
          <p>No notices posted yet.</p>
        </div>
      ) : (
        <section className="notice-list-container">
          {paginatedNotices.map((notice) => {
            const isExpanded = expandedIds.has(notice.id);
            return (
              <div key={notice.id} className="notice-card" style={{ padding: '1.25rem' }}>
                <div 
                  className="notice-card-header" 
                  onClick={() => toggleExpand(notice.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="notice-title-block">
                    <div className="notice-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                      <Megaphone size={16} />
                    </div>
                    <span className="notice-title" style={{ fontSize: '1.1rem' }}>{notice.title}</span>
                  </div>
                  <div className="notice-meta-block">
                    <span className={`notice-wing-badge ${notice.targetWing.toLowerCase()}`}>
                      {notice.targetWing}
                    </span>
                    <button type="button" className="notice-action-btn">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="notice-card-content" style={{ marginTop: '1.1rem', fontSize: '0.95rem' }}>
                    {notice.content}
                    <div className="notice-author-info" style={{ marginTop: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                      Posted by {notice.creatorName} on {new Date(notice.createdAtUtc).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {notices.length > ITEMS_PER_PAGE && (
            <div className="notice-pagination">
              <span>
                {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, notices.length)}-
                {Math.min(currentPage * ITEMS_PER_PAGE, notices.length)} of {notices.length}
              </span>
              <div className="notice-pagination-controls">
                <button
                  type="button"
                  className="notice-pagination-btn"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    type="button"
                    className={`notice-pagination-btn ${currentPage === i + 1 ? 'is-active' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="notice-pagination-btn"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  &gt;
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
