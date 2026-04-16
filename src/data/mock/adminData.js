export const adminStats = [
  { title: 'Total Residents', value: 412, trend: '+12 this month', tone: 'info' },
  { title: 'Pending Payments', value: 37, trend: '-5 from last week', tone: 'warning' },
  { title: 'Inventory Alerts', value: 6, trend: 'Rice and oil low', tone: 'danger' },
  { title: 'Revenue Collected', value: 2214000, trend: '+6.8%', tone: 'success', isCurrency: true },
];

export const residentRecords = [
  {
    id: 'ST-22014',
    name: 'Arafat Rahman',
    room: 'A-312',
    program: 'CSE',
    status: 'active',
    due: 5800,
  },
  {
    id: 'ST-22015',
    name: 'Fahim Islam',
    room: 'B-104',
    program: 'EEE',
    status: 'pending',
    due: 2100,
  },
  {
    id: 'ST-22016',
    name: 'Samiul Hasan',
    room: 'C-211',
    program: 'BBA',
    status: 'active',
    due: 0,
  },
  {
    id: 'ST-22017',
    name: 'Rahat Karim',
    room: 'D-402',
    program: 'Law',
    status: 'overdue',
    due: 9200,
  },
];

export const paymentQueue = [
  {
    id: 'PAY-8039',
    studentName: 'Arafat Rahman',
    billId: 'BILL-0426-01',
    amount: 5800,
    method: 'Bank Transfer',
    submittedAt: '2026-04-14',
    status: 'processing',
  },
  {
    id: 'PAY-8041',
    studentName: 'Fahim Islam',
    billId: 'BILL-0426-07',
    amount: 6100,
    method: 'bKash',
    submittedAt: '2026-04-14',
    status: 'pending',
  },
  {
    id: 'PAY-8042',
    studentName: 'Samiul Hasan',
    billId: 'BILL-0426-09',
    amount: 5600,
    method: 'Nagad',
    submittedAt: '2026-04-13',
    status: 'verified',
  },
];

export const inventoryItems = [
  { id: 'INV-1001', item: 'Rice', category: 'Food', stock: 120, threshold: 150, status: 'overdue' },
  { id: 'INV-1002', item: 'Soybean Oil', category: 'Food', stock: 35, threshold: 40, status: 'pending' },
  { id: 'INV-1003', item: 'Lentils', category: 'Food', stock: 90, threshold: 60, status: 'active' },
  { id: 'INV-1004', item: 'Detergent', category: 'Supplies', stock: 24, threshold: 20, status: 'active' },
];

export const auditLogs = [
  {
    id: 'LOG-1022',
    actor: 'Admin User',
    action: 'Approved payment PAY-8042',
    module: 'Payments',
    date: '2026-04-14',
  },
  {
    id: 'LOG-1021',
    actor: 'Billing Officer',
    action: 'Generated April invoices',
    module: 'Billing',
    date: '2026-04-13',
  },
  {
    id: 'LOG-1020',
    actor: 'Store Manager',
    action: 'Updated rice stock quantity',
    module: 'Inventory',
    date: '2026-04-12',
  },
];

export const monthlyRevenue = [
  { month: 'Jan', collected: 1780000, pending: 320000 },
  { month: 'Feb', collected: 1840000, pending: 280000 },
  { month: 'Mar', collected: 2030000, pending: 260000 },
  { month: 'Apr', collected: 2214000, pending: 190000 },
];

export const mealTrend = [
  { week: 'W1', consumed: 1790 },
  { week: 'W2', consumed: 1845 },
  { week: 'W3', consumed: 1912 },
  { week: 'W4', consumed: 1870 },
];

export const reportCards = [
  {
    title: 'Collection Efficiency',
    value: '92.1%',
    description: 'Compared to 87.4% last month',
  },
  {
    title: 'Average Meal Cost',
    value: 'BDT 82',
    description: 'Cost per meal over the last 30 days',
  },
  {
    title: 'Top Due Segment',
    value: '2nd Year Students',
    description: '34% of total pending amount',
  },
];