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

  // Helper to determine media type from URL
  const resolveMediaType = (item, url) => {
    if (item.mediaType) return item.mediaType;
    if (!url) return 'image';
    const lower = url.split('?')[0].toLowerCase();
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.includes('/video/upload/')) {
      return 'video';
    }
    if (lower.endsWith('.gif')) {
      return 'gif';
    }
    return 'image';
  };

  return (
    <div className="portal-announcement-container" role="region" aria-label="Portal Announcements">
      {announcements.map((item) => {
        const mediaUrl = item.mediaUrl || item.imageUrl || item.posterUrl;
        const mediaType = resolveMediaType(item, mediaUrl);
        const title = item.title || item.name || '';
        const message = item.message || '';

        return (
          <div key={item._id} className="portal-announcement-card">
            {mediaUrl && (
              <div className={`portal-announcement-media-wrap ${mediaType === 'video' ? 'is-video' : 'is-image'}`}>
                {mediaType === 'video' ? (
                  <video
                    ref={(el) => {
                      if (el) el.muted = true;
                    }}
                    src={mediaUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    controls
                    className="portal-announcement-video"
                    onLoadedMetadata={(e) => {
                      try {
                        e.currentTarget.muted = true;
                        const playPromise = e.currentTarget.play();
                        if (playPromise !== undefined) {
                          playPromise.catch(() => {});
                        }
                      } catch {
                        // Handle browser autoplay policy gracefully
                      }
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={mediaUrl}
                    alt={title || 'Announcement Poster'}
                    className="portal-announcement-img"
                    onError={(e) => {
                      e.target.parentElement.style.display = 'none';
                    }}
                  />
                )}
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
