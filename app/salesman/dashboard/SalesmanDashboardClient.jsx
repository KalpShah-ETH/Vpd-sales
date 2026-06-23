'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function SalesmanDashboardClient({ salesman }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('stock'); // stock, orders, preview
  
  // Data lists
  const [stockItems, setStockItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState([]); // for previewing other companies
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', isError: false });
  const [stockSearchQuery, setStockSearchQuery] = useState('');
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
  const [editingItem, setEditingItem] = useState(null); // null means adding
  const [stockForm, setStockForm] = useState({
    name: '',
    price: '',
    quantity: ''
  });

  // Preview tab state
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    fetchStock();
    fetchOrders();
    fetchCatalog();
  }, []);

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
      setShowLogoutModal(false);
      router.push('/?role=salesman');
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

  const openAddStockModal = () => {
    setEditingItem(null);
    setStockForm({ name: '', price: '', quantity: '' });
    setIsStockModalOpen(true);
  };

  const openEditStockModal = (item) => {
    setEditingItem(item);
    setStockForm({
      name: item.name,
      price: item.price.toString(),
      quantity: item.quantity.toString()
    });
    setIsStockModalOpen(true);
  };

  // Calculate quick stats
  const orderStats = useMemo(() => {
    const pending = orders.filter(o => o.status === 'PENDING').length;
    const fulfilled = orders.filter(o => o.status === 'FULFILLED').length;
    const totalBilling = orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
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

  const filteredStock = useMemo(() => {
    if (!stockSearchQuery) return stockItems;
    const query = stockSearchQuery.toLowerCase();
    return stockItems.filter(item => item.name.toLowerCase().includes(query));
  }, [stockItems, stockSearchQuery]);

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
          <li style={{ marginTop: 'auto' }}>
            <button 
              className="sidebar-link" 
              onClick={() => {
                setShowLogoutModal(true);
                setIsSidebarOpen(false);
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
              <button className="btn btn-primary" onClick={openAddStockModal}>
                ➕ Add Product
              </button>
            </div>

            {/* Search filter */}
            <div style={{ marginBottom: '20px', display: 'flex', maxWidth: '400px' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Search by product name..."
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
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
                      <th>Price per Strip</th>
                      <th>Stock Quantity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((item) => (
                      <tr key={item.id} className={item.quantity === 0 ? 'out-of-stock' : ''} style={item.quantity === 0 ? { opacity: 0.6 } : {}}>
                        <td>
                          <div style={{ fontWeight: '600', fontSize: '16px' }}>{item.name}</div>
                        </td>
                        <td style={{ fontWeight: '600' }}>₹{item.price.toFixed(2)}</td>
                        <td style={{ fontWeight: '600' }}>{item.quantity} strips</td>
                        <td>
                          <span className={`badge ${item.quantity > 0 ? 'badge-success' : 'badge-warning'}`}>
                            {item.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ padding: '0 10px', fontSize: '14px' }} disabled={submittingId === item.id} onClick={() => openEditStockModal(item)}>
                              Edit Stock/Price
                            </button>
                            <button className="btn btn-danger" style={{ padding: '0 10px', fontSize: '14px' }} disabled={submittingId === item.id} onClick={() => handleDeleteStock(item.id)}>
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
                    const color = colors[index % colors.length];

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
                  <button className="back-btn" onClick={() => setSelectedCompanyId(null)} style={{ marginLeft: '-12px' }}>
                    ←
                  </button>
                  <span className="mobile-header-title">{selectedCompany?.companyName} Stock</span>
                </div>

                <div style={{ maxWidth: '600px', marginTop: '12px' }}>
                  {selectedCompany?.stockItems.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📦</div>
                      <p>This company has not posted any products yet.</p>
                    </div>
                  ) : (
                    selectedCompany?.stockItems.map((item) => (
                      <div key={item.id} className={`stock-card ${item.quantity === 0 ? 'out-of-stock' : ''}`}>
                        <div className="stock-header">
                          <div>
                            <div className="stock-title">{item.name}</div>
                            <div className="stock-qty">
                              {item.quantity > 0 ? `Stock: ${item.quantity} strips available` : 'Product Out of Stock'}
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
              </div>
            )}
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
                  min="0.01"
                  className="form-input"
                  required
                  value={stockForm.price}
                  onChange={(e) => setStockForm({ ...stockForm, price: e.target.value })}
                  placeholder="e.g. 150.00"
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

      {/* MODAL: Logout Confirmation */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚪</div>
            <h2 className="modal-title" style={{ marginBottom: '12px' }}>Confirm Logout</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to log out of your Salesman session?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                style={{ flex: 1 }} 
                onClick={handleLogout}
              >
                Okay
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
          <span>{toast.isError ? '✕' : '🔔'}</span> {toast.message}
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
