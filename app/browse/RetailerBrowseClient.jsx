'use client';

import { useState, useEffect, useMemo } from 'react';

export default function RetailerBrowseClient({ shopName }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  
  // Track quantities selected for each item (default 1)
  const [quantities, setQuantities] = useState({});
  const [submittingItemId, setSubmittingItemId] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', isError: false });

  useEffect(() => {
    fetchCatalog();
  }, []);

  const showToast = (message) => {
    setToast({ visible: true, message, isError: false });
    setTimeout(() => {
      setToast({ visible: false, message: '', isError: false });
    }, 4000);
  };

  const showErrorToast = (message) => {
    setToast({ visible: true, message, isError: true });
    setTimeout(() => {
      setToast({ visible: false, message: '', isError: false });
    }, 4000);
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/retailer/browse');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      } else {
        showToast('Failed to load catalogue. Please reload.');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Check internet.');
    } finally {
      setLoading(false);
    }
  };

  // Get selected company
  const company = useMemo(() => {
    if (!selectedCompanyId) return null;
    return catalog.find(c => c.id === selectedCompanyId);
  }, [catalog, selectedCompanyId]);

  // Adjust quantity
  const handleQtyChange = (itemId, change, maxQty) => {
    const currentVal = quantities[itemId] || 1;
    let newVal = currentVal + change;
    if (newVal < 1) newVal = 1;
    if (newVal > maxQty) newVal = maxQty;
    
    setQuantities({
      ...quantities,
      [itemId]: newVal
    });
  };

  // Place Order
  const handlePlaceOrder = async (itemId) => {
    const qty = quantities[itemId] || 1;
    setSubmittingItemId(itemId);
    showToast('Saving order and opening WhatsApp...');

    try {
      const res = await fetch('/api/retailer/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockItemId: itemId, quantity: qty })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      // Decrement local quantity for instant visual feedback
      setCatalog(prevCatalog => {
        return prevCatalog.map(comp => {
          return {
            ...comp,
            stockItems: comp.stockItems.map(item => {
              if (item.id === itemId) {
                return {
                  ...item,
                  quantity: Math.max(0, item.quantity - qty)
                };
              }
              return item;
            })
          };
        });
      });

      // Clear quantity selection
      setQuantities({ ...quantities, [itemId]: 1 });

      // Immediate handoff to WhatsApp
      window.location.href = data.waUrl;
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setSubmittingItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Loading Catalogues...</p>
      </div>
    );
  }

  // Assign background colors to initials avatars
  const avatarColors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

  return (
    <div className="retailer-view">
      
      {/* State 1: Company List View */}
      {!selectedCompanyId ? (
        <div>
          <header style={{ padding: '8px 0 24px 0', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)' }}>VPD Orders</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '4px', fontWeight: '500' }}>
              Logged in: <strong>{shopName}</strong>
            </p>
          </header>

          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Select Pharma Company
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {catalog.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No active pharma catalogues found.</p>
              </div>
            ) : (
              catalog.map((company, index) => {
                const initials = company.companyName.substring(0, 2).toUpperCase();
                const color = avatarColors[index % avatarColors.length];

                return (
                  <button 
                    key={company.id} 
                    className="company-card"
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      window.scrollTo(0, 0);
                    }}
                  >
                    <div className="avatar" style={{ backgroundColor: color }}>
                      {initials}
                    </div>
                    <div className="company-info">
                      <div className="company-name">{company.companyName}</div>
                      <div className="company-meta">
                        {company.stockItems.filter(i => i.quantity > 0).length} items in stock
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '24px', color: 'var(--primary)', fontWeight: 'bold' }}>
                      →
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* State 2: Company Stock Item list */
        <div>
          <div className="mobile-header" style={{ marginLeft: '-16px', marginRight: '-16px', marginTop: '-16px', marginBottom: '20px' }}>
            <button 
              className="back-btn" 
              onClick={() => setSelectedCompanyId(null)}
              style={{ fontSize: '28px', fontWeight: 'bold' }}
            >
              ←
            </button>
            <span className="mobile-header-title">{company?.companyName}</span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '16px', fontWeight: '500' }}>
            Tap the large <strong style={{ color: 'var(--primary)' }}>ORDER</strong> button to initiate WhatsApp order.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {company?.stockItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No products listed in this catalogue yet.</p>
              </div>
            ) : (
              company?.stockItems.map((item) => {
                const qtySelected = quantities[item.id] || 1;
                const isOutOfStock = item.quantity <= 0;

                return (
                  <div 
                    key={item.id} 
                    className={`stock-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                    style={isOutOfStock ? { borderLeft: '4px solid var(--gray-out)' } : { borderLeft: '4px solid var(--primary)' }}
                  >
                    <div className="stock-header">
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <div className="stock-title" style={{ fontSize: '19px', fontWeight: '700' }}>{item.name}</div>
                        <div className="stock-qty" style={{ marginTop: '4px' }}>
                          {isOutOfStock 
                            ? '🚫 Out of Stock' 
                            : `🟢 Available Stock: ${item.quantity} units`}
                        </div>
                      </div>
                      <div className="stock-price" style={{ fontSize: '20px' }}>
                        ₹{item.price.toFixed(2)}
                      </div>
                    </div>

                    {!isOutOfStock && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', backgroundColor: 'var(--bg-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)' }}>Quantity:</span>
                        <div className="qty-selector">
                          <button 
                            type="button" 
                            className="qty-btn"
                            onClick={() => handleQtyChange(item.id, -1, item.quantity)}
                            disabled={qtySelected <= 1}
                          >
                            -
                          </button>
                          <div className="qty-val">{qtySelected}</div>
                          <button 
                            type="button" 
                            className="qty-btn"
                            onClick={() => handleQtyChange(item.id, 1, item.quantity)}
                            disabled={qtySelected >= item.quantity}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="stock-actions" style={{ marginTop: '8px' }}>
                      <button 
                        className="btn btn-primary btn-full"
                        style={{ 
                          height: '52px', 
                          fontSize: '17px', 
                          backgroundColor: isOutOfStock ? 'var(--gray-out)' : 'var(--primary)' 
                        }}
                        onClick={() => handlePlaceOrder(item.id)}
                        disabled={isOutOfStock || submittingItemId === item.id}
                      >
                        {isOutOfStock 
                          ? 'OUT OF STOCK (N/A)' 
                          : submittingItemId === item.id 
                            ? 'Processing Order...' 
                            : `Order ${qtySelected} units via WhatsApp`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TOAST POPUP NOTIFICATION */}
      {toast.visible && (
        <div className={`toast ${toast.isError ? 'toast-error' : ''}`}>
          <span>{toast.isError ? '✕' : '🔔'}</span> {toast.message}
        </div>
      )}
    </div>
  );
}
