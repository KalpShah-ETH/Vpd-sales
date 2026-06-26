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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [bgVersion, setBgVersion] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [companyLoadingId, setCompanyLoadingId] = useState(null);
  const ITEMS_PER_PAGE = 50;

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
        setCurrentPage(1);
        setTotalPages(data.totalPages);
        window.scrollTo(0, 0);
      } else {
        showErrorToast('Failed to load company catalogue');
      }
    } catch (err) {
      console.error(err);
      showErrorToast('Error connecting to database');
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
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyStock(selectedCompanyId, currentPage, debouncedSearchQuery);
    }
  }, [selectedCompanyId, currentPage, debouncedSearchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('bgVersion');
      if (cached) {
        setBgVersion(cached);
      } else {
        fetchSettings();
      }
      if (sessionStorage.getItem('last_order_placed') === 'true') {
        showToast('Order successfully saved!');
        sessionStorage.removeItem('last_order_placed');
      }
    } else {
      fetchSettings();
    }
  }, []);

  useEffect(() => {
    if (bgVersion) {
      document.body.style.backgroundImage = `url('/api/retailer/bg-image?v=${bgVersion}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    }
    return () => {
      document.body.style.backgroundImage = '';
    };
  }, [bgVersion]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/retailer/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.RETAILER_BG_VERSION) {
          setBgVersion(data.RETAILER_BG_VERSION);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('bgVersion', data.RETAILER_BG_VERSION);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
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

  const fetchCatalog = async (silent = false) => {
    try {
      const res = await fetch('/api/retailer/browse');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      } else if (!silent) {
        showErrorToast('Failed to load catalogue. Please reload.');
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        showErrorToast('Connection error. Check internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get selected company
  const company = useMemo(() => {
    if (!selectedCompanyId) return null;
    return catalog.find(c => c.id === selectedCompanyId);
  }, [catalog, selectedCompanyId]);

  const paginatedStockItems = useMemo(() => {
    return company?.stockItems || [];
  }, [company?.stockItems]);

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
      sessionStorage.setItem('last_order_placed', 'true');
      window.location.href = data.waUrl;
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setSubmittingItemId(null);
    }
  };

  const addToCart = (item) => {
    const qtySelected = quantities[item.id] || 1;
    setCart(prevCart => {
      const existing = prevCart.find(c => c.item.id === item.id);
      if (existing) {
        return prevCart.map(c => 
          c.item.id === item.id 
            ? { ...c, quantity: Math.min(item.quantity, c.quantity + qtySelected) }
            : c
        );
      }
      return [...prevCart, { item, quantity: qtySelected }];
    });
    setQuantities({ ...quantities, [item.id]: 1 });
    showToast(`Added ${qtySelected} strips of ${item.name} to cart`);
  };

  const updateCartQuantity = (itemId, newQty, maxQty) => {
    let val = parseInt(newQty);
    if (isNaN(val) || val < 1) val = 1;
    if (val > maxQty) val = maxQty;
    setCart(prevCart => prevCart.map(c => 
      c.item.id === itemId ? { ...c, quantity: val } : c
    ));
  };

  const removeFromCart = (itemId) => {
    setCart(prevCart => prevCart.filter(c => c.item.id !== itemId));
    showToast('Item removed from cart');
  };

  const handlePlaceCartOrder = async () => {
    if (cart.length === 0) return;
    setSubmittingItemId('cart');
    showToast('Submitting cart and opening WhatsApp...');
    try {
      const res = await fetch('/api/retailer/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: cart.map(c => ({ stockItemId: c.item.id, quantity: c.quantity })) 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');

      setCatalog(prevCatalog => {
        return prevCatalog.map(comp => {
          return {
            ...comp,
            stockItems: comp.stockItems.map(item => {
              const cartItem = cart.find(c => c.item.id === item.id);
              if (cartItem) {
                return {
                  ...item,
                  quantity: Math.max(0, item.quantity - cartItem.quantity)
                };
              }
              return item;
            })
          };
        });
      });

      setCart([]);
      setIsCartOpen(false);
      sessionStorage.setItem('last_order_placed', 'true');
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
                const color = avatarColors[company.id % avatarColors.length];
                const isLoading = companyLoadingId === company.id;

                return (
                  <button 
                    key={company.id} 
                    className="company-card"
                    onClick={() => handleSelectCompany(company.id)}
                    disabled={companyLoadingId !== null}
                    style={companyLoadingId !== null && !isLoading ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                  >
                    <div className="avatar" style={{ backgroundColor: color }}>
                      {initials}
                    </div>
                    <div className="company-info">
                      <div className="company-name">{company.companyName}</div>
                      <div className="company-meta">
                        {company.stockItemsCount !== undefined ? company.stockItemsCount : (company.stockItems?.filter(i => i.quantity > 0).length || 0)} items in stock
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                      {isLoading ? (
                        <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px', borderTopColor: 'var(--primary)', margin: 0 }}></div>
                      ) : (
                        <div style={{ fontSize: '24px', color: 'var(--primary)', fontWeight: 'bold' }}>→</div>
                      )}
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
              onClick={() => {
                setSelectedCompanyId(null);
                setSearchQuery('');
                setDebouncedSearchQuery('');
                window.scrollTo(0, 0);
              }}
            >
              ← Back
            </button>
            <span className="mobile-header-title">{company?.companyName}</span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '16px', fontWeight: '500' }}>
            Tap the large <strong style={{ color: 'var(--primary)' }}>ORDER</strong> button to initiate WhatsApp order.
          </p>

          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '12px 48px 12px 16px', fontSize: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
              placeholder="🔍 Search medicines by name or manufacturer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery !== debouncedSearchQuery && (
              <div style={{ position: 'absolute', right: '16px', top: '14px', display: 'flex', alignItems: 'center' }}>
                <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderTopColor: 'var(--primary)', margin: 0 }}></span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: totalPages > 1 ? '80px' : '20px' }}>
            {paginatedStockItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>
                  {company?.stockItems.length === 0 
                    ? 'No medicines listed in this catalogue yet.' 
                    : 'No matching medicines found.'}
                </p>
              </div>
            ) : (
              paginatedStockItems.map((item) => {
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
                            ? <span style={{ color: 'var(--danger)', fontWeight: '800' }}>🚫 SOLD OUT</span> 
                            : `🟢 Available Stock: ${item.quantity} strips`}
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
                          <input 
                            type="number" 
                            min="1"
                            max={item.quantity}
                            value={quantities[item.id] !== undefined ? quantities[item.id] : 1}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              if (valStr === '') {
                                setQuantities({
                                  ...quantities,
                                  [item.id]: ''
                                });
                                return;
                              }
                              let val = parseInt(valStr);
                              if (isNaN(val)) val = 1;
                              if (val < 1) val = 1;
                              if (val > item.quantity) val = item.quantity;
                              setQuantities({
                                  ...quantities,
                                  [item.id]: val
                              });
                            }}
                            onBlur={() => {
                              const val = quantities[item.id];
                              if (val === '' || isNaN(parseInt(val))) {
                                setQuantities({
                                  ...quantities,
                                  [item.id]: 1
                                });
                              }
                            }}
                            style={{
                              width: '60px',
                              textAlign: 'center',
                              fontSize: '16px',
                              fontWeight: '600',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '4px 0',
                              margin: '0 8px',
                              height: '36px'
                            }}
                          />
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
                        onClick={() => addToCart(item)}
                        disabled={isOutOfStock}
                      >
                        {isOutOfStock 
                          ? 'SOLD OUT' 
                          : `Add ${qtySelected || 1} ${(qtySelected || 1) === 1 ? 'strip' : 'strips'} to Cart`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mobile-pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px', paddingBottom: '20px' }}>
              <button 
                className="btn btn-secondary" 
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage(prev => Math.max(1, prev - 1));
                  window.scrollTo(0, 0);
                }}
              >
                ◀ Previous
              </button>
              <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  window.scrollTo(0, 0);
                }}
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      )}

      {cart.length > 0 && !isCartOpen && (
        <button 
          onClick={() => setIsCartOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🛒 View Cart ({cart.reduce((sum, c) => sum + c.quantity, 0)} strips)
        </button>
      )}

      {isCartOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h2 className="modal-title" style={{ fontSize: '20px' }}>🛒 My Order Cart</h2>
              <button className="modal-close" onClick={() => {
                setIsCartOpen(false);
              }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cart.map((cartItem) => (
                <div 
                  key={cartItem.item.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    borderBottom: '1px solid var(--border-color)', 
                    paddingBottom: '12px' 
                  }}
                >
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <div style={{ fontWeight: '700', fontSize: '16px' }}>{cartItem.item.name}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="qty-selector" style={{ margin: 0 }}>
                      <button 
                        type="button" 
                        className="qty-btn"
                        onClick={() => updateCartQuantity(cartItem.item.id, cartItem.quantity - 1, cartItem.item.quantity)}
                        disabled={cartItem.quantity <= 1}
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        value={cartItem.quantity}
                        onChange={(e) => updateCartQuantity(cartItem.item.id, e.target.value, cartItem.item.quantity)}
                        style={{
                          width: '45px',
                          textAlign: 'center',
                          fontSize: '15px',
                          fontWeight: '600',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 0',
                          height: '32px'
                        }}
                      />
                      <button 
                        type="button" 
                        className="qty-btn"
                        onClick={() => updateCartQuantity(cartItem.item.id, cartItem.quantity + 1, cartItem.item.quantity)}
                        disabled={cartItem.quantity >= cartItem.item.quantity}
                      >
                        +
                      </button>
                    </div>

                    <button 
                      onClick={() => removeFromCart(cartItem.item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        fontSize: '20px',
                        cursor: 'pointer',
                        padding: '4px 8px'
                      }}
                      title="Remove item"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => setIsCartOpen(false)}
                >
                  Add More
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 2, height: '48px' }} 
                  disabled={submittingItemId === 'cart'}
                  onClick={handlePlaceCartOrder}
                >
                  {submittingItemId === 'cart' ? 'Processing Order...' : 'Send WhatsApp Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST POPUP NOTIFICATION */}
      {toast.visible && (
        <div className={`toast ${toast.isError ? 'toast-error' : ''}`}>
          <span>{toast.isError ? '✕' : '✓'}</span> {toast.message}
        </div>
      )}
    </div>
  );
}
