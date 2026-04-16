import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { inventoryItems } from '../../data/mock/adminData';

const columns = [
  { key: 'id', title: 'Item ID' },
  { key: 'item', title: 'Item Name' },
  { key: 'category', title: 'Category' },
  { key: 'stock', title: 'Current Stock' },
  { key: 'threshold', title: 'Threshold' },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function Inventory() {
  useDocumentTitle('Inventory');

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock levels for food and operational supplies."
      />

      <PageSection title="Inventory Ledger">
        <DataTable columns={columns} rows={inventoryItems} />
      </PageSection>
    </div>
  );
}