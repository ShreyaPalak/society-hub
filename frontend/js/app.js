const { useState, useEffect, useCallback, useRef, createContext, useContext } = React;
const apiClient = window.ShAPI.api;
const sessionGetToken = window.ShAPI.getToken;
const sessionSet = window.ShAPI.setSession;
const sessionClear = window.ShAPI.clearSession;
const sessionUser = window.ShAPI.getUser;
const apiBase = window.ShAPI.API_BASE;

/* ============================== Toasts ============================== */
const ToastCtx = createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => useContext(ToastCtx);

/* ============================== Badges ============================== */
function StatusBadge({ status }) {
  const labels = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };
  return <span className={`badge badge-${status.toLowerCase()}`}>{labels[status] || status}</span>;
}
function PriorityBadge({ priority }) {
  return <span className={`badge badge-priority-${priority.toLowerCase()}`}>{priority}</span>;
}
function CategoryBadge({ category }) {
  return <span className="badge badge-category">{category}</span>;
}
function OverdueBadge() {
  return <span className="badge badge-overdue">! Overdue</span>;
}

/* ============================== Empty state ============================== */
function EmptyState({ icon = '\u{1F4ED}', title, subtitle }) {
  return (
    <div className="empty-state card">
      <div className="empty-icon">{icon}</div>
      <div style={{ fontWeight: 600, color: '#0F172A' }}>{title}</div>
      {subtitle && <div className="caption">{subtitle}</div>}
    </div>
  );
}

/* ============================== Modal shell ============================== */
function Modal({ title, onClose, children, footer, width }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>{title}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ============================== Header shell ============================== */
function Header({ user, onLogout }) {
  return (
    <header className="app-header">
      <div className="brand"><span className="logo-dot" /> Society Hub</div>
      <div className="user-area">
        <span>{user.name}</span>
        <span className="role-pill">{user.role}</span>
        <button className="btn-logout" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}

/* ============================== Auth Page ============================== */
function AuthPage({ onAuthed }) {
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', apartment_no: '' });

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await apiClient.login(form.email, form.password)
        : await apiClient.register(form);
      sessionSet(res.token, res.user);
      toast(`Welcome, ${res.user.name.split(' ')[0]}!`, 'success');
      onAuthed(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 style={{ marginBottom: 4 }}>Society Hub</h1>
        <p className="caption" style={{ marginBottom: 20 }}>Maintenance & operations, in one place.</p>

        <div className="auth-toggle">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">Log in</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">Resident sign up</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <div className="field">
                <label>Full name</label>
                <input type="text" required value={form.name} onChange={update('name')} style={{ width: '100%' }} />
              </div>
              <div className="field">
                <label>Apartment No.</label>
                <input type="text" required placeholder="e.g. A-302" value={form.apartment_no} onChange={update('apartment_no')} style={{ width: '100%' }} />
              </div>
            </>
          )}
          <div className="field">
            <label>Email</label>
            <input type="text" required value={form.email} onChange={update('email')} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required value={form.password} onChange={update('password')} style={{ width: '100%' }} />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
            {loading && <span className="spinner" />}
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="hint-box">
          Demo accounts &mdash; Admin: <b>admin@societyhub.local</b> / Admin@12345<br />
          Resident: <b>jane@societyhub.local</b> / Resident@123
        </div>
      </div>
    </div>
  );
}

/* ============================== Notice Board ============================== */
function NoticeBoard({ notices }) {
  const pinned = notices.filter((n) => n.is_important);
  const rest = notices.filter((n) => !n.is_important);
  return (
    <div className="section">
      <div className="section-head"><h2>Notice Board</h2></div>
      {pinned.map((n) => (
        <div className="notice-pinned" key={n.id}>
          <span className="pin-badge">PINNED</span>
          <div>
            <div style={{ fontWeight: 700 }}>{n.title}</div>
            <div className="caption">{n.content}</div>
          </div>
        </div>
      ))}
      {notices.length === 0 && <EmptyState icon="\u{1F4CB}" title="No notices yet" subtitle="Announcements from your admin will appear here." />}
      {rest.length > 0 && (
        <div className="card">
          {rest.map((n) => (
            <div className="notice-item" key={n.id}>
              <div style={{ fontWeight: 600 }}>{n.title}</div>
              <div className="caption" style={{ margin: '4px 0' }}>{n.content}</div>
              <div className="caption">by {n.author_name} &middot; {new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== Timeline Modal ============================== */
function TimelineModal({ complaintId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    apiClient.complaintDetail(complaintId)
      .then((res) => live && setData(res))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [complaintId]);

  return (
    <Modal title={`Complaint Details ${complaintId ? '#' + complaintId : ''}`} onClose={onClose} width="620px">
      {error && <div className="error-text">{error}</div>}
      {!data && !error && <div className="caption">Loading...</div>}
      {data && (
        <>
          <div className="caption" style={{ marginBottom: 4 }}>
            <CategoryBadge category={data.complaint.category} /> &nbsp;
            Created: {new Date(data.complaint.created_at).toLocaleString()}
          </div>
          <p style={{ marginTop: 8 }}>{data.complaint.description}</p>
          {data.complaint.photo_url && (
            <a href={`${apiBase.replace(/\/api(?:\/v1)?$/, '')}${data.complaint.photo_url}`} target="_blank" rel="noreferrer">
              <img src={`${apiBase.replace(/\/api(?:\/v1)?$/, '')}${data.complaint.photo_url}`} alt="attachment" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8 }} />
            </a>
          )}

          <h2 style={{ marginTop: 24, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B' }}>
            Resolution Timeline
          </h2>
          <div className="timeline">
            {[...data.history].reverse().map((h) => (
              <div className="timeline-item" key={h.id}>
                <div className={`timeline-dot ${h.new_status === 'RESOLVED' ? 'resolved' : ''}`} />
                <div className="timeline-content">
                  <div className="timeline-title">
                    {h.action_type === 'CREATED' && 'COMPLAINT CREATED'}
                    {h.action_type === 'STATUS_CHANGE' && (h.new_status || '').replace('_', ' ')}
                    {h.action_type === 'PRIORITY_CHANGE' && `PRIORITY: ${h.previous_priority} \u2192 ${h.new_priority}`}
                  </div>
                  <div className="timeline-meta">
                    by {h.actor_name} ({h.actor_role === 'admin' ? 'Admin' : 'Resident'}) &middot; {new Date(h.created_at).toLocaleString()}
                  </div>
                  {h.note && <div className="timeline-note">{h.note}</div>}
                  {h.new_status === 'IN_PROGRESS' && h.assigned_worker_name && (
                    <div className="card" style={{ marginTop: 10, padding: 12, background: '#F0FDF4' }}>
                      <strong>Service Personnel</strong>
                      <div>{h.assigned_worker_name}</div>
                      {h.assigned_worker_phone && <a href={`tel:${h.assigned_worker_phone}`}>{h.assigned_worker_phone}</a>}
                      {data.complaint.scheduled_visit_time && <div className="caption">Visit: {new Date(data.complaint.scheduled_visit_time).toLocaleString()}</div>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ============================== New Complaint Modal ============================== */
const CATEGORIES = ['Plumbing', 'Electrical', 'Elevator', 'Common Area', 'Security', 'Housekeeping', 'Other'];

function NewComplaintModal({ onClose, onCreated }) {
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  function pickFile(f) {
    if (!f) return;
    if (!['image/png', 'image/jpeg'].includes(f.type)) {
      setError('Only PNG or JPG images are supported.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File too large - max 5MB.');
      return;
    }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    setError('');
    if (!category) return setError('Please select a category.');
    if (!description || description.trim().length < 5) return setError('Description must be at least 5 characters.');

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      if (file) formData.append('photo', file);
      const res = await apiClient.createComplaint(formData);
      toast('Complaint submitted.', 'success');
      onCreated(res.complaint);
    } catch (err) {
      // Form text and photo selection are intentionally NOT cleared here,
      // so a network blip during upload never costs the resident their draft.
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Raise a Maintenance Complaint"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting && <span className="spinner" />} Submit Complaint
          </button>
        </>
      )}
    >
      <div className="field">
        <label>Category *</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }}>
          <option value="">Select category&hellip;</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Description *</label>
        <textarea
          placeholder="Provide detailed information about the issue..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Upload Photo (Optional)</label>
        <div
          className={`dropzone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
        >
          Drag & drop image here or click to browse
          <div className="caption">Supported format: PNG, JPG (Max 5MB)</div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={(e) => pickFile(e.target.files[0])} />
        </div>
        {preview && (
          <div className="file-preview">
            <img src={preview} alt="preview" />
            <button className="remove-file" onClick={() => { setFile(null); setPreview(null); }}>Remove</button>
          </div>
        )}
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}

/* ============================== Resident Dashboard ============================== */
function ResidentDashboard({ user, toast }) {
  const [complaints, setComplaints] = useState(null);
  const [notices, setNotices] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [showNew, setShowNew] = useState(false);
  const [timelineId, setTimelineId] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.category) params.category = filters.category;
      apiClient.myComplaints(params).then((r) => setComplaints(r.complaints)).catch((e) => toast(e.message, 'error'));
  }, [filters, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiClient.listNotices().then((r) => setNotices(r.notices)).catch(() => {}); }, []);

  return (
    <div className="page">
      <NoticeBoard notices={notices} />

      <div className="section">
        <div className="section-head">
          <h2>My Complaints</h2>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Raise New Complaint</button>
        </div>

        <div className="filters">
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {complaints === null && <div className="caption">Loading complaints&hellip;</div>}
        {complaints && complaints.length === 0 && (
          <EmptyState icon="\u{2705}" title="No complaints found" subtitle="Nothing matches these filters, or you haven't raised any yet." />
        )}
        {complaints && complaints.map((c) => (
          <div className="card complaint-card" key={c.id} onClick={() => setTimelineId(c.id)}>
            <div className="cc-left">
              <div className="cc-id">#{c.id}</div>
              <div className="cc-title">{c.description.length > 70 ? c.description.slice(0, 70) + '\u2026' : c.description}</div>
              <div className="cc-meta">
                <CategoryBadge category={c.category} />
                <PriorityBadge priority={c.priority} />
                <span className="caption">Submitted: {new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="cc-right">
              {c.photo_url && <img className="cc-thumb" src={`${apiBase.replace(/\/api(?:\/v1)?$/, '')}${c.photo_url}`} alt="" />}
              <StatusBadge status={c.status} />
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <NewComplaintModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}
      {timelineId && <TimelineModal complaintId={timelineId} onClose={() => setTimelineId(null)} />}
    </div>
  );
}

/* ============================== New Notice Modal ============================== */
function NewNoticeModal({ onClose, onCreated }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!title.trim() || !content.trim()) return setError('Title and content are required.');
    setSubmitting(true);
    try {
      const res = await apiClient.createNotice({ title, content, is_important: important });
      toast(important ? 'Notice published and residents notified.' : 'Notice published.', 'success');
      onCreated(res.notice);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Create New Announcement"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting && <span className="spinner" />} Publish Notice
          </button>
        </>
      )}
    >
      <div className="field">
        <label>Notice Title *</label>
        <input type="text" style={{ width: '100%' }} placeholder="e.g., Scheduled Water Shutdown for Tower A" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Notice Content *</label>
        <textarea placeholder="Enter full text announcement here..." value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" id="imp" checked={important} onChange={(e) => setImportant(e.target.checked)} />
        <label htmlFor="imp" style={{ margin: 0 }}>Mark as Important (pins notice to top of resident feed and triggers email)</label>
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}

/* ============================== Admin Dashboard ============================== */
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

function AdminDashboard({ user, toast }) {
  const [metrics, setMetrics] = useState(null);
  const [complaints, setComplaints] = useState(null);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '' });
  const [showNotice, setShowNotice] = useState(false);
  const [timelineId, setTimelineId] = useState(null);
  const [threshold, setThreshold] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [showUsers, setShowUsers] = useState(false);

  const loadMetrics = useCallback(() => {
    apiClient.metrics().then(setMetrics).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const loadComplaints = useCallback(() => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      apiClient.allComplaints(params).then((r) => setComplaints(r.complaints)).catch((e) => toast(e.message, 'error'));
  }, [filters, toast]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);
  useEffect(() => { loadComplaints(); }, [loadComplaints]);
  useEffect(() => { apiClient.getOverdueThreshold().then((r) => setThreshold(r.overdue_threshold_days)).catch(() => {}); }, []);
  useEffect(() => {
    if (!window.io || !sessionGetToken()) return undefined;
    const socket = window.io('http://localhost:4000', { auth: { token: sessionGetToken() } });
    socket.on('complaint:created', ({ complaint }) => {
      toast(`New complaint #${complaint.id} received.`, 'info');
      loadComplaints();
      loadMetrics();
    });
    return () => socket.disconnect();
  }, [loadComplaints, loadMetrics, toast]);

  async function changeStatus(id, status, details = {}) {
    try {
      await apiClient.updateStatus(id, status, details.note, details);
      toast(`Complaint #${id} marked ${status.replace('_', ' ')}.`, 'success');
      loadComplaints();
      loadMetrics();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function changePriority(id, priority) {
    try {
      await apiClient.updatePriority(id, priority);
      toast(`Complaint #${id} priority set to ${priority}.`, 'success');
      loadComplaints();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  
    useEffect(() => {
      if (!window.io || !sessionGetToken()) return undefined;
      const socket = window.io('http://localhost:4000', { auth: { token: sessionGetToken() } });
      socket.on('complaint:created', ({ complaint }) => {
        toast(`New complaint #${complaint.id} received.`, 'info');
        loadComplaints();
        loadMetrics();
      });
      return () => socket.disconnect();
    }, [loadComplaints, loadMetrics, toast]);
  async function saveThreshold(days) {
    try {
      const r = await apiClient.setOverdueThreshold(days);
        await apiClient.updateStatus(id, status, details.note, details);
      toast(`Overdue threshold updated to ${r.overdue_threshold_days} day(s).`, 'success');
      loadComplaints();
      loadMetrics();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="metrics-grid">
        <div className="card metric-card"><div className="metric-label">Total Open</div><div className="metric-value">{metrics ? metrics.open : '\u2013'}</div></div>
        <div className="card metric-card"><div className="metric-label">In Progress</div><div className="metric-value">{metrics ? metrics.in_progress : '\u2013'}</div></div>
        <div className="card metric-card"><div className="metric-label">Resolved</div><div className="metric-value">{metrics ? metrics.resolved : '\u2013'}</div></div>
        <div className="card metric-card overdue"><div className="metric-label">Overdue</div><div className="metric-value">{metrics ? metrics.overdue : '\u2013'}</div></div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Manage Complaints</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="caption">Overdue after</span>
            <input
              type="number" min="1" style={{ width: 56 }}
              value={threshold ?? ''}
              onChange={(e) => setThreshold(Number(e.target.value))}
              onBlur={(e) => e.target.value && saveThreshold(Number(e.target.value))}
            />
            <span className="caption">day(s)</span>
            <button className="btn btn-primary" onClick={() => setShowNotice(true)}>+ Post New Notice</button>
          </div>
        </div>

        <div className="filters">
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="search" placeholder="Search Complaint ID" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </div>

        <div className="card" style={{ padding: 0 }}>
          {complaints === null && <div className="caption" style={{ padding: 16 }}>Loading&hellip;</div>}
          {complaints && complaints.length === 0 && (
            <EmptyState icon="\u{1F4ED}" title="No complaints found" subtitle="Nothing matches the current filters." />
          )}
          {complaints && complaints.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Resident</th><th>Category</th><th>Priority</th><th>Created</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id} className={c.is_overdue ? 'overdue-row' : ''}>
                    <td>#{c.id}</td>
                    <td>{c.apartment_no || '\u2014'}</td>
                    <td><CategoryBadge category={c.category} /></td>
                    <td>
                      <select value={c.priority} onChange={(e) => changePriority(c.id, e.target.value)}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="caption">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>{c.is_overdue ? <OverdueBadge /> : <StatusBadge status={c.status} />}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <select value={c.status} onChange={(e) => e.target.value === 'IN_PROGRESS'
                        ? setAssignment({ id: c.id, status: e.target.value })
                        : changeStatus(c.id, e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                      <button className="btn btn-ghost btn-sm" onClick={() => setTimelineId(c.id)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showNotice && (
        <NewNoticeModal onClose={() => setShowNotice(false)} onCreated={() => setShowNotice(false)} />
      )}
      {timelineId && <TimelineModal complaintId={timelineId} onClose={() => setTimelineId(null)} />}
      {assignment && <AssignmentModal assignment={assignment} onClose={() => setAssignment(null)} onSave={(details) => { setAssignment(null); changeStatus(assignment.id, assignment.status, details); }} />}
      <div className="section">
        <div className="section-head"><h2>User Management</h2><button className="btn btn-ghost" onClick={() => setShowUsers((value) => !value)}>{showUsers ? 'Hide Users' : 'Manage Users'}</button></div>
        {showUsers && <UserManagement user={user} toast={toast} />}
      </div>
    </div>
  );
}

function AssignmentModal({ assignment, onClose, onSave }) {
  const [details, setDetails] = useState({ assigned_worker_name: '', assigned_worker_phone: '', scheduled_visit_time: '', note: 'Technician dispatched.' });
  const update = (key) => (event) => setDetails((value) => ({ ...value, [key]: event.target.value }));
  return <Modal title={`Assign technician to complaint #${assignment.id}`} onClose={onClose} footer={<button className="btn btn-primary" onClick={() => onSave(details)}>Save Assignment</button>}>
    <div className="field"><label>Worker Name *</label><input value={details.assigned_worker_name} onChange={update('assigned_worker_name')} /></div>
    <div className="field"><label>Worker Phone *</label><input value={details.assigned_worker_phone} onChange={update('assigned_worker_phone')} /></div>
    <div className="field"><label>Scheduled Visit *</label><input type="datetime-local" value={details.scheduled_visit_time} onChange={update('scheduled_visit_time')} /></div>
    <div className="field"><label>Admin Note</label><textarea value={details.note} onChange={update('note')} /></div>
  </Modal>;
}

function UserManagement({ user, toast }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const load = useCallback(() => apiClient.users({ search }).then((response) => setUsers(response.users)).catch((err) => toast(err.message, 'error')), [search, toast]);
  useEffect(() => { load(); }, [load]);
  async function changeRole(target) {
    const nextRole = target.role === 'admin' ? 'resident' : 'admin';
    if (!window.confirm(`${nextRole === 'admin' ? 'Promote' : 'Revoke admin from'} ${target.name}?`)) return;
    try { await apiClient.updateUserRole(target.id, nextRole); toast('User role updated.', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  }
  return <div><input type="search" placeholder="Search name, email or flat" value={search} onChange={(event) => setSearch(event.target.value)} />
    <table><thead><tr><th>Name</th><th>Email</th><th>Flat</th><th>Role</th><th></th></tr></thead><tbody>{users.map((target) => <tr key={target.id}><td>{target.name}</td><td>{target.email}</td><td>{target.flat_number || '-'}</td><td>{target.role}</td><td><button className="btn btn-ghost btn-sm" disabled={target.id === user.id} onClick={() => changeRole(target)}>{target.role === 'admin' ? 'Revoke Admin' : 'Promote to Admin'}</button></td></tr>)}</tbody></table>
  </div>;
}

/* ============================== Root App ============================== */
function AppInner() {
  const [user, setUser] = useState(sessionUser());
  const toast = useToast();

  useEffect(() => {
    // Validate any persisted token on load; drop it silently if stale/expired.
    if (sessionGetToken()) {
      apiClient.me().then((r) => setUser(r.user)).catch(() => { sessionClear(); setUser(null); });
    }
  }, []);

  function logout() {
    sessionClear();
    setUser(null);
  }

  if (!user) return <AuthPage onAuthed={setUser} />;

  return (
    <div>
      <Header user={user} onLogout={logout} />
      {/* Role routing guard: the UI only ever renders the dashboard that
          matches the JWT-verified role in `user`. There is no client route
          a resident can visit to reach the admin view - and even if they
          forged one, every admin API call is independently rejected by the
          backend's authorize('admin') middleware. */}
      {user.role === 'admin'
        ? <AdminDashboard user={user} toast={toast} />
        : <ResidentDashboard user={user} toast={toast} />}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
