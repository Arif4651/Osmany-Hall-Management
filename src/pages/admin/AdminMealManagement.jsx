import { useMemo, useState } from 'react';
import { Info, Utensils, Clock, Users, XCircle, Plus, Edit2 } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import useAdminMealModule from '../../hooks/useAdminMealModule';
import { formatCutoffTimeLabel } from '../../constants/mealConfig';
import { formatCurrency } from '../../utils/formatters';

function getItemsCost(items = []) {
  return items.reduce((sum, item) => sum + item.cost, 0);
}

function formatItems(items = []) {
  if (!items.length) return 'N/A';
  return items.map((item) => `${item.name} (${formatCurrency(item.cost)})`).join(', ');
}

export default function AdminMealManagement() {
  useDocumentTitle('Meal Management');

  const {
    isLoading,
    errorMessage,
    cutoffTime,
    dayOptions,
    mealTypeOptions,
    menuRows,
    tomorrowForecast,
    updateCutoffTime,
    getMealForEdit,
    saveMealConfiguration,
  } = useAdminMealModule();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('menus');
  const [formState, setFormState] = useState({
    dayId: '',
    mealTypeId: '',
    commonText: '',
    optionalText: '',
  });

  const handleOpenCreate = () => {
    setFormState({
      dayId: dayOptions[0]?.id || '',
      mealTypeId: mealTypeOptions[0]?.id || '',
      commonText: '',
      optionalText: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (dayId, mealTypeId) => {
    const editable = getMealForEdit(dayId, mealTypeId);
    setFormState(editable);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formState.dayId || !formState.mealTypeId) return;

    setIsSaving(true);
    try {
      await saveMealConfiguration(formState);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Meal Management</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Configure menus, track student orders, and manage cutoffs</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem' }}>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Cutoff Time:</span>
            <input 
              type="time" 
              value={cutoffTime} 
              onChange={(e) => updateCutoffTime(e.target.value)}
              disabled={isLoading}
              style={{ border: 'none', outline: 'none', fontWeight: '600', color: '#1e293b', cursor: 'pointer', backgroundColor: 'transparent' }}
            />
          </div>
          <button 
            onClick={handleOpenCreate}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              backgroundColor: '#3b82f6', color: 'white', border: 'none',
              borderRadius: '8px', fontWeight: '500', cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem', opacity: isLoading ? 0.7 : 1
            }}
          >
            <Plus size={18} /> Create Menu Planner
          </button>
        </div>
      </div>

      {/* Overview Cards Area */}
      {errorMessage && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', border: '1px solid #f87171' }}>
          {errorMessage}
        </div>
      )}

      {/* Cards Row - Forecast from context */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {tomorrowForecast.entries.map((entry, index) => {
          let Icon = Utensils;
          let bgColor = '#e0f2fe';
          let iconColor = '#3b82f6';
          
          if (index === 1) { Icon = Info; bgColor = '#f3e8ff'; iconColor = '#a855f7'; }
          if (index === 2) { Icon = Clock; bgColor = '#dcfce7'; iconColor = '#22c55e'; }
          if (index === 3) { Icon = Users; bgColor = '#ffedd5'; iconColor = '#d97706'; }

          return (
            <div key={entry.key} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', position: 'relative' }}>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500' }}>{entry.label}</p>
              <h3 style={{ fontSize: '1.5rem', color: '#1e293b', fontWeight: '500', margin: 0 }}>{entry.value}</h3>
              <div style={{ position: 'absolute', top: '24px', right: '24px', backgroundColor: bgColor, padding: '8px', borderRadius: '8px', color: iconColor }}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setActiveTab('menus')}
          style={{ 
            padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', 
            fontWeight: '500', fontSize: '0.95rem', transition: 'all 0.2s',
            backgroundColor: activeTab === 'menus' ? 'white' : 'transparent',
            color: activeTab === 'menus' ? '#1e293b' : '#64748b',
            boxShadow: activeTab === 'menus' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Daily Menu Matrix
        </button>
      </div>

      {/* Matrix Tab Content */}
      {activeTab === 'menus' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fcfcfc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '500', color: '#1e293b' }}>Menu Configuration</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Dynamic day-wise matrix generated from repository data.</p>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Day</th>
                  {mealTypeOptions.map((mealType) => (
                    <th key={mealType.id} style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>{mealType.label}</th>
                  ))}
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Daily Cost Summary</th>
                </tr>
              </thead>
              <tbody>
                {menuRows.map((row) => (
                  <tr key={row.dayId} style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.95rem' }}>
                    <td style={{ padding: '16px', verticalAlign: 'top', fontWeight: '500' }}>{row.dayLabel}</td>
                    
                    {mealTypeOptions.map((mealType) => {
                      const meal = row.mealsByType[mealType.id];
                      return (
                        <td key={mealType.id} style={{ padding: '16px', verticalAlign: 'top' }}>
                          {!meal ? (
                            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>Not configured</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ fontSize: '0.85rem' }}><strong style={{ color: '#475569' }}>Common:</strong> {formatItems(meal.commonItems)}</div>
                              <div style={{ fontSize: '0.85rem' }}><strong style={{ color: '#475569' }}>Options:</strong> {formatItems(meal.optionalItems)}</div>
                              <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '500' }}>Base {formatCurrency(getItemsCost(meal.commonItems))}</div>
                              <button 
                                onClick={() => handleEdit(row.dayId, mealType.id)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: '500', alignSelf: 'flex-start', marginTop: '4px' }}
                              >
                                <Edit2 size={14} /> Edit
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td style={{ padding: '16px', verticalAlign: 'top', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Common:</span>
                          <span>{formatCurrency(row.costSummary.commonTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Optional:</span>
                          <span>{formatCurrency(row.costSummary.optionalTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontWeight: '600' }}>
                          <span>Total:</span>
                          <span>{formatCurrency(row.costSummary.total)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tool */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '500px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '500', color: '#1e293b' }}>
                {formState.dayId && formState.mealTypeId ? 'Edit Meal Configuration' : 'Create Menu Planner'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>Day</label>
                  <select
                    required
                    value={formState.dayId}
                    onChange={(event) => setFormState((prev) => ({ ...prev, dayId: event.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    {dayOptions.map((day) => (
                      <option key={day.id} value={day.id}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>Meal Type</label>
                  <select
                    required
                    value={formState.mealTypeId}
                    onChange={(event) => setFormState((prev) => ({ ...prev, mealTypeId: event.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    {mealTypeOptions.map((mealType) => (
                      <option key={mealType.id} value={mealType.id}>{mealType.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>Common Items</label>
                <input
                  type="text"
                  value={formState.commonText}
                  onChange={(event) => setFormState((prev) => ({ ...prev, commonText: event.target.value }))}
                  placeholder="e.g. Rice-20, Dal-10..."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>Optional Items</label>
                <input
                  type="text"
                  value={formState.optionalText}
                  onChange={(event) => setFormState((prev) => ({ ...prev, optionalText: event.target.value }))}
                  placeholder="e.g. Beef-50, Fish-40..."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>All values are repository-backed and ready for backend API transition.</p>

              <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                 <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  style={{ flex: 1, padding: '10px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '500', color: '#64748b', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#3b82f6', border: 'none', borderRadius: '8px', fontWeight: '500', color: 'white', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
                >
                  {isSaving ? 'Saving...' : 'Save Planner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
