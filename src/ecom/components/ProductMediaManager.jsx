import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Video, Play, Plus, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

/**
 * Gestionnaire de médias pour les produits (images + vidéos)
 * Permet drag & drop, réorganisation, ajout/suppression
 */
export default function ProductMediaManager({ 
  images = [], 
  videos = [],
  onImagesChange,
  onVideosChange 
}) {
  const [activeTab, setActiveTab] = useState('images');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoForm, setVideoForm] = useState({ url: '', type: 'youtube', title: '' });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);
    
    try {
      // Upload images to Cloudinary/server
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      
      const response = await fetch('/api/ecom/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      const newImages = data.urls.map((url, idx) => ({
        url,
        alt: '',
        order: images.length + idx
      }));
      
      onImagesChange([...images, ...newImages]);
    } catch (error) {
      console.error('Erreur upload images:', error);
      alert('Erreur lors de l\'upload des images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const updateImageAlt = (index, alt) => {
    const updated = [...images];
    updated[index] = { ...updated[index], alt };
    onImagesChange(updated);
  };

  const handleImageDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(images);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    const reindexed = items.map((item, idx) => ({ ...item, order: idx }));
    onImagesChange(reindexed);
  };

  const addVideo = () => {
    if (!videoForm.url) {
      alert('URL vidéo requise');
      return;
    }

    const newVideo = {
      ...videoForm,
      order: videos.length,
      thumbnail: getVideoThumbnail(videoForm.url, videoForm.type)
    };

    onVideosChange([...videos, newVideo]);
    setVideoForm({ url: '', type: 'youtube', title: '' });
    setShowVideoForm(false);
  };

  const removeVideo = (index) => {
    onVideosChange(videos.filter((_, i) => i !== index));
  };

  const getVideoThumbnail = (url, type) => {
    if (type === 'youtube') {
      const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
    }
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('images')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'images'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ImageIcon size={18} className="inline mr-2" />
          Images ({images.length})
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'videos'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Video size={18} className="inline mr-2" />
          Vidéos ({videos.length})
        </button>
      </div>

      {/* Images Tab */}
      {activeTab === 'images' && (
        <div className="space-y-4">
          {/* Upload Zone */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-500 transition">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={uploadingImages}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                {uploadingImages ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                ) : (
                  <Upload className="text-emerald-600" size={32} />
                )}
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {uploadingImages ? 'Upload en cours...' : 'Ajouter des images'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Cliquez ou glissez-déposez vos images ici
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG, WEBP jusqu'à 10MB
                </p>
              </div>
            </label>
          </div>

          {/* Images Grid with Drag & Drop */}
          {images.length > 0 && (
            <DragDropContext onDragEnd={handleImageDragEnd}>
              <Droppable droppableId="images-list" direction="horizontal">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                  >
                    {images.map((image, index) => (
                      <Draggable key={index} draggableId={`image-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`relative group ${snapshot.isDragging ? 'opacity-50' : ''}`}
                          >
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="absolute top-2 left-2 z-10 bg-white rounded-lg p-1 shadow-lg opacity-0 group-hover:opacity-100 transition cursor-grab"
                            >
                              <GripVertical size={18} className="text-gray-600" />
                            </div>

                            {/* Image */}
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={image.url}
                                alt={image.alt || `Image ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Badge première image */}
                            {index === 0 && (
                              <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
                                Principal
                              </div>
                            )}

                            {/* Remove Button */}
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                            >
                              <X size={16} />
                            </button>

                            {/* Alt Text */}
                            <input
                              type="text"
                              value={image.alt || ''}
                              onChange={(e) => updateImageAlt(index, e.target.value)}
                              placeholder="Texte alternatif..."
                              className="mt-2 w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {images.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Aucune image ajoutée
            </div>
          )}
        </div>
      )}

      {/* Videos Tab */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          {/* Add Video Button */}
          {!showVideoForm && (
            <button
              onClick={() => setShowVideoForm(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-500 transition"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                  <Plus className="text-emerald-600" size={32} />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-900">Ajouter une vidéo</p>
                  <p className="text-sm text-gray-500 mt-1">
                    YouTube, Vimeo ou lien direct
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Video Form */}
          {showVideoForm && (
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Ajouter une vidéo</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de vidéo
                </label>
                <select
                  value={videoForm.type}
                  onChange={(e) => setVideoForm({ ...videoForm, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="direct">Lien direct (MP4)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL de la vidéo *
                </label>
                <input
                  type="text"
                  value={videoForm.url}
                  onChange={(e) => setVideoForm({ ...videoForm, url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre (optionnel)
                </label>
                <input
                  type="text"
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  placeholder="Démonstration du produit"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addVideo}
                  className="flex-1 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition"
                >
                  Ajouter
                </button>
                <button
                  onClick={() => {
                    setShowVideoForm(false);
                    setVideoForm({ url: '', type: 'youtube', title: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Videos List */}
          {videos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((video, index) => (
                <div key={index} className="relative group bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gray-900 relative">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video size={48} className="text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                        <Play size={32} className="text-gray-900 ml-1" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {video.title || 'Vidéo sans titre'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{video.url}</p>
                    <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {video.type}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeVideo(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {videos.length === 0 && !showVideoForm && (
            <div className="text-center py-8 text-gray-500">
              Aucune vidéo ajoutée
            </div>
          )}
        </div>
      )}
    </div>
  );
}
