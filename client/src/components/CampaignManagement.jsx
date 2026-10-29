import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Plus,
  Edit2,
  Eye,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import './CampaignManagement.css';

export default function CampaignManagement() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);

  const emptyForm = {
    name: '',
    occasion: '',
    startDate: '',
    endDate: '',
    bannerText: '',
    bannerColor: '#ffcc00',
    animationPreset: '',
    informational: true,
    discount: 0,
    targetPortals: ['STUDENT'],
    isActive: false,
  };
  const [form, setForm] = useState(emptyForm);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/admin/campaigns');
      if (data.success) setCampaigns(data.campaigns || []);
      else setError(data.message || 'Failed to load campaigns');
    } catch (err) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const openModal = (campaign = null) => {
    setError('');
    setSuccess('');
    if (campaign) {
      setEditing(campaign);
      setForm({
        name: campaign.name || '',
        occasion: campaign.occasion || '',
        startDate: campaign.startDate ? campaign.startDate.substring(0, 10) : '',
        endDate: campaign.endDate ? campaign.endDate.substring(0, 10) : '',
        bannerText: campaign.bannerText || '',
        bannerColor: campaign.bannerColor || '#ffcc00',
        animationPreset: campaign.animationPreset || '',
        informational: campaign.informational ?? true,
        discount: campaign.discount || 0,
        targetPortals: campaign.targetPortals || ['STUDENT'],
        isActive: campaign.isActive ?? false,
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'targetPortals') {
      const newPorts = checked
        ? [...form.targetPortals, value]
        : form.targetPortals.filter((p) => p !== value);
      setForm({ ...form, targetPortals: newPorts });
    } else if (type === 'checkbox') {
      setForm({ ...form, [name]: checked });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.name || !form.occasion || !form.startDate || !form.endDate) {
      setError('Name, occasion and dates are required');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError('End date must be after start date');
      return;
    }
    try {
      const payload = { ...form };
      const endpoint = editing ? `/admin/campaigns/${editing._id}` : '/admin/campaigns';
      const method = editing ? api.put : api.post;
      const res = await method(endpoint, payload);
      if (res.success) {
        setSuccess(res.message || (editing ? 'Campaign updated' : 'Campaign created'));
        closeModal();
        fetchCampaigns();
      } else {
        setError(res.message || 'Operation failed');
      }
    } catch (err) {
      setError(err.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign? This cannot be undone.')) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete(`/admin/campaigns/${id}`);
      if (res.success) {
        setSuccess('Campaign deleted');
        fetchCampaigns();
      } else {
        setError(res.message || 'Delete failed');
      }
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleToggle = async (id) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.patch(`/admin/campaigns/${id}/toggle`);
      if (res.success) {
        setSuccess('Campaign status updated');
        fetchCampaigns();
      } else {
        setError(res.message || 'Toggle failed');
      }
    } catch (err) {
      setError(err.message || 'Toggle failed');
    }
  };

  const handlePreview = (campaign) => {
    setPreview(campaign);
  };
  const closePreview = () => setPreview(null);

  return (
    <div className="glass-card" style={{ maxWidth: '900px', margin: '2rem auto', padding: '2rem' }}>
      <h2 className="campaign-title">Campaign Management</h2>
      <p className="campaign-subtitle">
        Create, edit, preview and activate/deactivate promotional campaigns.
      </p>
      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <button className="btn-primary" onClick={() => openModal()} style={{ marginBottom: '1rem' }}>
        <Plus size={16} style={{ verticalAlign: 'middle' }} /> Add Campaign
      </button>

      {loading ? (
        <p>Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <p className="empty-state">No campaigns yet. Click “Add Campaign” to get started.</p>
      ) : (
        <table className="campaign-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Occasion</th>
              <th>Period</th>
              <th>Portals</th>
              <th>Discount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>{c.occasion}</td>
                <td>{c.startDate?.substring(0, 10)} → {c.endDate?.substring(0, 10)}</td>
                <td>{c.targetPortals?.join(', ')}</td>
                <td>{c.informational ? 'Info only' : `${c.discount}%`}</td>
                <td>{c.isActive ? 'Active' : 'Inactive'}</td>
                <td className="action-cell">
                  <button className="icon-btn" onClick={() => handlePreview(c)} title="Preview">
                    <Eye size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => openModal(c)} title="Edit">
                    <Edit2 size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => handleToggle(c._id)} title={c.isActive ? 'Deactivate' : 'Activate'}>
                    {c.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                  </button>
                  <button className="icon-btn" onClick={() => handleDelete(c._id)} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal} title="Close">
              <X size={20} />
            </button>
            <h3>{editing ? 'Edit Campaign' : 'New Campaign'}</h3>
            <form onSubmit={submitForm} className="campaign-form">
              <div className="form-group">
                <label>Name</label>
                <input type="text" name="name" value={form.name} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Occasion</label>
                <input type="text" name="occasion" value={form.occasion} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" name="startDate" value={form.startDate} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" name="endDate" value={form.endDate} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Banner Text</label>
                <input type="text" name="bannerText" value={form.bannerText} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Banner Color</label>
                <input type="color" name="bannerColor" value={form.bannerColor} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Informational Only</label>
                <input type="checkbox" name="informational" checked={form.informational} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Discount % (if not informational)</label>
                <input type="number" name="discount" min="0" max="100" value={form.discount} onChange={handleInputChange} disabled={form.informational} />
              </div>
              <div className="form-group">
                <label>Target Portals</label>
                <div className="checkboxes">
                  {['STUDENT', 'SHOPKEEPER', 'DELIVERY_BOY'].map((p) => (
                    <label key={p}>
                      <input
                        type="checkbox"
                        name="targetPortals"
                        value={p}
                        checked={form.targetPortals.includes(p)}
                        onChange={handleInputChange}
                      />
                      {p.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>
              <button className="btn-primary" type="submit" style={{ marginTop: '1rem' }}>
                Save
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <button className="modal-close" onClick={closePreview} title="Close">
              <X size={20} />
            </button>
            <h3>{preview.bannerText || preview.name}</h3>
            <div
              style={{
                background: preview.bannerColor || '#ffcc00',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <p>{preview.bannerText}</p>
              <button className="btn-primary" onClick={() => alert('Shop Now clicked')}>Shop Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
