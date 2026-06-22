'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('salesmen'); // salesmen, retailers, orders
  
  // Data lists
  const [salesmen, setSalesmen] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalOrders: 0, pendingOrders: 0, fulfilledOrders: 0 });

  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isSalesmanModalOpen, setIsSalesmanModalOpen] = useState(false);
  const [editingSalesman, setEditingSalesman] = useState(null); // null means adding new
  const [salesmanForm, setSalesmanForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    username: '',
    password: '',
    active: true
  });

  const [isRetailerModalOpen, setIsRetailerModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState(null);
  const [retailerForm, setRetailerForm] = useState({
    shopName: '',
    phone: '',
    active: true
  });

  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');

  // Host URL for links
  const [hostUrl, setHostUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostUrl(window.location.origin);
    }
    fetchSalesmen();
    fetchRetailers();
    fetchOrders();
  }, []);

  // Show toast notification
  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => {
      setToast({ visible: false, message: '' });
    }, 3000);
  };

  // API Call: Fetch Salesmen
  const fetchSalesmen = async () => {
    try {
      const res = await fetch('/api/admin/salesman');
      if (res.ok) {
        const data = await res.json();
        setSalesmen(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Fetch Retailers
  const fetchRetailers = async () => {
    try {
      const res = await fetch('/api/admin/retailer');
      if (res.ok) {
        const data = await res.json();
        setRetailers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Fetch Orders
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        
        // Calculate statistics
        const pending = data.filter(o => o.status === 'PENDING').length;
        const fulfilled = data.filter(o => o.status === 'FULFILLED').length;
        setStats({
          totalOrders: data.length,
          pendingOrders: pending,
          fulfilledOrders: fulfilled
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Admin Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
      router.push('/admin/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Save Salesman (Create or Edit)
  const handleSalesmanSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEditing = !!editingSalesman;
      const url = '/api/admin/salesman';
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing 
        ? { id: editingSalesman.id, ...salesmanForm }
        : salesmanForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save salesman');

      showToast(isEditing ? 'Salesman updated successfully!' : 'Salesman created successfully!');
      setIsSalesmanModalOpen(false);
      fetchSalesmen();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Salesman
  const handleDeleteSalesman = async (id) => {
    if (!confirm('Are you sure you want to delete this salesman? All their products and orders will also be permanently deleted.')) return;
    try {
      const res = await fetch(`/api/admin/salesman?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Salesman deleted successfully');
      fetchSalesmen();
    } catch (err) {
      alert(err.message);
    }
  };

  // Open Salesman Modal for Create
  const openAddSalesmanModal = () => {
    setEditingSalesman(null);
    setSalesmanForm({
      name: '',
      companyName: '',
      phone: '',
      username: '',
      password: '',
      active: true
    });
    setIsSalesmanModalOpen(true);
  };

  // Open Salesman Modal for Edit
  const openEditSalesmanModal = (salesman) => {
    setEditingSalesman(salesman);
    setSalesmanForm({
      name: salesman.name,
      companyName: salesman.companyName,
      phone: salesman.phone,
      username: salesman.username,
      password: '', // Leave blank to keep existing
      active: salesman.active
    });
    setIsSalesmanModalOpen(true);
  };

  // Save Retailer (Single Create or Edit)
  const handleRetailerSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEditing = !!editingRetailer;
      const url = '/api/admin/retailer';
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing
        ? { id: editingRetailer.id, ...retailerForm }
        : retailerForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save retailer');

      showToast(isEditing ? 'Retailer updated successfully!' : 'Retailer created successfully!');
      setIsRetailerModalOpen(false);
      fetchRetailers();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Retailer Active Status
  const toggleRetailerStatus = async (retailer) => {
    try {
      const res = await fetch('/api/admin/retailer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: retailer.id, active: !retailer.active })
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      showToast(`Retailer ${!retailer.active ? 'activated' : 'deactivated'} successfully!`);
      fetchRetailers();
    } catch (err) {
      alert(err.message);
    }
  };

  // Regenerate Retailer Link/Token
  const regenerateRetailerLink = async (id) => {
    if (!confirm('This will invalidate their existing private link. Regenerate link now?')) return;
    try {
      const res = await fetch('/api/admin/retailer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, regenerateToken: true })
      });
      if (!res.ok) throw new Error('Failed to regenerate link');
      showToast('New link generated successfully!');
      fetchRetailers();
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete Retailer
  const handleDeleteRetailer = async (id) => {
    if (!confirm('Are you sure you want to delete this retailer? All their orders will be deleted.')) return;
    try {
      const res = await fetch(`/api/admin/retailer?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Retailer deleted successfully');
      fetchRetailers();
    } catch (err) {
      alert(err.message);
    }
  };

  // Bulk Upload Action
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkCsvText.trim()) return;
    setLoading(true);

    try {
      // Parse CSV Text (Format: Shop Name, Phone)
      const lines = bulkCsvText.split('\n');
      const parsedRetailers = [];

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // Simple comma split
        const parts = line.split(',');
        if (parts.length >= 2) {
          const shopName = parts[0].trim();
          const phone = parts[1].trim();
          if (shopName && phone && shopName !== 'Shop Name') {
            parsedRetailers.push({ shopName, phone });
          }
        }
      }

      if (parsedRetailers.length === 0) {
        throw new Error('No valid retailer rows found. Format must be: Shop Name, Phone Number');
      }

      const res = await fetch('/api/admin/retailer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailers: parsedRetailers })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk upload failed');

      showToast(`Successfully uploaded ${data.count} retailers!`);
      setIsBulkUploadModalOpen(false);
      setBulkCsvText('');
      fetchRetailers();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy private link to clipboard
  const handleCopyLink = (token) => {
    const link = `${hostUrl}/r/${token}`;
    navigator.clipboard.writeText(link);
    showToast('Copied private link to clipboard!');
  };

  // Search Filtered Retailers
  const filteredRetailers = useMemo(() => {
    if (!searchQuery) return retailers;
    const query = searchQuery.toLowerCase();
    return retailers.filter(r => 
      r.shopName.toLowerCase().includes(query) || 
      r.phone.includes(query)
    );
  }, [retailers, searchQuery]);

  return (
    <div className="dashboard-grid">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <span>🛡️</span> VPD Admin
        </div>
        <ul className="sidebar-menu">
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'salesmen' ? 'active' : ''}`}
              onClick={() => setActiveTab('salesmen')}
            >
              👤 Salesmen Catalogues
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'retailers' ? 'active' : ''}`}
              onClick={() => setActiveTab('retailers')}
            >
              🏪 Retailer Access Links
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              📊 System Orders Feed
            </button>
          </li>
          <li style={{ marginTop: 'auto' }}>
            <button className="sidebar-link" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
              🚪 Log Out
            </button>
          </li>
        </ul>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* TAB 1: Salesmen Management */}
        {activeTab === 'salesmen' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Salesmen Catalogues</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage salesmen accounts and catalog ownership.</p>
              </div>
              <button className="btn btn-primary" onClick={openAddSalesmanModal}>
                ➕ Add New Salesman
              </button>
            </div>

            <div className="table-container">
              {salesmen.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👤</div>
                  <p>No salesmen registered yet.</p>
                  <button className="btn btn-secondary" onClick={openAddSalesmanModal}>Add Your First Salesman</button>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Salesman Details</th>
                      <th>Company Representing</th>
                      <th>WhatsApp Routing</th>
                      <th>Dashboard Login</th>
                      <th>Catalogue Stats</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesmen.map((salesman) => (
                      <tr key={salesman.id}>
                        <td>
                          <div style={{ fontWeight: '600' }}>{salesman.name}</div>
                        </td>
                        <td>
                          <div className="badge badge-success" style={{ textTransform: 'uppercase' }}>
                            {salesman.companyName}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{salesman.phone}</td>
                        <td style={{ fontWeight: '500' }}>{salesman.username}</td>
                        <td style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                          📦 {salesman._count.stockItems} items | 🧾 {salesman._count.orders} orders
                        </td>
                        <td>
                          <span className={`badge ${salesman.active ? 'badge-success' : 'badge-warning'}`}>
                            {salesman.active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '14px' }} onClick={() => openEditSalesmanModal(salesman)}>
                              Edit
                            </button>
                            <button className="btn btn-danger" style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '14px' }} onClick={() => handleDeleteSalesman(salesman.id)}>
                              Delete
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

        {/* TAB 2: Retailers Management */}
        {activeTab === 'retailers' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Retailer Access Links</h1>
                <p style={{ color: 'var(--text-muted)' }}>Pre-load shop databases and generate one-click secure access URLs.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setIsBulkUploadModalOpen(true)}>
                  📥 Bulk Upload CSV
                </button>
                <button className="btn btn-primary" onClick={() => {
                  setEditingRetailer(null);
                  setRetailerForm({ shopName: '', phone: '', active: true });
                  setIsRetailerModalOpen(true);
                }}>
                  ➕ Add Single Retailer
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div style={{ marginBottom: '20px', display: 'flex', maxWidth: '400px' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', minHeight: '40px', height: '40px' }}
                placeholder="Search by shop name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="table-container">
              {filteredRetailers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏪</div>
                  <p>No retailers found.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shop Name</th>
                      <th>Phone Number</th>
                      <th>Status</th>
                      <th>Orders Placed</th>
                      <th>Unique Private Link</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRetailers.map((retailer) => (
                      <tr key={retailer.id}>
                        <td>
                          <div style={{ fontWeight: '600' }}>{retailer.shopName}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{retailer.phone}</td>
                        <td>
                          <span className={`badge ${retailer.active ? 'badge-success' : 'badge-warning'}`}>
                            {retailer.active ? 'Authenticated' : 'Deactivated'}
                          </span>
                        </td>
                        <td>🛒 {retailer._count.orders} orders</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              readOnly 
                              className="form-input" 
                              style={{ minHeight: '36px', height: '36px', padding: '0 8px', fontSize: '13px', width: '220px', fontFamily: 'monospace' }}
                              value={`${hostUrl}/r/${retailer.token}`} 
                            />
                            <button 
                              className="btn btn-primary" 
                              style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '13px' }}
                              onClick={() => handleCopyLink(retailer.token)}
                              disabled={!retailer.active}
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              className={`btn ${retailer.active ? 'btn-secondary' : 'btn-primary'}`} 
                              style={{ minHeight: '36px', height: '36px', padding: '0 10px', fontSize: '13px' }} 
                              onClick={() => toggleRetailerStatus(retailer)}
                            >
                              {retailer.active ? 'Disable' : 'Enable'}
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ minHeight: '36px', height: '36px', padding: '0 10px', fontSize: '13px' }} 
                              onClick={() => regenerateRetailerLink(retailer.id)}
                            >
                              🔄 Reset
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ minHeight: '36px', height: '36px', padding: '0 10px', fontSize: '13px' }} 
                              onClick={() => handleDeleteRetailer(retailer.id)}
                            >
                              ❌
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

        {/* TAB 3: Orders Overview */}
        {activeTab === 'orders' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">System Orders Feed</h1>
                <p style={{ color: 'var(--text-muted)' }}>Real-time database tracking of orders initiated by retailers.</p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-title">Total Orders Initiated</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{stats.totalOrders}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Pending Delivery</div>
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pendingOrders}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Fulfilled Deliveries</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.fulfilledOrders}</div>
              </div>
            </div>

            <div className="table-container">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <p>No orders captured in system yet.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Retailer (Shop Name)</th>
                      <th>Pharma Company</th>
                      <th>Product Ordered</th>
                      <th>Qty × Unit Price</th>
                      <th>Total Billing</th>
                      <th>Routing Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>#{order.id}</td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{order.retailer?.shopName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{order.retailer?.phone}</div>
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ textTransform: 'uppercase' }}>
                            {order.salesman?.companyName}
                          </span>
                        </td>
                        <td>{order.productName}</td>
                        <td>{order.quantity} units × ₹{order.price.toFixed(2)}</td>
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>
                          ₹{(order.quantity * order.price).toFixed(2)}
                        </td>
                        <td>
                          <span className={`badge ${order.status === 'FULFILLED' ? 'badge-success' : 'badge-warning'}`}>
                            {order.status === 'FULFILLED' ? '✓ Delivered & Fulfilled' : '⏳ WhatsApp Message Sent'}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {new Date(order.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Salesman Add/Edit */}
      {isSalesmanModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingSalesman ? `Edit Salesman: ${editingSalesman.name}` : 'Register New Salesman'}
              </h2>
              <button className="modal-close" onClick={() => setIsSalesmanModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSalesmanSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={salesmanForm.name}
                  onChange={(e) => setSalesmanForm({ ...salesmanForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={salesmanForm.companyName}
                  onChange={(e) => setSalesmanForm({ ...salesmanForm, companyName: e.target.value })}
                  placeholder="e.g. XYZ Pharma"
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={salesmanForm.phone}
                  onChange={(e) => setSalesmanForm({ ...salesmanForm, phone: e.target.value })}
                  placeholder="e.g. 9876543210 (include country code if non-India)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username (Dashboard Login)</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={salesmanForm.username}
                  onChange={(e) => setSalesmanForm({ ...salesmanForm, username: e.target.value })}
                  placeholder="e.g. ramesh_xyz"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password {editingSalesman && '(Leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  className="form-input"
                  required={!editingSalesman}
                  value={salesmanForm.password}
                  onChange={(e) => setSalesmanForm({ ...salesmanForm, password: e.target.value })}
                  placeholder="Enter login password"
                />
              </div>

              {editingSalesman && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
                  <input
                    type="checkbox"
                    id="salesman-active"
                    checked={salesmanForm.active}
                    onChange={(e) => setSalesmanForm({ ...salesmanForm, active: e.target.checked })}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <label htmlFor="salesman-active" className="form-label" style={{ cursor: 'pointer', margin: 0 }}>
                    Account Active & Visible to Retailers
                  </label>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSalesmanModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Retailer Single Add */}
      {isRetailerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Register Retailer</h2>
              <button className="modal-close" onClick={() => setIsRetailerModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleRetailerSubmit}>
              <div className="form-group">
                <label className="form-label">Shop/Retailer Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={retailerForm.shopName}
                  onChange={(e) => setRetailerForm({ ...retailerForm, shopName: e.target.value })}
                  placeholder="e.g. Apex Medico"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Retailer Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={retailerForm.phone}
                  onChange={(e) => setRetailerForm({ ...retailerForm, phone: e.target.value })}
                  placeholder="e.g. 9876543210 (without + or spaces)"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsRetailerModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Retailer Bulk Upload */}
      {isBulkUploadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Bulk Upload Retailers</h2>
              <button className="modal-close" onClick={() => setIsBulkUploadModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleBulkUpload}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Paste CSV or list data below. Each line should contain <strong>Shop Name, Phone Number</strong>.
              </p>
              
              <div className="form-group">
                <label className="form-label">Format: Shop Name, Phone Number</label>
                <textarea
                  className="form-input"
                  style={{ width: '100%', height: '240px', padding: '12px', fontFamily: 'monospace', resize: 'vertical' }}
                  required
                  placeholder={`Apex Medico, 9876543210\nNational Pharmacy, 919876543210\nHealthCare Store, 9998887770`}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsBulkUploadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !bulkCsvText.trim()}>
                  {loading ? 'Uploading & Generating Links...' : 'Upload & Generate Links'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST POPUP NOTIFICATION */}
      {toast.visible && (
        <div className="toast">
          <span>🔔</span> {toast.message}
        </div>
      )}
    </div>
  );
}
