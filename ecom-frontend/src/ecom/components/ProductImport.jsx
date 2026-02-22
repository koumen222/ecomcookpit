import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const ProductImport = ({ onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Template CSV pour l'importation (exactement votre format)
  const csvTemplate = `PRODUIT	IMAGE APPARENTE	CREATIVE	LIEN ALIBABA	LIEN RECHERCHE	SITE WEB	PRIX SOURCING BRUT	POIDS (KG)	FRAIS DE LIVRAISON UNITAIRE	COÛT DE REVIENT (COGS)	PRIX DE VENTE	SCORE OPPORTUNITÉ	STATUT
Drain Stick	https://drive.google.com/file/d/1VKpeTlTV0WA3vSafl-8MprbqrEBVOJBB/view?usp=share_link	https://example.com/ad1	https://www.alibaba.com/product-detail/Drain-cleaning-and-sanitation-pipes-sticks_62246107858.html	https://www.facebook.com/ads/library/?id=1188938655134167	https://africaoffre.com/products/tiges	360	0.10	1200	1560	1560	3	research
Correcteur Blancheur	https://drive.google.com/file/d/1u1Y9P-1GQizSZO6SZIDh0F_sKXDD3wOK/view?usp=share_link	https://www.tiktok.com/@cosmile.co/video/7112749127234080005	https://www.alibaba.com/product-detail/Private-Label-V34-Colour-Corrector-Serum_1600808374175.html	https://app.minea.com/posts/364525732348961	https://cosmile.co/products/copy-of-correcteur-de-couleur-c15-cosmile	2100	0.07	840	2940	2940	4	research
Patch anti douleurs	https://app.minea.com/posts/364525732348961?tab=ad_analysis	https://example.com/ad3	https://www.alibaba.com/product-detail/Best-selling-Chinese-Herbal-Hot-Moxibustion_1600751291493.html	https://app.minea.com/posts/364525732348961?tab=ad_analysis	https://georgleroy.com/products/patch-anti-douleur	630	0.15	1800	2430	2430	4	testing`;

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Vérifier l'extension du fichier
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
        setError('Veuillez sélectionner un fichier CSV ou Excel (.csv, .xlsx, .xls)');
        return;
      }
      
      setFile(selectedFile);
      setError('');
      setSuccess('');
      
      // Prévisualiser le fichier
      if (fileExtension === 'csv') {
        parseCSV(selectedFile);
      } else {
        setError('Pour les fichiers Excel, veuillez d\'abord les convertir en CSV');
      }
    }
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setError('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données');
          return;
        }

        // Parser le CSV en gérant les guillemets et tabulations
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                // Deux guillemets = un guillemet littéral
                current += '"';
                i++; // Skip le prochain guillemet
              } else {
                // Toggle guillemets
                inQuotes = !inQuotes;
              }
            } else if ((char === ',' || char === '\t') && !inQuotes) {
              // Fin de champ (virgule OU tabulation)
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          // Ajouter le dernier champ
          result.push(current.trim());
          return result;
        };

        // Nettoyer les en-têtes (enlever les guillemets si présents)
        const cleanHeader = (header) => {
          return header.replace(/^"(.*)"$/, '$1').trim();
        };

        const headers = parseCSVLine(lines[0]).map(cleanHeader);
        const data = [];

        for (let i = 1; i < Math.min(lines.length, 6); i++) { // Limiter à 5 lignes de preview
          const values = parseCSVLine(lines[i]);
          
          if (values.length >= headers.length) {
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            data.push(row);
          }
        }

        setPreview(data);
        setShowPreview(true);
      } catch (error) {
        console.error('Erreur parsing CSV:', error);
        setError('Erreur lors de la lecture du fichier CSV. Vérifiez le format.');
      }
    };
    reader.readAsText(file);
  };

  // Fonction pour nettoyer et parser les nombres (format français)
  const parseFrenchNumber = (value) => {
    console.log(`🔍 Parsing nombre: "${value}"`);
    
    if (!value || value.trim() === '') {
      console.log('❌ Valeur vide, retour 0');
      return 0;
    }
    
    // Enlever les espaces insécables et les espaces normaux
    let cleanValue = value.replace(/\s/g, '');
    console.log(`🧹 Après suppression espaces: "${cleanValue}"`);
    
    // Remplacer la virgule par un point pour les décimales
    cleanValue = cleanValue.replace(',', '.');
    console.log(`🔄 Après remplacement virgule: "${cleanValue}"`);
    
    // Parser en nombre
    const parsed = parseFloat(cleanValue);
    console.log(`📊 Résultat parseFloat: ${parsed}`);
    
    // Retourner 0 si NaN, sinon le nombre
    const result = isNaN(parsed) ? 0 : parsed;
    console.log(`✅ Résultat final: ${result}`);
    
    return result;
  };

  const validateRow = (row) => {
    const errors = [];
    
    // Vérifier si la ligne est vide
    const isEmpty = Object.values(row).every(value => !value || value.trim() === '');
    if (isEmpty) {
      return ['Ligne vide - ignorée'];
    }
    
    // Vérifier le nom du produit (plusieurs colonnes possibles)
    const productName = row['PRODUIT'] || row['PRODUIT '] || row['PRODUCT'] || row['NAME'] || row['NOM'];
    if (!productName || productName.trim() === '') {
      return ['Ligne sans nom de produit - ignorée'];
    }
    
    // Autoriser les produits avec prix à 0 (produits de recherche)
    // On ne valide plus les prix ici, on accepte tout
    
    return errors; // Pas d'erreurs si on arrive ici
  };

  const processImport = async () => {
    if (!file) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            setError('Le fichier doit contenir des données à importer');
            setLoading(false);
            return;
          }

          // Parser le CSV en gérant les guillemets et tabulations
          const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              
              if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if ((char === ',' || char === '\t') && !inQuotes) {
                // Fin de champ (virgule OU tabulation)
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            
            result.push(current.trim());
            return result;
          };

          // Nettoyer les en-têtes (enlever les guillemets si présents)
          const cleanHeader = (header) => {
            return header.replace(/^"(.*)"$/, '$1').trim();
          };

          const headers = parseCSVLine(lines[0]).map(cleanHeader);
          console.log('📋 En-têtes nettoyés:', headers);
          const products = [];
          const errors = [];

          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            
            // Debug: afficher la ligne brute et les valeurs parsées
            console.log(` Ligne ${i + 1} brute:`, lines[i]);
            console.log(` Valeurs parsées:`, values);
            
            if (values.length >= headers.length) {
              const row = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              
              console.log(` Ligne ${i + 1} objet:`, row);
              
              const rowErrors = validateRow(row);
              console.log(`❌ Erreurs ligne ${i + 1}:`, rowErrors);
              
              // Ignorer seulement les lignes vraiment vides ou sans nom
              if (rowErrors.length === 1 && (rowErrors[0].includes('Ligne vide') || rowErrors[0].includes('sans nom de produit'))) {
                console.log(`⏭️ Ligne ${i + 1} ignorée: ${rowErrors[0]}`);
                continue; // Passer à la ligne suivante
              }
              
              // Accepter tous les autres produits (même avec prix = 0)
              if (rowErrors.length > 0) {
                console.log(`⚠️ Ligne ${i + 1} avec avertissements: ${rowErrors.join(', ')}`);
              }
              
              // Convertir les données au format attendu par l'API (avec vos noms de colonnes exacts et parsing français)
              const productData = {
                name: row['PRODUIT'] || row['PRODUIT '] || row['PRODUCT'] || row['NAME'] || row['NOM'],
                imageUrl: row['IMAGE APPARENTE'] || row['IMAGE'] || row['IMAGE URL'] || row['IMAGE_URL'] || row['IMG'],
                creative: row['CREATIVE'] || row['AD'] || row['ADS'] || row['PUB'],
                alibabaLink: row['LIEN ALIBABA'] || row['ALIBABA'] || row['ALIBABA LINK'] || row['ALIBABA_URL'],
                researchLink: row['LIEN RECHERCHE'] || row['RECHERCHE'] || row['RESEARCH'] || row['RESEARCH LINK'] || row['FACEBOOK'],
                websiteUrl: row['SITE WEB'] || row['WEBSITE'] || row['SITE_WEB'] || row['URL'],
                sourcingPrice: parseFrenchNumber(row['PRIX SOURCING BRUT'] || row['SOURCING'] || row['BUY PRICE'] || row['PRIX ACHAT']),
                weight: parseFrenchNumber(row['POIDS (KG)'] || row['WEIGHT'] || row['POIDS'] || row['KG']),
                shippingUnitCost: parseFrenchNumber(row['FRAIS DE LIVRAISON UNITAIRE'] || row['SHIPPING'] || row['LIVRAISON'] || row['SHIPPING COST']),
                cogs: parseFrenchNumber(row['COÛT DE REVIENT (COGS)'] || row['COGS'] || row['COST'] || row['COÛT']),
                sellingPrice: parseFrenchNumber(row['PRIX DE VENTE'] || row['SELLING PRICE'] || row['VENTE'] || row['PRICE']),
                opportunityScore: parseInt(row['SCORE OPPORTUNITÉ'] || row['SCORE'] || row['OPPORTUNITY']) || 3,
                status: row['STATUT'] || row['STATUS'] || row['STATE'] || 'research'
              };
              
              console.log(` ProduitData ligne ${i + 1}:`, productData);
              
              // Calculer les financiers automatiquement (même si prix = 0)
              productData.margin = productData.sellingPrice > 0 ? 
                ((productData.sellingPrice - productData.cogs) / productData.sellingPrice * 100) : 0;
              productData.profit = Math.max(0, productData.sellingPrice - productData.cogs);
              
              console.log(` Calculs financiers ligne ${i + 1}:`, { margin: productData.margin, profit: productData.profit });
              
              products.push(productData);
            } else {
              console.log(` Ligne ${i + 1}: Nombre de valeurs (${values.length}) < nombre d'en-têtes (${headers.length})`);
            }
          }

          if (errors.length > 0) {
            setError(`Erreurs de validation:\n${errors.join('\n')}`);
            setLoading(false);
            return;
          }

          if (products.length === 0) {
            setError('Aucun produit valide à importer');
            setLoading(false);
            return;
          }

          // Importer les produits un par un
          let successCount = 0;
          let importErrors = [];

          for (let i = 0; i < products.length; i++) {
            try {
              const response = await ecomApi.post('/products-research/research', products[i]);
              if (response.data.success) {
                successCount++;
              } else {
                importErrors.push(`Produit ${i + 1}: ${response.data.message || 'Erreur inconnue'}`);
              }
            } catch (error) {
              importErrors.push(`Produit ${i + 1}: Erreur lors de l'importation`);
            }
          }

          if (successCount > 0) {
            setSuccess(`${successCount} produit(s) importé(s) avec succès!${importErrors.length > 0 ? `\n${importErrors.length} erreur(s): ${importErrors.join(', ')}` : ''}`);
            setFile(null);
            setShowPreview(false);
            if (onImportSuccess) {
              onImportSuccess();
            }
          } else {
            setError('Aucun produit n\'a pu être importé');
          }
        } catch (error) {
          console.error('Erreur traitement fichier:', error);
          setError('Erreur lors du traitement du fichier');
        }
        setLoading(false);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Erreur lecture fichier:', error);
      setError('Erreur lors de la lecture du fichier');
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template-import-produits.csv';
    link.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Upload className="mr-2" size={20} />
          Importer des produits (CSV/Excel)
        </h3>
        <button
          onClick={downloadTemplate}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Télécharger le modèle
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="text-red-600 mr-3 mt-0.5" size={16} />
            <div className="text-red-700 text-sm whitespace-pre-line">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <CheckCircle className="text-green-600 mr-3 mt-0.5" size={16} />
            <div className="text-green-700 text-sm whitespace-pre-line">{success}</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <FileText className="w-12 h-12 text-gray-400 mb-3" />
            <span className="text-sm text-gray-600 mb-2">
              Cliquez pour sélectionner un fichier CSV ou Excel
            </span>
            <span className="text-xs text-gray-500">
              Formats supportés: .csv, .xlsx, .xls
            </span>
          </label>
        </div>

        {file && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-sm text-gray-700">{file.name}</span>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setShowPreview(false);
                setError('');
                setSuccess('');
              }}
              className="text-red-600 hover:text-red-800"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {showPreview && preview.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Aperçu (5 premières lignes):</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(preview[0]).map(header => (
                      <th key={header} className="px-2 py-1 text-left font-medium text-gray-500">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex} className="px-2 py-1 text-gray-900 truncate max-w-xs">
                          {value || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {file && (
          <div className="flex justify-end">
            <button
              onClick={processImport}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importation...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer les produits
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImport;
