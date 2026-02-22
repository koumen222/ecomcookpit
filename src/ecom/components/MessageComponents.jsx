import React, { useState, useRef } from 'react';
import { useAudioPlayer } from '../hooks/useAudioRecorder';

const ROLE_COLORS = { 
  ecom_admin: 'bg-blue-600', 
  ecom_closeuse: 'bg-pink-500', 
  ecom_compta: 'bg-emerald-500', 
  ecom_livreur: 'bg-orange-500', 
  super_admin: 'bg-purple-600' 
};

/**
 * Audio message player component
 */
export function AudioPlayer({ src, duration }) {
  const { isPlaying, progress, currentTime, toggle, seek } = useAudioPlayer();
  const progressRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    if (progressRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      seek(percent * (duration / 1000));
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        onClick={() => toggle(src)}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      
      <div className="flex-1">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="h-1 bg-white/30 rounded-full cursor-pointer"
        >
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-0.5 opacity-70">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration / 1000)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Image message component with lightbox
 */
export function ImageMessage({ src, alt, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative max-w-xs cursor-pointer" onClick={onClick}>
      {!loaded && (
        <div className="w-48 h-32 bg-gray-200 rounded-lg animate-pulse" />
      )}
      <img
        src={src}
        alt={alt || 'Image'}
        className={`max-w-full rounded-lg ${loaded ? '' : 'hidden'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

/**
 * Video message component
 */
export function VideoMessage({ src }) {
  return (
    <video
      src={src}
      controls
      className="max-w-xs rounded-lg"
      preload="metadata"
    />
  );
}

/**
 * Document message component
 */
export function DocumentMessage({ fileName, fileSize, src }) {
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
    >
      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName || 'Document'}</p>
        {fileSize && <p className="text-xs opacity-70">{formatSize(fileSize)}</p>}
      </div>
      <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  );
}

/**
 * Reply preview component
 */
export function ReplyPreview({ replyTo, onClear, isOwn }) {
  if (!replyTo) return null;

  const getPreviewText = () => {
    if (replyTo.messageType === 'image') return '📷 Photo';
    if (replyTo.messageType === 'audio') return '🎤 Message vocal';
    if (replyTo.messageType === 'video') return '🎬 Vidéo';
    if (replyTo.messageType === 'document') return '📎 Document';
    return replyTo.content?.substring(0, 50) + (replyTo.content?.length > 50 ? '...' : '');
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-l-2 ${isOwn ? 'bg-blue-500/20 border-blue-400' : 'bg-gray-100 border-gray-400'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{replyTo.senderName}</p>
        <p className="text-xs opacity-70 truncate">{getPreviewText()}</p>
      </div>
      {onClear && (
        <button onClick={onClear} className="p-1 hover:bg-black/10 rounded">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Message status indicator (sent, delivered, read)
 */
export function MessageStatus({ status }) {
  if (status === 'sending') {
    return (
      <svg className="w-3 h-3 text-gray-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
      </svg>
    );
  }
  
  if (status === 'sent') {
    return (
      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  
  if (status === 'delivered') {
    return (
      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 19l4 4L19 13" />
      </svg>
    );
  }
  
  if (status === 'read') {
    return (
      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 19l4 4L19 13" />
      </svg>
    );
  }
  
  return null;
}

/**
 * Emoji reactions display
 */
export function MessageReactions({ reactions, onReact, userId }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(reactions).map(([emoji, users]) => {
        const hasReacted = users.includes(userId);
        return (
          <button
            key={emoji}
            onClick={() => onReact(emoji, hasReacted ? 'remove' : 'add')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
              hasReacted ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Typing indicator
 */
export function TypingIndicator({ userName }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{userName || 'Quelqu\'un'} écrit...</span>
    </div>
  );
}

/**
 * Audio recording indicator
 */
export function RecordingIndicator({ duration, onCancel, onStop }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      <span className="text-red-600 font-medium">{duration}</span>
      <div className="flex-1" />
      <button
        onClick={onCancel}
        className="p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-red-100"
        title="Annuler"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button
        onClick={onStop}
        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
        title="Envoyer"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Upload progress indicator
 */
export function UploadProgress({ progress, fileName, onCancel }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl">
      <div className="w-8 h-8 relative">
        <svg className="w-8 h-8 transform -rotate-90">
          <circle
            cx="16"
            cy="16"
            r="14"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-blue-200"
          />
          <circle
            cx="16"
            cy="16"
            r="14"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeDasharray={88}
            strokeDashoffset={88 - (88 * progress) / 100}
            className="text-blue-500 transition-all"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-600">
          {progress}%
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-700 truncate">{fileName}</p>
        <p className="text-xs text-blue-500">Envoi en cours...</p>
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="p-1 text-blue-400 hover:text-blue-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Emoji picker (simple version)
 */
export function EmojiPicker({ onSelect, onClose }) {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

  return (
    <div className="absolute bottom-full mb-2 p-2 bg-white rounded-lg shadow-lg border flex gap-1">
      {emojis.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default {
  AudioPlayer,
  ImageMessage,
  VideoMessage,
  DocumentMessage,
  ReplyPreview,
  MessageStatus,
  MessageReactions,
  TypingIndicator,
  RecordingIndicator,
  UploadProgress,
  EmojiPicker
};
