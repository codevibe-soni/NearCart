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
  Upload,
  Image as ImageIcon,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Users,
} from 'lucide-react';
import './CampaignManagement.css';

export default function CampaignManagement() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);

  // Form states
  const emptyForm = {
    title: '',
    imageUrl: '',
    message: '',
    targetPortals: ['ALL'],
    isActive: true,
  };
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/admin/campaigns');
      if (data.success) {
        setAnnouncements(data.announcements || data.campaigns || []);
      } else {
        setError(data.message || 'Failed to load announcements');
      }
    } catch (err) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const openModal = (announcement = null) => {
    setError('');
    setSuccess('');
    setSelectedFile(null);

    if (announcement) {
      setEditing(announcement);
      const portals = announcement.targetPortals?.length ? announcement.targetPortals : ['ALL'];
      setForm({
        title: announcement.title || announcement.name || '',
        imageUrl: announcement.imageUrl || announcement.posterUrl || '',
        message: announcement.message || announcement.bannerText || '',
        targetPortals: portals,
        isActive: announcement.isActive ?? announcement.isPublished ?? true,
      });
      setImagePreviewUrl(announcement.imageUrl || announcement.posterUrl || '');
    } else {
      setEditing(null);
      setForm(emptyForm);
      setImagePreviewUrl('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setImagePreviewUrl('');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'isActive') {
      setForm((prev) => ({ ...prev, isActive: checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size must be less than 5MB.');
      return;
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleTargetChange = (portal) => {
    setForm((prev) => {
      let current = [...prev.targetPortals];

      if (portal === 'ALL') {
        return { ...prev, targetPortals: ['ALL'] };
      }

      // Remove ALL if selecting specific
      current = current.filter((p) => p !== 'ALL');

      if (current.includes(portal)) {
        current = current.filter((p) => p !== portal);
      } else {
        current.push(portal);
      }

      // If all three or none are selected, set to ALL
      const allSpecific = ['STUDENT', 'SHOPKEEPER', 'DELIVERY_BOY'];
      if (current.length === 0 || allSpecific.every((p) => current.includes(p))) {
        return { ...prev, targetPortals: ['ALL'] };
      }

      return { ...prev, targetPortals: current };
    });
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title.trim()) {
      setError('Announcement title is required.');
      return;
    }

    if (!selectedFile && !form.imageUrl.trim() && !imagePreviewUrl) {
      setError('A poster image is required. Please choose a file or enter an image URL.');
      return;
    }

    setUploading(true);

    try {
      let finalImageUrl = form.imageUrl.trim();

      // Upload file to server/Cloudinary if file selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('poster', selectedFile);

        const uploadRes = await api.post('/admin/campaigns/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (uploadRes.success && uploadRes.url) {
          finalImageUrl = uploadRes.url;
        } else {
          throw new Error(uploadRes.message || 'Image upload failed');
        }
      }

      const payload = {
        title: form.title.trim(),
        name: form.title.trim(),
        imageUrl: finalImageUrl,
        posterUrl: finalImageUrl,
        message: form.message.trim(),
        targetPortals: form.targetPortals,
        isActive: form.isActive,
        isPublished: form.isActive,
      };

      const endpoint = editing ? `/admin/campaigns/${editing._id}` : '/admin/campaigns';
      const method = editing ? api.put : api.post;

      const res = await method(endpoint, payload);

      if (res.success) {
        setSuccess(res.message || (editing ? 'Announcement updated successfully!' : 'Announcement published successfully!'));
        closeModal();
        fetchAnnouncements();
      } else {
        setError(res.message || 'Operation failed');
      }
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this poster/announcement? This action cannot be undone.')) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete(`/admin/campaigns/${id}`);
      if (res.success) {
        setSuccess('Announcement deleted successfully.');
        fetchAnnouncements();
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
        setSuccess(res.message || 'Announcement status updated.');
        fetchAnnouncements();
      } else {
        setError(res.message || 'Toggle failed');
      }
    } catch (err) {
      setError(err.message || 'Toggle failed');
    }
  };

  const renderAudienceBadges = (portals) => {
    if (!portals || portals.length === 0 || portals.includes('ALL')) {
      return <span className="badge badge-all">All Audiences</span>;
    }
    return (
      <div className="audience-badges">
        {portals.map((p) => {
          if (p === 'STUDENT') return <span key={p} className="badge badge-student">Students</span>;
          if (p === 'SHOPKEEPER') return <span key={p} className="badge badge-shopkeeper">Shopkeepers</span>;
          if (p === 'DELIVERY_BOY') return <span key={p} className="badge badge-delivery">Delivery Boys</span>;
          return <span key={p} className="badge badge-all">{p}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="glass-card campaign-container">
      <div className="campaign-header">
        <div>
          <h2 className="campaign-title">
            <Megaphone size={22} color="var(--primary)" /> Poster & Announcement Management
          </h2>
          <p className="campaign-subtitle">
            Upload promotional posters and announcements targeted to Students, Shopkeepers, Delivery Partners, or All Audiences.
          </p>
        </div>

        <button className="btn-primary" onClick={() => openModal()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> Add Announcement
        </button>
      </div>

      {error && (
        <div className="campaign-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="campaign-alert success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p>Loading announcements...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="empty-state">
          <ImageIcon size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p>No posters or announcements created yet.</p>
          <p style={{ fontSize: '0.85rem' }}>Click &ldquo;Add Announcement&rdquo; above to publish your first poster.</p>
        </div>
      ) : (
        <div className="campaign-table-wrapper">
          <table className="campaign-table">
            <thead>
              <tr>
                <th>Poster</th>
                <th>Title & Message</th>
                <th>Target Audience</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((a) => {
                const img = a.imageUrl || a.posterUrl;
                const isPub = a.isActive ?? a.isPublished ?? false;
                return (
                  <tr key={a._id}>
                    <td>
                      {img ? (
                        <img
                          src={img}
                          alt={a.title || a.name || 'Poster'}
                          className="poster-thumb"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="poster-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={18} color="var(--text-muted)" />
                        </div>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.95rem' }}>
                        {a.title || a.name || 'Untitled'}
                      </strong>
                      {a.message && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginTop: '0.2rem' }}>
                          {a.message.length > 60 ? `${a.message.substring(0, 60)}...` : a.message}
                        </span>
                      )}
                    </td>
                    <td>{renderAudienceBadges(a.targetPortals)}</td>
                    <td>
                      <span className={`status-badge ${isPub ? 'published' : 'unpublished'}`}>
                        {isPub ? '🟢 Published' : '⚪ Draft / Hidden'}
                      </span>
                    </td>
                    <td>
                      <div className="action-cell">
                        <button className="icon-btn" onClick={() => setPreview(a)} title="Preview Poster">
                          <Eye size={15} />
                        </button>
                        <button className="icon-btn" onClick={() => openModal(a)} title="Edit Announcement">
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => handleToggle(a._id)}
                          title={isPub ? 'Unpublish' : 'Publish'}
                        >
                          {isPub ? <ToggleRight size={17} color="#10b981" /> : <ToggleLeft size={17} color="#64748b" />}
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => handleDelete(a._id)}
                          title="Delete Poster"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Announcement' : 'New Poster & Announcement'}</h3>
              <button className="modal-close" onClick={closeModal} title="Close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitForm} className="campaign-form">
              {/* Title */}
              <div className="form-group">
                <label>Announcement Title *</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g., Weekend Special Offer, Campus Holiday Notice"
                  value={form.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Poster Image Upload */}
              <div className="form-group">
                <label>Poster Image *</label>
                <label className="upload-area" htmlFor="poster-file-input">
                  <Upload size={24} style={{ color: 'var(--primary)', marginBottom: '0.4rem' }} />
                  <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', fontWeight: 600 }}>
                    Click to browse and upload image (JPG, PNG, WEBP max 5MB)
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {selectedFile ? selectedFile.name : 'Stored in Cloudinary'}
                  </span>
                  <input
                    id="poster-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </label>

                {/* Or enter direct image URL */}
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Or enter Image URL directly:</span>
                  <input
                    type="text"
                    name="imageUrl"
                    placeholder="https://..."
                    value={form.imageUrl}
                    onChange={(e) => {
                      handleInputChange(e);
                      setImagePreviewUrl(e.target.value);
                    }}
                    style={{ marginTop: '0.25rem' }}
                  />
                </div>

                {/* Image Preview */}
                {imagePreviewUrl && (
                  <div className="image-preview-container">
                    <img src={imagePreviewUrl} alt="Preview" className="image-preview" />
                  </div>
                )}
              </div>

              {/* Optional Announcement Message */}
              <div className="form-group">
                <label>Announcement Message (Optional)</label>
                <textarea
                  name="message"
                  placeholder="Enter details or extra instructions to display alongside the poster banner..."
                  value={form.message}
                  onChange={handleInputChange}
                />
              </div>

              {/* Target Portals */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users size={15} /> Target Audience
                </label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.targetPortals.includes('ALL')}
                      onChange={() => handleTargetChange('ALL')}
                    />
                    <strong>All Audiences (Everyone)</strong>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.targetPortals.includes('STUDENT') && !form.targetPortals.includes('ALL')}
                      onChange={() => handleTargetChange('STUDENT')}
                    />
                    Students / Customers
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.targetPortals.includes('SHOPKEEPER') && !form.targetPortals.includes('ALL')}
                      onChange={() => handleTargetChange('SHOPKEEPER')}
                    />
                    Shopkeepers / Vendors
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.targetPortals.includes('DELIVERY_BOY') && !form.targetPortals.includes('ALL')}
                      onChange={() => handleTargetChange('DELIVERY_BOY')}
                    />
                    Delivery Partners
                  </label>
                </div>
              </div>

              {/* Publish immediately */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleInputChange}
                  />
                  <span>Publish immediately and make visible to target portals</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading & Saving...' : editing ? 'Update Announcement' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Poster Preview</h3>
              <button className="modal-close" onClick={() => setPreview(null)} title="Close">
                <X size={20} />
              </button>
            </div>

            <div className="preview-poster-card">
              {(preview.imageUrl || preview.posterUrl) ? (
                <img
                  src={preview.imageUrl || preview.posterUrl}
                  alt={preview.title || preview.name}
                  className="preview-poster-img"
                />
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-muted)' }}>
                  <ImageIcon size={36} color="var(--text-muted)" />
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)' }}>No image uploaded</p>
                </div>
              )}

              <div className="preview-poster-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {preview.title || preview.name || 'Announcement'}
                  </h4>
                  {renderAudienceBadges(preview.targetPortals)}
                </div>

                {preview.message && (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {preview.message}
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setPreview(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
