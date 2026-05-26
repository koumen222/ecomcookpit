/**
 * Skeleton.jsx — Composants skeleton/shimmer réutilisables pour toute la plateforme
 * Usage: import { SkeletonCard, SkeletonTable, SkeletonText, SkeletonKpi } from '../components/Skeleton';
 */

import React from 'react';

// ── Primitive shimmer box ──────────────────────────────────────────────────────
export const Shimmer = ({ className = '', style = {} }) => (
  <div
    className={`rounded-lg bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse ${className}`}
    style={{
      backgroundSize: '200% 100%',
      ...style
    }}
  />
);

// ── Text line skeleton ─────────────────────────────────────────────────────────
export const SkeletonText = ({ lines = 2, lastWidth = '60%', className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Shimmer
        key={i}
        className="h-3.5 rounded"
        style={{ width: i === lines - 1 ? lastWidth : '100%' }}
      />
    ))}
  </div>
);

// ── KPI card skeleton ──────────────────────────────────────────────────────────
export const SkeletonKpi = () => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
    <div className="flex items-start justify-between">
      <Shimmer className="w-9 h-9 rounded-xl" />
      <Shimmer className="w-14 h-5 rounded-lg" />
    </div>
    <div className="space-y-1.5">
      <Shimmer className="h-3 w-20 rounded" />
      <Shimmer className="h-7 w-28 rounded" />
      <Shimmer className="h-3 w-24 rounded" />
    </div>
  </div>
);

// ── Generic card skeleton ──────────────────────────────────────────────────────
export const SkeletonCard = ({ rows = 4, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 p-5 ${className}`}>
    {/* Header */}
    <div className="flex items-center gap-2.5 mb-4">
      <Shimmer className="w-8 h-8 rounded-xl" />
      <div className="space-y-1.5">
        <Shimmer className="h-3.5 w-32 rounded" />
        <Shimmer className="h-2.5 w-20 rounded" />
      </div>
    </div>
    {/* Rows */}
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <Shimmer className="h-3 rounded" style={{ width: `${50 + Math.random() * 30}%` }} />
            <Shimmer className="h-3 w-10 rounded" />
          </div>
          <Shimmer className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

// ── Chart skeleton ─────────────────────────────────────────────────────────────
export const SkeletonChart = ({ h = 180, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 p-5 ${className}`}>
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Shimmer className="w-8 h-8 rounded-xl" />
        <Shimmer className="h-4 w-36 rounded" />
      </div>
      <Shimmer className="h-4 w-24 rounded" />
    </div>
    {/* Chart area */}
    <div className="relative overflow-hidden rounded-xl bg-slate-50" style={{ height: h }}>
      <div className="absolute inset-0 flex items-end gap-1 px-3 pb-3">
        {Array.from({ length: 20 }).map((_, i) => {
          const heights = [40, 55, 35, 70, 60, 80, 45, 65, 50, 75, 55, 85, 40, 60, 70, 45, 80, 55, 65, 50];
          const pct = heights[i % heights.length];
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm animate-pulse"
              style={{
                height: `${pct}%`,
                backgroundColor: `rgba(16, 185, 129, ${0.08 + (i % 3) * 0.04})`,
                animationDelay: `${i * 60}ms`
              }}
            />
          );
        })}
      </div>
    </div>
    {/* Stats below */}
    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-50">
      {[1, 2, 3].map(i => (
        <div key={i} className="text-center space-y-1.5">
          <Shimmer className="h-5 w-16 rounded mx-auto" />
          <Shimmer className="h-2.5 w-10 rounded mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

// ── Table skeleton ─────────────────────────────────────────────────────────────
export const SkeletonTable = ({ rows = 8, cols = 5, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden ${className}`}>
    {/* Header */}
    <div className="px-5 pt-5 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shimmer className="w-8 h-8 rounded-xl" />
          <div className="space-y-1.5">
            <Shimmer className="h-4 w-40 rounded" />
            <Shimmer className="h-3 w-28 rounded" />
          </div>
        </div>
        <Shimmer className="h-7 w-20 rounded-lg" />
      </div>
    </div>
    {/* Table head */}
    <div className="flex gap-4 px-4 py-2.5 bg-slate-50 border-y border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <Shimmer key={i} className="h-2.5 rounded flex-1" style={{ maxWidth: i === 0 ? '35%' : undefined }} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50">
        <div className="flex items-center gap-2.5 flex-[2]">
          <Shimmer className="w-7 h-7 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Shimmer className="h-3 w-32 rounded" />
            <Shimmer className="h-2.5 w-24 rounded" />
          </div>
        </div>
        {Array.from({ length: cols - 1 }).map((_, j) => (
          <Shimmer key={j} className="h-3 rounded flex-1" style={{ width: `${40 + j * 15}%` }} />
        ))}
      </div>
    ))}
  </div>
);

// ── Grid of small tiles skeleton ───────────────────────────────────────────────
export const SkeletonGrid = ({ cols = 6, rows = 2, className = '' }) => (
  <div className={`grid gap-3 ${className}`}
    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
    {Array.from({ length: cols * rows }).map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 space-y-2.5">
        <Shimmer className="w-7 h-7 rounded-lg" />
        <Shimmer className="h-3 w-20 rounded" />
        <Shimmer className="h-2.5 w-12 rounded" />
      </div>
    ))}
  </div>
);

// ── Full page skeleton for ProductsList, OrdersList, etc. ──────────────────────
export const PageListSkeleton = ({ kpiCount = 4, tableRows = 8 }) => (
  <div className="flex flex-col min-h-full bg-slate-50/50 animate-pulse">
    {/* Top bar */}
    <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
      <div className="space-y-1.5">
        <Shimmer className="h-5 w-28 rounded" />
        <Shimmer className="h-3 w-20 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <Shimmer className="h-9 w-24 rounded-xl" />
        <Shimmer className="h-9 w-9 rounded-xl" />
      </div>
    </div>
    {/* KPI row */}
    <div className={`px-6 pt-5 pb-4 grid gap-3`}
      style={{ gridTemplateColumns: `repeat(${kpiCount}, minmax(0, 1fr))` }}>
      {Array.from({ length: kpiCount }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
          <Shimmer className="h-3 w-20 rounded" />
          <Shimmer className="h-6 w-16 rounded" />
        </div>
      ))}
    </div>
    {/* Search bar */}
    <div className="px-6 pb-3">
      <Shimmer className="h-10 w-full rounded-xl" />
    </div>
    {/* Table */}
    <div className="flex-1 mx-6 mb-6 bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="flex gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100">
        {[35, 20, 15, 15, 15].map((w, i) => (
          <Shimmer key={i} className="h-2.5 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
      {Array.from({ length: tableRows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
          <Shimmer className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3.5 w-48 rounded" />
            <Shimmer className="h-3 w-24 rounded" />
          </div>
          <Shimmer className="h-3.5 w-16 rounded ml-auto" />
          <Shimmer className="h-3.5 w-20 rounded" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

// ── Dashboard skeleton (super admin) ──────────────────────────────────────────
export const DashboardSkeleton = () => (
  <div className="min-h-screen bg-slate-50/50">
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <Shimmer className="h-20 w-full rounded-2xl" />
      {/* Nav */}
      <Shimmer className="h-12 w-full rounded-2xl" />
      {/* KPI row 1 */}
      <div>
        <Shimmer className="h-5 w-40 rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)}
        </div>
      </div>
      {/* KPI row 2 */}
      <div>
        <Shimmer className="h-5 w-36 rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)}
        </div>
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      {/* 3 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard rows={6} />
        <SkeletonCard rows={5} />
        <SkeletonCard rows={6} />
      </div>
    </div>
  </div>
);

// ── Simple centered spinner ────────────────────────────────────────────────────
export const CenteredSpinner = ({ message = 'Chargement…', icon: Icon = null }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center space-y-4">
      <div className="relative mx-auto w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
        <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
        {Icon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary-500" />
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-500">{message}</p>
    </div>
  </div>
);

// ── Section error state ────────────────────────────────────────────────────────
export const SectionError = ({ message = 'Erreur de chargement', onRetry }) => (
  <div className="flex flex-col items-center justify-center py-8 gap-3">
    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <p className="text-sm text-slate-500 font-medium">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-xs font-bold text-primary-600 hover:text-primary-700 underline transition-colors"
      >
        Réessayer
      </button>
    )}
  </div>
);
