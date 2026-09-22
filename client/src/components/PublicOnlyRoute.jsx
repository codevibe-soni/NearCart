import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NearCartLoader from './NearCartLoader';

export default function PublicOnlyRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <NearCartLoader fullScreen={true} message="Verifying authentication..." />;
  }


  if (isAuthenticated && user) {
    const getRolePath = (role) => {
      switch (role) {
        case 'STUDENT':
          return '/student';
        case 'SHOPKEEPER':
          return '/shopkeeper';
        case 'DELIVERY_BOY':
          return '/delivery';
        case 'ADMIN':
          return '/admin';
        default:
          return '/student';
      }
    };

    return <Navigate to={getRolePath(user.role)} replace />;
  }

  return children;
}
