import React, { useState, useEffect, useRef } from 'react';

const TopLoader = () => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);
  const pendingRef = useRef(0);

  const startProgress = () => {
    pendingRef.current += 1;
    if (pendingRef.current === 1) {
      setFading(false);
      setVisible(true);
      setProgress(10);

      let current = 10;
      timerRef.current = setInterval(() => {
        current += Math.random() * 12 + 4;
        if (current >= 85) {
          current = 85;
          clearInterval(timerRef.current);
        }
        setProgress(current);
      }, 350);
    }
  };

  const stopProgress = () => {
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    if (pendingRef.current === 0) {
      clearInterval(timerRef.current);
      setProgress(100);
      setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setVisible(false);
          setProgress(0);
          setFading(false);
        }, 300);
      }, 150);
    }
  };

  useEffect(() => {
    const onStart = () => startProgress();
    const onStop = () => stopProgress();

    window.addEventListener('toploader:start', onStart);
    window.addEventListener('toploader:stop', onStop);
    return () => {
      window.removeEventListener('toploader:start', onStart);
      window.removeEventListener('toploader:stop', onStop);
      clearInterval(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease' }}
    >
      <div
        className="h-full bg-emerald-600 rounded-r-full shadow-[0_0_8px_rgba(15,107,79,0.7)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? 'width 0.15s ease-out' : 'width 0.35s ease-out',
        }}
      />
    </div>
  );
};

export default TopLoader;
