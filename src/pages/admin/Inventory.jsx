import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Flame, Pencil, Search, Trash2, Package, Loader2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { adminDataService } from '../../services/adminDataService';
import { money, todayLocal } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { useQueryCache } from '../../context/QueryCacheContext';
import { useToast } from '../../context/ToastContext';
import { TableSkeleton } from '../../components/ui/PageSkeleton';

const tabs = [
  { id: 'in', label: 'Stock In' },
  { id: 'out', label: 'Stock Out' },
  { id: 'non-stock', label: 'Non-Stock' },
  { id: 'items', label: 'Items' },
];

const MEAL_SEGMENTS = [
  { id: 'breakfast', label: 'Breakfast', short: '☀' },
  { id: 'lunch', label: 'Lunch', short: '🌤' },
  { id: 'dinner', label: 'Dinner', short: '🌙' },
];

const emptyMovement = { date: todayLocal(), mealPeriod: 'breakfast', itemId: '', quantity: '', rate: '', totalPrice: '', sourceBatchId: '' };
const emptyItem = { id: '', name: '', unit: 'KG', category: 'Common', linkedOptionId: '', isStored: true };
const formatNumber = (value) => money(value).toFixed(2);
const formatDisplayDate = (value) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(`${value}T00:00:00`));

// ── ItemPicker ───────────────────────────────────────────────────────────────
function ItemPicker({ items, value, onChange, showRemaining, disabled }) {
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selected = items.find((item) => item.id === value);

  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected]);

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  }, [items, query]);

  useEffect(() => {
    setHighlightedIndex(filtered.length > 0 ? 0 : -1);
  }, [filtered]);

  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const selectItem = (item) => {
    onChange(item.id);
    setQuery(item.name);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < filtered.length) selectItem(filtered[highlightedIndex]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); if (selected) setQuery(selected.name); else setQuery(''); }
  };

  // Allow parent to clear the picker externally
  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  return (
    <div className={`stock-item-picker ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      <Search size={17} />
      <input
        value={query}
        placeholder="Search item..."
        autoComplete="off"
        disabled={disabled}
        onFocus={() => { if (disabled) return; setOpen(true); setHighlightedIndex(filtered.length > 0 ? 0 : -1); }}
        onChange={(event) => { if (disabled) return; setQuery(event.target.value); onChange(''); setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div className="stock-item-menu">
          {filtered.length ? filtered.map((item, index) => (
            <button
              type="button"
              key={item.id}
              ref={(el) => (optionRefs.current[index] = el)}
              className={highlightedIndex === index ? 'is-highlighted' : ''}
              onClick={() => selectItem(item)}
            >
              <span>{item.name}</span>
              {showRemaining && (
                <span className="stock-item-left">
                  <b>{item.unit.toUpperCase()}</b>
                  <em>({formatNumber(item.currentStockQty)} left)</em>
                </span>
              )}
            </button>
          )) : <p>No matching items</p>}
        </div>
      )}
    </div>
  );
}

// ── BatchPicker ───────────────────────────────────────────────────────────────
function BatchPicker({ batches, value, onChange, disabled, loading, hasItem }) {
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const selected = batches.find((batch) => batch.id === value) || null;
  const isDisabled = disabled || loading || !hasItem || batches.length === 0;
  const showLabels = batches.length > 1;

  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const index = batches.findIndex((batch) => batch.id === value);
    setHighlightedIndex(index >= 0 ? index : 0);
  }, [open, batches, value]);

  useEffect(() => {
    if (open && highlightedIndex >= 0) optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightedIndex]);

  const select = (batch) => { onChange(batch.id); setOpen(false); };

  const handleKeyDown = (e) => {
    if (isDisabled) return;
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex((prev) => (prev < batches.length - 1 ? prev + 1 : prev)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0) select(batches[highlightedIndex]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  const placeholder = !hasItem ? 'Select an item first' : loading ? 'Loading batches...' : 'No stock available';

  return (
    <div className={`stock-batch-picker ${isDisabled ? 'is-disabled' : ''} ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="stock-batch-trigger"
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !isDisabled && setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
      >
        {selected ? (
          <span className="stock-batch-value">
            {showLabels && <span className="stock-batch-chip">{selected.label}</span>}
            <span className="stock-batch-value-meta">
              <b>{formatNumber(selected.remainingQuantity)} {selected.unit.toUpperCase()}</b>
              <em>৳{formatNumber(selected.rate)}/{selected.unit.toUpperCase()}</em>
            </span>
          </span>
        ) : (
          <span className="stock-batch-placeholder">
            {loading && <Loader2 size={14} className="spin-icon" />}
            {placeholder}
          </span>
        )}
        <ChevronDown size={16} className="stock-batch-caret" />
      </button>

      {open && (
        <div className="stock-batch-menu" role="listbox">
          {batches.map((batch, index) => {
            const usedPct = batch.receivedQuantity > 0 ? Math.max(0, Math.min(100, (batch.remainingQuantity / batch.receivedQuantity) * 100)) : 0;
            return (
              <button
                type="button"
                key={batch.id}
                role="option"
                aria-selected={batch.id === value}
                ref={(el) => (optionRefs.current[index] = el)}
                className={`stock-batch-option ${highlightedIndex === index ? 'is-highlighted' : ''} ${batch.id === value ? 'is-selected' : ''}`}
                style={{ animationDelay: `${index * 35}ms` }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => select(batch)}
              >
                <span className="stock-batch-option-head">
                  {showLabels && <span className="stock-batch-chip">{batch.label}</span>}
                  <span className="stock-batch-option-rate">৳{formatNumber(batch.rate)}<small>/{batch.unit.toUpperCase()}</small></span>
                </span>
                <span className="stock-batch-bar"><i style={{ width: `${usedPct}%` }} /></span>
                <span className="stock-batch-option-meta">
                  <span><b>{formatNumber(batch.remainingQuantity)}</b> of {formatNumber(batch.receivedQuantity)} {batch.unit.toUpperCase()} left</span>
                  <span>{formatDisplayDate(batch.receivedDate)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Pending item row (inline-editable) ────────────────────────────────────────
function PendingRow({ row, index, isOut, allItems, allBatches, onUpdate, onRemove, disabled }) {
  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState(row.quantity);
  const [editTotalPrice, setEditTotalPrice] = useState(row.totalPrice || '');

  const item = allItems.find((i) => i.id === row.itemId);

  const commitEdit = () => {
    if (!editQty || Number(editQty) <= 0) return;
    onUpdate(row._id, { quantity: editQty, totalPrice: editTotalPrice || row.totalPrice });
    setEditing(false);
  };

  const costPreview = isOut
    ? `৳${formatNumber(Number(row.quantity || 0) * Number(row.batchRate || 0))}`
    : `৳${formatNumber(Number(row.totalPrice || 0))}`;

  return (
    <tr className={`pending-row ${editing ? 'is-editing' : ''}`}>
      <td className="pending-row-num">{index + 1}</td>
      <td className="pending-row-item">
        <span className="pending-item-name">{row.itemName}</span>
        {row.itemCategory && <span className="pending-item-cat">{row.itemCategory}</span>}
      </td>
      {isOut && (
        <td className="pending-row-batch">
          {row.batchLabel ? <span className="stock-batch-chip">{row.batchLabel}</span> : <span className="pending-na">—</span>}
        </td>
      )}
      {editing ? (
        <>
          <td colSpan={isOut ? 2 : 2} className="pending-row-edit-cell">
            <div className="pending-edit-inline">
              <label>
                <span>Qty ({item?.unit?.toUpperCase()})</span>
                <input
                  type="number" min="0.0001" step="0.0001"
                  value={editQty}
                  autoFocus
                  onChange={(e) => setEditQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                />
              </label>
              {!isOut && (
                <label>
                  <span>Total Price (৳)</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={editTotalPrice}
                    onChange={(e) => setEditTotalPrice(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                  />
                </label>
              )}
              <button type="button" className="pending-edit-save" onClick={commitEdit}>✓</button>
              <button type="button" className="pending-edit-cancel" onClick={() => { setEditing(false); setEditQty(row.quantity); setEditTotalPrice(row.totalPrice || ''); }}>✕</button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="pending-row-qty">{formatNumber(Number(row.quantity))} <span className="pending-unit">{item?.unit?.toUpperCase()}</span></td>
          <td className="pending-row-cost">
            <strong>{costPreview}</strong>
            {isOut && row.batchRate && (
              <small className="pending-rate-hint">৳{formatNumber(row.batchRate)}/{item?.unit?.toUpperCase()}</small>
            )}
            {!isOut && row.participantCount > 0 && (
              <small className="pending-rate-hint">{row.participantCount} students</small>
            )}
          </td>
        </>
      )}
      <td className="pending-row-actions">
        {!editing && (
          <button type="button" className="pending-action-edit" onClick={() => { setEditing(true); setEditQty(row.quantity); setEditTotalPrice(row.totalPrice || ''); }} disabled={disabled} title="Edit">
            <Pencil size={14} />
          </button>
        )}
        <button type="button" className="pending-action-remove" onClick={() => onRemove(row._id)} disabled={disabled} title="Remove">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Inventory() {
  useDocumentTitle('Stock');
  const { user, role } = useAuth();
  const isWingAdmin = role === 'male_wing_admin' || role === 'female_wing_admin';

  const { invalidate } = useQueryCache();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('in');
  const [gender, setGender] = useState(() => user?.wing || 'Male');

  // ── Inventory items ────────────────────────────────────────────────────────
  const {
    data: items = [],
    isLoading: itemsLoading,
    isRefreshing: itemsRefreshing,
    refresh: refreshItems
  } = useCachedFetch(
    `inventory-${gender}`,
    () => adminDataService.getInventory(false, gender),
    { ttl: 30_000 }
  );

  // ── Stock-In form state (unchanged) ──────────────────────────────────────
  const [movement, setMovement] = useState(emptyMovement);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Session state (Stock Out & Non-Stock) ─────────────────────────────────
  const [sessionDate, setSessionDate] = useState(todayLocal);
  const [sessionMeal, setSessionMeal] = useState('breakfast');
  // Warn when meal switches while pending list is non-empty
  const [mealSwitchWarning, setMealSwitchWarning] = useState(false);

  // Pending items queue
  const [pendingItems, setPendingItems] = useState([]);
  const pendingIdRef = useRef(0);

  // Entry-row fields
  const [entryItemId, setEntryItemId] = useState('');
  const [entryBatchId, setEntryBatchId] = useState('');
  const [entryQty, setEntryQty] = useState('');
  const [entryTotalPrice, setEntryTotalPrice] = useState('');
  const [entryError, setEntryError] = useState('');

  // Batches for current entry item (Stock Out)
  const [entryBatches, setEntryBatches] = useState([]);
  const [loadingEntryBatches, setLoadingEntryBatches] = useState(false);

  // Participant count for Non-Stock preview
  const [entryParticipantCount, setEntryParticipantCount] = useState(0);
  const [loadingEntryParticipants, setLoadingEntryParticipants] = useState(false);

  // Bulk confirm state
  const [bulkErrors, setBulkErrors] = useState([]);

  // ── Misc (Items tab, ledger, edit/delete modals — all unchanged) ───────────
  const [summarySearch, setSummarySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemModal, setItemModal] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [modalError, setModalError] = useState('');
  const [historyItem, setHistoryItem] = useState(null);

  const ledgerCacheKey = historyItem ? `inventory-ledger-${historyItem.id}-${gender}` : null;
  const {
    data: ledgerTransactions = [],
    isLoading: ledgerLoading,
    isRefreshing: ledgerRefreshing,
    error: ledgerFetchError,
    refresh: refreshLedger
  } = useCachedFetch(
    ledgerCacheKey,
    () => adminDataService.getInventoryLedger({ itemId: historyItem.id, wing: gender }),
    { ttl: 30_000, enabled: Boolean(historyItem) }
  );

  const ledgerError = ledgerFetchError || modalError;
  const [ledgerTab, setLedgerTab] = useState('all');
  const [editTransaction, setEditTransaction] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', mealPeriod: 'breakfast', quantity: '', totalPrice: '' });
  const [deleteTransaction, setDeleteTransaction] = useState(null);
  const [editStudentsCount, setEditStudentsCount] = useState(0);
  const [loadingEditStudentsCount, setLoadingEditStudentsCount] = useState(false);

  // ── All batches (for summary) ──────────────────────────────────────────────
  const [allBatches, setAllBatches] = useState([]);
  useEffect(() => {
    let cancelled = false;
    adminDataService.getAllInventoryBatches(gender)
      .then((rows) => { if (!cancelled) setAllBatches(rows || []); })
      .catch(() => { if (!cancelled) setAllBatches([]); });
    return () => { cancelled = true; };
  }, [gender, items]);

  const batchesByItem = useMemo(() => {
    const map = new Map();
    allBatches.forEach((batch) => {
      const list = map.get(batch.itemId) || [];
      list.push(batch);
      map.set(batch.itemId, list);
    });
    return map;
  }, [allBatches]);

  // ── Derived item lists ─────────────────────────────────────────────────────
  const storedItems = items.filter((item) => item.isStored);
  const optionItems = items.filter((item) => item.category === 'Options' && item.id !== itemForm.id);
  const pickerItems = activeTab === 'non-stock' ? items.filter((item) => !item.isStored) : storedItems;
  const summaryItems = useMemo(() => {
    let list = items;
    if (activeTab === 'non-stock') list = items.filter(item => !item.isStored);
    else if (activeTab === 'in' || activeTab === 'out') list = items.filter(item => item.isStored);
    return list.filter((item) => item.name.toLowerCase().includes(summarySearch.toLowerCase()));
  }, [items, summarySearch, activeTab]);
  const visibleItems = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(itemSearch.toLowerCase())), [items, itemSearch]);

  // ── Load entry batches when entry item changes (Stock Out) ─────────────────
  useEffect(() => {
    if (activeTab !== 'out' || !entryItemId) { setEntryBatches([]); setEntryBatchId(''); return undefined; }
    let cancelled = false;
    setLoadingEntryBatches(true);
    adminDataService.getInventoryBatches({ itemId: entryItemId, wing: gender })
      .then((rows) => {
        if (cancelled) return;
        const list = rows || [];
        setEntryBatches(list);
        setEntryBatchId(list[0]?.id || '');
      })
      .catch(() => { if (!cancelled) setEntryBatches([]); })
      .finally(() => { if (!cancelled) setLoadingEntryBatches(false); });
    return () => { cancelled = true; };
  }, [activeTab, entryItemId, gender]);

  // ── Load participant count when item/date/meal changes (Non-Stock) ──────────
  useEffect(() => {
    if (activeTab !== 'non-stock' || !entryItemId || !sessionDate || !sessionMeal) {
      setEntryParticipantCount(0); return undefined;
    }
    let active = true;
    setLoadingEntryParticipants(true);
    adminDataService.getParticipantCount({ date: sessionDate, mealPeriod: sessionMeal, itemId: entryItemId, wing: gender })
      .then(count => { if (active) { setEntryParticipantCount(count); setLoadingEntryParticipants(false); } })
      .catch(() => { if (active) setLoadingEntryParticipants(false); });
    return () => { active = false; };
  }, [activeTab, entryItemId, sessionDate, sessionMeal, gender]);

  // ── Edit-transaction participant count (unchanged) ─────────────────────────
  useEffect(() => {
    if (editTransaction && historyItem && !historyItem.isStored && editForm.date && editForm.mealPeriod) {
      let active = true;
      setLoadingEditStudentsCount(true);
      adminDataService.getParticipantCount({ date: editForm.date, mealPeriod: editForm.mealPeriod, itemId: editTransaction.itemId, wing: gender })
        .then(count => { if (active) { setEditStudentsCount(count); setLoadingEditStudentsCount(false); } })
        .catch(() => { if (active) setLoadingEditStudentsCount(false); });
      return () => { active = false; };
    } else setEditStudentsCount(0);
  }, [editTransaction, historyItem, editForm.date, editForm.mealPeriod, gender]);

  const editCalcUnitPrice = useMemo(() => {
    const qty = Number(editForm.quantity || 0);
    const total = Number(editForm.totalPrice || 0);
    return qty > 0 ? (total / qty) : 0;
  }, [editForm.quantity, editForm.totalPrice]);

  // ── Ledger helpers (unchanged) ─────────────────────────────────────────────
  const currentLedgerTransactions = useMemo(() => {
    if (!historyItem) return [];
    return ledgerTransactions.filter((t) => t.itemId === historyItem.id);
  }, [ledgerTransactions, historyItem]);

  const historyStats = useMemo(() => {
    let totalIn = 0, totalOut = 0, totalSpent = 0;
    currentLedgerTransactions.forEach((t) => {
      const qty = Number(t.quantity || 0);
      const cost = Number(t.totalCost || 0);
      if (t.transactionType === 'in') totalIn += qty; else totalOut += qty;
      totalSpent += cost;
    });
    return { totalIn, totalOut, totalSpent };
  }, [currentLedgerTransactions]);

  const historyTimeline = useMemo(() => {
    const oldestFirst = [...currentLedgerTransactions].reverse();
    let balance = 0;
    const computed = oldestFirst.map((t) => {
      if (t.transactionType === 'in') balance += Number(t.quantity || 0);
      else balance -= Number(t.quantity || 0);
      return { ...t, runningBalance: balance };
    });
    return computed.reverse();
  }, [currentLedgerTransactions]);

  const filteredTimeline = useMemo(() => {
    if (ledgerTab === 'all') return historyTimeline;
    return historyTimeline.filter((t) => t.transactionType === ledgerTab);
  }, [historyTimeline, ledgerTab]);

  // ── Tab switch ─────────────────────────────────────────────────────────────
  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setMovement(emptyMovement);
    setFormError('');
    // Reset session entry row on tab change
    setEntryItemId('');
    setEntryBatchId('');
    setEntryQty('');
    setEntryTotalPrice('');
    setEntryError('');
    setBulkErrors([]);
    // Keep pending list across tab switch only if moving between out ↔ non-stock would be confusing;
    // clear on full tab change instead to keep things unambiguous.
    setPendingItems([]);
  }, []);

  // ── Session meal switch ────────────────────────────────────────────────────
  const switchMeal = (meal) => {
    if (pendingItems.length > 0 && meal !== sessionMeal) setMealSwitchWarning(true);
    setSessionMeal(meal);
  };

  const clearMealWarning = () => setMealSwitchWarning(false);

  // ── Open history ledger modal ──────────────────────────────────────────────
  const openHistoryModal = (item) => {
    setHistoryItem(item); setLedgerTab('all'); setModalError('');
  };

  // ── Stock-In submit (unchanged logic) ─────────────────────────────────────
  const formRef = useRef(null);
  const handleFormKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      if (document.activeElement && document.activeElement.closest('.stock-item-picker')) return;
      e.preventDefault();
      const inputs = Array.from(e.currentTarget.querySelectorAll('input, select'));
      const index = inputs.indexOf(document.activeElement);
      if (index >= 0 && index < inputs.length - 1) inputs[index + 1].focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (document.activeElement && document.activeElement.closest('.stock-item-picker')) return;
      e.preventDefault();
      const inputs = Array.from(e.currentTarget.querySelectorAll('input, select'));
      const index = inputs.indexOf(document.activeElement);
      if (index > 0) inputs[index - 1].focus();
    }
  };

  const submitMovement = async (event) => {
    event.preventDefault();
    const item = items.find((row) => row.id === movement.itemId);
    if (!item) return setFormError('Please select an item.');
    if (money(movement.quantity).lessThanOrEqualTo(0)) return setFormError('Quantity must be greater than zero.');
    if (!movement.totalPrice || money(movement.totalPrice).lessThanOrEqualTo(0)) return setFormError('Total Price must be greater than zero.');
    setSaving(true); setFormError('');
    try {
      await adminDataService.createInventoryMovement({
        itemId: item.id, wing: gender, transactionType: 'in',
        date: movement.date, mealPeriod: null,
        quantity: Number(movement.quantity), totalPrice: Number(movement.totalPrice),
        sourceBatchId: null, note: null,
      });
      setMovement(emptyMovement);
      invalidate('inventory-'); refreshItems();
      toast.success('Stock-in recorded', `${item.name} · ${movement.quantity} ${item.unit} on ${movement.date}.`);
    } catch (error) {
      toast.error('Could not save transaction', error?.message);
    } finally { setSaving(false); }
  };

  // ── Entry row: add item to pending list ────────────────────────────────────
  const entrySelectedBatch = useMemo(() => entryBatches.find((b) => b.id === entryBatchId) || null, [entryBatches, entryBatchId]);
  const entryItem = useMemo(() => items.find((i) => i.id === entryItemId) || null, [items, entryItemId]);

  const addToPending = () => {
    setEntryError('');
    if (!entryItemId || !entryItem) { setEntryError('Select an item.'); return; }
    if (!entryQty || Number(entryQty) <= 0) { setEntryError('Quantity must be greater than zero.'); return; }

    if (activeTab === 'out') {
      if (!entryBatchId || !entrySelectedBatch) { setEntryError('Select a batch.'); return; }
      if (money(entryQty).greaterThan(money(entrySelectedBatch.remainingQuantity))) {
        setEntryError(`${entrySelectedBatch.label} only has ${formatNumber(entrySelectedBatch.remainingQuantity)} ${entryItem.unit} remaining.`);
        return;
      }
    }

    if (activeTab === 'non-stock') {
      if (!entryTotalPrice || Number(entryTotalPrice) <= 0) { setEntryError('Total Purchase Price must be greater than zero.'); return; }
    }

    const _id = ++pendingIdRef.current;
    setPendingItems((prev) => [
      ...prev,
      {
        _id,
        itemId: entryItem.id,
        itemName: entryItem.name,
        itemCategory: entryItem.category,
        unit: entryItem.unit,
        batchId: entryBatchId || null,
        batchLabel: entrySelectedBatch?.label || null,
        batchRate: entrySelectedBatch?.rate || null,
        quantity: entryQty,
        totalPrice: activeTab === 'non-stock' ? entryTotalPrice : null,
        participantCount: activeTab === 'non-stock' ? entryParticipantCount : null,
      }
    ]);

    // Clear entry fields, keep focus on item picker for fast entry
    setEntryItemId('');
    setEntryBatchId('');
    setEntryQty('');
    setEntryTotalPrice('');
    setEntryParticipantCount(0);
  };

  const removePending = (id) => setPendingItems((prev) => prev.filter((r) => r._id !== id));

  const updatePending = (id, patch) => {
    setPendingItems((prev) => prev.map((r) => r._id === id ? { ...r, ...patch } : r));
  };

  // ── Bulk confirm ───────────────────────────────────────────────────────────
  const confirmBulk = async () => {
    if (pendingItems.length === 0) return;
    setSaving(true); setBulkErrors([]);
    try {
      const payloadItems = pendingItems.map((row) => ({
        itemId: row.itemId,
        transactionType: 'out',
        date: sessionDate,
        mealPeriod: sessionMeal,
        quantity: Number(row.quantity),
        rate: null,
        note: null,
        wing: gender,
        totalPrice: row.totalPrice ? Number(row.totalPrice) : null,
        sourceBatchId: row.batchId || null,
      }));
      await adminDataService.createBulkInventoryMovements({ items: payloadItems, wing: gender });
      const count = pendingItems.length;
      setPendingItems([]);
      setEntryItemId('');
      setEntryBatchId('');
      setEntryQty('');
      setEntryTotalPrice('');
      setBulkErrors([]);
      setMealSwitchWarning(false);
      invalidate('inventory-'); refreshItems();
      const label = activeTab === 'non-stock' ? 'Non-Stock' : 'Stock Out';
      toast.success(
        `${label} confirmed`,
        `${count} item${count !== 1 ? 's' : ''} posted to ${sessionMeal.charAt(0).toUpperCase() + sessionMeal.slice(1)} · ${formatDisplayDate(sessionDate)}.`,
      );
    } catch (error) {
      // Structured per-item errors from the bulk endpoint
      const payload = error?.data || error;
      if (payload?.errors && Array.isArray(payload.errors)) {
        setBulkErrors(payload.errors);
      } else {
        setBulkErrors([{ index: -1, message: error?.message || 'Bulk confirmation failed.' }]);
      }
    } finally { setSaving(false); }
  };

  // ── Items CRUD (unchanged) ─────────────────────────────────────────────────
  const openItemModal = (item = null) => {
    setModalError('');
    setItemForm(item ? { id: item.id, name: item.name, unit: item.unit, category: item.category, linkedOptionId: item.linkedOptionId || '', isStored: item.isStored } : emptyItem);
    setItemModal(item ? 'edit' : 'new');
  };

  const saveItem = async (event) => {
    event.preventDefault();
    if (itemForm.category === 'Others' && !itemForm.linkedOptionId) { setModalError('Please select which optional item this item belongs to.'); return; }
    setSaving(true); setModalError('');
    try {
      const payload = { name: itemForm.name, wing: gender, unit: itemForm.unit, category: itemForm.category, linkedOptionId: itemForm.category === 'Others' ? itemForm.linkedOptionId || null : null, isStored: itemForm.isStored };
      if (itemForm.id) await adminDataService.updateInventoryItem(itemForm.id, payload);
      else await adminDataService.createInventoryItem(payload);
      setItemModal(null); invalidate('inventory-'); refreshItems();
      toast.success(itemForm.id ? 'Item updated' : 'Item created', `${itemForm.name} · ${itemForm.category} · measured in ${itemForm.unit}.`);
    } catch (error) { setModalError(error.message || 'Unable to save item.'); }
    finally { setSaving(false); }
  };

  const openDeleteDialog = (item, force = false) => { setModalError(''); setDeleteTarget({ item, force }); };
  const deleteItem = async () => {
    if (!deleteTarget?.item) return;
    const { item, force } = deleteTarget;
    try {
      setSaving(true); setModalError('');
      if (force) await adminDataService.forceDeleteInventoryItem(item.id);
      else await adminDataService.deleteInventoryItem(item.id);
      setDeleteTarget(null); invalidate('inventory-'); refreshItems();
      toast.success(force ? 'Item permanently deleted' : 'Item deleted', force ? `${item.name} and its entire transaction history were removed.` : `${item.name} was removed from the stock list.`);
    } catch (error) { setModalError(error.message || 'Unable to delete item.'); }
    finally { setSaving(false); }
  };

  const openEditTransactionModal = (t) => {
    setModalError(''); setEditTransaction(t);
    setEditForm({ date: t.date, mealPeriod: t.mealPeriod || 'breakfast', quantity: t.quantity.toString(), totalPrice: (t.totalCost || (t.quantity * t.rate)).toString() });
  };

  const handleSaveEditTransaction = async (e) => {
    e.preventDefault();
    if (money(editForm.quantity).lessThanOrEqualTo(0)) return setModalError('Quantity must be greater than zero.');
    const isStockInOrNonStock = editTransaction.transactionType === 'in' || (editTransaction.transactionType === 'out' && !historyItem.isStored);
    if (isStockInOrNonStock && (!editForm.totalPrice || money(editForm.totalPrice).lessThanOrEqualTo(0))) return setModalError('Total Purchase Price must be greater than zero.');
    setSaving(true); setModalError('');
    try {
      const payload = {
        itemId: editTransaction.itemId, wing: gender, transactionType: editTransaction.transactionType,
        date: editForm.date, mealPeriod: editTransaction.transactionType === 'in' ? null : editForm.mealPeriod,
        quantity: Number(editForm.quantity), totalPrice: isStockInOrNonStock ? Number(editForm.totalPrice) : null, note: editTransaction.note,
      };
      await adminDataService.updateInventoryMovement(editTransaction.id, payload);
      setEditTransaction(null); invalidate('inventory-'); refreshItems(); if (historyItem) refreshLedger();
      toast.success('Transaction updated', `${historyItem?.name || 'Item'} · ${editForm.quantity} ${historyItem?.unit || ''} on ${editForm.date}.`);
    } catch (error) { setModalError(error.message || 'Unable to update transaction.'); }
    finally { setSaving(false); }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTransaction) return;
    const removed = deleteTransaction; setSaving(true); setModalError('');
    try {
      await adminDataService.deleteInventoryMovement(deleteTransaction.id);
      setDeleteTransaction(null); invalidate('inventory-'); refreshItems(); if (historyItem) refreshLedger();
      toast.success('Transaction deleted', `${removed.transactionType === 'in' ? 'Stock-in' : 'Stock-out'} of ${removed.quantity} ${historyItem?.unit || ''} on ${removed.date} was removed.`);
    } catch (error) { setModalError(error.message || 'Unable to delete transaction.'); }
    finally { setSaving(false); }
  };

  // ── Derived helpers ────────────────────────────────────────────────────────
  const isSessionTab = activeTab === 'out' || activeTab === 'non-stock';
  const activeMealSegment = MEAL_SEGMENTS.find((m) => m.id === sessionMeal);

  const calcMovementUnitPrice = useMemo(() => {
    const qty = Number(movement.quantity || 0);
    const total = Number(movement.totalPrice || 0);
    return qty > 0 ? (total / qty) : 0;
  }, [movement.quantity, movement.totalPrice]);

  const pendingTotalCost = useMemo(() => {
    return pendingItems.reduce((sum, row) => {
      if (activeTab === 'out') return sum + (Number(row.quantity || 0) * Number(row.batchRate || 0));
      return sum + Number(row.totalPrice || 0);
    }, 0);
  }, [pendingItems, activeTab]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="stock-page">
      {(itemsRefreshing || ledgerRefreshing) && <div className="data-refreshing-bar" />}

      {/* ── Title row ─────────────────────────────────────────────────────── */}
      <div className="stock-title-row">
        <h1>Stock</h1>
        <div className="stock-top-actions">
          {isWingAdmin ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: user?.wing === 'Female' ? '#fce7f3' : '#dbeafe', color: user?.wing === 'Female' ? '#9d174d' : '#1e40af', border: `1px solid ${user?.wing === 'Female' ? '#f9a8d4' : '#93c5fd'}`, borderRadius: '6px', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' }}>
              {user?.wing} Wing Only
            </span>
          ) : (
            <label className="stock-gender-select">
              <select value={gender} onChange={(event) => setGender(event.target.value)}>
                <option>Male</option>
                <option>Female</option>
              </select>
              <ChevronDown size={16} />
            </label>
          )}
        </div>
      </div>

      {/* ── Tab nav ────────────────────────────────────────────────────────── */}
      <nav className="stock-tabs">
        {tabs.map((tab) => (
          <button type="button" key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => switchTab(tab.id)}>
            {tab.label}
            {(tab.id === 'out' || tab.id === 'non-stock') && pendingItems.length > 0 && activeTab === tab.id && (
              <small>{pendingItems.length}</small>
            )}
          </button>
        ))}
      </nav>

      {/* ── Items tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'items' ? (
        <section className="stock-items-view">
          <div className="stock-items-toolbar">
            <div><Search size={17} /><input placeholder="Search items..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} /></div>
            <button type="button" onClick={() => openItemModal()}><Plus size={17} /> New Item</button>
          </div>
          <div className="stock-items-table-wrap">
            {itemsLoading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : (
              <table className="stock-items-table">
                <thead><tr><th>Name</th><th>Unit</th><th>Category</th><th>Main Option</th><th>Storage Type</th><th>Actions</th></tr></thead>
                <tbody style={{ cursor: 'pointer' }}>{visibleItems.map((item) => (
                  <tr key={item.id} onClick={() => openHistoryModal(item)}>
                    <td>{item.name}</td>
                    <td>{item.unit.toUpperCase()}</td>
                    <td><span className={`stock-category stock-category-${item.category.toLowerCase()}`}>{item.category.toUpperCase()}</span></td>
                    <td>{item.category === 'Others' ? items.find((option) => option.id === item.linkedOptionId)?.name || 'Not linked' : '—'}</td>
                    <td><span className={`stock-storage ${item.isStored ? 'is-stored' : 'is-non-stored'}`}>{item.isStored ? 'STORED' : 'NON-STORED'}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button type="button" aria-label={`Edit ${item.name}`} onClick={() => openItemModal(item)}><Pencil size={17} /></button>
                      <button type="button" aria-label={`Delete ${item.name}`} onClick={() => openDeleteDialog(item)}><Trash2 size={17} /></button>
                      <button type="button" aria-label={`Force delete ${item.name}`} onClick={() => openDeleteDialog(item, true)}><Flame size={17} /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </section>
      ) : (
        <div className="stock-workspace">
          <main>

            {/* ── Stock-In tab (unchanged single-entry form) ───────────── */}
            {activeTab === 'in' && (
              <>
                {formError && <div className="stock-message stock-message-error" role="alert">{formError}</div>}
                <form ref={formRef} className="stock-form stock-form-in" onSubmit={submitMovement} onKeyDown={handleFormKeyDown}>
                  <label>
                    <span>Date</span>
                    <div>
                      <CalendarDays size={17} />
                      <input type="date" value={movement.date} disabled={saving} onChange={(e) => setMovement({ ...movement, date: e.target.value })} onClick={(e) => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) { console.error(err); } } }} />
                      <b>{formatDisplayDate(movement.date)}</b>
                    </div>
                  </label>
                  <label className="stock-item-field"><span>Item</span><ItemPicker items={storedItems} value={movement.itemId} onChange={(itemId) => setMovement({ ...movement, itemId })} showRemaining={false} disabled={saving} /></label>
                  <label>
                    <span>Quantity</span>
                    <input type="number" min="0" step="0.0001" placeholder="eg: 10" value={movement.quantity} disabled={saving} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} />
                  </label>
                  <label>
                    <span>Total Purchase Price</span>
                    <input type="number" min="0" step="0.0001" placeholder="eg: 2500" value={movement.totalPrice || ''} disabled={saving} onChange={(e) => setMovement({ ...movement, totalPrice: e.target.value })} />
                  </label>
                  <div className="stock-calc-preview" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', height: '46px', padding: '0 1rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '7px', fontSize: '0.85rem', color: '#475569', minWidth: '200px' }}>
                    <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: '#64748b' }}>Calculated Unit Price</span>
                    <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                      ৳{formatNumber(calcMovementUnitPrice)} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>per {items.find(x => x.id === movement.itemId)?.unit?.toUpperCase() || 'unit'}</span>
                    </strong>
                  </div>
                  <button className="stock-submit stock-submit-in" type="submit" disabled={saving}>
                    {saving ? <><Loader2 size={16} className="spin-icon" style={{ marginRight: '0.4rem' }} />Saving...</> : 'Stock In'}
                  </button>
                </form>
              </>
            )}

            {/* ── Session tabs: Stock Out / Non-Stock ──────────────────── */}
            {isSessionTab && (
              <div className="session-container">

                {/* Session header: date + meal segmented control */}
                <div className="session-header">
                  <div className="session-header-left">
                    <label className="session-date-label">
                      <CalendarDays size={15} />
                      <span>Date</span>
                      <div className="session-date-picker">
                        <input
                          type="date"
                          value={sessionDate}
                          disabled={saving}
                          onChange={(e) => setSessionDate(e.target.value)}
                          onClick={(e) => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }}
                        />
                        <b>{formatDisplayDate(sessionDate)}</b>
                      </div>
                    </label>
                  </div>
                  <div className="session-header-right">
                    <span className="session-meal-label">Meal Period</span>
                    <div className="session-meal-seg" role="group" aria-label="Meal period">
                      {MEAL_SEGMENTS.map((seg) => (
                        <button
                          key={seg.id}
                          type="button"
                          className={`session-meal-btn session-meal-btn-${seg.id} ${sessionMeal === seg.id ? 'is-active' : ''}`}
                          onClick={() => switchMeal(seg.id)}
                          disabled={saving}
                          aria-pressed={sessionMeal === seg.id}
                        >
                          <span className="session-meal-icon">{seg.short}</span>
                          {seg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Meal switch warning */}
                {mealSwitchWarning && pendingItems.length > 0 && (
                  <div className="session-switch-warning" role="alert">
                    <AlertTriangle size={15} />
                    <span>
                      Switched to <strong>{activeMealSegment?.label}</strong> — the {pendingItems.length} queued item{pendingItems.length !== 1 ? 's' : ''} will be confirmed under <strong>{activeMealSegment?.label}</strong>.
                    </span>
                    <button type="button" className="session-warning-dismiss" onClick={clearMealWarning} aria-label="Dismiss">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Entry row */}
                <div className="pending-entry-card">
                  <div className="pending-entry-row">
                    <div className="pending-entry-item">
                      <span className="pending-entry-label">Item</span>
                      <div className="stock-item-field" style={{ width: '100%' }}>
                        <ItemPicker
                          items={pickerItems}
                          value={entryItemId}
                          onChange={(id) => {
                            setEntryItemId(id);
                            setEntryError('');
                            // Jump to qty as soon as the item is chosen
                            if (id) setTimeout(() => document.getElementById('entry-qty-input')?.focus(), 50);
                          }}
                          showRemaining={activeTab === 'out'}
                          disabled={saving}
                        />
                      </div>
                    </div>

                    {activeTab === 'out' && (
                      <div className="pending-entry-batch">
                        <span className="pending-entry-label">Batch</span>
                        <div style={{ width: '100%' }}>
                          <BatchPicker
                            batches={entryBatches}
                            value={entryBatchId}
                            onChange={(id) => { setEntryBatchId(id); setEntryError(''); }}
                            disabled={saving}
                            loading={loadingEntryBatches}
                            hasItem={Boolean(entryItemId)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="pending-entry-qty">
                      <span className="pending-entry-label">
                        Qty {entryItem ? `(${entryItem.unit.toUpperCase()})` : ''}
                      </span>
                      <input
                        id="entry-qty-input"
                        type="number" min="0.0001" step="0.0001"
                        placeholder="eg: 10"
                        value={entryQty}
                        disabled={saving}
                        onChange={(e) => { setEntryQty(e.target.value); setEntryError(''); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // For Stock Out, Enter on qty queues immediately
                            if (activeTab === 'out') addToPending();
                            // For Non-Stock, move focus to price field
                            else document.getElementById('entry-price-input')?.focus();
                          }
                        }}
                        className="pending-entry-input"
                      />
                    </div>

                    {activeTab === 'non-stock' && (
                      <div className="pending-entry-price">
                        <span className="pending-entry-label">Total Price (৳)</span>
                        <input
                          id="entry-price-input"
                          type="number" min="0" step="0.01"
                          placeholder="eg: 2500"
                          value={entryTotalPrice}
                          disabled={saving}
                          onChange={(e) => { setEntryTotalPrice(e.target.value); setEntryError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToPending(); } }}
                          className="pending-entry-input"
                        />
                      </div>
                    )}

                    {/* Inline cost preview */}
                    {activeTab === 'out' && entrySelectedBatch && entryQty && (
                      <div className="pending-entry-preview">
                        <span>Cost</span>
                        <strong>৳{formatNumber(Number(entryQty) * Number(entrySelectedBatch.rate))}</strong>
                        <small>৳{formatNumber(entrySelectedBatch.rate)}/{entryItem?.unit?.toUpperCase()}</small>
                      </div>
                    )}
                    {activeTab === 'non-stock' && entryItemId && (
                      <div className="pending-entry-preview">
                        <span>Per Person</span>
                        {loadingEntryParticipants ? (
                          <small><Loader2 size={12} className="spin-icon" /> Loading…</small>
                        ) : (
                          <>
                            <strong>৳{formatNumber(entryParticipantCount > 0 && entryTotalPrice ? Number(entryTotalPrice) / entryParticipantCount : 0)}</strong>
                            <small>{entryParticipantCount} students</small>
                          </>
                        )}
                      </div>
                    )}

                    {/* Keyboard hint — no button */}
                    <div className="pending-entry-hint">
                      <kbd>↵</kbd> to queue
                    </div>

                  </div>

                  {entryError && (
                    <div className="pending-entry-error" role="alert">
                      <AlertTriangle size={13} /> {entryError}
                    </div>
                  )}
                </div>

                {/* Bulk errors panel */}
                {bulkErrors.length > 0 && (
                  <div className="bulk-error-panel" role="alert">
                    <div className="bulk-error-title"><AlertTriangle size={15} /> Some items could not be saved — fix them and try again.</div>
                    {bulkErrors.map((err, i) => (
                      <div key={i} className="bulk-error-row">
                        {err.index >= 0 ? <span className="bulk-error-idx">#{err.index + 1}</span> : null}
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending items list */}
                {pendingItems.length > 0 && (
                  <div className="pending-panel">
                    {/* Meal banner */}
                    <div className={`pending-meal-banner pending-meal-banner-${sessionMeal}`}>
                      <span className="pending-meal-icon">{activeMealSegment?.short}</span>
                      <span className="pending-meal-name">{activeMealSegment?.label}</span>
                      <span className="pending-meal-date">·  {formatDisplayDate(sessionDate)}</span>
                      <span className="pending-meal-count">{pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} queued</span>
                    </div>

                    <div className="pending-table-wrap">
                      <table className="pending-table">
                        <thead>
                          <tr>
                            <th className="th-num">#</th>
                            <th>Item</th>
                            {activeTab === 'out' && <th>Batch</th>}
                            <th>Qty</th>
                            <th>Cost</th>
                            <th className="th-actions">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingItems.map((row, index) => (
                            <PendingRow
                              key={row._id}
                              row={row}
                              index={index}
                              isOut={activeTab === 'out'}
                              allItems={items}
                              allBatches={allBatches}
                              onUpdate={updatePending}
                              onRemove={removePending}
                              disabled={saving}
                            />
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="pending-tfoot">
                            <td colSpan={activeTab === 'out' ? 4 : 3} className="pending-tfoot-label">
                              Total ({pendingItems.length} items)
                            </td>
                            <td className="pending-tfoot-total">
                              <strong>৳{formatNumber(pendingTotalCost)}</strong>
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="pending-confirm-row">
                      <button
                        type="button"
                        className={`pending-confirm-btn pending-confirm-btn-${activeTab === 'out' ? 'out' : 'nonstock'}`}
                        onClick={confirmBulk}
                        disabled={saving || pendingItems.length === 0}
                      >
                        {saving ? (
                          <><Loader2 size={16} className="spin-icon" style={{ marginRight: '0.5rem' }} />Confirming…</>
                        ) : (
                          <><CheckCircle2 size={16} style={{ marginRight: '0.5rem' }} />
                            {activeTab === 'out' ? 'Confirm Stock Out' : 'Confirm Non-Stock'} ({pendingItems.length} Item{pendingItems.length !== 1 ? 's' : ''})
                          </>
                        )}
                      </button>
                      <button type="button" className="pending-clear-btn" onClick={() => { setPendingItems([]); setBulkErrors([]); setMealSwitchWarning(false); }} disabled={saving}>
                        Clear All
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </main>

          {/* ── Stock Summary sidebar (unchanged) ──────────────────────────── */}
          <aside className="stock-summary">
            <div className="stock-summary-title"><h2>Stock Summary</h2><small>Click row for history</small></div>
            <div className="stock-summary-search"><Search size={17} /><input placeholder="Search items..." value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} /></div>
            <div className="stock-summary-table-wrap">
              {itemsLoading ? (
                <TableSkeleton rows={6} cols={4} />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  {activeTab === 'non-stock' ? (
                    <>
                      <thead><tr><th>Item name</th><th>Students number</th><th>Unit</th><th>Avrg price</th></tr></thead>
                      <tbody style={{ cursor: 'pointer' }}>{summaryItems.map((item) => <tr key={item.id} onClick={() => openHistoryModal(item)}><td>{item.name}</td><td>{Math.round(item.currentStockQty)}</td><td>{item.unit.toUpperCase()}</td><td>{formatNumber(item.currentWac)}</td></tr>)}</tbody>
                    </>
                  ) : (
                    <>
                      <thead><tr><th>Name</th><th>Qty</th><th>Unit</th><th>Rate</th></tr></thead>
                      <tbody style={{ cursor: 'pointer' }}>{summaryItems.map((item) => {
                        const allItemBatches = batchesByItem.get(item.id) || [];
                        const itemBatches = allItemBatches.length > 1 ? allItemBatches : [];
                        return (
                          <Fragment key={item.id}>
                            <tr onClick={() => openHistoryModal(item)}>
                              <td>{item.name}</td>
                              <td>{formatNumber(item.currentStockQty)}</td>
                              <td>{item.unit.toUpperCase()}</td>
                              <td>{itemBatches.length > 1 ? <span style={{ color: '#64748b' }}>{formatNumber(item.currentWac)} avg</span> : formatNumber(item.currentWac)}</td>
                            </tr>
                            {itemBatches.map((batch) => (
                              <tr key={batch.id} className="stock-batch-row" onClick={() => openHistoryModal(item)}>
                                <td><span className="stock-batch-chip">{batch.label}</span></td>
                                <td>{formatNumber(batch.remainingQuantity)}</td>
                                <td>{batch.unit.toUpperCase()}</td>
                                <td className="stock-batch-rate">{formatNumber(batch.rate)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}</tbody>
                    </>
                  )}
                </table>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ── Modals (all unchanged) ─────────────────────────────────────────── */}

      {/* New / Edit Item */}
      <Modal isOpen={Boolean(itemModal)} onClose={() => !saving && setItemModal(null)} title={itemModal === 'edit' ? 'Edit Item' : 'New Item'} actions={<><Button variant="secondary" onClick={() => setItemModal(null)} disabled={saving}>Cancel</Button><Button type="submit" form="stock-item-form" disabled={saving}>{saving ? <><Loader2 size={16} className="spin-icon" style={{ marginRight: '0.4rem' }} /> Saving...</> : 'Save'}</Button></>}>
        <form id="stock-item-form" className="stock-item-form" onSubmit={saveItem}>
          {modalError && <div className="stock-message-error" style={{ marginBottom: '1rem', color: '#c73833', background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.62rem 0.82rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}>{modalError}</div>}
          <label>Name<input value={itemForm.name} disabled={saving} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required /></label>
          <label>Unit<input value={itemForm.unit} disabled={saving} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} required /></label>
          <label>Category
            <select value={itemForm.category} disabled={saving} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value, linkedOptionId: e.target.value === 'Others' ? itemForm.linkedOptionId : '' })}>
              <option>Common</option><option>Options</option><option>Others</option>
            </select>
          </label>
          {itemForm.category === 'Others' && (
            <label>Belongs to Option
              <select value={itemForm.linkedOptionId} disabled={saving} onChange={(e) => setItemForm({ ...itemForm, linkedOptionId: e.target.value })} required>
                <option value="">Select optional item</option>
                {optionItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <small>Its cost will be billed only to students who selected this option.</small>
            </label>
          )}
          <label>Storage Type<select value={itemForm.isStored ? 'stored' : 'non-stored'} disabled={saving} onChange={(e) => setItemForm({ ...itemForm, isStored: e.target.value === 'stored' })}><option value="stored">Stored</option><option value="non-stored">Non-Stored</option></select></label>
        </form>
      </Modal>

      {/* Delete Item */}
      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !saving && setDeleteTarget(null)} title={deleteTarget?.force ? 'Permanently Delete Item' : 'Delete Item'} actions={<><Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</Button><Button variant="danger" onClick={deleteItem} disabled={saving}>{saving ? <><Loader2 size={16} className="spin-icon" style={{ marginRight: '0.4rem' }} />Deleting...</> : deleteTarget?.force ? 'Delete Forever' : 'Delete Item'}</Button></>}>
        {modalError && <div className="stock-message-error" style={{ marginBottom: '1rem', color: '#c73833', background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.62rem 0.82rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}>{modalError}</div>}
        <div className="stock-delete-dialog">
          <div className={`stock-delete-dialog__icon ${deleteTarget?.force ? 'is-force' : ''}`}>{deleteTarget?.force ? <Flame size={20} /> : <Trash2 size={20} />}</div>
          <div className="stock-delete-dialog__content">
            <p className="stock-delete-dialog__title">{deleteTarget?.force ? `Delete ${deleteTarget?.item?.name} forever?` : `Delete ${deleteTarget?.item?.name}?`}</p>
            <p className="stock-delete-dialog__text">{deleteTarget?.force ? 'This will remove the item and its full stock history permanently. Use this only when you are sure the record should not stay in the system.' : 'This will remove the item from the active inventory view. You can still keep the rest of your inventory workflow unchanged.'}</p>
            <div className="stock-delete-dialog__meta"><span>{deleteTarget?.item?.unit?.toUpperCase()}</span><span>{deleteTarget?.item?.category}</span><span>{deleteTarget?.item?.isStored ? 'Stored item' : 'Non-stored item'}</span></div>
          </div>
        </div>
      </Modal>

      {/* Item History Ledger */}
      <Modal
        isOpen={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
        title={
          <div className="stock-history-header">
            <div className="stock-history-title">
              <Package size={20} />
              <strong>{historyItem?.name}</strong>
              <span>({historyItem?.unit?.toUpperCase()}) — {historyItem?.isStored ? 'STORED' : 'NON-STORED'}</span>
            </div>
            <div className="stock-history-stats">
              <span className="stat-in">↑ Total In: {formatNumber(historyStats.totalIn)} {historyItem?.unit?.toUpperCase()}</span>
              <span className="stat-out">↓ Total Out: {formatNumber(historyStats.totalOut)} {historyItem?.unit?.toUpperCase()}</span>
              <span className="stat-spent">৳ Total Spent: {formatNumber(historyStats.totalSpent)}</span>
            </div>
            <div className="stock-history-tabs">
              <button type="button" className={ledgerTab === 'all' ? 'is-active' : ''} onClick={() => setLedgerTab('all')}>All ({currentLedgerTransactions.length})</button>
              <button type="button" className={ledgerTab === 'in' ? 'is-active' : ''} onClick={() => setLedgerTab('in')}>Stock In ({currentLedgerTransactions.filter((t) => t.transactionType === 'in').length})</button>
              <button type="button" className={ledgerTab === 'out' ? 'is-active' : ''} onClick={() => setLedgerTab('out')}>Stock Out ({currentLedgerTransactions.filter((t) => t.transactionType === 'out').length})</button>
            </div>
          </div>
        }
      >
        <div className="stock-history-timeline" style={{ minWidth: 'min(620px, 90vw)', maxHeight: '60vh', overflowY: 'auto' }}>
          {ledgerError && <div className="stock-message-error" style={{ marginBottom: '1rem', color: '#c73833', background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.62rem 0.82rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}>{ledgerError}</div>}
          {ledgerLoading ? (
            <div className="stock-loading">Loading timeline ledger...</div>
          ) : filteredTimeline.length === 0 ? (
            <div className="stock-no-data">No movements found.</div>
          ) : (
            filteredTimeline.map((t) => (
              <div key={t.id} className={`stock-timeline-item type-${t.transactionType}`}>
                <div className="stock-timeline-icon">{t.transactionType === 'in' ? '↓' : '↑'}</div>
                <div className="stock-timeline-card">
                  <div className="stock-timeline-card-header">
                    <div>
                      <span className={`stock-timeline-badge badge-${t.transactionType}`}>{t.transactionType === 'in' ? 'IN' : 'OUT'}</span>
                      <span className="stock-timeline-date">{formatDisplayDate(t.date)}</span>
                      {t.mealPeriod && <span className="stock-timeline-meal">{t.mealPeriod.toUpperCase()}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="stock-timeline-actions" style={{ display: 'flex', gap: '0.45rem' }}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEditTransactionModal(t); }} style={{ background: 'transparent', border: 0, padding: 2, cursor: 'pointer', color: '#1e40af', display: 'inline-flex', alignItems: 'center' }} title="Edit transaction"><Pencil size={15} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setModalError(''); setDeleteTransaction(t); }} style={{ background: 'transparent', border: 0, padding: 2, cursor: 'pointer', color: '#b91c1c', display: 'inline-flex', alignItems: 'center' }} title="Delete transaction"><Trash2 size={15} /></button>
                      </div>
                      {historyItem?.isStored && <span className="stock-timeline-balance">Balance: {formatNumber(t.runningBalance)} {historyItem?.unit?.toUpperCase()}</span>}
                    </div>
                  </div>
                  <div className="stock-timeline-card-body">
                    <span>Qty: <strong>{t.transactionType === 'in' ? '+' : '-'}{formatNumber(t.quantity)} {historyItem?.unit?.toUpperCase()}</strong></span>
                    {historyItem && !historyItem.isStored ? (
                      <><span>Per Person: <strong>৳{formatNumber(t.rate || 0)}</strong></span><span>Students: <strong>{t.participantCount ?? 0}</strong></span></>
                    ) : (
                      <span>Unit: <strong>৳{formatNumber(t.rate || t.wacSnapshot || 0)}</strong></span>
                    )}
                    <span>Total: <strong>৳{formatNumber(t.totalCost || 0)}</strong></span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Delete Transaction */}
      <Modal isOpen={Boolean(deleteTransaction)} onClose={() => !saving && setDeleteTransaction(null)} title="Delete Transaction" actions={<><Button variant="secondary" onClick={() => setDeleteTransaction(null)} disabled={saving}>Cancel</Button><Button variant="danger" onClick={handleDeleteTransaction} disabled={saving}>{saving ? <><Loader2 size={16} className="spin-icon" style={{ marginRight: '0.4rem' }} />Deleting...</> : 'Delete'}</Button></>}>
        {modalError && <div className="stock-message-error" style={{ marginBottom: '1rem', color: '#c73833', background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.62rem 0.82rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}>{modalError}</div>}
        <div className="stock-delete-dialog">
          <div className="stock-delete-dialog__icon"><Trash2 size={20} /></div>
          <div className="stock-delete-dialog__content">
            <p className="stock-delete-dialog__title">Delete this transaction?</p>
            <p className="stock-delete-dialog__text">Are you sure you want to delete this {deleteTransaction?.transactionType === 'in' ? 'Stock In' : 'Stock Out'} transaction of {formatNumber(deleteTransaction?.quantity)} {historyItem?.unit?.toUpperCase()} on {deleteTransaction && formatDisplayDate(deleteTransaction.date)}?</p>
          </div>
        </div>
      </Modal>

      {/* Edit Transaction */}
      <Modal isOpen={Boolean(editTransaction)} onClose={() => !saving && setEditTransaction(null)} title="Edit Transaction" actions={<><Button variant="secondary" onClick={() => setEditTransaction(null)} disabled={saving}>Cancel</Button><Button type="submit" form="stock-edit-transaction-form" disabled={saving}>{saving ? <><Loader2 size={16} className="spin-icon" style={{ marginRight: '0.4rem' }} />Saving...</> : 'Save Changes'}</Button></>}>
        {editTransaction && (
          <form id="stock-edit-transaction-form" className="stock-item-form" onSubmit={handleSaveEditTransaction}>
            {modalError && <div className="stock-message-error" style={{ marginBottom: '1rem', color: '#c73833', background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.62rem 0.82rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}>{modalError}</div>}
            <label style={{ display: 'grid', gap: '0.4rem', color: '#626c7f' }}>
              Date
              <input type="date" value={editForm.date} disabled={saving} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} onClick={(e) => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }} required style={{ height: '42px', border: '1px solid #dfe3e8', borderRadius: '7px', padding: '0 0.75rem', background: '#fff', font: 'inherit', outline: 'none' }} />
            </label>
            {editTransaction.transactionType === 'out' && (
              <label style={{ display: 'grid', gap: '0.4rem', color: '#626c7f' }}>
                Meal
                <select value={editForm.mealPeriod} disabled={saving} onChange={(e) => setEditForm({ ...editForm, mealPeriod: e.target.value })} required style={{ height: '42px', border: '1px solid #dfe3e8', borderRadius: '7px', padding: '0 0.75rem', background: '#fff', font: 'inherit', outline: 'none' }}>
                  <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option>
                </select>
              </label>
            )}
            <label style={{ display: 'grid', gap: '0.4rem', color: '#626c7f' }}>
              Quantity
              <input type="number" min="0.0001" step="0.0001" value={editForm.quantity} disabled={saving} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} required style={{ height: '42px', border: '1px solid #dfe3e8', borderRadius: '7px', padding: '0 0.75rem', background: '#fff', font: 'inherit', outline: 'none' }} />
            </label>
            {(editTransaction.transactionType === 'in' || (editTransaction.transactionType === 'out' && !historyItem?.isStored)) && (
              <>
                <label style={{ display: 'grid', gap: '0.4rem', color: '#626c7f' }}>
                  Total Purchase Price
                  <input type="number" min="0.0001" step="0.0001" value={editForm.totalPrice} disabled={saving} onChange={(e) => setEditForm({ ...editForm, totalPrice: e.target.value })} required style={{ height: '42px', border: '1px solid #dfe3e8', borderRadius: '7px', padding: '0 0.75rem', background: '#fff', font: 'inherit', outline: 'none' }} />
                </label>
                <div className="stock-calc-preview" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '7px', fontSize: '0.85rem', color: '#475569' }}>
                  {historyItem && !historyItem.isStored ? (
                    <>
                      <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: '#64748b' }}>Calculated Per Person Price</span>
                      <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                        {loadingEditStudentsCount ? <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'normal' }}>Loading students...</span> : <>৳{formatNumber(editStudentsCount > 0 ? (Number(editForm.totalPrice || 0) / editStudentsCount) : 0)} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>per person ({editStudentsCount} students)</span></>}
                      </strong>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: '#64748b' }}>Calculated Unit Price</span>
                      <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>৳{formatNumber(editCalcUnitPrice)} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>per {historyItem?.unit?.toUpperCase() || 'unit'}</span></strong>
                    </>
                  )}
                </div>
              </>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
