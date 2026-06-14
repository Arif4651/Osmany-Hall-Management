import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Flame, Pencil, Plus, Search, Trash2, Package } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { adminDataService } from '../../services/adminDataService';
import { money, todayLocal } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const tabs = [
  { id: 'in', label: 'Stock In' },
  { id: 'out', label: 'Stock Out' },
  { id: 'non-stock', label: 'Non-Stock' },
  { id: 'items', label: 'Items' },
];

const emptyMovement = { date: todayLocal(), mealPeriod: 'breakfast', itemId: '', quantity: '', rate: '' };
const emptyItem = { id: '', name: '', unit: 'KG', category: 'Common', linkedOptionId: '', isStored: true };
const formatNumber = (value) => money(value).toFixed(2);
const formatDisplayDate = (value) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(`${value}T00:00:00`));

function ItemPicker({ items, value, onChange, showRemaining }) {
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

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(filtered.length > 0 ? 0 : -1);
  }, [filtered]);

  // Scroll highlighted item into view
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
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        selectItem(filtered[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      if (selected) {
        setQuery(selected.name);
      } else {
        setQuery('');
      }
    }
  };

  return (
    <div className="stock-item-picker" ref={rootRef}>
      <Search size={17} />
      <input
        value={query}
        placeholder="Search item..."
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setHighlightedIndex(filtered.length > 0 ? 0 : -1);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange('');
          setOpen(true);
        }}
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

export default function Inventory() {
  useDocumentTitle('Stock');
  const { user, role } = useAuth();
  const isWingAdmin = role === 'male_wing_admin' || role === 'female_wing_admin';

  const [activeTab, setActiveTab] = useState('in');
  // Wing admins are locked to their wing's gender; super_admin/admin can switch
  const [gender, setGender] = useState(() => user?.wing || 'Male');
  const [items, setItems] = useState([]);
  const [movement, setMovement] = useState(emptyMovement);
  const [summarySearch, setSummarySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemModal, setItemModal] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // History ledger state variables
  const [historyItem, setHistoryItem] = useState(null);
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTab, setLedgerTab] = useState('all');

  const formRef = useRef(null);

  const loadItems = useCallback(async () => {
    try {
      setItems(await adminDataService.getInventory(false, gender));
    } catch (error) {
      setMessage(error.message || 'Unable to load inventory.');
    }
  }, [gender]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const storedItems = items.filter((item) => item.isStored);
  const optionItems = items.filter((item) => item.category === 'Options' && item.id !== itemForm.id);
  const pickerItems = activeTab === 'non-stock' ? items.filter((item) => !item.isStored) : storedItems;
  const summaryItems = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(summarySearch.toLowerCase())), [items, summarySearch]);
  const visibleItems = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(itemSearch.toLowerCase())), [items, itemSearch]);

  // Compute stats for history ledger modal
  const historyStats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalSpent = 0;

    ledgerTransactions.forEach((t) => {
      const qty = Number(t.quantity || 0);
      const cost = Number(t.totalCost || 0);
      if (t.transactionType === 'in') {
        totalIn += qty;
      } else {
        totalOut += qty;
      }
      totalSpent += cost;
    });

    return { totalIn, totalOut, totalSpent };
  }, [ledgerTransactions]);

  // Chronologically sort timeline to compute running balance correctly
  const historyTimeline = useMemo(() => {
    // The backend returns transactions sorted newest first (Date desc, CreatedAtUtc desc).
    // Reversing it gives us chronological order (oldest first).
    const oldestFirst = [...ledgerTransactions].reverse();

    let balance = 0;
    const computed = oldestFirst.map((t) => {
      if (t.transactionType === 'in') {
        balance += Number(t.quantity || 0);
      } else {
        balance -= Number(t.quantity || 0);
      }
      return { ...t, runningBalance: balance };
    });

    return computed.reverse();
  }, [ledgerTransactions]);


  const filteredTimeline = useMemo(() => {
    if (ledgerTab === 'all') return historyTimeline;
    return historyTimeline.filter((t) => t.transactionType === ledgerTab);
  }, [historyTimeline, ledgerTab]);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setMovement(emptyMovement);
    setMessage('');
  }, []);

  // Open history ledger modal and load timeline from backend
  const openHistoryModal = async (item) => {
    setHistoryItem(item);
    setLedgerTransactions([]);
    setLedgerLoading(true);
    setLedgerTab('all');
    try {
      const data = await adminDataService.getInventoryLedger({ itemId: item.id, wing: gender });
      setLedgerTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error.message || 'Unable to load stock history.');
    } finally {
      setLedgerLoading(false);
    }
  };



  // Form input field navigation using Arrow Keys
  const handleFormKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      // Don't hijack arrow keys if user is navigating the searchable picker dropdown list
      if (document.activeElement && document.activeElement.closest('.stock-item-picker')) return;
      e.preventDefault();
      const inputs = Array.from(e.currentTarget.querySelectorAll('input, select'));
      const index = inputs.indexOf(document.activeElement);
      if (index >= 0 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (document.activeElement && document.activeElement.closest('.stock-item-picker')) return;
      e.preventDefault();
      const inputs = Array.from(e.currentTarget.querySelectorAll('input, select'));
      const index = inputs.indexOf(document.activeElement);
      if (index > 0) {
        inputs[index - 1].focus();
      }
    }
  };

  const submitMovement = async (event) => {
    event.preventDefault();
    const item = items.find((row) => row.id === movement.itemId);
    if (!item) return setMessage('Please select an item.');
    if (money(movement.quantity).lessThanOrEqualTo(0)) return setMessage('Quantity must be greater than zero.');
    if (activeTab === 'out' && money(movement.quantity).greaterThan(money(item.currentStockQty))) {
      return setMessage(`Only ${formatNumber(item.currentStockQty)} ${item.unit} is available.`);
    }
    setSaving(true);
    setMessage('');
    try {
      await adminDataService.createInventoryMovement({
        itemId: item.id,
        wing: gender,
        transactionType: activeTab === 'in' ? 'in' : 'out',
        date: movement.date,
        mealPeriod: activeTab === 'in' ? null : movement.mealPeriod,
        quantity: Number(movement.quantity),
        rate: activeTab === 'in' || activeTab === 'non-stock' ? Number(movement.rate) : null,
        note: null,
      });
      setMovement(emptyMovement);
      await loadItems();
      setMessage('Transaction saved successfully.');
    } catch (error) {
      setMessage(error.message || 'Unable to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  const openItemModal = (item = null) => {
    setItemForm(item ? {
      id: item.id, name: item.name, unit: item.unit, category: item.category,
      linkedOptionId: item.linkedOptionId || '', isStored: item.isStored,
    } : emptyItem);
    setItemModal(item ? 'edit' : 'new');
  };

  const saveItem = async (event) => {
    event.preventDefault();
    if (itemForm.category === 'Others' && !itemForm.linkedOptionId) {
      setMessage('Please select which optional item this item belongs to.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: itemForm.name,
        wing: gender,
        unit: itemForm.unit,
        category: itemForm.category,
        linkedOptionId: itemForm.category === 'Others' ? itemForm.linkedOptionId || null : null,
        isStored: itemForm.isStored,
      };
      if (itemForm.id) await adminDataService.updateInventoryItem(itemForm.id, payload);
      else await adminDataService.createInventoryItem(payload);
      setItemModal(null);
      await loadItems();
    } catch (error) {
      setMessage(error.message || 'Unable to save item.');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item, force = false) => {
    setDeleteTarget({ item, force });
  };

  const deleteItem = async () => {
    if (!deleteTarget?.item) return;
    try {
      setSaving(true);
      setMessage('');
      if (deleteTarget.force) await adminDataService.forceDeleteInventoryItem(deleteTarget.item.id);
      else await adminDataService.deleteInventoryItem(deleteTarget.item.id);
      setDeleteTarget(null);
      await loadItems();
      setMessage(deleteTarget.force ? 'Item was permanently deleted.' : 'Item deleted successfully.');
    } catch (error) {
      setMessage(error.message || 'Unable to delete item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stock-page">
      <div className="stock-title-row">
        <h1>Stock</h1>
        <div className="stock-top-actions">
          {isWingAdmin ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: user?.wing === 'Female' ? '#fce7f3' : '#dbeafe',
              color: user?.wing === 'Female' ? '#9d174d' : '#1e40af',
              border: `1px solid ${user?.wing === 'Female' ? '#f9a8d4' : '#93c5fd'}`,
              borderRadius: '6px',
              padding: '0.4rem 0.9rem',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}>
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

      <nav className="stock-tabs">
        {tabs.map((tab) => (
          <button type="button" key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => switchTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {message && <div className="stock-message">{message}</div>}

      {activeTab === 'items' ? (
        <section className="stock-items-view">
          <div className="stock-items-toolbar">
            <div><Search size={17} /><input placeholder="Search items..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} /></div>
            <button type="button" onClick={() => openItemModal()}><Plus size={17} /> New Item</button>
          </div>
          <div className="stock-items-table-wrap">
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
          </div>
        </section>
      ) : (
        <div className="stock-workspace">
          <main>
            <form ref={formRef} className={`stock-form stock-form-${activeTab}`} onSubmit={submitMovement} onKeyDown={handleFormKeyDown}>
              <label><span>Date</span><div className={activeTab === 'non-stock' ? 'is-tinted' : ''}><CalendarDays size={17} /><input type="date" value={movement.date} onChange={(e) => setMovement({ ...movement, date: e.target.value })} /><b>{formatDisplayDate(movement.date)}</b></div></label>
              {activeTab !== 'in' && <label><span>Meal</span><select value={movement.mealPeriod} onChange={(e) => setMovement({ ...movement, mealPeriod: e.target.value })}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label>}
              <label className="stock-item-field"><span>Item</span><ItemPicker items={pickerItems} value={movement.itemId} onChange={(itemId) => setMovement({ ...movement, itemId })} showRemaining={activeTab === 'out'} /></label>
              <label><span>Quantity</span><input type="number" min="0" step="0.0001" placeholder={activeTab === 'non-stock' ? 'eg: 100' : 'eg: 10'} value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} /></label>
              {(activeTab === 'in' || activeTab === 'non-stock') && <label><span>{activeTab === 'in' ? 'Price Per Unit' : 'Price (per unit)'}</span><input type="number" min="0" step="0.0001" placeholder={activeTab === 'in' ? 'eg: 100' : 'eg: 10'} value={movement.rate} onChange={(e) => setMovement({ ...movement, rate: e.target.value })} /></label>}
              <button className={`stock-submit stock-submit-${activeTab}`} type="submit" disabled={saving}>{activeTab === 'in' ? 'Stock In' : 'Stock Out'}</button>
            </form>
          </main>
          <aside className="stock-summary">
            <div className="stock-summary-title"><h2>Stock Summary</h2><small>Click row for history</small></div>
            <div className="stock-summary-search"><Search size={17} /><input placeholder="Search items..." value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} /></div>
            <div className="stock-summary-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th>Name</th><th>Qty</th><th>Unit</th><th>Avg Price</th></tr></thead>
                <tbody style={{ cursor: 'pointer' }}>{summaryItems.map((item) => <tr key={item.id} onClick={() => openHistoryModal(item)}><td>{item.name}</td><td>{formatNumber(item.currentStockQty)}</td><td>{item.unit.toUpperCase()}</td><td>{formatNumber(item.currentWac)}</td></tr>)}</tbody>
              </table>
            </div>
          </aside>
        </div>
      )}

      <Modal isOpen={Boolean(itemModal)} onClose={() => setItemModal(null)} title={itemModal === 'edit' ? 'Edit Item' : 'New Item'} actions={<><Button variant="secondary" onClick={() => setItemModal(null)}>Cancel</Button><Button type="submit" form="stock-item-form" disabled={saving}>Save</Button></>}>
        <form id="stock-item-form" className="stock-item-form" onSubmit={saveItem}>
          <label>Name<input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required /></label>
          <label>Unit<input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} required /></label>
          <label>Category
            <select
              value={itemForm.category}
              onChange={(e) => setItemForm({
                ...itemForm,
                category: e.target.value,
                linkedOptionId: e.target.value === 'Others' ? itemForm.linkedOptionId : '',
              })}
            >
              <option>Common</option><option>Options</option><option>Others</option>
            </select>
          </label>
          {itemForm.category === 'Others' && (
            <label>Belongs to Option
              <select
                value={itemForm.linkedOptionId}
                onChange={(e) => setItemForm({ ...itemForm, linkedOptionId: e.target.value })}
                required
              >
                <option value="">Select optional item</option>
                {optionItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <small>Its cost will be billed only to students who selected this option.</small>
            </label>
          )}
          <label>Storage Type<select value={itemForm.isStored ? 'stored' : 'non-stored'} onChange={(e) => setItemForm({ ...itemForm, isStored: e.target.value === 'stored' })}><option value="stored">Stored</option><option value="non-stored">Non-Stored</option></select></label>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !saving && setDeleteTarget(null)}
        title={deleteTarget?.force ? 'Permanently Delete Item' : 'Delete Item'}
        actions={(
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</Button>
            <Button variant="danger" onClick={deleteItem} disabled={saving}>
              {saving ? 'Deleting...' : deleteTarget?.force ? 'Delete Forever' : 'Delete Item'}
            </Button>
          </>
        )}
      >
        <div className="stock-delete-dialog">
          <div className={`stock-delete-dialog__icon ${deleteTarget?.force ? 'is-force' : ''}`}>
            {deleteTarget?.force ? <Flame size={20} /> : <Trash2 size={20} />}
          </div>
          <div className="stock-delete-dialog__content">
            <p className="stock-delete-dialog__title">
              {deleteTarget?.force
                ? `Delete ${deleteTarget?.item?.name} forever?`
                : `Delete ${deleteTarget?.item?.name}?`}
            </p>
            <p className="stock-delete-dialog__text">
              {deleteTarget?.force
                ? 'This will remove the item and its full stock history permanently. Use this only when you are sure the record should not stay in the system.'
                : 'This will remove the item from the active inventory view. You can still keep the rest of your inventory workflow unchanged.'}
            </p>
            <div className="stock-delete-dialog__meta">
              <span>{deleteTarget?.item?.unit?.toUpperCase()}</span>
              <span>{deleteTarget?.item?.category}</span>
              <span>{deleteTarget?.item?.isStored ? 'Stored item' : 'Non-stored item'}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Item History Ledger Modal */}
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
              <button
                type="button"
                className={ledgerTab === 'all' ? 'is-active' : ''}
                onClick={() => setLedgerTab('all')}
              >
                All ({ledgerTransactions.length})
              </button>
              <button
                type="button"
                className={ledgerTab === 'in' ? 'is-active' : ''}
                onClick={() => setLedgerTab('in')}
              >
                Stock In ({ledgerTransactions.filter((t) => t.transactionType === 'in').length})
              </button>
              <button
                type="button"
                className={ledgerTab === 'out' ? 'is-active' : ''}
                onClick={() => setLedgerTab('out')}
              >
                Stock Out ({ledgerTransactions.filter((t) => t.transactionType === 'out').length})
              </button>
            </div>
          </div>
        }
      >
        <div className="stock-history-timeline" style={{ minWidth: 'min(620px, 90vw)', maxHeight: '60vh', overflowY: 'auto' }}>
          {ledgerLoading ? (
            <div className="stock-loading">Loading timeline ledger...</div>
          ) : filteredTimeline.length === 0 ? (
            <div className="stock-no-data">No movements found.</div>
          ) : (
            filteredTimeline.map((t) => (
              <div key={t.id} className={`stock-timeline-item type-${t.transactionType}`}>
                <div className="stock-timeline-icon">
                  {t.transactionType === 'in' ? '↓' : '↑'}
                </div>
                <div className="stock-timeline-card">
                  <div className="stock-timeline-card-header">
                    <div>
                      <span className={`stock-timeline-badge badge-${t.transactionType}`}>
                        {t.transactionType === 'in' ? 'IN' : 'OUT'}
                      </span>
                      <span className="stock-timeline-date">{formatDisplayDate(t.date)}</span>
                      {t.mealPeriod && (
                        <span className="stock-timeline-meal">{t.mealPeriod.toUpperCase()}</span>
                      )}
                    </div>
                    {historyItem?.isStored && (
                      <span className="stock-timeline-balance">
                        Balance: {formatNumber(t.runningBalance)} {historyItem?.unit?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="stock-timeline-card-body">
                    <span>Qty: <strong>{t.transactionType === 'in' ? '+' : '-'}{formatNumber(t.quantity)} {historyItem?.unit?.toUpperCase()}</strong></span>
                    <span>Unit: <strong>৳{formatNumber(t.rate || t.wacSnapshot || 0)}</strong></span>
                    <span>Total: <strong>৳{formatNumber(t.totalCost || 0)}</strong></span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
