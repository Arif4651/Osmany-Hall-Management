import { useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import PageSection from '../components/layout/PageSection';
import Button from '../components/ui/Button';
import useAdminStudentModule from '../hooks/useAdminStudentModule';
import StudentSearchBar from '../components/student-management/StudentSearchBar';
import StudentFilters from '../components/student-management/StudentFilters';
import StudentTable from '../components/student-management/StudentTable';
import BulkActionToolbar from '../components/student-management/BulkActionToolbar';
import AddStudentModal from '../components/student-management/AddStudentModal';
import EditStudentModal from '../components/student-management/EditStudentModal';
import DeleteStudentModal from '../components/student-management/DeleteStudentModal';
import BulkUpdateModal from '../components/student-management/BulkUpdateModal';
import BulkConfirmationModal from '../components/student-management/BulkConfirmationModal';
import ReactivateStudentModal from '../components/student-management/ReactivateStudentModal';
import StudentDetailsDrawer from '../components/student-management/StudentDetailsDrawer';
import {
  exportStudentsToCsv,
  exportStudentsToExcel,
  exportStudentsToPdf,
  exportStudentsToWord,
  printStudents,
} from '../utils/studentExportHelpers';

export default function AdminStudentsPage() {
  const {
    students,
    isLoading,
    isSubmitting,
    errorMessage,
    setErrorMessage,
    successNotice,
    setSuccessNotice,

    filters,
    updateFilter,
    resetFilters,

    page,
    pageSize,
    setPage,
    setPageSize,
    total,
    totalPages,
    filterOptions,

    selectedIds,
    selectedSet,
    selectionSummary,
    toggleStudentSelection,
    togglePageSelection,
    selectAllFiltered,
    clearSelection,

    createStudent,
    updateStudent,
    markStudentInactive,
    deleteStudentPermanently,
    resetStudentPassword,
    reactivateStudent,

    bulkUpdateStudents,
    bulkArchiveStudents,
    bulkPermanentDeleteStudents,

    evaluateAllLifecycles,
    getFilteredStudentsForExport,
  } = useAdminStudentModule();

  const [activeStudent, setActiveStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isBulkPromotion, setIsBulkPromotion] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [bulkConfirmTitle, setBulkConfirmTitle] = useState('Confirm Bulk Update');
  const [pendingBulkFields, setPendingBulkFields] = useState({});
  const [isExporting, setIsExporting] = useState(false);

  const hasSelection = selectedIds.length > 0;

  const pageStart = useMemo(() => {
    if (!total) return 0;
    return (page - 1) * pageSize + 1;
  }, [page, pageSize, total]);

  const pageEnd = useMemo(() => Math.min(page * pageSize, total), [page, pageSize, total]);

  const handleRowAction = async (action, student) => {
    if (action === 'view') {
      setActiveStudent(student);
      return;
    }

    if (action === 'edit') {
      setEditingStudent(student);
      return;
    }

    if (action === 'resetPassword') {
      await resetStudentPassword(student.id);
      return;
    }

    if (action === 'reactivate') {
      setReactivateTarget(student);
      return;
    }

    if (action === 'markInactive' || action === 'remove') {
      await markStudentInactive(student.id);
      return;
    }

    if (action === 'archive') {
      await updateStudent(student.id, { status: 'archived' });
      return;
    }

    if (action === 'deletePermanent') {
      setDeleteStudent(student);
    }
  };

  const handleBulkPreview = (updateFields) => {
    setPendingBulkFields(updateFields);
    setBulkConfirmTitle(isBulkPromotion ? 'Confirm Bulk Promotion' : 'Confirm Bulk Update');
    setIsBulkUpdateOpen(false);
    setIsBulkConfirmOpen(true);
  };

  const handleBulkConfirm = async () => {
    await bulkUpdateStudents(pendingBulkFields);
    setIsBulkConfirmOpen(false);
    setPendingBulkFields({});
    setIsBulkPromotion(false);
  };

  const handleBulkDeleteConfirm = async () => {
    await bulkPermanentDeleteStudents(true);
    setIsBulkDeleteConfirmOpen(false);
  };

  const handleExportStudents = async (format) => {
    setIsExporting(true);
    setErrorMessage('');

    try {
      const rows = await getFilteredStudentsForExport();
      if (!rows.length) {
        setSuccessNotice({
          title: 'No data to export',
          lines: ['There are no students in the current filtered result.'],
        });
        return;
      }

      if (format === 'csv') {
        exportStudentsToCsv(rows);
      } else if (format === 'excel') {
        await exportStudentsToExcel(rows);
      } else if (format === 'pdf') {
        await exportStudentsToPdf(rows);
      } else if (format === 'word') {
        exportStudentsToWord(rows);
      } else if (format === 'print') {
        printStudents(rows);
      }

      setSuccessNotice({
        title: 'Export completed',
        lines: [`${rows.length} students exported as ${format === 'excel' ? 'XLSX' : format.toUpperCase()}.`],
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to export student list.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <PageHeader
        title="Student Management"
        description="Lifecycle-ready student administration with dynamic filtering, bulk promotion, reactivation, and deletion controls."
        actions={[
          {
            label: 'Evaluate Lifecycle',
            variant: 'secondary',
            onClick: evaluateAllLifecycles,
          },
          {
            label: 'Add Student',
            onClick: () => setIsAddOpen(true),
          },
        ]}
      />

      {errorMessage ? <div className="student-message student-message-error">{errorMessage}</div> : null}
      {successNotice ? (
        <div className="student-message student-message-success">
          <div>
            <strong>{successNotice.title}</strong>
            {successNotice.lines?.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <button type="button" onClick={() => setSuccessNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <PageSection title="Search and Filters" subtitle="Search by Name, Student ID, Hall ID, Mobile and refine with reusable filters.">
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <StudentSearchBar value={filters.search} onChange={(value) => updateFilter('search', value)} />
          <StudentFilters
            filters={filters}
            departments={filterOptions.departments}
            sessions={filterOptions.sessions}
            halls={filterOptions.halls}
            onChange={updateFilter}
            onReset={resetFilters}
          />
        </div>
      </PageSection>

      <PageSection title="Bulk Management" subtitle="Filter -> select all filtered -> deselect exceptions -> preview -> confirm.">
        <BulkActionToolbar
          summary={selectionSummary}
          hasSelection={hasSelection}
          onSelectAllFiltered={selectAllFiltered}
          onClearSelection={clearSelection}
          onOpenBulkUpdate={() => {
            setIsBulkPromotion(false);
            setIsBulkUpdateOpen(true);
          }}
          onOpenBulkPromotion={() => {
            setIsBulkPromotion(true);
            setIsBulkUpdateOpen(true);
          }}
          onArchive={bulkArchiveStudents}
          onReactivate={() => {
            setIsBulkPromotion(false);
            setIsBulkUpdateOpen(true);
          }}
          onOpenBulkDelete={() => setIsBulkDeleteConfirmOpen(true)}
        />
      </PageSection>

      <PageSection
        title="Student List"
        subtitle={`Showing ${pageStart}-${pageEnd} of ${total} students`}
      >
        <div className="inline-actions" style={{ marginBottom: '0.75rem' }}>
          <Button variant="secondary" onClick={() => handleExportStudents('excel')} disabled={isExporting || isLoading}>
            Export Excel
          </Button>
          <Button variant="secondary" onClick={() => handleExportStudents('csv')} disabled={isExporting || isLoading}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => handleExportStudents('pdf')} disabled={isExporting || isLoading}>
            Export PDF
          </Button>
          <Button variant="secondary" onClick={() => handleExportStudents('word')} disabled={isExporting || isLoading}>
            Export Word
          </Button>
          <Button variant="secondary" onClick={() => handleExportStudents('print')} disabled={isExporting || isLoading}>
            Print List
          </Button>
        </div>

        <StudentTable
          students={students}
          isLoading={isLoading}
          selectedSet={selectedSet}
          onToggleStudent={toggleStudentSelection}
          onTogglePage={togglePageSelection}
          onAction={handleRowAction}
        />

        <div className="student-pagination-row">
          <div>
            <span>Rows per page</span>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="inline-actions">
            <Button variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <span style={{ alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            <Button variant="secondary" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
              Next
            </Button>
            <Button variant="ghost" onClick={evaluateAllLifecycles}>
              <RefreshCcw size={14} />
              Recheck Lifecycle
            </Button>
          </div>
        </div>
      </PageSection>

      <StudentDetailsDrawer
        student={activeStudent}
        onClose={() => setActiveStudent(null)}
        onEdit={(student) => setEditingStudent(student)}
        onReactivate={(student) => setReactivateTarget(student)}
      />

      <AddStudentModal
        isOpen={isAddOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsAddOpen(false)}
        onCreate={createStudent}
      />

      <EditStudentModal
        student={editingStudent}
        isOpen={Boolean(editingStudent)}
        isSubmitting={isSubmitting}
        onClose={() => setEditingStudent(null)}
        onUpdate={updateStudent}
      />

    <DeleteStudentModal
  student={deleteStudent}
  isOpen={Boolean(deleteStudent)}
  isSubmitting={isSubmitting}
  onClose={() => setDeleteStudent(null)}
  onMarkInactive={markStudentInactive}
  onDeletePermanent={() => deleteStudentPermanently(deleteStudent.id, false)}
/>

      <ReactivateStudentModal
        student={reactivateTarget}
        isOpen={Boolean(reactivateTarget)}
        isSubmitting={isSubmitting}
        onClose={() => setReactivateTarget(null)}
        onReactivate={reactivateStudent}
      />

      <BulkUpdateModal
        isOpen={isBulkUpdateOpen}
        isPromotionOnly={isBulkPromotion}
        isSubmitting={isSubmitting}
        summary={selectionSummary}
        onClose={() => setIsBulkUpdateOpen(false)}
        onPreview={handleBulkPreview}
      />

      <BulkConfirmationModal
        isOpen={isBulkConfirmOpen}
        title={bulkConfirmTitle}
        isSubmitting={isSubmitting}
        summary={selectionSummary}
        updateFields={pendingBulkFields}
        isDestructive={false}
        onClose={() => {
          setIsBulkConfirmOpen(false);
          setPendingBulkFields({});
        }}
        onConfirm={handleBulkConfirm}
      />

    <BulkConfirmationModal
        isOpen={isBulkDeleteConfirmOpen}
        title="Permanent Delete by Filtering"
        isSubmitting={isSubmitting}
        summary={selectionSummary}
        updateFields={{ action: 'Delete Permanently' }}
        isDestructive
        onClose={() => {
          setIsBulkDeleteConfirmOpen(false);
        }}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
}
