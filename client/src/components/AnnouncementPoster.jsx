import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Megaphone } from 'lucide-react';
import './AnnouncementPoster.css';

export default function AnnouncementPoster({ portal = 'STUDENT' }) {
  const [announcements, setAnnouncements] = useState([]);

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

  if (!announcements || announcements.length === 0) {
    return null;
  }

  return (
    <div className="portal-announcement-container" role="region" aria-label="Portal Announcements">
      {announcements.map((item) => {
        const img = item.imageUrl || item.posterUrl;
        const title = item.title || item.name || '';
        const message = item.message || '';

        return (
          <div key={item._id} className="portal-announcement-card">
            {img && (
              <div className="portal-announcement-img-wrap">
                <img
                  src={img}
                  alt={title || 'Announcement Poster'}
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
