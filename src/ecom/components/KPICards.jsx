import React from 'react';

const KPICards = ({ stats, fmt }) => {
  const deliveryRate = stats.total ? ((stats.delivered || 0) / stats.total * 100).toFixed(1) : 0;
  const returnRate = stats.total ? ((stats.returned || 0) / stats.total * 100).toFixed(1) : 0;

  const kpis = [
    {
      title: 'Revenu livré',
      value: fmt(stats.totalRevenue),
      subtitle: `${stats.delivered || 0} commandes livrées`,
      color: 'green',
      icon: (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )
    },
    {
      title: 'Taux livraison',
      value: `${deliveryRate}%`,
      subtitle: 'Performance globale',
      color: 'blue',
      icon: (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
      progress: deliveryRate
    },
    {
      title: 'Taux retour',
      value: `${returnRate}%`,
      subtitle: 'Retours traités',
      color: 'orange',
      icon: (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"/>
        </svg>
      ),
      progress: returnRate
    },
    {
      title: 'En cours',
      value: (stats.pending || 0) + (stats.confirmed || 0) + (stats.shipped || 0),
      subtitle: `${stats.pending || 0} en attente · ${stats.shipped || 0} expédiées`,
      color: 'purple',
      icon: (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      green: {
        bg: 'bg-gradient-to-br from-green-50 to-green-100',
        border: 'border-green-200',
        title: 'text-green-700',
        icon: 'bg-green-500',
        progress: 'bg-gradient-to-r from-green-400 to-green-600'
      },
      blue: {
        bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
        border: 'border-blue-200',
        title: 'text-blue-700',
        icon: 'bg-blue-500',
        progress: 'bg-gradient-to-r from-blue-400 to-blue-600'
      },
      orange: {
        bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
        border: 'border-orange-200',
        title: 'text-orange-700',
        icon: 'bg-orange-500',
        progress: 'bg-gradient-to-r from-orange-400 to-orange-600'
      },
      purple: {
        bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
        border: 'border-purple-200',
        title: 'text-purple-700',
        icon: 'bg-purple-500',
        progress: 'bg-gradient-to-r from-purple-400 to-purple-600'
      }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {kpis.map((kpi, index) => {
        const colorClasses = getColorClasses(kpi.color);
        return (
          <div 
            key={index}
            className={`${colorClasses.bg} rounded-xl border ${colorClasses.border} shadow-sm p-4 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-semibold ${colorClasses.title} uppercase tracking-wide`}>
                {kpi.title}
              </p>
              <div className={`w-8 h-8 ${colorClasses.icon} rounded-lg flex items-center justify-center`}>
                {kpi.icon}
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
            <p className={`text-xs ${colorClasses.title} font-medium mt-1`}>{kpi.subtitle}</p>
            {kpi.progress !== undefined && (
              <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                <div 
                  className={`${colorClasses.progress} h-2 rounded-full transition-all duration-500`} 
                  style={{ width: `${Math.min(kpi.progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default KPICards;
