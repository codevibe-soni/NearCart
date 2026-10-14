import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, User, Mail, Phone, LogIn, KeyRound, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Profile() {
  const { user, isAuthenticated, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user?.phone && user?.phone !== '0000000000' ? user.phone : '');
  const [savingPhone, setSavingPhone] = useState(false);

  const handleSavePhone = async (e) => {
    e.preventDefault();
    setSavingPhone(true);
    try {
      await api.put('/auth/profile', { phone: phoneInput.trim() });
      await refreshUser();
      setIsEditingPhone(false);
    } catch (err) {
      console.error('Failed to update phone number:', err);
    } finally {
      setSavingPhone(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '2rem auto',
        padding: '2rem',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        border: '1px solid #f1f5f9'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#f8fafc',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto'
        }}>
          <User size={40} color="#94a3b8" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
          Welcome to NearCart+FoodDisk
        </h2>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Please login to view your profile and order history.
        </p>
        <Link to="/login" style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
          color: 'white',
          padding: '0.75rem 2rem',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '1rem',
          transition: 'opacity 0.2s'
        }}>
          <LogIn size={20} />
          Login to Continue
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '600px',
      margin: '2rem auto',
      padding: '2rem',
      background: '#ffffff',
      borderRadius: '1rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      border: '1px solid #f1f5f9'
    }}>
      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        My Profile
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
          <div style={{ background: '#e0f2fe', padding: '0.75rem', borderRadius: '0.5rem', color: '#0284c7' }}>
            <User size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Full Name</p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              {user?.name || 'Not Available'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
          <div style={{ background: '#e0f2fe', padding: '0.75rem', borderRadius: '0.5rem', color: '#0284c7' }}>
            <Mail size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Email Address</p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              {user?.email || 'Not Available'}
            </p>
          </div>
        </div>

        {/* Customer Type Section (Student / Atithi) */}
        {user?.role === 'STUDENT' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: '#e0f2fe', padding: '0.75rem', borderRadius: '0.5rem', color: '#0284c7' }}>
                <User size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Customer Category</p>
                <p style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                  {user?.customerType === 'ATITHI' ? 'Atithi (Guest / Visitor)' : 'Student (Hostel / Campus)'}
                </p>
              </div>
            </div>
            <select
              value={user?.customerType || 'STUDENT'}
              onChange={async (e) => {
                const nextType = e.target.value;
                try {
                  await api.put('/auth/profile', { customerType: nextType });
                  await refreshUser();
                } catch (err) {
                  console.error('Failed to update customer type:', err);
                }
              }}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: '600',
                background: '#ffffff',
                color: '#0284c7',
                cursor: 'pointer',
              }}
            >
              <option value="STUDENT">Student</option>
              <option value="ATITHI">Atithi</option>
            </select>
          </div>
        )}

        {/* Phone Number Item with Edit/Add capability */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#e0f2fe', padding: '0.75rem', borderRadius: '0.5rem', color: '#0284c7' }}>
              <Phone size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Phone Number</p>
              {isEditingPhone ? (
                <form onSubmit={handleSavePhone} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Enter 10-digit number"
                    style={{
                      padding: '0.35rem 0.6rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.375rem',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                    required
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={savingPhone}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {savingPhone ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPhone(false);
                      setPhoneInput(user?.phone && user?.phone !== '0000000000' ? user.phone : '');
                    }}
                    style={{
                      padding: '0.35rem 0.6rem',
                      background: '#f1f5f9',
                      color: '#64748b',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <p style={{
                  fontSize: '1.125rem',
                  fontWeight: user?.phone && user?.phone !== '0000000000' ? '600' : '400',
                  color: user?.phone && user?.phone !== '0000000000' ? '#1e293b' : '#94a3b8',
                  margin: 0
                }}>
                  {user?.phone && user?.phone !== '0000000000' ? user.phone : 'Not added'}
                </p>
              )}
            </div>
          </div>
          {!isEditingPhone && (
            <button
              onClick={() => setIsEditingPhone(true)}
              style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#0284c7',
                background: '#e0f2fe',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {user?.phone && user?.phone !== '0000000000' ? 'Edit' : 'Add Phone'}
            </button>
          )}
        </div>

        {/* Security & Authentication Section */}
        <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldCheck size={20} style={{ color: '#0284c7' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Security & Authentication</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>Google Account</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Sign in seamlessly with Google</p>
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                background: user?.googleConnected ? 'rgba(34, 197, 94, 0.1)' : '#f1f5f9',
                color: user?.googleConnected ? '#16a34a' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                {user?.googleConnected ? <><CheckCircle2 size={13} /> Connected</> : 'Not Linked'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>Password</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  {user?.passwordSet ? 'Password is set for email login' : 'Set a password to login with email'}
                </p>
              </div>
              <Link
                to="/set-password"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: '#0284c7',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.4rem 0.8rem',
                  background: '#e0f2fe',
                  borderRadius: '0.375rem',
                  transition: 'background 0.2s'
                }}
              >
                <KeyRound size={14} />
                {user?.passwordSet ? 'Change' : 'Set Password'}
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            marginTop: '0.5rem',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: '#fef2f2',
            color: '#ef4444',
            padding: '0.875rem',
            borderRadius: '0.5rem',
            border: '1px solid #fee2e2',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
