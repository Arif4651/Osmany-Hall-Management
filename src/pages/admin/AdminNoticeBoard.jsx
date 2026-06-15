import { useEffect, useState, useMemo } from 'react';
import { Megaphone, Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { noticeService } from '../../services/noticeService';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const ITEMS_PER_PAGE = 5;

export default function AdminNoticeBoard() {
  useDocumentTitle('Notice Board');
  const { user, role } = useAuth();

  const isSuperAdmin = role === 'super_admin' || role === 'admin';
  const isMaleWingAdmin = role === 'male_wing_admin';
  const isFemaleWingAdmin = role === 'female_wing_admin';
  const isWingAdmin = isMaleWingAdmin || isFemaleWingAdmin;

  // Determine initial target wing default for this admin
  const defaultTargetWing = isMaleWingAdmin ? 'Male' : isFemaleWingAdmin ? 'Female' : 'All';

  const [notices, setNotices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetWing: defaultTargetWing
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded card state (track notice IDs that are expanded)
  const [expandedIds, setExpandedIds] = useState(new Set());

  const fetchNotices = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await noticeService.getNotices();
      setNotices(data);
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

  const toggleExpand = (id, e) => {
    // Prevent expanding if they clicked on action buttons
    if (e.target.closest('.notice-action-btn')) return;

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOpenNewForm = () => {
    setEditId(null);
    setFormData({
      title: '',
      content: '',
      targetWing: defaultTargetWing
    });
    setShowForm(true);
  };

  const handleOpenEditForm = (notice) => {
    setEditId(notice.id);
    setFormData({
      title: notice.title,
      content: notice.content,
      targetWing: notice.targetWing
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditId(null);
    setFormData({
      title: '',
      content: '',
      targetWing: defaultTargetWing
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      if (editId) {
        await noticeService.updateNotice(editId, formData);
      } else {
        await noticeService.createNotice(formData);
      }
      handleCloseForm();
      fetchNotices();
    } catch (err) {
      setError(err.message || 'Failed to post notice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notice?')) return;
    try {
      await noticeService.deleteNotice(id);
      fetchNotices();
    } catch (err) {
      setError(err.message || 'Failed to delete notice.');
    }
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

  // Check if current user is allowed to edit/delete a notice
  const canModifyNotice = (notice) => {
    if (isSuperAdmin) return true;
    if (isMaleWingAdmin && notice.targetWing === 'Male') return true;
    if (isFemaleWingAdmin && notice.targetWing === 'Female') return true;
    return false;
  };

  const getWingLabel = (wing) => {
    if (wing === 'All') return 'All Wings';
    return `${wing} Wing`;
  };

  return (
    <div className="notice-board-page">
      <header className="notice-board-header">
        <div>
          <h1>Notice Board</h1>
          <p>Post and manage notices for your wing</p>
        </div>
        {!showForm && (
          <Button variant="primary" onClick={handleOpenNewForm}>
            <Plus size={16} /> New Notice
          </Button>
        )}
      </header>

      {error && <div className="student-message student-message-error">{error}</div>}

      {showForm && (
        <form className="notice-form-card" onSubmit={handleSubmit}>
          <div className="notice-board-header" style={{ margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3>{editId ? 'Edit Notice' : 'New Notice'}</h3>
            <button type="button" className="notice-action-btn" onClick={handleCloseForm}>
              <X size={18} /> Close
            </button>
          </div>

          <div className="notice-form-row">
            <div className="field-control" style={{ margin: 0 }}>
              <input
                type="text"
                name="title"
                placeholder="Notice title"
                className="input-field"
                value={formData.title}
                onChange={handleInputChange}
                required
                maxLength={200}
                style={{ width: '100%' }}
              />
            </div>
            <div className="field-control" style={{ margin: 0 }}>
              <select
                name="targetWing"
                className="select-field"
                value={formData.targetWing}
                onChange={handleInputChange}
                disabled={isWingAdmin} // Wing admins are locked to their own wing
                style={{ height: '38px', minWidth: '150px' }}
              >
                {isSuperAdmin && <option value="All">All Wings</option>}
                {(isSuperAdmin || isMaleWingAdmin) && <option value="Male">Male Wing</option>}
                {(isSuperAdmin || isFemaleWingAdmin) && <option value="Female">Female Wing</option>}
              </select>
            </div>
          </div>

          <div className="field-control">
            <textarea
              name="content"
              placeholder="Notice content..."
              className="textarea-field"
              rows={5}
              value={formData.content}
              onChange={handleInputChange}
              required
              maxLength={4000}
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" type="submit" disabled={isSubmitting} style={{ background: '#00a050' }}>
              {isSubmitting ? (
                <>
                  <LoaderCircle size={15} className="spin" /> Posting...
                </>
              ) : (
                editId ? 'Save Notice' : 'Post Notice'
              )}
            </Button>
          </div>
        </form>
      )}

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
            const canModify = canModifyNotice(notice);
            return (
              <div key={notice.id} className="notice-card">
                <div className="notice-card-header" onClick={(e) => toggleExpand(notice.id, e)}>
                  <div className="notice-title-block">
                    <div className="notice-icon-wrap">
                      <Megaphone size={16} />
                    </div>
                    <span className="notice-title">{notice.title}</span>
                  </div>
                  <div className="notice-meta-block">
                    <span className={`notice-wing-badge ${notice.targetWing.toLowerCase()}`}>
                      {notice.targetWing}
                    </span>
                    {canModify && (
                      <>
                        <button
                          type="button"
                          className="notice-action-btn"
                          onClick={() => handleOpenEditForm(notice)}
                          title="Edit Notice"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="notice-action-btn delete"
                          onClick={() => handleDelete(notice.id)}
                          title="Delete Notice"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <button type="button" className="notice-action-btn">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="notice-card-content">
                    {notice.content}
                    <div className="notice-author-info">
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
