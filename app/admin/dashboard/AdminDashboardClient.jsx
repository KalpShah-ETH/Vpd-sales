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
  const [catalog, setCatalog] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [bgFile, setBgFile] = useState(null);
  const [bgUploadLoading, setBgUploadLoading] = useState(false);
  const [bgUploadStatus, setBgUploadStatus] = useState('');

  // Admin creation form states
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminCreateStatus, setAdminCreateStatus] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', isError: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [companyLoadingId, setCompanyLoadingId] = useState(null);

  const handleSelectCompany = async (companyId) => {
    if (companyLoadingId) return;
    setCompanyLoadingId(companyId);
    try {
      const res = await fetch(`/api/retailer/browse?companyId=${companyId}&page=1&search=`);
      if (res.ok) {
        const data = await res.json();
        setCatalog(prev => prev.map(c => c.id === companyId ? { ...c, stockItems: data.stockItems } : c));
        setSelectedCompanyId(companyId);
        setSearchQuery('');
        setDebouncedSearchQuery('');
        setPreviewPage(1);
        setPreviewTotalPages(data.totalPages || 1);
        window.scrollTo(0, 0);
      } else {
        showToast('Failed to load company catalogue');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to database');
    } finally {
      setCompanyLoadingId(null);
    }
  };

  const fetchCompanyStock = async (companyId, page, search) => {
    try {
      const res = await fetch(`/api/retailer/browse?companyId=${companyId}&page=${page}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setCatalog(prev => prev.map(c => c.id === companyId ? { ...c, stockItems: data.stockItems } : c));
        setPreviewTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  // Bulk Stock Upload state for Admin on behalf of Salesman
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvItems, setCsvItems] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvUploadLoading, setCsvUploadLoading] = useState(false);
  const [selectedUploadSalesman, setSelectedUploadSalesman] = useState(null);
  
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
  const [isSalesmanBulkUploadModalOpen, setIsSalesmanBulkUploadModalOpen] = useState(false);
  const [salesmanBulkCsvText, setSalesmanBulkCsvText] = useState('');
  const [showSalesmanPassword, setShowSalesmanPassword] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Host URL for links
  const [hostUrl, setHostUrl] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostUrl(window.location.origin);
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'success') {
        showToast('Logged in successfully!');
        router.replace('/admin/dashboard');
      }
    }
    fetchSalesmen(); // only default tab
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyStock(selectedCompanyId, previewPage, debouncedSearchQuery);
    }
  }, [selectedCompanyId, previewPage, debouncedSearchQuery]);

  useEffect(() => {
    if (activeTab === 'retailers') fetchRetailers();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'preview') fetchCatalog();
  }, [activeTab]);

  // Show toast notification
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
      const res = await fetch('/api/admin/salesman/bulk-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: csvItems 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload items');

      showToast(`Uploaded successfully to all ${data.salesmenCount} salesmen! Added ${data.inserted} new medicines, skipped ${data.skipped} duplicates.`);
      setIsCsvModalOpen(false);
      setCsvItems([]);
      setCsvFileName('');
      setSelectedUploadSalesman(null);
      fetchSalesmen(); 
      fetchCatalog(); 
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setCsvUploadLoading(false);
    }
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
      showErrorToast('Failed to load data. Please refresh.');
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
      showErrorToast('Failed to load data. Please refresh.');
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
      showErrorToast('Failed to load data. Please refresh.');
    }
  };

  // API Call: Fetch Catalog (Retailer View Preview)
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

  // Handle Admin Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
      router.push('/?role=admin&logout=success');
    } catch (err) {
      console.error('Logout error:', err);
      showErrorToast('Logout failed');
    }
  };

  const handleBgUpload = async (e) => {
    e.preventDefault();
    if (!bgFile) return;
    setBgUploadLoading(true);
    setBgUploadStatus('');
    try {
      const formData = new FormData();
      formData.append('file', bgFile);

      const res = await fetch('/api/admin/background', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload background image');

      showToast('Background image updated successfully!');
      setBgUploadStatus('Upload successful!');
      setBgFile(null);
    } catch (err) {
      showErrorToast(err.message);
      setBgUploadStatus(`Error: ${err.message}`);
    } finally {
      setBgUploadLoading(false);
    }
  };

  const handleAdminCreateSubmit = async (e) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminCreateStatus('');
    try {
      const res = await fetch('/api/admin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create admin');

      setAdminCreateStatus('Admin created successfully!');
      setAdminForm({ username: '', password: '' });
      setShowAdminPassword(false);
      showToast('New admin registered successfully!');
    } catch (err) {
      setAdminCreateStatus(`Error: ${err.message}`);
      showErrorToast(err.message);
    } finally {
      setAdminLoading(false);
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

      const cleanPhone = salesmanForm.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        throw new Error('Salesman phone number must be exactly 10 digits');
      }
      
      const payload = isEditing 
        ? { id: editingSalesman.id, ...salesmanForm, username: salesmanForm.phone }
        : { ...salesmanForm, username: salesmanForm.phone };

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
      fetchCatalog();
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Salesman
  const handleDeleteSalesman = (id) => {
    triggerConfirm(
      'Delete Salesman',
      'Are you sure you want to delete this salesman? All their products and orders will also be permanently deleted.',
      async () => {
        try {
          const res = await fetch(`/api/admin/salesman?id=${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete');
          showToast('Salesman deleted successfully');
          fetchSalesmen();
          fetchCatalog();
        } catch (err) {
          showErrorToast(err.message);
        }
      },
      true,
      'Delete'
    );
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
    setShowSalesmanPassword(false);
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
    setShowSalesmanPassword(false);
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
      showErrorToast(err.message);
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
      showErrorToast(err.message);
    }
  };

  // Regenerate Retailer Link/Token
  const regenerateRetailerLink = (id) => {
    triggerConfirm(
      'Regenerate Access Link',
      'This will invalidate their existing private link. Regenerate link now? Note: Retailers using the old link will immediately lose access.',
      async () => {
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
          showErrorToast(err.message);
        }
      },
      true,
      'Regenerate'
    );
  };

  // Delete Retailer
  const handleDeleteRetailer = (id) => {
    triggerConfirm(
      'Delete Retailer',
      'Are you sure you want to delete this retailer? All their orders will be deleted permanently.',
      async () => {
        try {
          const res = await fetch(`/api/admin/retailer?id=${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete');
          showToast('Retailer deleted successfully');
          fetchRetailers();
        } catch (err) {
          showErrorToast(err.message);
        }
      },
      true,
      'Delete'
    );
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
      showErrorToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSalesmanBulkUpload = async (e) => {
    e.preventDefault();
    if (!salesmanBulkCsvText.trim()) return;
    setLoading(true);

    try {
      const lines = salesmanBulkCsvText.split('\n');
      const parsedSalesmen = [];

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length >= 4) {
          const name = parts[0].trim();
          const companyName = parts[1].trim();
          const phone = parts[2].trim();
          const password = parts[3].trim();
          if (name && companyName && phone && password && name !== 'Name') {
            parsedSalesmen.push({ name, companyName, phone, password });
          }
        }
      }

      if (parsedSalesmen.length === 0) {
        throw new Error('No valid salesman rows found. Format must be: Name, Company, Phone, Password');
      }

      const res = await fetch('/api/admin/salesman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesmen: parsedSalesmen })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk upload failed');

      showToast(`Successfully uploaded ${data.count} salesmen!`);
      setIsSalesmanBulkUploadModalOpen(false);
      setSalesmanBulkCsvText('');
      fetchSalesmen();
      fetchCatalog();
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setLoading(false);
    }
  };
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

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return catalog.find(c => c.id === selectedCompanyId);
  }, [catalog, selectedCompanyId]);

  const paginatedPreviewStock = useMemo(() => {
    return selectedCompany?.stockItems || [];
  }, [selectedCompany?.stockItems]);

  return (
    <div className="dashboard-grid">
      {/* Sidebar Backdrop for Mobile */}
      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="sidebar-title">
            <span>🛡️</span> VPD Admin
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
              className={`sidebar-link ${activeTab === 'salesmen' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('salesmen');
                setSelectedCompanyId(null);
                setIsSidebarOpen(false);
              }}
            >
              👤 Salesmen Catalogues
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'retailers' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('retailers');
                setSelectedCompanyId(null);
                setIsSidebarOpen(false);
              }}
            >
              🏪 Retailer Access Links
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('orders');
                setSelectedCompanyId(null);
                setIsSidebarOpen(false);
              }}
            >
              📊 System Orders Feed
              {stats.pendingOrders > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 'auto', borderRadius: '4px', padding: '2px 6px' }}>
                  {stats.pendingOrders}
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
              👀 Retailer View Preview
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-link ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                setSelectedCompanyId(null);
                setIsSidebarOpen(false);
              }}
            >
              ⚙️ Settings
            </button>
          </li>
          <li style={{ marginTop: 'auto' }}>
            <button 
              className="sidebar-link" 
              onClick={() => {
                setIsSidebarOpen(false);
                triggerConfirm(
                  'Confirm Logout',
                  'Are you sure you want to log out of your Admin session?',
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
        
        {/* TAB 1: Salesmen Management */}
        {activeTab === 'salesmen' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Salesmen Catalogues</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage salesmen accounts and catalog ownership.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setIsSalesmanBulkUploadModalOpen(true)}>
                  📥 Bulk Upload CSV
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                  onClick={() => {
                    setIsCsvModalOpen(true);
                    setCsvItems([]);
                    setCsvFileName('');
                  }}
                >
                  📄 Bulk Upload Stock (Shared Global)
                </button>
                <button className="btn btn-primary" onClick={openAddSalesmanModal}>
                  ➕ Add New Salesman
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-title">Total Salesmen registered</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{salesmen.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Active Salesmen</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{salesmen.filter(s => s.active).length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Deactivated Salesmen</div>
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{salesmen.filter(s => !s.active).length}</div>
              </div>
            </div>

            <div className="table-container">
              {salesmen.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👤</div>
                  <p>No salesmen registered yet.</p>
                  <button className="btn btn-secondary" onClick={openAddSalesmanModal}>Add Your First Salesman</button>
                </div>
              ) : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Salesman Details</th>
                        <th>Company Representing</th>
                        <th>WhatsApp Routing</th>
                        <th>Username (Phone)</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesmen.map((salesman) => (
                        <tr key={salesman.id}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{salesman.name}</div>
                          </td>
                          <td>
                            <div className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                              {salesman.companyName}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{salesman.phone}</td>
                          <td style={{ fontWeight: '500' }}>{salesman.username}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button 
                                className={`btn ${salesman.active ? 'btn-secondary' : 'btn-primary'}`} 
                                style={{ padding: '0 10px', fontSize: '14px' }}
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/admin/salesman', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: salesman.id, active: !salesman.active })
                                    });
                                    if (!res.ok) throw new Error('Failed to toggle active status');
                                    showToast(`Salesman ${!salesman.active ? 'activated' : 'deactivated'} successfully!`);
                                    fetchSalesmen();
                                    fetchCatalog();
                                  } catch (err) {
                                    showErrorToast(err.message);
                                  }
                                }}
                              >
                                {salesman.active ? 'Disable' : 'Enable'}
                              </button>
                              <button className="btn btn-secondary" style={{ padding: '0 10px', fontSize: '14px' }} onClick={() => openEditSalesmanModal(salesman)}>
                                Edit
                              </button>
                              <button className="btn btn-danger" style={{ padding: '0 10px', fontSize: '14px' }} onClick={() => handleDeleteSalesman(salesman.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mobile-card-list">
                    {salesmen.map((salesman) => (
                      <div key={salesman.id} className="mobile-card">
                        <div className="mobile-card-header">
                          <span style={{ fontWeight: '700', fontSize: '16px' }}>{salesman.name}</span>
                        </div>
                        <div className="mobile-card-body">
                          <div><strong>Company:</strong> {salesman.companyName}</div>
                          <div><strong>Phone (Username):</strong> {salesman.phone}</div>
                        </div>
                        <div className="mobile-card-actions">
                          <button 
                            className={`btn ${salesman.active ? 'btn-secondary' : 'btn-primary'}`} 
                            style={{ flex: 1, minHeight: '40px', padding: '0 8px', fontSize: '13px' }}
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/admin/salesman', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: salesman.id, active: !salesman.active })
                                });
                                if (!res.ok) throw new Error('Failed to toggle active status');
                                showToast(`Salesman ${!salesman.active ? 'activated' : 'deactivated'} successfully!`);
                                fetchSalesmen();
                                fetchCatalog();
                              } catch (err) {
                                showErrorToast(err.message);
                              }
                            }}
                          >
                            {salesman.active ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn btn-secondary" style={{ flex: 1, minHeight: '40px', padding: '0 8px', fontSize: '13px' }} onClick={() => openEditSalesmanModal(salesman)}>
                            Edit
                          </button>
                          <button className="btn btn-danger" style={{ flex: 1, minHeight: '40px', padding: '0 8px', fontSize: '13px' }} onClick={() => handleDeleteSalesman(salesman.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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

            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-title">Total Retailers</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{retailers.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Active Retailers</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{retailers.filter(r => r.active).length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Deactivated Retailers</div>
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{retailers.filter(r => !r.active).length}</div>
              </div>
            </div>

            {/* Search filter */}
            <div style={{ marginBottom: '20px', display: 'flex', maxWidth: '400px' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
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
                <>
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
                              {retailer.active ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td>🛒 {retailer._count.orders} orders</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input 
                                type="text" 
                                readOnly 
                                className="form-input" 
                                style={{ padding: '0 8px', fontSize: '13px', width: '220px', fontFamily: 'monospace', background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'default', boxShadow: 'none' }}
                                value={`${hostUrl}/r/${retailer.token}`} 
                              />
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '0 12px', fontSize: '13px' }}
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
                                className="btn btn-secondary" 
                                style={{ padding: '0 10px', fontSize: '13px' }} 
                                onClick={() => {
                                  setEditingRetailer(retailer);
                                  setRetailerForm({ shopName: retailer.shopName, phone: retailer.phone, active: retailer.active });
                                  setIsRetailerModalOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button 
                                className={`btn ${retailer.active ? 'btn-secondary' : 'btn-primary'}`} 
                                style={{ padding: '0 10px', fontSize: '13px' }} 
                                onClick={() => toggleRetailerStatus(retailer)}
                              >
                                {retailer.active ? 'Disable' : 'Enable'}
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0 10px', fontSize: '13px' }} 
                                onClick={() => regenerateRetailerLink(retailer.id)}
                              >
                                🔄 Reset Link
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '0 10px', fontSize: '13px' }} 
                                onClick={() => handleDeleteRetailer(retailer.id)}
                              >
                                ❌ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mobile-card-list">
                    {filteredRetailers.map((retailer) => (
                      <div key={retailer.id} className="mobile-card">
                        <div className="mobile-card-header">
                          <span style={{ fontWeight: '700', fontSize: '16px' }}>{retailer.shopName}</span>
                          <span className={`badge ${retailer.active ? 'badge-success' : 'badge-warning'}`}>
                            {retailer.active ? 'Active' : 'Deactivated'}
                          </span>
                        </div>
                        <div className="mobile-card-body">
                          <div><strong>Phone:</strong> {retailer.phone}</div>
                          <div><strong>Orders:</strong> 🛒 {retailer._count.orders} orders</div>
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <strong>Private Link:</strong>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input 
                                type="text" 
                                readOnly 
                                className="form-input" 
                                style={{ flex: 1, minHeight: '36px', height: '36px', padding: '0 8px', fontSize: '12px', fontFamily: 'monospace', background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'default', boxShadow: 'none' }}
                                value={`${hostUrl}/r/${retailer.token}`} 
                              />
                              <button 
                                className="btn btn-primary" 
                                style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '12px' }}
                                onClick={() => handleCopyLink(retailer.token)}
                                disabled={!retailer.active}
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <button 
                            className="btn btn-secondary" 
                            style={{ flex: 1, minHeight: '36px', padding: '0 6px', fontSize: '12px' }} 
                            onClick={() => {
                              setEditingRetailer(retailer);
                              setRetailerForm({ shopName: retailer.shopName, phone: retailer.phone, active: retailer.active });
                              setIsRetailerModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button 
                            className={`btn ${retailer.active ? 'btn-secondary' : 'btn-primary'}`} 
                            style={{ flex: 1, minHeight: '36px', padding: '0 6px', fontSize: '12px' }} 
                            onClick={() => toggleRetailerStatus(retailer)}
                          >
                            {retailer.active ? 'Disable' : 'Enable'}
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ flex: 1, minHeight: '36px', padding: '0 6px', fontSize: '12px' }} 
                            onClick={() => regenerateRetailerLink(retailer.id)}
                          >
                            Reset
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ flex: 1, minHeight: '36px', padding: '0 6px', fontSize: '12px' }} 
                            onClick={() => handleDeleteRetailer(retailer.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Shop Name</th>
                        <th>Pharma Company</th>
                        <th>Routing Status</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{order.retailer?.shopName}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              📞 <a href={`tel:${order.retailer?.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{order.retailer?.phone}</a>
                            </div>
                          </td>
                          <td style={{ textTransform: 'uppercase', fontWeight: '500' }}>
                            {order.salesman?.companyName}
                          </td>
                          <td style={{ color: order.status === 'FULFILLED' ? 'var(--success)' : 'var(--warning)', fontWeight: '600' }}>
                            {order.status === 'FULFILLED' ? '✓ Delivered' : '⏳ Pending delivery'}
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mobile-card-list">
                    {orders.map((order) => (
                      <div key={order.id} className="mobile-card">
                        <div className="mobile-card-body">
                          <div><strong>Shop Name:</strong> {order.retailer?.shopName}</div>
                          <div><strong>Pharma Company:</strong> <span style={{ textTransform: 'uppercase', fontWeight: '500' }}>{order.salesman?.companyName}</span></div>
                          <div><strong>Routing Status:</strong> <span style={{ color: order.status === 'FULFILLED' ? 'var(--success)' : 'var(--warning)', fontWeight: '600' }}>{order.status === 'FULFILLED' ? '✓ Delivered' : '⏳ Pending'}</span></div>
                          <div><strong>Time:</strong> {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Preview Retailer View */}
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
                        onClick={() => handleSelectCompany(company.id)}
                        disabled={companyLoadingId !== null}
                        style={companyLoadingId !== null && companyLoadingId !== company.id ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                      >
                        <div className="avatar" style={{ backgroundColor: color }}>
                          {initials}
                        </div>
                        <div className="company-info">
                          <div className="company-name">{company.companyName}</div>
                          <div className="company-meta">
                            {company.stockItemsCount !== undefined ? company.stockItemsCount : (company.stockItems?.length || 0)} Products Available
                          </div>
                        </div>
                        {companyLoadingId === company.id && (
                          <div style={{ marginLeft: 'auto' }}>
                            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderTopColor: 'var(--primary)', margin: 0 }}></div>
                          </div>
                        )}
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

                <div style={{ maxWidth: '600px', marginTop: '12px', paddingBottom: previewTotalPages > 1 ? '80px' : '20px' }}>
                  {paginatedPreviewStock.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📦</div>
                      <p>
                        {selectedCompany?.stockItems?.length === 0 
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
                          </div>
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
                  <div className="mobile-pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px', paddingBottom: '20px', maxWidth: '600px' }}>
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

        {/* TAB 5: Global Settings */}
        {activeTab === 'settings' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">Global Settings</h1>
                <p style={{ color: 'var(--text-muted)' }}>Configure platform-wide preferences and styles.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '16px' }}>
              <div className="card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>Retailer Browse Background Image</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
                  Upload a background image that will appear across the retailer browsing dashboard for all shops. Highly recommended to use a clean, professional, and optimized image.
                </p>

                <form onSubmit={handleBgUpload}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <input 
                      type="file" 
                      accept="image/jpeg,image/jpg,image/png" 
                      onChange={(e) => setBgFile(e.target.files[0])} 
                      className="form-input" 
                      style={{ padding: '8px' }}
                    />
                  </div>

                  {bgFile && (
                    <div style={{ marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center', backgroundColor: 'var(--bg-primary)' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>
                        Selected: {bgFile.name} ({(bgFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  )}

                  {bgUploadStatus && (
                    <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600', color: bgUploadStatus.includes('Error') ? 'var(--danger)' : 'var(--success)' }}>
                      {bgUploadStatus}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-full" 
                    disabled={!bgFile || bgUploadLoading}
                  >
                    {bgUploadLoading ? 'Uploading...' : 'Save & Publish Image'}
                  </button>
                </form>
              </div>

              <div className="card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>Create Admin Account</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
                  Register a new administrator account with login credentials. Only active admins can create additional admins.
                </p>

                <form onSubmit={handleAdminCreateSubmit}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. admin2"
                      value={adminForm.username} 
                      onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} 
                      className="form-input" 
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showAdminPassword ? 'text' : 'password'} 
                        required
                        placeholder="At least 6 characters"
                        value={adminForm.password} 
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} 
                        className="form-input" 
                        style={{ width: '100%', paddingRight: '48px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {showAdminPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {adminCreateStatus && (
                    <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600', color: adminCreateStatus.includes('Error') ? 'var(--danger)' : 'var(--success)' }}>
                      {adminCreateStatus}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-full" 
                    disabled={adminLoading}
                  >
                    {adminLoading ? 'Creating...' : 'Create Admin'}
                  </button>
                </form>
              </div>
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
                <label className="form-label">
                  Password {editingSalesman && '(Leave blank to keep current)'}
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showSalesmanPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ width: '100%', paddingRight: '48px' }}
                    required={!editingSalesman}
                    value={salesmanForm.password}
                    onChange={(e) => setSalesmanForm({ ...salesmanForm, password: e.target.value })}
                    placeholder="Enter login password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSalesmanPassword(!showSalesmanPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {showSalesmanPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
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
                  type="tel"
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
                  placeholder={`Apex Medico, 9876543210\nNational Pharmacy, 9876543211\nHealthCare Store, 9998887770`}
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

      {/* MODAL: Salesman Bulk Upload */}
      {isSalesmanBulkUploadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Bulk Upload Salesmen</h2>
              <button className="modal-close" onClick={() => setIsSalesmanBulkUploadModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSalesmanBulkUpload}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Paste CSV or list data below. Each line should contain <strong>Name, Company, Phone, Password</strong>.
              </p>
              
              <div className="form-group">
                <label className="form-label">Format: Name, Company, Phone, Password</label>
                <textarea
                  className="form-input"
                  style={{ width: '100%', height: '240px', padding: '12px', fontFamily: 'monospace', resize: 'vertical' }}
                  required
                  placeholder={`Ramesh Kumar, Apex Pharma, 9876543210, [password]\nSuresh Singh, National Meds, 9876543211, [password]`}
                  value={salesmanBulkCsvText}
                  onChange={(e) => setSalesmanBulkCsvText(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSalesmanBulkUploadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !salesmanBulkCsvText.trim()}>
                  {loading ? 'Uploading...' : 'Upload Salesmen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Shared Confirm Modal */}
      {/* MODAL: Admin Bulk Stock Upload for Shared Global Stock */}
      {isCsvModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Bulk Upload Shared Global Stock</h2>
              <button 
                className="modal-close" 
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvItems([]);
                  setCsvFileName('');
                  setSelectedUploadSalesman(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '8px 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px', lineHeight: '1.5' }}>
                Upload a CSV or XLSX file containing stock catalog. The system will save these stock items centrally as <strong>Shared Global Stock</strong> and reflect them across all salesmen's catalogues automatically.
                Column headers like <strong>mfg</strong>, <strong>item name</strong>, <strong>pack</strong>, and <strong>Qty.</strong> are expected.
                Duplicate items in the central global stock database will be automatically skipped.
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
                  setSelectedUploadSalesman(null);
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
                  'Upload Stock'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
