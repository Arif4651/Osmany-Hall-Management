import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCcw, Venus, Mars } from 'lucide-react';
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
import { studentService } from '../services/studentService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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

    filters,
    updateFilter,
    resetFilters,

    total,
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

  const toast = useToast();

  // Wing-admin context — drives gender filter visibility and the header badge
  const { user, role } = useAuth();
  const isWingAdmin = role === 'male_wing_admin' || role === 'female_wing_admin';
  const wingLabel = user?.wing ? `${user.wing} Wing` : null;

  const [activeStudent, setActiveStudent] = useState(null);
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    const studentId = searchParams.get('student');
    if (!studentId) return;
    studentService.getStudentById(studentId).then(setActiveStudent).catch(() => null);
  }, [searchParams]);

  const hasSelection = selectedIds.length > 0;

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
    // Same eligibility rule as the single-row delete: only inactive/archived/graduated
    // students are actually removed. force:true used to skip that check here, so bulk-delete
    // could wipe an Active student's full billing/payment history in two clicks while the
    // single-row action correctly refused to. bulkPermanentDeleteStudents already reports how
    // many were skipped as not eligible.
    await bulkPermanentDeleteStudents(false);
    setIsBulkDeleteConfirmOpen(false);
  };

  const handleExportStudents = async (format) => {
    setIsExporting(true);
    setErrorMessage('');

    try {
      const rows = await getFilteredStudentsForExport();
      if (!rows.length) {
        toast.info('No data to export', 'There are no students in the current filtered result.');
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

      toast.success(
        format === 'print' ? 'Print sheet opened' : 'Export completed',
        `${rows.length} students exported as ${format === 'excel' ? 'XLSX' : format.toUpperCase()}.`,
      );
    } catch (error) {
      toast.error('Export failed', error instanceof Error ? error.message : 'Failed to export student list.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <PageHeader
        title="Student Management"
        description={
          isWingAdmin ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              {user?.wing === 'Female' ? <Venus size={15} /> : <Mars size={15} />}
              <strong>{wingLabel} Admin</strong> — Showing {user?.wing} students only.
            </span>
          ) : (
            'Lifecycle-ready student administration with dynamic filtering, bulk promotion, reactivation, and deletion controls.'
          )
        }
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
            isWingAdmin={isWingAdmin}
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
        subtitle={`Showing all ${total} students`}
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

        {/* No pagination — the roster always loads as a single page (useAdminStudentModule
            fetches with a fixed high page size), so there is nothing to page through. */}
        <div className="student-pagination-row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={evaluateAllLifecycles}>
            <RefreshCcw size={14} />
            Recheck Lifecycle
          </Button>
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
        destructiveNote="Only Inactive, Archived, or Graduated students in the selection are actually deleted — Active students are skipped and left untouched."
        onClose={() => {
          setIsBulkDeleteConfirmOpen(false);
        }}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
}
