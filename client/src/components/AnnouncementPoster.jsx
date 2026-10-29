import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Megaphone } from 'lucide-react';
import './AnnouncementPoster.css';

export default function AnnouncementPoster({ portal = 'STUDENT' }) {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`nearcart_dismissed_posters_${portal}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let isMounted = true;

    const fetchActiveAnnouncements = async () => {
      try {
        // Fetch published announcements targeted to this portal
        const res = await api.get(`/announcements/active?portal=${portal}`);
        if (isMounted && res.success && Array.isArray(res.announcements || res.campaigns)) {
          setAnnouncements(res.announcements || res.campaigns);
        }
      } catch (err) {
        // Fallback to /campaigns/active if /announcements/active fails
        try {
          const fallbackRes = await api.get(`/campaigns/active?portal=${portal}`);
          if (isMounted && fallbackRes.success && Array.isArray(fallbackRes.announcements || fallbackRes.campaigns)) {
            setAnnouncements(fallbackRes.announcements || fallbackRes.campaigns);
          }
        } catch {
          // Silent fallback - no posters displayed if server error
        }
      }
    };

    fetchActiveAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [portal]);

  const handleDismiss = (id) => {
    setDismissedIds((prev) => {
      const updated = [...prev, id];
      try {
        sessionStorage.setItem(`nearcart_dismissed_posters_${portal}`, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  };

  const visiblePosters = announcements.filter((a) => !dismissedIds.includes(a._id));

  if (visiblePosters.length === 0) {
    return null;
  }

  return (
    <div className="portal-announcement-container" role="region" aria-label="Portal Announcements">
      {visiblePosters.map((item) => {
        const img = item.imageUrl || item.posterUrl;
        const title = item.title || item.name || '';
        const message = item.message || '';

        return (
          <div key={item._id} className="portal-announcement-card">
            <button
              className="portal-announcement-dismiss"
              onClick={() => handleDismiss(item._id)}
              aria-label="Dismiss announcement banner"
              title="Dismiss banner"
            >
              <X size={16} />
            </button>

            {img && (
              <div className="portal-announcement-img-wrap">
                <img
                  src={img}
                  alt={title || 'Announcement'}
                  className="portal-announcement-img"
                  onError={(e) => {
                    e.target.parentElement.style.display = 'none';
                  }}
                />
              </div>
            )}

            {(title || message) && (
              <div className="portal-announcement-content">
                {title && (
                  <h4 className="portal-announcement-title">
                    <Megaphone size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span>{title}</span>
                  </h4>
                )}
                {message && <p className="portal-announcement-message">{message}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
