export const studentSummary = [
  { title: 'Monthly Bill', value: 5800, unit: 'BDT', trend: '+4.2%', tone: 'warning' },
  { title: 'Meals This Month', value: 84, unit: 'meals', trend: '+8%', tone: 'success' },
  { title: 'Remaining Balance', value: 2300, unit: 'BDT', trend: 'Safe', tone: 'info' },
  { title: 'Pending Payments', value: 1, unit: 'invoice', trend: 'Action needed', tone: 'danger' },
];

export const studentMealHistory = [
  { id: 'M-1001', date: '2026-04-12', type: 'Dinner', quantity: 1, cost: 95, status: 'active' },
  { id: 'M-1002', date: '2026-04-12', type: 'Lunch', quantity: 1, cost: 85, status: 'active' },
  { id: 'M-1003', date: '2026-04-11', type: 'Breakfast', quantity: 1, cost: 45, status: 'active' },
  { id: 'M-1004', date: '2026-04-10', type: 'Dinner', quantity: 0, cost: 0, status: 'draft' },
];

export const studentBills = [
  {
    id: 'BILL-0426-01',
    period: 'Apr 2026',
    mealCost: 5100,
    utility: 350,
    service: 350,
    total: 5800,
    status: 'pending',
    dueDate: '2026-04-20',
  },
  {
    id: 'BILL-0326-01',
    period: 'Mar 2026',
    mealCost: 4900,
    utility: 350,
    service: 350,
    total: 5600,
    status: 'paid',
    dueDate: '2026-03-20',
  },
  {
    id: 'BILL-0226-01',
    period: 'Feb 2026',
    mealCost: 4700,
    utility: 350,
    service: 350,
    total: 5400,
    status: 'paid',
    dueDate: '2026-02-20',
  },
];

export const studentPayments = [
  {
    id: 'PAY-7842',
    billId: 'BILL-0326-01',
    method: 'bKash',
    amount: 5600,
    date: '2026-03-18',
    status: 'verified',
    reference: 'TXN9K2F34',
  },
  {
    id: 'PAY-7712',
    billId: 'BILL-0226-01',
    method: 'Nagad',
    amount: 5400,
    date: '2026-02-18',
    status: 'verified',
    reference: 'TXN1F5R21',
  },
  {
    id: 'PAY-8039',
    billId: 'BILL-0426-01',
    method: 'Bank Transfer',
    amount: 5800,
    date: '2026-04-14',
    status: 'processing',
    reference: 'TXN8B4H56',
  },
];

export const studentProfile = {
  name: 'Osmany Hall Student Resident',
  studentId: 'ST-22014',
  email: 'student@example.com',
  phone: '+880 1711-000000',
  program: 'BSc in Computer Science',
  roomNo: 'A-312',
  joinedAt: '2025-01-10',
  emergencyContact: '+880 1811-111111',
};

export const studentNotifications = [
  {
    id: 'NTF-01',
    title: 'April bill published',
    description: 'Your monthly bill is now available. Please pay before due date.',
    date: '2026-04-13',
    isRead: false,
  },
  {
    id: 'NTF-02',
    title: 'Payment submitted successfully',
    description: 'Your payment is under verification by admin.',
    date: '2026-04-14',
    isRead: false,
  },
  {
    id: 'NTF-03',
    title: 'Meal cutoff reminder',
    description: 'Tomorrow meal changes must be submitted before 10:00 PM.',
    date: '2026-04-14',
    isRead: true,
  },
];