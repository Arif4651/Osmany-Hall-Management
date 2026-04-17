import React, { useState } from 'react';
import { Box, AlertTriangle, TrendingDown, Plus, Minus, X } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';

// Mock Initial Data matching screenshot
const initialInventory = [
  { id: 1, item: 'Rice (Premium)', category: 'Common', unit: 'kg', added: 500, used: 320, remaining: 180, unitPrice: 65, totalValue: 11700, lastUpdate: '2026-04-12' },
  { id: 2, item: 'Cooking Oil', category: 'Common', unit: 'L', added: 100, used: 72, remaining: 28, unitPrice: 180, totalValue: 5040, lastUpdate: '2026-04-11' },
  { id: 3, item: 'Salt', category: 'Common', unit: 'kg', added: 50, used: 35, remaining: 15, unitPrice: 40, totalValue: 600, lastUpdate: '2026-04-10' },
  { id: 4, item: 'Chicken', category: 'Optional', unit: 'kg', added: 200, used: 165, remaining: 35, unitPrice: 280, totalValue: 9800, lastUpdate: '2026-04-12' },
  { id: 5, item: 'Beef', category: 'Optional', unit: 'kg', added: 150, used: 128, remaining: 22, unitPrice: 650, totalValue: 14300, lastUpdate: '2026-04-12' },
  { id: 6, item: 'Fish (Rohu)', category: 'Optional', unit: 'kg', added: 120, used: 98, remaining: 22, unitPrice: 350, totalValue: 7700, lastUpdate: '2026-04-11' },
  { id: 7, item: 'Eggs', category: 'Optional', unit: 'pcs', added: 2000, used: 1650, remaining: 350, unitPrice: 14, totalValue: 4900, lastUpdate: '2026-04-12' },
];

const initialMovements = [
  { id: 1, item: 'Chicken', action: 'Added', quantity: '50 kg', costEffect: '+BDT 14,000', date: '2026-04-12', admin: 'Admin' },
  { id: 2, item: 'Rice (Premium)', action: 'Used', quantity: '25 kg', costEffect: 'BDT -1,625', date: '2026-04-12', admin: 'System' },
  { id: 3, item: 'Cooking Oil', action: 'Added', quantity: '20 L', costEffect: '+BDT 3,600', date: '2026-04-11', admin: 'Admin' },
  { id: 4, item: 'Beef', action: 'Used', quantity: '15 kg', costEffect: 'BDT -9,750', date: '2026-04-11', admin: 'System' },
  { id: 5, item: 'Eggs', action: 'Added', quantity: '500 pcs', costEffect: '+BDT 7,000', date: '2026-04-10', admin: 'Admin' },
];

export default function Inventory() {
  useDocumentTitle('Inventory');

  const [inventory, setInventory] = useState(initialInventory);
  const [movements, setMovements] = useState(initialMovements);
  const [activeTab, setActiveTab] = useState('inventory');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);

  const [stockForm, setStockForm] = useState({
    item: '',
    amount: '',
    category: 'Common'
  });

  const handleStockFormChange = (e) => {
    setStockForm({ ...stockForm, [e.target.name]: e.target.value });
  };

  const handleAddStock = (e) => {
    e.preventDefault();
    if (!stockForm.item || !stockForm.amount) return;
    
    const addAmt = Number(stockForm.amount);
    let existingItem = inventory.find(inv => inv.item.toLowerCase() === stockForm.item.toLowerCase());
    let unitPrice = existingItem ? existingItem.unitPrice : 150; 
    let unit = existingItem ? existingItem.unit : 'kg';
    const costEffectValue = addAmt * unitPrice;
    
    if (existingItem) {
      setInventory(inventory.map(inv => {
        if (inv.id === existingItem.id) {
          return {
            ...inv,
            category: stockForm.category,
            added: inv.added + addAmt,
            remaining: inv.remaining + addAmt,
            totalValue: (inv.remaining + addAmt) * inv.unitPrice,
            lastUpdate: new Date().toISOString().split('T')[0]
          };
        }
        return inv;
      }));
    } else {
      setInventory([{
        id: Date.now(),
        item: stockForm.item,
        category: stockForm.category,
        unit: 'kg',
        added: addAmt,
        used: 0,
        remaining: addAmt,
        unitPrice: unitPrice,
        totalValue: costEffectValue,
        lastUpdate: new Date().toISOString().split('T')[0]
      }, ...inventory]);
    }

    setMovements([{
      id: Date.now(),
      item: existingItem ? existingItem.item : stockForm.item,
      action: 'Added',
      quantity: `${addAmt} ${unit}`,
      costEffect: `+BDT ${costEffectValue.toLocaleString()}`,
      date: new Date().toISOString().split('T')[0],
      admin: 'Admin'
    }, ...movements]);

    setIsAddModalOpen(false);
    setStockForm({ item: '', amount: '', category: 'Common' });
  };

  const handleRemoveStock = (e) => {
    e.preventDefault();
    if (!stockForm.item || !stockForm.amount) return;
    
    const subAmt = Number(stockForm.amount);
    let existingItem = inventory.find(inv => inv.item.toLowerCase() === stockForm.item.toLowerCase());
    if (!existingItem) {
      alert("Item not found in inventory!");
      return;
    }

    const costEffectValue = subAmt * existingItem.unitPrice;

    setInventory(inventory.map(inv => {
      if (inv.id === existingItem.id) {
        return {
          ...inv,
          used: inv.used + subAmt,
          remaining: Math.max(0, inv.remaining - subAmt),
          totalValue: Math.max(0, inv.remaining - subAmt) * inv.unitPrice,
          lastUpdate: new Date().toISOString().split('T')[0]
        };
      }
      return inv;
    }));

    setMovements([{
      id: Date.now(),
      item: existingItem.item,
      action: 'Used',
      quantity: `${subAmt} ${existingItem.unit}`,
      costEffect: `BDT -${costEffectValue.toLocaleString()}`,
      date: new Date().toISOString().split('T')[0],
      admin: 'System'
    }, ...movements]);

    setIsRemoveModalOpen(false);
    setStockForm({ item: '', amount: '', category: 'Common' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Inventory / Store</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Stock and cost control</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              backgroundColor: '#10b981', color: 'white', border: 'none',
              borderRadius: '8px', fontWeight: '500', cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            <Plus size={18} /> Add Stock
          </button>
          <button 
            onClick={() => setIsRemoveModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              backgroundColor: 'white', color: '#475569', border: '1px solid #e2e8f0',
              borderRadius: '8px', fontWeight: '500', cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            <Minus size={18} /> Remove Stock
          </button>
        </div>
      </div>

      {/* Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', position: 'relative' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500' }}>Total Stock Value</p>
          <h3 style={{ fontSize: '1.5rem', color: '#1e293b', fontWeight: '500', margin: 0 }}>BDT 59K</h3>
          <div style={{ position: 'absolute', top: '24px', right: '24px', backgroundColor: '#efe7ff', padding: '8px', borderRadius: '8px', color: '#8b5cf6' }}>
            <Box size={20} />
          </div>
        </div>
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', position: 'relative' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500' }}>Low Stock Items</p>
          <h3 style={{ fontSize: '1.5rem', color: '#1e293b', fontWeight: '500', margin: 0 }}>4</h3>
          <div style={{ position: 'absolute', top: '24px', right: '24px', backgroundColor: '#ede9fe', padding: '8px', borderRadius: '8px', color: '#8b5cf6' }}>
            <AlertTriangle size={20} />
          </div>
        </div>
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', position: 'relative' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500' }}>Common Items</p>
          <h3 style={{ fontSize: '1.5rem', color: '#1e293b', fontWeight: '500', margin: 0 }}>{inventory.filter(i => i.category === 'Common').length}</h3>
          <div style={{ position: 'absolute', top: '24px', right: '24px', backgroundColor: '#ede9fe', padding: '8px', borderRadius: '8px', color: '#8b5cf6' }}>
            <Box size={20} />
          </div>
        </div>
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', position: 'relative' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500' }}>Optional Items</p>
          <h3 style={{ fontSize: '1.5rem', color: '#1e293b', fontWeight: '500', margin: 0 }}>{inventory.filter(i => i.category === 'Optional').length}</h3>
          <div style={{ position: 'absolute', top: '24px', right: '24px', backgroundColor: '#ede9fe', padding: '8px', borderRadius: '8px', color: '#8b5cf6' }}>
            <TrendingDown size={20} />
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
        backgroundColor: '#fffbeb', border: '1px solid #fde047', borderRadius: '8px', 
        color: '#b45309', fontSize: '0.95rem'
      }}>
        <AlertTriangle size={18} />
        <span><strong style={{ fontWeight: '500' }}>Low Stock Alert:</strong> Salt (15 kg), Lentils (Dal) (18 kg), Onion (12 kg), Spices Mix (5 kg)</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'inline-flex', padding: '4px', backgroundColor: '#f8fafc', borderRadius: '10px', gap: '4px', border: '1px solid #e2e8f0', alignSelf: 'flex-start' }}>
        <button 
          onClick={() => setActiveTab('inventory')}
          style={{ 
            padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', 
            fontWeight: '500', fontSize: '0.95rem', transition: 'all 0.2s',
            backgroundColor: activeTab === 'inventory' ? 'white' : 'transparent',
            color: activeTab === 'inventory' ? '#1e293b' : '#64748b',
            boxShadow: activeTab === 'inventory' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Inventory
        </button>
        <button 
          onClick={() => setActiveTab('stock_movements')}
          style={{ 
            padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', 
            fontWeight: '500', fontSize: '0.95rem', transition: 'all 0.2s',
            backgroundColor: activeTab === 'stock_movements' ? 'white' : 'transparent',
            color: activeTab === 'stock_movements' ? '#1e293b' : '#64748b',
            boxShadow: activeTab === 'stock_movements' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Stock Movements
        </button>
      </div>

      {/* Table Area for Inventory */}
      {activeTab === 'inventory' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Item</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Category</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Unit</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Added</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Used</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Remaining</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Unit Price</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Total Value</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.95rem' }}>
                    <td style={{ padding: '16px' }}>{inv.item}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        backgroundColor: inv.category === 'Common' ? '#e0e7ff' : '#fae8ff',
                        color: inv.category === 'Common' ? '#4338ca' : '#c026d3',
                        padding: '4px 10px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '500'
                      }}>
                        {inv.category}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: '#64748b' }}>{inv.unit}</td>
                    <td style={{ padding: '16px' }}>{inv.added}</td>
                    <td style={{ padding: '16px' }}>{inv.used}</td>
                    <td style={{ padding: '16px', fontWeight: '500' }}>{inv.remaining}</td>
                    <td style={{ padding: '16px', color: '#64748b' }}>BDT {inv.unitPrice}</td>
                    <td style={{ padding: '16px' }}>BDT {inv.totalValue.toLocaleString()}</td>
                    <td style={{ padding: '16px', color: '#64748b' }}>{inv.lastUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inventory.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No items found.</div>
            )}
          </div>
        </div>
      )}

      {/* Table Area for Stock Movements */}
      {activeTab === 'stock_movements' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Item</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Action</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Quantity</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Cost Effect</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Date</th>
                  <th style={{ padding: '16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Admin</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => (
                  <tr key={mov.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.95rem' }}>
                    <td style={{ padding: '16px' }}>{mov.item}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        backgroundColor: mov.action === 'Added' ? '#dcfce7' : '#fee2e2',
                        color: mov.action === 'Added' ? '#166534' : '#991b1b',
                        padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '500'
                      }}>
                        {mov.action}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>{mov.quantity}</td>
                    <td style={{ padding: '16px', color: '#64748b' }}>{mov.costEffect}</td>
                    <td style={{ padding: '16px', color: '#64748b' }}>{mov.date}</td>
                    <td style={{ padding: '16px', color: '#64748b' }}>{mov.admin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No items found.</div>
            )}
          </div>
        </div>
      )}

      {/* Modals for Dynamic Interaction */}
      {(isAddModalOpen || isRemoveModalOpen) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '400px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '500', color: '#1e293b' }}>
                {isAddModalOpen ? 'Add New Stock' : 'Remove Stock'}
              </h2>
              <button 
                onClick={() => { setIsAddModalOpen(false); setIsRemoveModalOpen(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={isAddModalOpen ? handleAddStock : handleRemoveStock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>Item Name (e.g. Rice (Premium))</label>
                <input 
                  type="text" name="item" required
                  value={stockForm.item} onChange={handleStockFormChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              
              {isAddModalOpen && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>Category</label>
                  <select 
                    name="category"
                    value={stockForm.category} onChange={handleStockFormChange}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    <option value="Common">Common</option>
                    <option value="Optional">Optional</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>Amount to {isAddModalOpen ? 'Add' : 'Deduct'}</label>
                <input 
                  type="number" name="amount" required min="1"
                  value={stockForm.amount} onChange={handleStockFormChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                 <button 
                  type="button" 
                  onClick={() => { setIsAddModalOpen(false); setIsRemoveModalOpen(false); }}
                  style={{ flex: 1, padding: '10px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '500', color: '#64748b', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ flex: 1, padding: '10px', backgroundColor: isAddModalOpen ? '#10b981' : '#ef4444', border: 'none', borderRadius: '8px', fontWeight: '500', color: 'white', cursor: 'pointer' }}
                >
                  {isAddModalOpen ? 'Confirm Add' : 'Confirm Deduct'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}