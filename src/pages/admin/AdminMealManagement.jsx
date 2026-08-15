import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Download, Edit2, Loader2, Power, Search, Settings2, Users } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import useAdminMealModule from '../../hooks/useAdminMealModule';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency, todayLocal } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { useQueryCache } from '../../context/QueryCacheContext';
import { useToast } from '../../context/ToastContext';
import TableSkeleton from '../../components/ui/TableSkeleton';
import AdditionalItemsPanel from '../../components/admin/AdditionalItemsPanel';
import { MENU_KEYS } from '../../services/permissionService';

const tomorrowLocal = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA').format(date);
};

const emptyOverride = {
  mealPeriod: 'breakfast',
  effectiveFrom: todayLocal(),
  effectiveTo: todayLocal(),
  isOn: false,
  note: '',
};

function itemNames(items = []) {
  return items.map((item) => item.name).join(', ') || 'Not configured';
}

function mealCost(meal) {
  return (meal?.commonItems || [])
    .reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

function MealCell({ meal, onEdit }) {
  const hasItems = Boolean(meal?.commonItems?.length || meal?.optionalItems?.length);
  if (!hasItems) {
    return (
      <div className="meal-menu-cell">
        <span className="meal-empty">Not configured</span>
        <button type="button" onClick={onEdit}><Edit2 size={14} /> Edit</button>
      </div>
    );
  }
  return (
    <div className="meal-menu-cell">
      <strong>{itemNames(meal.commonItems)}</strong>
      {meal.optionalItems.length > 0 && (
        <span>Options: {meal.optionalItems.map((item) => item.name).join(', ')}</span>
      )}
      <span className="meal-menu-cost">Cost: {formatCurrency(mealCost(meal))}</span>
      <button type="button" onClick={onEdit}><Edit2 size={14} /> Edit</button>
    </div>
  );
}

export default function AdminMealManagement() {
  useDocumentTitle('Meal Management');
  const { user, can } = useAuth();
  const [selectedWing, setSelectedWing] = useState(() => user?.wing || 'Male');

  const {
    isLoading,
    errorMessage,
    cutoffTime,
    dayOptions,
    mealTypeOptions,
    menuRows,
    updateCutoffTime,
    getMealForEdit,
    saveMealConfiguration,
  } = useAdminMealModule(selectedWing);

  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('menu');
  const [saving, setSaving] = useState(false);
  const [studentControlSaving, setStudentControlSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [menuFormError, setMenuFormError] = useState('');
  const [overrideFormError, setOverrideFormError] = useState('');
  const [countDate, setCountDate] = useState(tomorrowLocal());
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentMealControl, setStudentMealControl] = useState(null);
  const [studentControlLoading, setStudentControlLoading] = useState(false);
  const [formState, setFormState] = useState({
    dayId: '',
    mealTypeId: '',
    commonText: '',
    optionalText: '',
  });
  const [overrideForm, setOverrideForm] = useState(emptyOverride);

  const { invalidate } = useQueryCache();
  const toast = useToast();

  const countsCacheKey = `meal-counts-${countDate}-${selectedWing}`;
  const {
    data: counts,
    isLoading: isCountsLoading,
    isRefreshing: isCountsRefreshing,
    refresh: refreshCounts,
    refreshInBackground: refreshCountsInBackground,
  } = useCachedFetch(
    countsCacheKey,
    () => adminDataService.getMealCounts(countDate, selectedWing),
    { ttl: 30_000 }
  );

  const overridesCacheKey = `meal-overrides-${countDate}-${selectedWing}`;
  const {
    data: overridesData,
    refresh: refreshOverrides,
  } = useCachedFetch(
    overridesCacheKey,
    () => adminDataService.getGlobalOverrides(countDate, countDate, selectedWing),
    { ttl: 30_000 }
  );

  const overrides = useMemo(() => overridesData || [], [overridesData]);

  const loadOperations = useCallback(() => {
    invalidate('meal-counts');
    invalidate('meal-overrides');
    invalidate('meal-sheet-');
    invalidate('student-meal-preferences-');
    invalidate('meal-snapshot-');
    invalidate('guest-meals-');
    refreshCounts();
    refreshOverrides();
  }, [invalidate, refreshCounts, refreshOverrides]);

  const syncAfterStudentMealChange = useCallback(() => {
    invalidate('meal-counts');
    invalidate('meal-sheet-');
    invalidate('student-meal-preferences-');
    invalidate('meal-snapshot-');
    invalidate('guest-meals-');
    refreshCountsInBackground();
  }, [invalidate, refreshCountsInBackground]);

  useEffect(() => {
    setStudentSearch('');
    setStudentSearchResults([]);
    setSelectedStudent(null);
    setStudentMealControl(null);
  }, [selectedWing]);

  const loadStudentMealControl = useCallback(async (student) => {
    setStudentControlLoading(true);
    try {
      const state = await adminDataService.getStudentMealControl(student.id, countDate, selectedWing);
      setSelectedStudent(student);
      setStudentMealControl(state);
    } catch (error) {
      toast.error('Could not load meal control', error?.message || 'Unable to load student meal control.');
    } finally {
      setStudentControlLoading(false);
    }
  }, [countDate, selectedWing, toast]);

  useEffect(() => {
    if (activeSection !== 'controls') return undefined;
    const term = studentSearch.trim();
    if (!term) {
      setStudentSearchResults([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setStudentSearchLoading(true);
      try {
        setStudentSearchResults(await adminDataService.searchStudents(term, selectedWing));
      } catch (error) {
        toast.error('Student search failed', error?.message || 'Unable to search students.');
      } finally {
        setStudentSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeSection, selectedWing, studentSearch, toast]);

  useEffect(() => {
    if (!selectedStudent) return;
    loadStudentMealControl(selectedStudent);
  }, [countDate, loadStudentMealControl, selectedStudent]);

  const activeOverrides = useMemo(() => Object.fromEntries(
    overrides.map((override) => [override.mealPeriod, override]),
  ), [overrides]);

  const openMenuEditor = (dayId = dayOptions[0]?.id, mealTypeId = mealTypeOptions[0]?.id) => {
    setMenuFormError('');
    setFormState(getMealForEdit(dayId, mealTypeId));
    setMenuModalOpen(true);
  };

  const closeMenuEditor = () => {
    if (saving) return;
    setMenuFormError('');
    setMenuModalOpen(false);
  };

  const updateMenuForm = (field, value) => {
    setMenuFormError('');
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const saveMenu = async (event) => {
    event.preventDefault();
    setMenuFormError('');
    setSaving(true);
    try {
      await saveMealConfiguration(formState);
      setMenuModalOpen(false);
      const day = dayOptions.find((option) => option.id === formState.dayId)?.label;
      const mealType = mealTypeOptions.find((option) => option.id === formState.mealTypeId)?.label;
      toast.success('Menu saved', [day, mealType].filter(Boolean).join(' · ') || 'Weekly menu updated.');
    } catch (error) {
      setMenuFormError(error.message || 'Unable to save menu.');
    } finally {
      setSaving(false);
    }
  };

  const openOverride = (mealPeriod, isOn) => {
    setOverrideFormError('');
    setOverrideForm({
      mealPeriod,
      effectiveFrom: countDate,
      effectiveTo: countDate,
      isOn,
      note: '',
    });
    setOverrideModalOpen(true);
  };

  const saveOverride = async (event) => {
    event.preventDefault();
    setOverrideFormError('');
    setSaving(true);
    try {
      await adminDataService.createGlobalOverride({
        ...overrideForm,
        wing: selectedWing,
        note: overrideForm.note.trim() || null,
      });
      setOverrideModalOpen(false);
      await loadOperations(overrideForm.effectiveFrom);
      toast.success(
        `Global ${overrideForm.isOn ? 'ON' : 'OFF'} applied`,
        `${overrideForm.mealPeriod} · ${overrideForm.effectiveFrom}`
        + (overrideForm.effectiveTo !== overrideForm.effectiveFrom ? ` → ${overrideForm.effectiveTo}` : '')
        + ` · ${selectedWing} wing`,
      );
    } catch (error) {
      setOverrideFormError(error.message || 'Unable to apply global override.');
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (override) => {
    if (!window.confirm(`Remove the global override for ${override.mealPeriod}?`)) return;
    try {
      await adminDataService.deleteGlobalOverride(override.id);
      await loadOperations();
      toast.success('Override removed', `${override.mealPeriod} is back on its normal schedule.`);
    } catch (error) {
      toast.error('Could not remove override', error?.message);
    }
  };

  const updateStudentMealStatus = async (mealPeriod, isOn) => {
    if (!studentMealControl) return;
    const meal = studentMealControl.meals.find((entry) => entry.mealPeriod === mealPeriod);
    setStudentControlSaving(true);
    try {
      const updated = await adminDataService.saveStudentMealControlStatus({
        studentRecordId: studentMealControl.studentRecordId,
        wing: selectedWing,
        effectiveFrom: countDate,
        mealPeriod,
        isOn,
        optionItemId: isOn ? (meal?.optionItemId || null) : null,
      });
      setStudentMealControl(updated);
      syncAfterStudentMealChange();
      toast.success(
        `${mealPeriod} turned ${isOn ? 'ON' : 'OFF'}`,
        `${updated.name} · effective ${countDate}.`,
      );
    } catch (error) {
      toast.error('Could not update meal', error?.message || 'Unable to update this student meal.');
    } finally {
      setStudentControlSaving(false);
    }
  };

  const updateStudentMealOption = async (mealPeriod, optionItemId) => {
    if (!studentMealControl) return;
    const meal = studentMealControl.meals.find((entry) => entry.mealPeriod === mealPeriod);
    if (!meal) return;

    setStudentControlSaving(true);
    try {
      const updated = await adminDataService.saveStudentMealControlStatus({
        studentRecordId: studentMealControl.studentRecordId,
        wing: selectedWing,
        effectiveFrom: countDate,
        mealPeriod,
        isOn: meal.isOn,
        optionItemId: optionItemId || null,
      });
      setStudentMealControl(updated);
      syncAfterStudentMealChange();
      toast.success('Optional choice updated', `${updated.name} · ${mealPeriod} · effective ${countDate}.`);
    } catch (error) {
      toast.error('Could not update optional choice', error?.message);
    } finally {
      setStudentControlSaving(false);
    }
  };

  const downloadMealRoutine = async () => {
    if (!menuRows.length || isDownloading) return;
    setIsDownloading(true);

    const report = document.createElement('section');
    report.style.cssText = [
      'width:1120px',
      'padding:38px',
      'background:#ffffff',
      'color:#172033',
      'font-family:Arial,"Noto Sans Bengali","Nirmala UI",sans-serif',
      'position:fixed',
      'left:-10000px',
      'top:0',
      'z-index:-1',
      'pointer-events:none',
      'contain:layout paint style',
    ].join(';');

    const title = document.createElement('h1');
    title.textContent = 'Weekly Meal Routine';
    title.style.cssText = 'margin:0;color:#173264;font-size:30px;font-weight:700;';
    report.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = `Osmany Hall • Generated ${new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date())}`;
    subtitle.style.cssText = 'margin:7px 0 24px;color:#64748b;font-size:14px;';
    report.appendChild(subtitle);

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;border:1px solid #cbd5e1;table-layout:fixed;';

    const headerRow = document.createElement('tr');
    ['Day', ...mealTypeOptions.map((meal) => meal.label)].forEach((label, index) => {
      const cell = document.createElement('th');
      cell.textContent = label;
      cell.style.cssText = [
        'border:1px solid #cbd5e1',
        'padding:14px 12px',
        `background:${index === 0 ? '#173264' : '#eaf2ff'}`,
        `color:${index === 0 ? '#ffffff' : '#173264'}`,
        'font-size:15px',
        'font-weight:700',
        'text-align:left',
      ].join(';');
      headerRow.appendChild(cell);
    });
    table.appendChild(headerRow);

    menuRows.forEach((row, rowIndex) => {
      const tableRow = document.createElement('tr');
      const dayCell = document.createElement('td');
      dayCell.textContent = row.dayLabel;
      dayCell.style.cssText = [
        'border:1px solid #cbd5e1',
        'padding:14px 12px',
        `background:${rowIndex % 2 === 0 ? '#f2fbf7' : '#ffffff'}`,
        'color:#08775a',
        'font-size:15px',
        'font-weight:700',
        'vertical-align:top',
      ].join(';');
      tableRow.appendChild(dayCell);

      mealTypeOptions.forEach((mealType) => {
        const meal = row.mealsByType[mealType.id];
        const cell = document.createElement('td');
        cell.style.cssText = [
          'border:1px solid #cbd5e1',
          'padding:12px',
          `background:${rowIndex % 2 === 0 ? '#fbfdff' : '#ffffff'}`,
          'font-size:13px',
          'line-height:1.55',
          'vertical-align:top',
        ].join(';');

        const regular = document.createElement('div');
        regular.textContent = meal?.commonItems?.length ? itemNames(meal.commonItems) : 'Not configured';
        regular.style.cssText = `font-weight:${meal?.commonItems?.length ? '600' : '400'};color:${meal?.commonItems?.length ? '#172033' : '#94a3b8'};`;
        cell.appendChild(regular);

        if (meal?.optionalItems?.length) {
          const options = document.createElement('div');
          options.textContent = `Options: ${meal.optionalItems.map((item) => item.name).join(', ')}`;
          options.style.cssText = 'margin-top:5px;color:#6d3bb3;font-size:12px;';
          cell.appendChild(options);
        }

        if (meal?.commonItems?.length || meal?.optionalItems?.length) {
          const cost = document.createElement('div');
          cost.textContent = `Cost: ${formatCurrency(mealCost(meal))}`;
          cost.style.cssText = 'margin-top:5px;color:#08775a;font-size:12px;font-weight:700;';
          cell.appendChild(cost);
        }
        tableRow.appendChild(cell);
      });
      table.appendChild(tableRow);
    });

    report.appendChild(table);

    const footer = document.createElement('p');
    footer.textContent = 'Prepared by Osmany Hall Management System';
    footer.style.cssText = 'margin:18px 0 0;color:#94a3b8;font-size:11px;text-align:right;';
    report.appendChild(footer);

    document.body.appendChild(report);

    try {
      await document.fonts?.ready;
      const canvas = await html2canvas(report, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      });

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth() - (margin * 2);
      const pageHeight = doc.internal.pageSize.getHeight() - (margin * 2);
      const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imageWidth = canvas.width * scale;
      const imageHeight = canvas.height * scale;
      const x = (doc.internal.pageSize.getWidth() - imageWidth) / 2;
      const y = (doc.internal.pageSize.getHeight() - imageHeight) / 2;

      doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, imageWidth, imageHeight, undefined, 'FAST');
      doc.save(`weekly-meal-routine-${todayLocal()}.pdf`);
      toast.success('Meal routine downloaded', `weekly-meal-routine-${todayLocal()}.pdf`);
    } catch (error) {
      toast.error('Download failed', error instanceof Error ? error.message : 'Unable to download the meal routine.');
    } finally {
      report.remove();
      setIsDownloading(false);
    }
  };

  return (
    <div className="admin-meal-page">
      <header className="admin-meal-header">
        <div>
          <h1>Meal Management</h1>
          <p>Configure menus, control hall-wide meals, and review daily counts.</p>
        </div>
        <div className="admin-meal-actions">
            {user?.role === 'super_admin' ? (
              <label>Wing
                <select value={selectedWing} onChange={(event) => setSelectedWing(event.target.value)}>
                  <option value="Male">Male Wing</option>
                  <option value="Female">Female Wing</option>
                </select>
              </label>
            ) : <span className="admin-wing-badge">{selectedWing} Wing</span>}
            {activeSection === 'menu' ? (
              <>
                <label>Cutoff
                  <input type="time" value={cutoffTime} onChange={(event) => updateCutoffTime(event.target.value)} disabled={isLoading} />
                </label>
                <Button onClick={() => openMenuEditor()} disabled={isLoading}><Settings2 size={17} /> Configure Menu</Button>
              </>
            ) : null}
          </div>
      </header>

      <div className="admin-wing-context">
        <strong>{selectedWing} Wing Meal Management</strong>
        <span>Menus and daily counts below apply only to {selectedWing.toLowerCase()} students.</span>
      </div>

      {errorMessage && <div className="admin-meal-message">{errorMessage}</div>}

      <nav className="admin-meal-tabs">
        <button type="button" className={activeSection === 'menu' ? 'is-active' : ''} onClick={() => setActiveSection('menu')}>Weekly Menu</button>
        <button type="button" className={activeSection === 'counts' ? 'is-active' : ''} onClick={() => {
          setActiveSection('counts');
          if (countDate > tomorrowLocal()) {
            setCountDate(tomorrowLocal());
          }
        }}>Daily Meal Count</button>
        <button type="button" className={activeSection === 'controls' ? 'is-active' : ''} onClick={() => setActiveSection('controls')}>Global Meal Controls</button>
      </nav>

      <div key={activeSection} className="admin-meal-tab-panel">
        {activeSection === 'menu' && (
          <section className="admin-meal-menu-section">
            <div className="admin-meal-section-head">
              <div><h2>Weekly Menu</h2><p>Refined day-by-day menu configuration.</p></div>
              <Button variant="secondary" onClick={downloadMealRoutine} disabled={!menuRows.length || isDownloading}>
                <Download size={16} /> {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
              </Button>
            </div>
            {isLoading ? (
              <TableSkeleton rows={7} cols={4} />
            ) : (
              <div className="admin-meal-table-wrap">
                <table className="admin-meal-table">
                  <thead><tr><th>Day</th>{mealTypeOptions.map((mealType) => <th key={mealType.id}>{mealType.label}</th>)}</tr></thead>
                  <tbody>
                    {menuRows.map((row) => (
                      <tr key={row.dayId}>
                        <td><strong>{row.dayLabel}</strong></td>
                        {mealTypeOptions.map((mealType) => <td key={mealType.id}><MealCell meal={row.mealsByType[mealType.id]} onEdit={() => openMenuEditor(row.dayId, mealType.id)} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeSection === 'counts' && (
          <section className="admin-meal-operations">
            <div className="admin-meal-section-head">
              <div><h2>Daily Meal Count</h2><p>Complete meal participation and option-choice details.</p></div>
              <div className="admin-meal-count-actions">
                <label>
                  <CalendarDays size={16} />
                  <input
                    type="date"
                    value={countDate}
                    max={tomorrowLocal()}
                    onChange={(event) => setCountDate(event.target.value)}
                  />
                </label>
                <Button variant="secondary" onClick={() => loadOperations()}><Users size={16} /> Refresh</Button>
              </div>
            </div>
            {countDate > tomorrowLocal() && (
              <div className="admin-meal-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #ffeeba', backgroundColor: '#fff3cd', color: '#856404', margin: '0 0 1rem 0' }}>
                <AlertCircle size={18} />
                <span>Meal counts for dates beyond tomorrow are not displayed as student choices are subject to change.</span>
              </div>
            )}
            {isCountsLoading ? (
              <div className="skeleton-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-block skeleton-card-title" />
                    <div className="skeleton-block skeleton-card-body" />
                    <div className="skeleton-block skeleton-card-body short" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-meal-count-grid">
                {(counts?.meals || []).map((meal) => {
                  const onPercent = meal.totalStudents ? Math.round((meal.enabledStudents / meal.totalStudents) * 100) : 0;
                  return (
                    <article key={meal.mealTypeId} className="admin-meal-count-card">
                      <div className="admin-meal-count-title"><h3>{meal.mealTypeLabel}</h3><span>{onPercent}% active</span></div>
                      <div className="admin-meal-progress"><i style={{ width: `${onPercent}%` }} /></div>
                      <div className="admin-meal-count-numbers">
                        <span className="count-on"><b>{meal.enabledStudents}</b> Meal On</span>
                        <span className="count-off"><b>{meal.disabledStudents}</b> Meal Off</span>
                        <span><b>{meal.totalStudents}</b> Students</span>
                      </div>
                      <div className="admin-meal-choice-breakdown">
                        <h4>Meal Choice Breakdown</h4>
                        {meal.optionalChoices.map((option) => (
                          <div key={option.optionItemId}><span>{option.name}</span><b>{option.studentCount}</b></div>
                        ))}
                        {!meal.optionalChoices.length && <p>No optional choices configured for this meal.</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeSection === 'controls' && (
          <section className="admin-meal-operations">
            {isCountsRefreshing ? <div className="data-refreshing-bar" /> : null}
            <div className="admin-meal-section-head">
              <div><h2>Global Meal Controls</h2><p>Force a meal ON or OFF for every active student.</p></div>
              <div className="admin-meal-count-actions">
                <label><CalendarDays size={16} /><input type="date" value={countDate} min={todayLocal()} onChange={(event) => setCountDate(event.target.value)} /></label>
              </div>
            </div>
            <div className="admin-student-meal-control">
              <div className="admin-student-meal-control__head">
                <div>
                  <h3>Emergency Student Meal Control</h3>
                  <p>Search by Student ID, then turn breakfast, lunch, or dinner on or off for the selected date even after cutoff.</p>
                </div>
                <span className="admin-student-meal-control__date">Applies on {countDate}</span>
              </div>
              <div className="admin-student-meal-search">
                <label className="admin-student-meal-search__input">
                  <Search size={16} />
                  <input
                    type="search"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder={`Search ${selectedWing.toLowerCase()} student by ID`}
                    autoComplete="off"
                  />
                </label>
                {studentSearch.trim() && (
                  <div className="admin-student-meal-search__results">
                    {studentSearchLoading ? (
                      <p>Searching students...</p>
                    ) : studentSearchResults.length ? (
                      studentSearchResults.map((student) => (
                        <button
                          type="button"
                          key={student.id}
                          onClick={() => {
                            setStudentSearch(student.studentId);
                            setStudentSearchResults([]);
                            setSelectedStudent(student);
                          }}
                        >
                          <strong>{student.name}</strong>
                          <span>Student ID: {student.studentId} · Hall ID: {student.hallId}</span>
                        </button>
                      ))
                    ) : (
                      <p>No student found in this wing.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="admin-student-meal-panel">
                {studentControlLoading ? (
                  <div className="admin-student-meal-empty">Loading student meal status...</div>
                ) : studentMealControl ? (
                  <>
                    <div className="admin-student-meal-summary">
                      <div>
                        <h4>{studentMealControl.name}</h4>
                        <p>Student ID: {studentMealControl.studentId} · Hall ID: {studentMealControl.hallId} · Room: {studentMealControl.roomNo}</p>
                      </div>
                      <span className="admin-wing-badge">{studentMealControl.gender} Wing</span>
                    </div>
                    <div className="admin-student-meal-grid">
                      {studentMealControl.meals.map((meal) => (
                        <article key={meal.mealPeriod} className="admin-student-meal-card">
                          <div className="admin-student-meal-card__top">
                            <h5>{meal.mealPeriod.charAt(0).toUpperCase() + meal.mealPeriod.slice(1)}</h5>
                            <span className={`meal-force-badge ${meal.isOn ? 'is-on' : 'is-off'}`}>
                              {meal.isOn ? 'Currently ON' : 'Currently OFF'}
                            </span>
                          </div>
                          {meal.availableOptions?.length ? (
                            <label className="admin-student-meal-card__select">
                              <span>Optional choice</span>
                              <select
                                value={meal.optionItemId || ''}
                                disabled={studentControlSaving || !meal.isOn}
                                onChange={(event) => updateStudentMealOption(meal.mealPeriod, event.target.value)}
                              >
                                <option value="">None</option>
                                {meal.availableOptions.map((option) => (
                                  <option key={option.id} value={option.id}>{option.name}</option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <div className="admin-student-meal-card__hint">No optional choices for this meal on the selected date.</div>
                          )}
                          <div className="admin-student-meal-card__actions">
                            <button
                              type="button"
                              className={`force-on ${meal.isOn ? 'is-active' : ''}`}
                              disabled={studentControlSaving}
                              onClick={() => updateStudentMealStatus(meal.mealPeriod, true)}
                            >
                              Turn ON
                            </button>
                            <button
                              type="button"
                              className={`force-off ${!meal.isOn ? 'is-active' : ''}`}
                              disabled={studentControlSaving}
                              onClick={() => updateStudentMealStatus(meal.mealPeriod, false)}
                            >
                              Turn OFF
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="admin-student-meal-empty">
                    Search a student ID to open emergency meal control for that student.
                  </div>
                )}
              </div>
            </div>
            {isCountsLoading ? (
              <div className="skeleton-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-block skeleton-card-title" />
                    <div className="skeleton-block skeleton-card-body" />
                    <div className="skeleton-block skeleton-card-body short" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-meal-control-grid">
                {(counts?.meals || []).map((meal) => {
                  const override = activeOverrides[meal.mealTypeId];
                  return (
                    <article key={meal.mealTypeId} className="admin-meal-control-card">
                      <div>
                        <h3>{meal.mealTypeLabel}</h3>
                        <p>Affects all {meal.totalStudents} active students for the selected date or range.</p>
                      </div>
                      {override ? (
                        <div className="admin-meal-active-override">
                          <span className={`meal-force-badge ${override.isOn ? 'is-on' : 'is-off'}`}>Currently forced {override.isOn ? 'ON' : 'OFF'}</span>
                          <button type="button" onClick={() => removeOverride(override)}>Remove override</button>
                        </div>
                      ) : <span className="meal-normal-status">Following student preferences</span>}
                      <div className="admin-meal-force-actions">
                        <button type="button" className="force-on" onClick={() => openOverride(meal.mealTypeId, true)}><Power size={15} /> Force ON</button>
                        <button type="button" className="force-off" onClick={() => openOverride(meal.mealTypeId, false)}><Power size={15} /> Force OFF</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <Modal
        isOpen={menuModalOpen}
        onClose={closeMenuEditor}
        title="Meal Configuration"
        actions={<><Button variant="secondary" onClick={closeMenuEditor} disabled={saving}>Cancel</Button><Button type="submit" form="meal-config-form" disabled={saving}>{saving ? <><Loader2 size={16} className="spin-icon" /> Saving...</> : 'Save Menu'}</Button></>}
      >
        <form id="meal-config-form" className="admin-meal-form" onSubmit={saveMenu} aria-busy={saving}>
          {menuFormError ? (
            <div className="admin-meal-form-error" role="alert">
              <AlertCircle size={19} />
              <div>
                <strong>Could not save this meal</strong>
                <span>{menuFormError}</span>
              </div>
            </div>
          ) : null}
          {saving ? (
            <div className="admin-meal-form-progress" role="status" aria-live="polite">
              <Loader2 size={18} className="spin-icon" />
              <span>Saving weekly menu and refreshing the table...</span>
            </div>
          ) : null}
          <div>
            <label>Day<select value={formState.dayId} onChange={(event) => updateMenuForm('dayId', event.target.value)} disabled={saving}>{dayOptions.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label>
            <label>Meal<select value={formState.mealTypeId} onChange={(event) => updateMenuForm('mealTypeId', event.target.value)} disabled={saving}>{mealTypeOptions.map((meal) => <option key={meal.id} value={meal.id}>{meal.label}</option>)}</select></label>
          </div>
          <label>Regular Items<input value={formState.commonText} onChange={(event) => updateMenuForm('commonText', event.target.value)} placeholder="Rice-0, Dal-0" disabled={saving} /></label>
          <label className={menuFormError ? 'has-error' : ''}>Optional Items<input value={formState.optionalText} onChange={(event) => updateMenuForm('optionalText', event.target.value)} placeholder="Fish, Beef" aria-invalid={Boolean(menuFormError)} disabled={saving} /></label>
        </form>
      </Modal>

      <Modal
        isOpen={overrideModalOpen}
        onClose={() => {
          if (!saving) setOverrideModalOpen(false);
        }}
        title={`Force ${overrideForm.mealPeriod} ${overrideForm.isOn ? 'ON' : 'OFF'} for all`}
        actions={<><Button variant="secondary" onClick={() => setOverrideModalOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="meal-override-form" disabled={saving}>{saving ? <><Loader2 size={16} className="spin-icon" /> Applying...</> : 'Apply Override'}</Button></>}
      >
        <form id="meal-override-form" className="admin-meal-form" onSubmit={saveOverride} aria-busy={saving}>
          {overrideFormError ? (
            <div className="admin-meal-form-error" role="alert">
              <AlertCircle size={19} />
              <div>
                <strong>Could not apply override</strong>
                <span>{overrideFormError}</span>
              </div>
            </div>
          ) : null}
          {saving ? (
            <div className="admin-meal-form-progress" role="status" aria-live="polite">
              <Loader2 size={18} className="spin-icon" />
              <span>Applying override and refreshing meal views...</span>
            </div>
          ) : null}
          <div>
            <label>From<input type="date" value={overrideForm.effectiveFrom} onChange={(event) => setOverrideForm({ ...overrideForm, effectiveFrom: event.target.value })} required disabled={saving} /></label>
            <label>To<input type="date" value={overrideForm.effectiveTo} onChange={(event) => setOverrideForm({ ...overrideForm, effectiveTo: event.target.value })} required disabled={saving} /></label>
          </div>
          <label>Note<textarea rows="3" value={overrideForm.note} onChange={(event) => setOverrideForm({ ...overrideForm, note: event.target.value })} placeholder="Reason for this hall-wide override" disabled={saving} /></label>
        </form>
      </Modal>

      {/* Optional consumables (tea and similar) — catalogue plus the counts that feed Others Bill.
          Hidden entirely for a role that has not been granted this menu — currently that means
          the male wing admin, until a super admin turns it on from Role Permissions. */}
      {can(MENU_KEYS.adminAdditionalItems, 'view') ? <AdditionalItemsPanel /> : null}
    </div>
  );
}
