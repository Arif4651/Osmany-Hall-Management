import React, { useState } from 'react';
import { FileText, Download, Printer, Loader2 } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const reportTypes = [
  { id: 'daily_meal', title: 'Daily Meal Report', desc: 'Detailed meal participation for each day' },
  { id: 'monthly_billing', title: 'Monthly Billing Report', desc: 'Complete billing summary by student' },
  { id: 'due_report', title: 'Due Report', desc: 'Outstanding dues by student' },
  { id: 'inventory_report', title: 'Inventory Report', desc: 'Current stock levels and usage' },
  { id: 'payment_report', title: 'Payment Report', desc: 'All payment transactions and statuses' },
  { id: 'forecast_report', title: 'Forecast Report', desc: 'Predicted meal counts and preferences' },
];

export default function Reports() {
  useDocumentTitle('Reports');
  
  // State for active report type
  const [activeReport, setActiveReport] = useState('daily_meal');

  // State for filters (preparing for backend integration)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    student: 'All Students',
    mealType: 'All Meals'
  });

  // State for generated report data & UI states
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setReportData(null);
    
    // Simulate API Call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock dynamic generation based on activeReport
    const mockGeneratedParams = { ...filters, reportId: activeReport };
    
    // Generating mock column/row data based on type
    if (activeReport === 'daily_meal') {
      setReportData({
        columns: ['Date', 'Student ID', 'Name', 'Breakfast', 'Lunch', 'Dinner'],
        rows: [
          ['2026-04-17', '202014001', 'Rahul Ahmed', 'Yes', 'Yes', 'No'],
          ['2026-04-17', '202014002', 'Fatima Khan', 'No', 'Yes', 'Yes'],
        ]
      });
    } else if (activeReport === 'due_report') {
      setReportData({
        columns: ['Student ID', 'Name', 'Department', 'Due Amount', 'Last Payment Date'],
        rows: [
          ['202014045', 'John Doe', 'CSE', 'BDT 4500', '2026-03-01'],
          ['202014088', 'Jane Smith', 'EEE', 'BDT 1200', '2026-04-10'],
        ]
      });
    } else {
      setReportData({
        columns: ['Metric', 'Category', 'Value'],
        rows: [
          ['Total Count', 'General', '45'],
          ['Total Value', 'Calculated', 'BDT 12,500'],
        ]
      });
    }
    
    setIsGenerating(false);
  };

  const handleExport = (type) => {
    if (!reportData) {
      alert("Please generate a report first before exporting.");
      return;
    }
    // Simulate export hook
    alert(`Initiating ${type} export for ${activeReport} from backend...`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Reports</h1>
        <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Generate and export summary reports</p>
      </div>

      {/* Report Types Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {reportTypes.map((report) => {
          const isActive = activeReport === report.id;
          return (
            <div
              key={report.id}
              onClick={() => {
                setActiveReport(report.id);
                setReportData(null); // Clear previous result when changing tab
              }}
              style={{
                padding: '20px',
                backgroundColor: isActive ? '#f8fafc' : 'white',
                border: `1px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isActive ? 'inset 0 0 0 1px #6366f1' : 'none'
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 6px 0' }}>{report.title}</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{report.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Filters Section */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 20px 0' }}>Filters</h2>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Date From</label>
            <input 
              type="date" 
              name="dateFrom" 
              value={filters.dateFrom} 
              onChange={handleFilterChange}
              style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', color: '#1e293b', fontFamily: 'inherit', height: '42px', boxSizing: 'border-box' }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Date To</label>
            <input 
              type="date" 
              name="dateTo" 
              value={filters.dateTo} 
              onChange={handleFilterChange}
              style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', color: '#1e293b', fontFamily: 'inherit', height: '42px', boxSizing: 'border-box' }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Student</label>
            <select 
              name="student" 
              value={filters.student} 
              onChange={handleFilterChange}
              style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', color: '#1e293b', fontFamily: 'inherit', backgroundColor: 'transparent', height: '42px', boxSizing: 'border-box' }}
            >
              <option>All Students</option>
              <option>Admin Student</option>
              <option>Rahul Ahmed</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Meal Type</label>
            <select 
              name="mealType" 
              value={filters.mealType} 
              onChange={handleFilterChange}
              style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', color: '#1e293b', fontFamily: 'inherit', backgroundColor: 'transparent', height: '42px', boxSizing: 'border-box' }}
            >
              <option>All Meals</option>
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Dinner</option>
            </select>
          </div>
          <button 
            onClick={handleGenerateReport}
            disabled={isGenerating}
            style={{
              padding: '0 24px',
              backgroundColor: isGenerating ? '#94a3b8' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              height: '42px',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isGenerating && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Export Options Section */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 20px 0' }}>Export Options</h2>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => handleExport('CSV')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
            <FileText size={16} /> CSV
          </button>
          <button onClick={() => handleExport('PDF')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
            <Download size={16} /> PDF
          </button>
          <button onClick={() => handleExport('Print')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
            <Printer size={16} /> Print
          </button>
        </div>

        {/* Dynamic State / Preview Box */}
        <div style={{
          marginTop: '24px',
          backgroundColor: reportData ? 'white' : '#f8fafc',
          border: reportData ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
          borderRadius: '8px',
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: reportData ? 'stretch' : 'center',
          justifyContent: reportData ? 'flex-start' : 'center',
          color: '#64748b',
          fontSize: '0.95rem',
          overflow: 'hidden'
        }}>
          {!reportData && !isGenerating && (
            <span>Report preview will appear here after generation</span>
          )}
          {isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#6366f1' }}>
               <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
               <span style={{ fontWeight: '500' }}>Fetching report data...</span>
            </div>
          )}
          {reportData && !isGenerating && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {reportData.columns.map((col, i) => (
                      <th key={i} style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#1e293b' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Global CSS for spinner animation inside standard JSX since Vite/React handles it gracefully or we can use inline styles but keyframes need regular css. Instead, we use lucide icons which spin naturally or standard app css. */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}