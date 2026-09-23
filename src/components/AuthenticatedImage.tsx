import React, { useState, useEffect } from 'react';
import { getAccessToken } from '../serviceAccess';

interface AuthenticatedImageProps {
  src: string;
  [key: string]: any;
}

export function extractDriveFileId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // Direct 20+ alphanumeric ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes('/') && !trimmed.includes(':')) {
    return trimmed;
  }

  // id= parameter
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  // /file/d/ID or /d/ID
  const fileMatch = trimmed.match(/\/(?:file\/d|d)\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];

  // /folders/ID
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];

  return null;
}

export function AuthenticatedImage({ src, ...props }: AuthenticatedImageProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchImage = async () => {
      if (!src) {
        setImgSrc('');
        setLoading(false);
        return;
      }

      // Check if it's a raw base64 string
      if (!src.startsWith('http') && !src.startsWith('data:') && src.length > 50) {
        setImgSrc(`data:image/png;base64,${src}`);
        setLoading(false);
        return;
      }
      
      if (src.startsWith('data:')) {
        setImgSrc(src);
        setLoading(false);
        return;
      }

      const fileId = extractDriveFileId(src);

      if (fileId) {
        try {
          const token = await getAccessToken();
          if (!token) throw new Error("No token");

          const response = await fetch(`/api/google/drive/v3/files/${fileId}?alt=media`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          if (response.ok) {
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              if (isMounted) {
                setImgSrc(typeof reader.result === 'string' ? reader.result : '');
                setLoading(false);
              }
            };
            reader.readAsDataURL(blob);
            return;
          } else {
            // Fallback to thumbnail or direct link if API fails
            if (isMounted) {
              setImgSrc(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
              setLoading(false);
            }
            return;
          }
        } catch (e) {
          console.error("Error fetching image from Drive", e);
          if (isMounted) {
            setImgSrc(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
            setLoading(false);
          }
          return;
        }
      } else {
        if (isMounted) setImgSrc(src);
      }
      if (isMounted) setLoading(false);
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (loading) {
    return <div className={`animate-pulse bg-slate-200/20 ${props.className || ''}`} />;
  }

  return <img src={imgSrc} {...props} referrerPolicy="no-referrer" />;
}
