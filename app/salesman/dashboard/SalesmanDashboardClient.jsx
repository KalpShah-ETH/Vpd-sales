'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function SalesmanDashboardClient({ salesman }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('stock'); // stock, orders
  
  // Data lists
  const [stockItems, setStockItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [retailerForm, setRetailerForm] = useState({ shopName: '', phone: '' });
  const [retailerLoading, setRetailerLoading] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', isError: false });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [debouncedStockSearchQuery, setDebouncedStockSearchQuery] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [stockTotalPages, setStockTotalPages] = useState(1);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [canUploadStock, setCanUploadStock] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedStockSearchQuery(stockSearchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [stockSearchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'success') {
        showToast('Logged in successfully!');
        router.replace('/salesman/dashboard');
      }
    }
    Promise.all([
      fetchStock(1, ''),
      fetchOrders(),
      fetchRetailers()
    ]).finally(() => {
      setDataLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (dataLoaded) {
      fetchStock(stockPage, debouncedStockSearchQuery);
    }
  }, [stockPage, debouncedStockSearchQuery, dataLoaded]);



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
  const fetchStock = async (page = stockPage, search = debouncedStockSearchQuery) => {
    try {
      const res = await fetch(`/api/salesman/stock?page=${page}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setStockItems(data.items || []);
        setStockTotalPages(data.totalPages || 1);
        if (data.canUploadStock !== undefined) {
          setCanUploadStock(data.canUploadStock);
        }
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
      fetchStock(stockPage, debouncedStockSearchQuery);
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
          fetchStock(stockPage, debouncedStockSearchQuery);
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

  const handleCsvFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);

    try {
      const XLSX = await import('xlsx');
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
    } catch (err) {
      console.error(err);
      showErrorToast('Failed to load file reader library.');
    }
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
        body: JSON.stringify({ items: csvItems, fileName: csvFileName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload items');

      showToast(`Uploaded successfully! Added ${data.inserted} new medicines, skipped ${data.skipped} duplicates.`);
      setIsCsvModalOpen(false);
      setCsvItems([]);
      setCsvFileName('');
      setStockPage(1);
      setStockSearchQuery('');
      setDebouncedStockSearchQuery('');
      fetchStock(1, '');
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

  if (!dataLoaded) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Loading Dashboard...</p>
      </div>
    );
  }

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
              className={`sidebar-link ${activeTab === 'retailers' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('retailers');
                setIsSidebarOpen(false);
              }}
            >
              👥 Retailer Directory
            </button>
          </li>
          <li>
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
                <p style={{ color: 'var(--text-muted)' }}>
                  {canUploadStock 
                    ? `Upload or view products listed for ${salesman.companyName}. Updates take effect globally.` 
                    : `View products listed for ${salesman.companyName}. Stock catalogue is uploaded and managed by administrators.`
                  }
                </p>
              </div>
              {canUploadStock && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => setIsCsvModalOpen(true)}>
                    📄 Upload CSV/XLSX
                  </button>
                </div>
              )}
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

            <div className="table-container" style={{ paddingBottom: stockTotalPages > 1 ? '80px' : '0px' }}>
              {stockItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <p>{stockSearchQuery ? 'No matching medicines found.' : 'Your catalogue is empty.'}</p>
                  {!stockSearchQuery && <button className="btn btn-secondary" onClick={openAddStockModal}>Add Your First Medicine</button>}
                </div>
              ) : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Mfg</th>
                        <th>Qty.</th>
                        <th>Pack</th>
                      </tr>
                    </thead>
                    <tbody>
                       {stockItems.map((item) => (
                        <tr key={item.id} className={item.quantity === 0 ? 'out-of-stock' : ''} style={item.quantity === 0 ? { opacity: 0.6 } : {}}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: '600', fontSize: '16px' }}>{item.name}</div>
                            </div>
                          </td>
                          <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{item.mfg || '-'}</td>
                          <td style={{ fontWeight: '600' }}>{item.quantity} strips</td>
                          <td>
                            <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                              {item.pack || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mobile-card-list">
                    {stockItems.map((item) => (
                      <div key={item.id} className={`mobile-card ${item.quantity === 0 ? 'out-of-stock' : ''}`} style={item.quantity === 0 ? { opacity: 0.6 } : {}}>
                        <div className="mobile-card-header">
                          <span style={{ fontWeight: '700', fontSize: '16px' }}>{item.name}</span>
                        </div>
                        <div className="mobile-card-body">
                          <div><strong>Mfg:</strong> {item.mfg || '-'}</div>
                          <div><strong>Quantity:</strong> {item.quantity} strips</div>
                          <div><strong>Pack:</strong> {item.pack || '-'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Pagination Controls */}
            {stockTotalPages > 1 && (
              <div className="mobile-pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                <button 
                  className="btn btn-secondary" 
                  disabled={stockPage <= 1}
                  onClick={() => { setStockPage(prev => Math.max(1, prev - 1)); window.scrollTo(0, 0); }}
                >
                  ◀ Previous
                </button>
                <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>
                  Page {stockPage} of {stockTotalPages}
                </span>
                <button 
                  className="btn btn-secondary" 
                  disabled={stockPage >= stockTotalPages}
                  onClick={() => { setStockPage(prev => Math.min(stockTotalPages, prev + 1)); window.scrollTo(0, 0); }}
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
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Retailer Shop</th>
                        <th>Product</th>
                        <th>Quantity</th>
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
                              <a href={`tel:${order.retailer?.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{order.retailer?.phone}</a>
                            </div>
                          </td>
                          <td>{order.productName}</td>
                          <td>{order.quantity} strips</td>
                          <td>
                            <span className={`badge ${order.status === 'FULFILLED' ? 'badge-success' : 'badge-warning'}`}>
                              {order.status === 'FULFILLED' ? 'Delivered' : 'Pending delivery'}
                            </span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                          <td>
                            {order.status === 'PENDING' ? (
                              <button 
                                className="btn btn-success" 
                                style={{ padding: '2px 6px', fontSize: '12px' }} 
                                onClick={() => handleFulfillOrder(order.id)}
                              >
                                Mark Delivered
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Done</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mobile-card-list">
                    {filteredOrders.map((order) => (
                      <div key={order.id} className="mobile-card">
                        <div className="mobile-card-header">
                          <span style={{ fontWeight: '700', fontSize: '15px' }}>#{order.id}</span>
                          <span className={`badge ${order.status === 'FULFILLED' ? 'badge-success' : 'badge-warning'}`}>
                            {order.status === 'FULFILLED' ? 'Delivered' : 'Pending'}
                          </span>
                        </div>
                        <div className="mobile-card-body">
                          <div><strong>Retailer Shop:</strong> {order.retailer?.shopName}</div>
                          <div><strong>Phone:</strong> <a href={`tel:${order.retailer?.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{order.retailer?.phone}</a></div>
                          <div><strong>Product:</strong> {order.productName}</div>
                          <div><strong>Quantity:</strong> {order.quantity} strips</div>
                          <div><strong>Received At:</strong> {new Date(order.createdAt).toLocaleString()}</div>
                        </div>
                        {order.status === 'PENDING' && (
                          <div className="mobile-card-actions">
                            <button 
                              className="btn btn-success btn-full" 
                              style={{ minHeight: '32px', fontSize: '12px', padding: '2px 6px' }} 
                              onClick={() => handleFulfillOrder(order.id)}
                            >
                              Mark Delivered
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}



        {/* TAB 4: Retailer Directory */}
        {activeTab === 'retailers' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Retailer Directory</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage your assigned retailers and send login invitations via WhatsApp.</p>
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
                    {retailerLoading ? 'Creating...' : 'Create Retailer Account'}
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
                            WhatsApp: {retailer.phone}
                          </div>

                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Retailer login details are their whatsapp number.
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




      {/* MODAL: CSV Upload */}
      {canUploadStock && isCsvModalOpen && (
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
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isDanger = false }) {
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
