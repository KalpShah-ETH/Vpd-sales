'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function SalesmanDashboardClient({ salesman }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('stock'); // stock, orders, preview
  
  // Data lists
  const [stockItems, setStockItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState([]); // for previewing other companies
  const [retailers, setRetailers] = useState([]);
  const [retailerForm, setRetailerForm] = useState({ shopName: '', phone: '' });
  const [retailerLoading, setRetailerLoading] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', isError: false });
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL'); // ALL, PENDING, FULFILLED
  const [submittingId, setSubmittingId] = useState(null);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isDanger: false,
    confirmText: 'Confirm'
  });

  const triggerConfirm = (title, message, onConfirm, isDanger = false, confirmText = 'Confirm') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      isDanger,
      confirmText
    });
  };

  // Modals state
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvItems, setCsvItems] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvUploadLoading, setCsvUploadLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null means adding
  const [stockForm, setStockForm] = useState({
    name: '',
    price: '',
    quantity: '',
    mfg: '',
    pack: ''
  });

  // Preview tab state
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'success') {
        showToast('Logged in successfully!');
        router.replace('/salesman/dashboard');
      }
    }
    fetchStock();
    fetchOrders();
    fetchRetailers();
  }, []);

  useEffect(() => {
    if (activeTab === 'preview') fetchCatalog();
  }, [activeTab]);

  const fetchRetailers = async () => {
    try {
      const res = await fetch('/api/salesman/retailers');
      if (res.ok) {
        const data = await res.json();
        setRetailers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetailerSubmit = async (e) => {
    e.preventDefault();
    setRetailerLoading(true);
    try {
      const res = await fetch('/api/salesman/retailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retailerForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create retailer');

      showToast('Retailer account created successfully!');
      setRetailerForm({ shopName: '', phone: '' });
      fetchRetailers();
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setRetailerLoading(false);
    }
  };

  const showToast = (message) => {
    setToast({ visible: true, message, isError: false });
    setTimeout(() => {
      setToast({ visible: false, message: '', isError: false });
    }, 3000);
  };

  const showErrorToast = (message) => {
    setToast({ visible: true, message, isError: true });
    setTimeout(() => {
      setToast({ visible: false, message: '', isError: false });
    }, 3000);
  };

  // API Call: Fetch stock items
  const fetchStock = async () => {
    try {
      const res = await fetch('/api/salesman/stock');
      if (res.ok) {
        const data = await res.json();
        setStockItems(data);
      }
    } catch (err) {
      console.error(err);
      showErrorToast('Failed to load data. Please refresh.');
    }
  };

  // API Call: Fetch orders
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/salesman/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error(err);
      showErrorToast('Failed to load data. Please refresh.');
    }
  };

  // API Call: Fetch all companies (to satisfy: see all companies' stock)
  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/retailer/browse');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (err) {
      console.error(err);
      showErrorToast('Failed to load data. Please refresh.');
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/salesman/login', { method: 'DELETE' });
      router.push('/?role=salesman&logout=success');
    } catch (err) {
      console.error(err);
      showErrorToast('Logout failed');
    }
  };

  // Submit Stock Item (Add or Edit)
  const handleStockSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEditing = !!editingItem;
      const url = '/api/salesman/stock';
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing 
        ? { id: editingItem.id, ...stockForm }
        : stockForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');

      showToast(isEditing ? 'Product details updated!' : 'Product added to catalogue!');
      setIsStockModalOpen(false);
      fetchStock();
      fetchCatalog(); // Refresh preview catalog too
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Stock Item
  const handleDeleteStock = (id) => {
    if (submittingId) return;
    triggerConfirm(
      'Remove Product',
      'Are you sure you want to remove this product from the catalogue?',
      async () => {
        setSubmittingId(id);
        try {
          const res = await fetch(`/api/salesman/stock?id=${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete');
          showToast('Product removed from catalogue');
          fetchStock();
          fetchCatalog(); // Refresh preview catalog too
        } catch (err) {
          showErrorToast(err.message);
        } finally {
          setSubmittingId(null);
        }
      },
      true,
      'Remove'
    );
  };

  // Mark Order as Fulfilled
  const handleFulfillOrder = async (id) => {
    if (submittingId) return;
    setSubmittingId(id);
    try {
      const res = await fetch('/api/salesman/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'FULFILLED' })
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast('Order marked as fulfilled!');
      fetchOrders();
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse sheet to JSON array (2D array of rows)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const parsed = parseExcelContent(rows);
        setCsvItems(parsed);
      } catch (err) {
        console.error(err);
        showErrorToast('Failed to parse file. Make sure it is a valid CSV or XLSX file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseExcelContent = (rows) => {
    if (rows.length === 0) return [];

    // Find headers
    const firstRow = rows[0].map(cell => String(cell).trim().toLowerCase());
    
    let mfgIdx = -1;
    let nameIdx = -1;
    let packIdx = -1;
    let qtyIdx = -1;

    firstRow.forEach((cell, idx) => {
      if (cell.includes('mfg') || cell.includes('manufacturer')) {
        mfgIdx = idx;
      } else if (cell.includes('item name') || cell.includes('name') || cell.includes('medicine') || cell.includes('product')) {
        nameIdx = idx;
      } else if (cell.includes('pack')) {
        packIdx = idx;
      } else if (cell.includes('qty') || cell.includes('quantity') || cell.includes('stock')) {
        qtyIdx = idx;
      }
    });

    // Fallbacks if headers are missing
    if (nameIdx === -1) nameIdx = 1; // Default to column 2
    if (mfgIdx === -1) mfgIdx = 0;   // Default to column 1
    if (packIdx === -1) packIdx = 2;  // Default to column 3
    if (qtyIdx === -1) qtyIdx = 3;    // Default to column 4

    const items = [];
    // Start from row 1 (index 1) to skip headers if we found them
    const startIndex = 1; 

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const name = row[nameIdx] ? String(row[nameIdx]).trim() : '';
      const mfg = mfgIdx !== -1 && row[mfgIdx] ? String(row[mfgIdx]).trim() : '';
      const pack = packIdx !== -1 && row[packIdx] ? String(row[packIdx]).trim() : '';
      const quantityVal = qtyIdx !== -1 ? row[qtyIdx] : 0;
      
      const quantity = parseInt(quantityVal);

      if (name && !isNaN(quantity)) {
        items.push({
          name,
          mfg,
          pack,
          quantity,
          price: 0.0
        });
      }
    }
    return items;
  };

  const handleCsvUploadSubmit = async () => {
    if (csvItems.length === 0) return;
    setCsvUploadLoading(true);
    try {
      const res = await fetch('/api/salesman/stock/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: csvItems })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload items');

      showToast(`Uploaded successfully! Added ${data.inserted} new medicines, skipped ${data.skipped} duplicates.`);
      setIsCsvModalOpen(false);
      setCsvItems([]);
      setCsvFileName('');
      fetchStock();
      fetchCatalog();
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setCsvUploadLoading(false);
    }
  };

  const openAddStockModal = () => {
    setEditingItem(null);
    setStockForm({ name: '', price: '', quantity: '', mfg: '', pack: '' });
    setIsStockModalOpen(true);
  };

  const openEditStockModal = (item) => {
    setEditingItem(item);
    setStockForm({
      name: item.name,
      price: item.price !== undefined ? item.price.toString() : '0',
      quantity: item.quantity.toString(),
      mfg: item.mfg || '',
      pack: item.pack || ''
    });
    setIsStockModalOpen(true);
  };

  // Calculate quick stats
  const orderStats = useMemo(() => {
    const pending = orders.filter(o => o.status === 'PENDING').length;
    const fulfilled = orders.filter(o => o.status === 'FULFILLED').length;
    const totalBilling = orders.filter(o => o.status === 'FULFILLED').reduce((sum, o) => sum + (o.quantity * o.price), 0);
    return {
      total: orders.length,
      pending,
      fulfilled,
      billing: totalBilling
    };
  }, [orders]);

  // Selected company's details for preview
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return catalog.find(c => c.id === selectedCompanyId);
  }, [catalog, selectedCompanyId]);

  const ITEMS_PER_PAGE = 50;

  const filteredStock = useMemo(() => {
    let result = stockItems;
    if (stockSearchQuery) {
      const query = stockSearchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query) ||
        (item.mfg && item.mfg.toLowerCase().includes(query))
      );
    }
    return result;
  }, [stockItems, stockSearchQuery]);

  const stockTotalPages = Math.ceil(filteredStock.length / ITEMS_PER_PAGE);

  const paginatedStock = useMemo(() => {
    const start = (stockPage - 1) * ITEMS_PER_PAGE;
    return filteredStock.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStock, stockPage]);

  const filteredPreviewStock = useMemo(() => {
    if (!selectedCompany?.stockItems) return [];
    if (!debouncedSearchQuery) return selectedCompany.stockItems;
    const q = debouncedSearchQuery.toLowerCase();
    return selectedCompany.stockItems.filter(item => 
      item.name.toLowerCase().includes(q) ||
      (item.mfg && item.mfg.toLowerCase().includes(q))
    );
  }, [selectedCompany?.stockItems, debouncedSearchQuery]);

  const previewTotalPages = Math.ceil(filteredPreviewStock.length / ITEMS_PER_PAGE);

  const paginatedPreviewStock = useMemo(() => {
    const start = (previewPage - 1) * ITEMS_PER_PAGE;
    return filteredPreviewStock.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPreviewStock, previewPage]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (orderSearchQuery) {
      const query = orderSearchQuery.toLowerCase();
      result = result.filter(order => 
        order.retailer?.shopName?.toLowerCase().includes(query) ||
        order.productName?.toLowerCase().includes(query)
      );
    }
    if (orderStatusFilter !== 'ALL') {
      result = result.filter(order => order.status === orderStatusFilter);
    }
    return result;
  }, [orders, orderSearchQuery, orderStatusFilter]);

  return (
    <div className="dashboard-grid">
      {/* Sidebar Backdrop for Mobile */}
      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="sidebar-title" style={{ fontSize: '18px' }}>
            <span>📦</span> {salesman.companyName}
          </div>
          <button 
            className="back-btn sidebar-close-btn"
            onClick={() => setIsSidebarOpen(false)}
            style={{
              color: 'var(--text-muted)'
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '0 16px', margin: '-16px 0 16px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
          Rep: {salesman.name}
        </div>
        <ul className="sidebar-menu" style={{ flex: 1 }}>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'stock' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('stock');
                setIsSidebarOpen(false);
              }}
            >
              📋 Stock Catalogue
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('orders');
                setIsSidebarOpen(false);
              }}
            >
              📥 Orders Received
              {orderStats.pending > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 'auto', borderRadius: '4px', padding: '2px 6px' }}>
                  {orderStats.pending}
                </span>
              )}
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('preview');
                setSelectedCompanyId(null);
                setIsSidebarOpen(false);
              }}
            >
              👀 Browse Catalogues
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'retailers' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('retailers');
                setIsSidebarOpen(false);
              }}
            >
              👥 Retailer Directory
            </button>
          </li>
          <li style={{ marginTop: 'auto' }}>
            <button 
              className="sidebar-link" 
              onClick={() => {
                setIsSidebarOpen(false);
                triggerConfirm(
                  'Confirm Logout',
                  'Are you sure you want to log out of your Salesman session?',
                  handleLogout,
                  true,
                  'Log Out'
                );
              }} 
              style={{ color: 'var(--danger)' }}
            >
              🚪 Log Out
            </button>
          </li>
        </ul>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        <button 
          className="menu-toggle-btn" 
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open sidebar menu"
        >
          ☰
        </button>
        
        {/* TAB 1: Stock Catalogue Management */}
        {activeTab === 'stock' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">My Stock Catalogue</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage products listed for {salesman.companyName}. Updates take effect instantly.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setIsCsvModalOpen(true)}>
                  📄 Upload CSV/XLSX
                </button>
                <button className="btn btn-primary" onClick={openAddStockModal}>
                  ➕ Add Product
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div style={{ marginBottom: '20px', display: 'flex', maxWidth: '400px' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Search by product name or manufacturer..."
                value={stockSearchQuery}
                onChange={(e) => {
                  setStockSearchQuery(e.target.value);
                  setStockPage(1);
                }}
              />
            </div>

            <div className="table-container">
              {filteredStock.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <p>{stockSearchQuery ? 'No matching products found.' : 'Your catalogue is empty.'}</p>
                  {!stockSearchQuery && <button className="btn btn-secondary" onClick={openAddStockModal}>Add Your First Product</button>}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Mfg</th>
                      <th>Qty.</th>
                      <th>Pack</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                     {paginatedStock.map((item) => (
                      <tr key={item.id} className={item.quantity === 0 ? 'out-of-stock' : ''} style={item.quantity === 0 ? { opacity: 0.6 } : {}}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: '600', fontSize: '16px' }}>{item.name}</div>
                            {item.isAdminGlobal && (
                              <span className="badge badge-warning" style={{ fontSize: '11px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                                🌐 Shared Stock
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{item.mfg || '-'}</td>
                        <td style={{ fontWeight: '600' }}>{item.quantity} strips</td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                            {item.pack || '-'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0 10px', fontSize: '14px' }} 
                              disabled={submittingId === item.id || item.isAdminGlobal} 
                              onClick={() => openEditStockModal(item)}
                              title={item.isAdminGlobal ? "Shared Admin Stock is read-only" : ""}
                            >
                              Edit Stock/Price
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '0 10px', fontSize: '14px' }} 
                              disabled={submittingId === item.id || item.isAdminGlobal} 
                              onClick={() => handleDeleteStock(item.id)}
                              title={item.isAdminGlobal ? "Shared Admin Stock is read-only" : ""}
                            >
                              {submittingId === item.id ? 'Removing...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {stockTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                <button 
                  className="btn btn-secondary" 
                  disabled={stockPage <= 1}
                  onClick={() => setStockPage(prev => Math.max(1, prev - 1))}
                >
                  ◀ Previous
                </button>
                <span style={{ fontWeight: '600' }}>
                  Page {stockPage} of {stockTotalPages}
                </span>
                <button 
                  className="btn btn-secondary" 
                  disabled={stockPage >= stockTotalPages}
                  onClick={() => setStockPage(prev => Math.min(stockTotalPages, prev + 1))}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Orders Feed */}
        {activeTab === 'orders' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Orders Received</h1>
                <p style={{ color: 'var(--text-muted)' }}>Orders placed by retailers for {salesman.companyName}. Make sure to deliver on WhatsApp confirmations.</p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-title">Total Orders Received</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{orderStats.total}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Pending Fulfillment</div>
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{orderStats.pending}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Fulfilled Billing Value</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>₹{orderStats.billing.toFixed(2)}</div>
              </div>
            </div>

            {/* Search and status filters */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', maxWidth: '600px' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Search by shop or product name..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
              />
              <select
                className="form-input"
                style={{ width: '180px' }}
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Delivery</option>
                <option value="FULFILLED">Delivered</option>
              </select>
            </div>

            <div className="table-container">
              {filteredOrders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🧾</div>
                  <p>No matching orders found.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Retailer Shop</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Billing Total</th>
                      <th>WhatsApp Delivery Status</th>
                      <th>Received At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>#{order.id}</td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{order.retailer?.shopName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            📞 <a href={`tel:${order.retailer?.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{order.retailer?.phone}</a>
                          </div>
                        </td>
                        <td>{order.productName}</td>
                        <td>{order.quantity} strips</td>
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>
                          ₹{(order.quantity * order.price).toFixed(2)}
                        </td>
                        <td>
                          <span className={`badge ${order.status === 'FULFILLED' ? 'badge-success' : 'badge-warning'}`}>
                            {order.status === 'FULFILLED' ? '✓ Delivered' : '⏳ Pending delivery'}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {new Date(order.createdAt).toLocaleString()}
                        </td>
                        <td>
                          {order.status === 'PENDING' ? (
                            <button 
                              className="btn btn-success" 
                              style={{ padding: '0 12px', fontSize: '13px' }} 
                              onClick={() => handleFulfillOrder(order.id)}
                            >
                              ✓ Mark Delivered
                            </button>
                          ) : (
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Done</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Preview Retailer View */}
        {activeTab === 'preview' && (
          <div>
            {!selectedCompanyId ? (
              <div>
                <div className="dashboard-header">
                  <div>
                    <h1 className="dashboard-title">Pharma Companies Stock Catalogues</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Here is a replica of what the Retailers see. You can check stocks across all other companies.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginTop: '16px' }}>
                  {catalog.map((company, index) => {
                    const initials = company.companyName.substring(0, 2).toUpperCase();
                    // Custom colors for initials badges
                    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                    const color = colors[company.id % colors.length];

                    return (
                      <button 
                        key={company.id} 
                        className="company-card"
                        onClick={() => setSelectedCompanyId(company.id)}
                      >
                        <div className="avatar" style={{ backgroundColor: color }}>
                          {initials}
                        </div>
                        <div className="company-info">
                          <div className="company-name">{company.companyName}</div>
                          <div className="company-meta">{company.stockItems.length} Products Available</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="mobile-header" style={{ position: 'static', padding: '16px 0', borderBottom: 'none', background: 'none' }}>
                  <button className="back-btn" onClick={() => { setSelectedCompanyId(null); setSearchQuery(''); setPreviewPage(1); window.scrollTo(0, 0); }} style={{ marginLeft: '-12px' }}>
                    ←
                  </button>
                  <span className="mobile-header-title">{selectedCompany?.companyName} Stock</span>
                </div>

                <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '600px' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', padding: '12px 48px 12px 16px', fontSize: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
                    placeholder="🔍 Search medicines by name or manufacturer..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPreviewPage(1);
                    }}
                  />
                  {searchQuery !== debouncedSearchQuery && (
                    <div style={{ position: 'absolute', right: '16px', top: '14px', display: 'flex', alignItems: 'center' }}>
                      <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderTopColor: 'var(--primary)', margin: 0 }}></span>
                    </div>
                  )}
                </div>

                <div style={{ maxWidth: '600px', marginTop: '12px' }}>
                  {filteredPreviewStock.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📦</div>
                      <p>
                        {selectedCompany?.stockItems.length === 0 
                          ? 'This company has not posted any products yet.' 
                          : 'No matching medicines found.'}
                      </p>
                    </div>
                  ) : (
                    paginatedPreviewStock.map((item) => (
                      <div key={item.id} className={`stock-card ${item.quantity === 0 ? 'out-of-stock' : ''}`}>
                        <div className="stock-header">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div className="stock-title" style={{ fontWeight: '700', fontSize: '18px' }}>{item.name}</div>
                              {item.isAdminGlobal && (
                                <span className="badge badge-warning" style={{ fontSize: '11px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                                  🌐 Shared Stock
                                </span>
                              )}
                            </div>
                            <div className="stock-qty">
                              {item.quantity > 0 ? `Stock: ${item.quantity} strips available` : 'Product Out of Stock'}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px', fontSize: '13px' }}>
                              {item.mfg && (
                                <span style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                  🏭 {item.mfg}
                                </span>
                              )}
                              {item.pack && (
                                <span style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                  📦 Pack: {item.pack}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="stock-price">₹{item.price.toFixed(2)}</div>
                        </div>
                        <div className="stock-actions" style={{ marginTop: '8px' }}>
                          <span className="badge badge-neutral" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px', borderRadius: 'var(--radius-sm)' }}>
                            👁️ View Only (Catalogue Preview)
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination Controls */}
                {previewTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px', paddingBottom: '20px', maxWidth: '600px' }}>
                    <button 
                      className="btn btn-secondary" 
                      disabled={previewPage <= 1}
                      onClick={() => {
                        setPreviewPage(prev => Math.max(1, prev - 1));
                        window.scrollTo(0, 0);
                      }}
                    >
                      ◀ Previous
                    </button>
                    <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>
                      Page {previewPage} of {previewTotalPages}
                    </span>
                    <button 
                      className="btn btn-secondary" 
                      disabled={previewPage >= previewTotalPages}
                      onClick={() => {
                        setPreviewPage(prev => Math.min(previewTotalPages, prev + 1));
                        window.scrollTo(0, 0);
                      }}
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Retailer Directory */}
        {activeTab === 'retailers' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Retailer Directory</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage your assigned retailers, generate direct login links, and send invitations via WhatsApp.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '16px' }}>
              {/* Form to Add Retailer */}
              <div className="card" style={{ padding: '20px', height: 'fit-content' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Add New Retailer</h2>
                <form onSubmit={handleRetailerSubmit}>
                  <div className="form-group">
                    <label className="form-label">Shop Name</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={retailerForm.shopName}
                      onChange={(e) => setRetailerForm({ ...retailerForm, shopName: e.target.value })}
                      placeholder="e.g. Apollo Pharmacy, Sector 15"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">WhatsApp Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      required
                      value={retailerForm.phone}
                      onChange={(e) => setRetailerForm({ ...retailerForm, phone: e.target.value })}
                      placeholder="e.g. 9876543210 (10 digits)"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-full" 
                    disabled={retailerLoading}
                    style={{ marginTop: '16px' }}
                  >
                    {retailerLoading ? 'Creating...' : 'Create Retailer & Link'}
                  </button>
                </form>
              </div>

              {/* List of Retailers */}
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>My Assigned Retailers</h2>
                {retailers.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <div className="empty-icon">👥</div>
                    <p>No retailers registered yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                    {retailers.map((retailer) => {
                      const loginLink = typeof window !== 'undefined' ? `${window.location.origin}/r/${retailer.token}` : '';
                      let cleanPhone = retailer.phone.replace(/\D/g, '');
                      if (cleanPhone.length === 10) {
                        cleanPhone = '91' + cleanPhone;
                      }
                      const message = `Hello, this is ${salesman.name} representing ${salesman.companyName}. Here is your direct link to view our catalog and place orders: ${loginLink}`;
                      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

                      return (
                        <div 
                          key={retailer.id} 
                          style={{ 
                            border: '1px solid var(--border-color)', 
                            borderRadius: 'var(--radius-md)', 
                            padding: '16px',
                            backgroundColor: 'var(--bg-primary)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontWeight: '700', fontSize: '16px' }}>{retailer.shopName}</div>
                            <span className={`badge ${retailer.active ? 'badge-success' : 'badge-neutral'}`}>
                              {retailer.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            📞 WhatsApp: {retailer.phone}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ flex: 1, minWidth: '100px', fontSize: '13px', padding: '8px 12px' }}
                              onClick={() => {
                                navigator.clipboard.writeText(loginLink);
                                showToast('Copied to clipboard!');
                              }}
                            >
                              📋 Copy Link
                            </button>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary"
                              style={{ 
                                flex: 1, 
                                minWidth: '120px', 
                                fontSize: '13px', 
                                padding: '8px 12px', 
                                display: 'inline-flex', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                textDecoration: 'none'
                              }}
                            >
                              💬 Send via WhatsApp
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: Stock Add/Edit */}
      {isStockModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingItem ? 'Edit Catalogue Item' : 'Add Product to Catalogue'}
              </h2>
              <button className="modal-close" onClick={() => setIsStockModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleStockSubmit}>
              <div className="form-group">
                <label className="form-label">Product Name / Description</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={stockForm.name}
                  onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
                  placeholder="e.g. Paracetamol 500mg (Box of 100)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Price per Strip (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.00"
                  className="form-input"
                  value={stockForm.price}
                  onChange={(e) => setStockForm({ ...stockForm, price: e.target.value })}
                  placeholder="e.g. 150.00 (optional)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Manufacturer (Mfg)</label>
                <input
                  type="text"
                  className="form-input"
                  value={stockForm.mfg}
                  onChange={(e) => setStockForm({ ...stockForm, mfg: e.target.value })}
                  placeholder="e.g. Cipla, GSK"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pack Size</label>
                <input
                  type="text"
                  className="form-input"
                  value={stockForm.pack}
                  onChange={(e) => setStockForm({ ...stockForm, pack: e.target.value })}
                  placeholder="e.g. 10 strips, 10x10"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Available Stock Quantity (Strips)</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  required
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  placeholder="e.g. 250"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsStockModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CSV Upload */}
      {isCsvModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Bulk Upload Medicines (CSV)</h2>
              <button 
                className="modal-close" 
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvItems([]);
                  setCsvFileName('');
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '8px 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px', lineHeight: '1.5' }}>
                Upload a CSV or XLSX file containing your stock catalog. The system will look for column headers like <strong>mfg</strong>, <strong>item name</strong>, <strong>pack</strong>, and <strong>Qty.</strong>. 
                If headers are missing, we default to: Column 1 = Mfg, Column 2 = Item Name, Column 3 = Pack, Column 4 = Qty. Duplicates will be skipped automatically.
              </p>
              
              <div className="form-group" style={{ border: '2px dashed var(--border-color)', padding: '24px', borderRadius: 'var(--radius-md)', textAlign: 'center', backgroundColor: 'var(--bg-primary)', marginBottom: '16px' }}>
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,.xlsx"
                  onChange={handleCsvFileChange}
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor="csv-file-input" 
                  style={{ cursor: 'pointer', display: 'block', fontWeight: '600', color: 'var(--primary)' }}
                >
                  {csvFileName ? `📄 Selected: ${csvFileName}` : '📂 Click to choose a CSV/XLSX file'}
                </label>
                {csvFileName && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Click again to change file
                  </p>
                )}
              </div>

              {csvItems.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-muted)' }}>
                    Parsed Preview ({csvItems.length} items found)
                  </h3>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px', backgroundColor: 'var(--bg-primary)' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontWeight: '700' }}>
                          <th style={{ padding: '6px' }}>Mfg</th>
                          <th style={{ padding: '6px' }}>Medicine Name</th>
                          <th style={{ padding: '6px' }}>Pack</th>
                          <th style={{ padding: '6px' }}>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvItems.slice(0, 100).map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{item.mfg}</td>
                            <td style={{ padding: '6px', fontWeight: '500' }}>{item.name}</td>
                            <td style={{ padding: '6px' }}>{item.pack}</td>
                            <td style={{ padding: '6px' }}>{item.quantity}</td>
                          </tr>
                        ))}
                        {csvItems.length > 100 && (
                          <tr>
                            <td colSpan="4" style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              ... and {csvItems.length - 100} more items
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvItems([]);
                  setCsvFileName('');
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={csvItems.length === 0 || csvUploadLoading}
                onClick={handleCsvUploadSubmit}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {csvUploadLoading ? (
                  <>
                    <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: '#ffffff', margin: 0 }}></span>
                    <span>Uploading...</span>
                  </>
                ) : (
                  `Upload ${csvItems.length} Products`
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Shared Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* TOAST POPUP NOTIFICATION */}
      {toast.visible && (
        <div className={`toast ${toast.isError ? 'toast-error' : ''}`}>
          <span>{toast.isError ? '✕' : '✓'}</span> {toast.message}
        </div>
      )}
    </div>
  );
}

// SHARED GENERIC CONFIRM MODAL COMPONENT
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Log Out', isDanger = false }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>{isDanger ? '⚠️' : '❓'}</div>
        <h2 className="modal-title" style={{ marginBottom: '12px' }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ flex: 1 }} 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
            style={{ flex: 1 }} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
