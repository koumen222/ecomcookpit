import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from 'lucide-react';

const ProductImportLocal = ({ onImportSuccess, onClose }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Template CSV avec support des images
  const csvTemplate = `NOM	PRIX	CATÉGORIE	DESCRIPTION	EN_STOCK	IMAGES
Produit 1	15000	Mode	Description du produit 1	Oui	https://example.com/image1.jpg
Produit 2	25000	Accessoires	Description du produit 2	Oui	https://example.com/image2.jpg|https://example.com/image3.jpg
Produit 3	8000	Électronique	Description du produit 3	Non	https://example.com/image4.jpg`;

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
        setError('Veuillez sélectionner un fichier CSV ou Excel (.csv, .xlsx, .xls)');
        return;
      }

      setFile(selectedFile);
      setError('');
      setSuccess('');

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
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }

          result.push(current.trim());
          return result;
        };

        const cleanHeader = (header) => {
          return header.replace(/^"(.*)"$/, '$1').trim();
        };

        const headers = parseCSVLine(lines[0]).map(cleanHeader);
        const data = [];

        for (let i = 1; i < Math.min(lines.length, 6); i++) {
          const values = parseCSVLine(lines[i]);

          if (values.length >= 1) {
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
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }

            result.push(current.trim());
            return result;
          };

          const cleanHeader = (header) => {
            return header.replace(/^"(.*)"$/, '$1').trim();
          };

          const headers = parseCSVLine(lines[0]).map(cleanHeader);
          const products = [];

          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);

            if (values.length >= 1) {
              const row = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });

              // Vérifier si la ligne est vide
              const isEmpty = Object.values(row).every(value => !value || value.trim() === '');
              if (isEmpty) continue;

              // Vérifier le nom
              const productName = row['NOM'] || row['PRODUIT'] || row['NAME'] || row['PRODUCT'];
              if (!productName || productName.trim() === '') continue;

              // Parser les images (séparées par |)
              const imagesStr = row['IMAGES'] || row['IMAGE'] || '';
              const images = imagesStr
                .split('|')
                .map(img => img.trim())
                .filter(img => img && (img.startsWith('http') || img.startsWith('/')));

              // Créer l'objet produit
              const productData = {
                name: productName,
                price: row['PRIX'] || row['PRICE'] || '0',
                category: row['CATÉGORIE'] || row['CATEGORY'] || '',
                description: row['DESCRIPTION'] || row['DESC'] || '',
                inStock: (row['EN_STOCK'] || row['IN_STOCK'] || 'Oui').toLowerCase() !== 'non',
                images: images, // Ajouter les images
                quantityOffers: [],
              };

              products.push(productData);
            }
          }

          if (products.length === 0) {
            setError('Aucun produit valide à importer');
            setLoading(false);
            return;
          }

          // Appeler le callback avec les produits
          if (onImportSuccess) {
            onImportSuccess(products);
          }

          setSuccess(`${products.length} produit(s) importé(s) avec succès!`);
          setFile(null);
          setShowPreview(false);
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
    link.download = 'template-produits.csv';
    link.click();
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importer des produits (CSV)
          </h3>
          <p className="text-[12px] text-gray-400 mt-1">Importez plusieurs produits à la fois</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-[12px] font-semibold"
        >
          <Download className="w-4 h-4" />
          Modèle
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-red-600 w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-red-700 text-[12px]">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-2">
            <CheckCircle className="text-green-600 w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-green-700 text-[12px]">{success}</div>
          </div>
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload-local"
        />
        <label
          htmlFor="file-upload-local"
          className="cursor-pointer flex flex-col items-center"
        >
          <FileText className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-[12px] text-gray-600 mb-1">
            Cliquez pour sélectionner un fichier CSV
          </span>
          <span className="text-[11px] text-gray-500">
            Formats: .csv, .xlsx, .xls
          </span>
        </label>
      </div>

      {file && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <span className="text-[12px] text-gray-700">{file.name}</span>
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
        <div className="mt-3">
          <h4 className="text-[12px] font-semibold text-gray-900 mb-2">Aperçu (5 premières lignes):</h4>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-[11px]">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(preview[0]).map(header => (
                    <th key={header} className="px-2 py-1 text-left font-medium text-gray-600 border-r">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.values(row).map((value, cellIndex) => (
                      <td key={cellIndex} className="px-2 py-1 text-gray-700 truncate max-w-xs border-r">
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

      <div className="flex justify-between gap-2">
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[12px] font-semibold transition-colors"
          >
            Annuler
          </button>
        )}
        {file && (
          <button
            onClick={processImport}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Importation...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importer
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductImportLocal;
