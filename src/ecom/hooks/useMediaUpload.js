import { useState, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app'}/api/ecom`;

/**
 * Custom hook for media upload with progress tracking
 */
export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const getToken = () => localStorage.getItem('ecomToken');

  /**
   * Upload a file using the direct upload endpoint
   */
  const uploadFile = useCallback(async (file, onProgress) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
            onProgress?.(percent);
          }
        };

        xhr.onload = () => {
          setIsUploading(false);
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve(response);
            } else {
              setError(response.message || 'Upload failed');
              reject(new Error(response.message));
            }
          } else {
            setError('Upload failed');
            reject(new Error('Upload failed'));
          }
        };

        xhr.onerror = () => {
          setIsUploading(false);
          setError('Network error');
          reject(new Error('Network error'));
        };

        xhr.open('POST', `${API_BASE}/media/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
        xhr.send(formData);
      });
    } catch (err) {
      setIsUploading(false);
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Upload using presigned URL (for larger files)
   */
  const uploadWithPresign = useCallback(async (file, kind, onProgress) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get presigned URL
      const presignRes = await fetch(`${API_BASE}/media/presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          kind,
          mimeType: file.type,
          size: file.size,
          fileName: file.name
        })
      });

      const presignData = await presignRes.json();
      if (!presignData.success) {
        throw new Error(presignData.message || 'Failed to get upload URL');
      }

      // Step 2: Upload directly to storage
      const xhr = new XMLHttpRequest();
      
      await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
            onProgress?.(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('Upload to storage failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));

        xhr.open('PUT', presignData.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Step 3: Confirm upload
      const confirmRes = await fetch(`${API_BASE}/media/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          storageKey: presignData.storageKey,
          kind,
          metadata: {
            mimeType: file.type,
            fileName: file.name,
            fileSize: file.size
          }
        })
      });

      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        throw new Error(confirmData.message || 'Failed to confirm upload');
      }

      setIsUploading(false);
      return confirmData;

    } catch (err) {
      setIsUploading(false);
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Upload audio blob (from voice recording)
   */
  const uploadAudio = useCallback(async (audioBlob, durationMs, onProgress) => {
    // Convert blob to file
    const file = new File([audioBlob], `voice_${Date.now()}.webm`, { 
      type: audioBlob.type || 'audio/webm' 
    });

    const result = await uploadFile(file, onProgress);
    
    // Add duration to metadata
    return {
      ...result,
      metadata: {
        ...result.metadata,
        durationMs
      }
    };
  }, [uploadFile]);

  /**
   * Determine media kind from file type
   */
  const getMediaKind = useCallback((file) => {
    const type = file.type;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    return 'document';
  }, []);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    isUploading,
    progress,
    error,
    uploadFile,
    uploadWithPresign,
    uploadAudio,
    getMediaKind,
    reset
  };
}

export default useMediaUpload;
