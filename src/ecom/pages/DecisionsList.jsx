import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const DecisionsList = () => {
  const { user } = useEcomAuth();
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDecisions();
  }, []);

  const loadDecisions = async () => {
    try {
      setLoading(true);
      const response = await ecomApi.get('/decisions');
      // Correction: les décisions sont directement dans response.data.data
      const decisionsData = response.data?.data || [];
      setDecisions(Array.isArray(decisionsData) ? decisionsData : []);
    } catch (error) {
      setError('Erreur lors du chargement des décisions');
      console.error(error);
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  };

  const updateDecisionStatus = async (decisionId, action) => {
    try {
      await ecomApi.put(`/decisions/${decisionId}/${action}`);
      loadDecisions();
    } catch (error) {
      setError('Erreur lors de la mise à jour de la décision');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Décisions</h1>
        <Link
          to="/ecom/decisions/new"
          className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-blue-700 text-sm"
        >
          + Décision
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Produit
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Priorité
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Assigné à
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {decisions.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  Aucune décision trouvée
                </td>
              </tr>
            ) : (
              decisions.map((decision) => (
                <tr key={decision._id}>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-900">
                      {new Date(decision.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    {decision.productId?._id ? (
                      <Link to={`/products/${decision.productId._id}`} className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline">{decision.productId.name}</Link>
                    ) : (
                      <span className="text-xs sm:text-sm text-gray-900">N/A</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      decision.type === 'scale' 
                        ? 'bg-green-100 text-green-800'
                        : decision.type === 'stop'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {decision.type === 'scale' ? 'Scaler' : 
                       decision.type === 'stop' ? 'Arrêter' : 'Continuer'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      decision.priority === 'high' 
                        ? 'bg-red-100 text-red-800'
                        : decision.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {decision.priority === 'high' ? 'Haute' : 
                       decision.priority === 'medium' ? 'Moyenne' : 'Basse'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      decision.status === 'completed' 
                        ? 'bg-green-100 text-green-800'
                        : decision.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {decision.status === 'completed' ? 'Complétée' : 
                       decision.status === 'cancelled' ? 'Annulée' : 'En attente'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                    <div className="text-xs sm:text-sm text-gray-900">
                      {decision.assignedTo?.name || 'Non assigné'}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <Link
                      to={`/decisions/${decision._id}`}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Voir
                    </Link>
                    {decision.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateDecisionStatus(decision._id, 'complete')}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          Compléter
                        </button>
                        <button
                          onClick={() => updateDecisionStatus(decision._id, 'cancel')}
                          className="text-red-600 hover:text-red-900"
                        >
                          Annuler
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DecisionsList;
