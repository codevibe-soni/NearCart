import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Mail, Phone, LogIn } from 'lucide-react';

export default function Profile() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

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

        {(user?.phone || user?.phoneNumber) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <div style={{ background: '#e0f2fe', padding: '0.75rem', borderRadius: '0.5rem', color: '#0284c7' }}>
              <Phone size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Phone Number</p>
              <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                {user.phone || user.phoneNumber}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          style={{
            marginTop: '1rem',
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
