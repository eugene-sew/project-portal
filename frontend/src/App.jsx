import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  CreditCard, Plus, Copy, Trash2, LogOut, CheckCircle, Clock, 
  AlertTriangle, DollarSign, ArrowRight, Printer, ExternalLink, ShieldCheck, RefreshCw, Layers,
  LayoutGrid, FolderOpen
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001/api";

// --- HELPERS ---
const formatCurrency = (amount, currency) => {
  const symbolMap = { 'NGN': '₦', 'USD': '$', 'GHS': 'GH₵', 'EUR': '€', 'GBP': '£' };
  const symbol = symbolMap[currency.toUpperCase()] || currency;
  return `${symbol}${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- PRIVATE ROUTE WRAPPER ---
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

// ==========================================
// 1. ADMIN LOGIN COMPONENT
// ==========================================
function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("admin_token")) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed");
      }
      localStorage.setItem("admin_token", data.access_token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div className="content-card" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', marginBottom: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-green-glow)', color: 'var(--primary-green)', marginBottom: '16px' }}>
            <Layers size={24} />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '6px', fontWeight: 800 }}>Admin Login</h1>
          <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem' }}>Enter credentials to access Projects Dashboard</p>
        </div>

        {error && (
          <div style={{ 
            background: 'var(--failed-bg)', 
            border: '1px solid var(--failed-border)', 
            color: 'var(--failed)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '20px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input 
              id="username"
              type="text" 
              className="form-control" 
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              className="form-control" 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <RefreshCw className="animate-spin" size={18} /> : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. ADMIN DASHBOARD COMPONENT
// ==========================================
function AdminDashboard() {
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, projects, payments
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Create Project Modal Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate('/admin/login');
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch stats
      const statsRes = await fetch(`${API_BASE}/admin/stats`, { headers });
      if (statsRes.status === 401) {
        handleLogout();
        return;
      }
      const statsData = await statsRes.json();

      // Fetch projects list
      const projectsRes = await fetch(`${API_BASE}/admin/projects`, { headers });
      const projectsData = await projectsRes.json();

      // Fetch payments list
      const paymentsRes = await fetch(`${API_BASE}/admin/payments`, { headers });
      const paymentsData = await paymentsRes.json();

      setStats(statsData);
      setProjects(projectsData);
      setPayments(paymentsData);
    } catch (err) {
      setError("Failed to fetch dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    navigate('/admin/login');
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    const token = localStorage.getItem("admin_token");

    try {
      const response = await fetch(`${API_BASE}/admin/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_name: clientName,
          client_email: clientEmail,
          project_name: projectName,
          amount: parseFloat(amount),
          currency,
          description
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ? JSON.stringify(data.detail) : "Failed to create project");
      }

      // Reset form & reload
      setClientName('');
      setClientEmail('');
      setProjectName('');
      setAmount('');
      setDescription('');
      setShowCreateModal(false);
      fetchDashboardData();
      setCurrentView('projects'); // Redirect to projects list to see new item
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;
    
    const token = localStorage.getItem("admin_token");
    try {
      const response = await fetch(`${API_BASE}/admin/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchDashboardData();
      } else {
        alert("Failed to delete project");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyPaymentLink = (projectId) => {
    const link = `${window.location.origin}/pay/${projectId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(projectId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <RefreshCw className="animate-spin" size={40} style={{ color: 'var(--primary-green)' }} />
        <p style={{ marginTop: '20px', color: 'var(--admin-text-secondary)' }}>Loading Workspace Dashboard...</p>
      </div>
    );
  }

  // --- STATS CALCULATIONS (Based on GHS/base currency matching screenshot) ---
  const paidProjects = projects.filter(p => p.status === 'paid');
  const pendingProjects = projects.filter(p => p.status === 'pending');
  
  // Calculate total revenue and outstanding in GHS (Base)
  const totalRevenue = paidProjects
    .filter(p => p.currency === 'GHS')
    .reduce((sum, p) => sum + p.amount, 0);

  const outstanding = pendingProjects
    .filter(p => p.currency === 'GHS')
    .reduce((sum, p) => sum + p.amount, 0);

  // --- RENDERING SUB-VIEWS ---
  
  // 1. Dashboard Overview View (Matches user screenshot)
  const renderDashboardView = () => {
    const recentPayments = payments.slice(0, 5); // Show top 5 recent payments
    
    return (
      <>
        <div className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Overview of your business metrics.</p>
        </div>

        {/* STATS ROW */}
        <div className="stats-grid">
          {/* Total Revenue */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Total Revenue</span>
              <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <DollarSign size={16} />
              </div>
            </div>
            <div className="stat-card-value">GH₵ {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            {/* If there are other currency revenues, show them as description */}
            <div className="stat-card-description">
              {projects.filter(p => p.status === 'paid' && p.currency !== 'GHS').length > 0 ? (
                <span>
                  + {projects.filter(p => p.status === 'paid' && p.currency !== 'GHS')
                    .map(p => formatCurrency(p.amount, p.currency)).join(', ')}
                </span>
              ) : 'Base GHS revenue'}
            </div>
          </div>

          {/* Outstanding */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Outstanding</span>
              <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <Clock size={16} />
              </div>
            </div>
            <div className="stat-card-value">GH₵ {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="stat-card-description">
              {projects.filter(p => p.status === 'pending' && p.currency !== 'GHS').length > 0 ? (
                <span>
                  + {projects.filter(p => p.status === 'pending' && p.currency !== 'GHS')
                    .map(p => formatCurrency(p.amount, p.currency)).join(', ')}
                </span>
              ) : 'Awaiting invoicing completion'}
            </div>
          </div>

          {/* Active Projects */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Active Projects</span>
              <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <FolderOpen size={16} />
              </div>
            </div>
            <div className="stat-card-value">{projects.length}</div>
            <div className="stat-card-description">{paidProjects.length} fully paid</div>
          </div>

          {/* Pending / Partial */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Pending / Partial</span>
              <div className="stat-card-icon" style={{ background: 'rgba(75, 85, 99, 0.1)', color: '#4b5563' }}>
                <CheckCircle size={16} />
              </div>
            </div>
            <div className="stat-card-value">{pendingProjects.length}</div>
            <div className="stat-card-description">Projects awaiting payment</div>
          </div>
        </div>

        {/* RECENT PAYMENTS BLOCK */}
        <div className="content-card">
          <h2 className="card-title">Recent Payments</h2>
          
          {recentPayments.length === 0 ? (
            <div className="empty-state">
              <p>No recent payments</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Client</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={{ fontWeight: 600 }}>{payment.project_name}</td>
                      <td>{payment.client_name}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(payment.amount_paid, payment.currency)}</td>
                      <td>
                        <span className={`badge badge-${payment.status}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
                        {new Date(payment.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                        {payment.reference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  // 2. Projects View (Standard invoice administration table)
  const renderProjectsView = () => {
    return (
      <>
        <div className="dashboard-header flex-between">
          <div>
            <h1 className="dashboard-title">Projects</h1>
            <p className="dashboard-subtitle">Create projects and manage client billing links.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> New Invoice Link
          </button>
        </div>

        <div className="content-card">
          {projects.length === 0 ? (
            <div className="empty-state">
              <FolderOpen size={40} style={{ color: 'var(--admin-text-muted)', marginBottom: '12px' }} />
              <p>No invoices created yet. Click "New Invoice Link" to create your first client payment link.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Project & Client Details</th>
                    <th>Billing Amount</th>
                    <th>Status</th>
                    <th>Created On</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{project.project_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                          {project.client_name} • {project.client_email}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(project.amount, project.currency)}</td>
                      <td>
                        <span className={`badge badge-${project.status}`}>
                          {project.status === 'paid' && <CheckCircle size={10} />}
                          {project.status === 'pending' && <Clock size={10} />}
                          {project.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
                        {new Date(project.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => copyPaymentLink(project.id)}
                          >
                            <Copy size={12} /> {copiedId === project.id ? "Copied!" : "Copy Link"}
                          </button>
                          <Link 
                            to={`/pay/${project.id}`} 
                            target="_blank" 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            <ExternalLink size={12} /> Open
                          </Link>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--failed)' }}
                            onClick={() => handleDeleteProject(project.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  // 3. Payments Audit Log View
  const renderPaymentsView = () => {
    return (
      <>
        <div className="dashboard-header">
          <h1 className="dashboard-title">Payments</h1>
          <p className="dashboard-subtitle">Audit log of all client checkout transactions.</p>
        </div>

        <div className="content-card">
          {payments.length === 0 ? (
            <div className="empty-state">
              <CreditCard size={40} style={{ color: 'var(--admin-text-muted)', marginBottom: '12px' }} />
              <p>No payments recorded yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Project</th>
                    <th>Client Name</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Verified Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                        {payment.reference}
                      </td>
                      <td style={{ fontWeight: 600 }}>{payment.project_name}</td>
                      <td>{payment.client_name}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(payment.amount_paid, payment.currency)}</td>
                      <td>
                        <span className={`badge badge-${payment.status}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
                        {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : new Date(payment.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="admin-container">
      {/* SIDEBAR NAVIGATION (Matches attached screenshot structure) */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-dot"></div>
          projects
        </div>
        <div className="sidebar-menu">
          <button 
            className={`sidebar-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <LayoutGrid size={18} />
            Dashboard
          </button>
          <button 
            className={`sidebar-item ${currentView === 'projects' ? 'active' : ''}`}
            onClick={() => setCurrentView('projects')}
          >
            <FolderOpen size={18} />
            Projects
          </button>
          <button 
            className={`sidebar-item ${currentView === 'payments' ? 'active' : ''}`}
            onClick={() => setCurrentView('payments')}
          >
            <CreditCard size={18} />
            Payments
          </button>
        </div>
        <div className="sidebar-footer">
          <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>
            admin
          </span>
          <button 
            onClick={handleLogout} 
            style={{ background: 'none', border: 'none', color: 'var(--failed)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* MAIN VIEW AREA */}
      <div className="main-content">
        {currentView === 'dashboard' && renderDashboardView()}
        {currentView === 'projects' && renderProjectsView()}
        {currentView === 'payments' && renderPaymentsView()}
      </div>

      {/* NEW PROJECT MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '500px', marginBottom: 0, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1.25rem', fontWeight: 700 }}>Create Payment Invoice Link</h3>
            
            {formError && (
              <div style={{ color: 'var(--failed)', background: 'var(--failed-bg)', border: '1px solid var(--failed-border)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '15px', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Project Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Mobile App Redesign" 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Client Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Janet Doe" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Client Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="e.g. janet@example.com" 
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Currency</label>
                  <select 
                    className="form-control" 
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="GHS">GHS (GH₵)</option>
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Billing Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label>Billing Description (Optional)</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  placeholder="e.g. Design sprint milestones details, final deliverables, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Generating Link..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. CLIENT PAYMENT PORTAL & RECEIPT COMPONENT
// ==========================================
function ClientPayment() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        const response = await fetch(`${API_BASE}/projects/${id}`);
        if (!response.ok) {
          throw new Error("Project billing details not found.");
        }
        const data = await response.json();
        setProject(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProjectDetails();
  }, [id]);

  const handlePayNow = async () => {
    setPaying(true);
    try {
      const response = await fetch(`${API_BASE}/projects/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_url: `${window.location.origin}/pay/verify`
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Payment initialization failed.");
      }
      
      // Redirect client to Paystack Authorization Checkout
      window.location.href = data.authorization_url;
    } catch (err) {
      alert(err.message);
      setPaying(false);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="client-wrapper">
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="animate-spin" size={40} style={{ color: 'var(--client-primary)' }} />
          <p style={{ marginTop: '20px', color: 'var(--client-text-secondary)' }}>Fetching invoice details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-wrapper">
        <div className="client-panel" style={{ textAlign: 'center' }}>
          <AlertTriangle size={48} style={{ color: 'var(--failed)', marginBottom: '15px' }} />
          <h2 style={{ marginBottom: '12px' }}>Billing Error</h2>
          <p style={{ color: 'var(--client-text-secondary)', marginBottom: '24px' }}>{error}</p>
          <a href="/" className="btn btn-secondary">Return Home</a>
        </div>
      </div>
    );
  }

  const activePayment = project.payments && project.payments.length > 0 
    ? project.payments.find(p => p.status === 'success') || project.payments[project.payments.length - 1]
    : null;

  return (
    <div className="client-wrapper">
      <div style={{ width: '100%', maxWidth: '600px' }}>
        {/* Hide header during printing */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span className="client-logo" style={{ marginBottom: 0 }}>
            <Layers size={20} style={{ color: 'var(--client-primary)' }} />
            Projects Invoice
          </span>
          {project.status === 'paid' && (
            <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} onClick={triggerPrint}>
              <Printer size={16} /> Print Receipt
            </button>
          )}
        </div>

        {/* MAIN PANEL */}
        <div className="client-panel print-content">
          {/* Printable logo header */}
          <div className="print-only" style={{ display: 'none', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
            <h1 style={{ fontSize: '1.75rem', color: '#fff', fontWeight: 800 }}>PAYMENT RECEIPT</h1>
            <p style={{ color: 'var(--client-text-secondary)', fontSize: '0.85rem' }}>Generated on {new Date().toLocaleString()}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--client-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Invoice Details
              </span>
              <h2 style={{ fontSize: '1.65rem', marginTop: '2px', color: '#fff' }}>{project.project_name}</h2>
            </div>
            <div>
              <span className={`badge ${project.status === 'paid' ? 'client-badge-paid' : 'client-badge-pending'}`} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                {project.status === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--client-text-secondary)' }}>Client Details:</span>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: '2px', color: '#fff' }}>{project.client_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--client-text-secondary)' }}>{project.client_email}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--client-text-secondary)' }}>Invoice Reference:</span>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginTop: '2px', wordBreak: 'break-all' }}>
                {project.id}
              </div>
            </div>
          </div>

          {project.description && (
            <div className="client-description-card">
              <span style={{ fontSize: '0.75rem', color: 'var(--client-text-secondary)', display: 'block', marginBottom: '4px' }}>Project Terms / Scope:</span>
              <p style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{project.description}</p>
            </div>
          )}

          <div className="client-totals-card">
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--client-text-secondary)' }}>Total Invoice Amount</span>
              <div style={{ fontSize: '0.7rem', color: 'var(--client-text-secondary)', opacity: 0.7 }}>Inclusive of payment gateway fees</div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              {formatCurrency(project.amount, project.currency)}
            </div>
          </div>

          <div className="no-print">
            {project.status === 'pending' ? (
              <button 
                className="client-btn-pay" 
                onClick={handlePayNow}
                disabled={paying}
              >
                {paying ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    Redirecting to Paystack...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Secure Checkout
                  </>
                )}
              </button>
            ) : (
              <div style={{ 
                border: '1px solid var(--success-border)', 
                background: 'var(--success-bg)', 
                color: 'var(--success)',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600
              }}>
                <ShieldCheck size={20} />
                Transaction Cleared
              </div>
            )}
          </div>

          {project.status === 'paid' && activePayment && (
            <div style={{ marginTop: '30px', borderTop: '1px solid var(--admin-border)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--admin-text-secondary)' }}>Payment Audit details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Gateway Reference:</span>
                  <div style={{ fontFamily: 'monospace', color: 'var(--admin-text-primary)', marginTop: '2px', wordBreak: 'break-all' }}>{activePayment.reference}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Audit Date:</span>
                  <div style={{ color: 'var(--admin-text-primary)', marginTop: '2px' }}>
                    {activePayment.paid_at ? new Date(activePayment.paid_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Payment Method:</span>
                  <div style={{ color: 'var(--admin-text-primary)', marginTop: '2px' }}>Paystack Gateway Checkout</div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Audit Status:</span>
                  <div style={{ color: 'var(--success)', marginTop: '2px', fontWeight: 600 }}>Success</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .client-wrapper {
            background: none !important;
            min-height: auto !important;
            padding: 0 !important;
          }
          .print-content {
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .print-content h1, 
          .print-content h2, 
          .print-content h3, 
          .print-content div, 
          .print-content span, 
          .print-content p {
            color: #000000 !important;
          }
          .print-only {
            display: block !important;
          }
          .badge {
            border: 1px solid #000000 !important;
            color: #000000 !important;
            background: transparent !important;
          }
          .client-totals-card {
            border: 1px solid #000000 !important;
            background: transparent !important;
          }
        }
      `}</style>
    </div>
  );
}

// ==========================================
// 4. CALLBACK PAYMENT VERIFICATION PAGE
// ==========================================
function PaymentVerify() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference");
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const [project, setProject] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPaymentOnServer = async () => {
      if (!reference) {
        setStatus('error');
        setErrorMsg("Transaction reference missing.");
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/projects/verify/${reference}`, {
          method: 'POST'
        });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.detail || "Payment verification failed.");
        }
        
        setProject(data);
        setStatus('success');
        
        // Redirect client to their project invoice page after a brief delay
        setTimeout(() => {
          navigate(`/pay/${data.id}`);
        }, 2200);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    };

    verifyPaymentOnServer();
  }, [reference, navigate]);

  return (
    <div className="client-wrapper">
      <div className="client-panel" style={{ maxWidth: '440px', textAlign: 'center' }}>
        {status === 'verifying' && (
          <>
            <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--client-primary)', marginBottom: '20px' }} />
            <h2 style={{ marginBottom: '10px', color: '#fff' }}>Verifying Payment</h2>
            <p style={{ color: 'var(--client-text-secondary)' }}>Confirming checkout audits with Paystack gateways...</p>
          </>
        )}

        {status === 'success' && project && (
          <>
            <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '20px' }} />
            <h2 style={{ marginBottom: '10px', color: 'var(--success)' }}>Payment Approved!</h2>
            <p style={{ color: 'var(--client-text-secondary)', marginBottom: '15px' }}>
              We successfully received your payment of <strong>{formatCurrency(project.amount, project.currency)}</strong>.
            </p>
            <p style={{ color: 'var(--client-text-secondary)', fontSize: '0.85rem', opacity: 0.8 }}>Loading receipt...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle size={48} style={{ color: 'var(--failed)', marginBottom: '20px' }} />
            <h2 style={{ marginBottom: '10px', color: 'var(--failed)' }}>Verification Failed</h2>
            <p style={{ color: 'var(--client-text-secondary)', marginBottom: '25px' }}>{errorMsg}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/')}>Return Home</button>
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 5. MOCK PAYSTACK GATEWAY SIMULATOR
// ==========================================
function MockPaystack() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference");
  const amount = searchParams.get("amount");
  const email = searchParams.get("email");
  const currency = searchParams.get("currency") || "NGN";
  const callback = searchParams.get("callback");

  const [paymentMethod, setPaymentMethod] = useState('card'); // card, transfer, ussd
  const [cardNumber, setCardNumber] = useState('4081  2234  5678  9010');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');

  const handleSimulatePayment = (success) => {
    if (!callback) return;
    
    // In a real Paystack checkout, after payment they append reference to callback URL:
    // e.g. callback_url?reference=xxx
    const redirectUrl = new URL(callback);
    redirectUrl.searchParams.set("reference", reference);
    redirectUrl.searchParams.set("status", success ? "success" : "failed");
    
    window.location.href = redirectUrl.toString();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#040206',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#ffffff',
        color: '#1a1a1a',
        width: '100%',
        maxWidth: '430px',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Paystack Header */}
        <div style={{
          background: '#09a5db',
          color: '#ffffff',
          padding: '24px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAYING MERCHANT</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', marginTop: '2px' }}>Projects Sandbox</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>
              {formatCurrency(amount, currency)}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{email}</div>
          </div>
        </div>

        {/* Notice of Mock Sandbox */}
        <div style={{
          background: '#fff3cd',
          color: '#856404',
          borderBottom: '1px solid #ffeeba',
          padding: '12px 20px',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ShieldCheck size={18} style={{ color: '#856404', flexShrink: 0 }} />
          <div>
            <strong>Paystack Simulator:</strong> No real money will be charged. Select simulator actions below.
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', background: '#f5f5f7', borderBottom: '1px solid #e1e1e3' }}>
          {['card', 'transfer', 'ussd'].map((method) => (
            <button 
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              style={{
                flex: 1,
                border: 'none',
                background: paymentMethod === method ? '#ffffff' : 'transparent',
                padding: '14px 10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: paymentMethod === method ? '#09a5db' : '#6b7280',
                cursor: 'pointer',
                borderBottom: paymentMethod === method ? '2px solid #09a5db' : 'none'
              }}
            >
              {method === 'card' && 'Pay with Card'}
              {method === 'transfer' && 'Bank Transfer'}
              {method === 'ussd' && 'USSD Code'}
            </button>
          ))}
        </div>

        {/* Checkout Forms Body */}
        <div style={{ padding: '24px 20px' }}>
          {paymentMethod === 'card' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '6px' }}>CARD NUMBER</label>
                <input 
                  type="text" 
                  value={cardNumber} 
                  onChange={(e) => setCardNumber(e.target.value)}
                  style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', letterSpacing: '1px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '6px' }}>EXPIRY</label>
                  <input 
                    type="text" 
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', textAlign: 'center' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '6px' }}>CVV</label>
                  <input 
                    type="password" 
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'transfer' && (
            <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '8px' }}>Transfer exactly the bill amount to:</div>
              <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#111827' }}>Wema Bank</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#09a5db', margin: '4px 0', fontFamily: 'monospace' }}>9920192837</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Account Name: Paystack / Projects Sandbox</div>
              </div>
            </div>
          )}

          {paymentMethod === 'ussd' && (
            <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '8px' }}>Dial this USSD code on your mobile phone:</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#111827', margin: '12px 0', fontFamily: 'monospace' }}>*737*1*2#</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Press Send and follow the prompts to authorize payment.</div>
            </div>
          )}

          {/* SIMULATION CONTROLS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              type="button"
              onClick={() => handleSimulatePayment(true)}
              style={{
                width: '100%',
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '16px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle size={18} /> Simulate Successful Payment
            </button>
            <button 
              type="button"
              onClick={() => handleSimulatePayment(false)}
              style={{
                width: '100%',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} /> Simulate Declined Payment
            </button>
            <button 
              type="button"
              onClick={() => window.close()}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Cancel & Return
            </button>
          </div>
        </div>

        {/* Paystack Footer */}
        <div style={{
          background: '#f9fafb',
          borderTop: '1px solid #f3f4f6',
          padding: '16px 20px',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#9ca3af',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <ShieldCheck size={14} style={{ color: '#10b981' }} /> Secured by <strong>paystack</strong>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. MAIN APP SHELL
// ==========================================
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Client Billing / Payment / Receipt Portal */}
        <Route path="/pay/:id" element={<ClientPayment />} />
        
        {/* Callback verification handler */}
        <Route path="/pay/verify" element={<PaymentVerify />} />
        
        {/* Paystack Checkout Simulator */}
        <Route path="/mock-pay" element={<MockPaystack />} />
        
        {/* Admin Section */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Fallbacks */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '20px', background: '#f8fafc' }}>
            <h2>Projects Payment Portal</h2>
            <Link to="/admin/login" className="btn btn-primary">Admin Sign In</Link>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
