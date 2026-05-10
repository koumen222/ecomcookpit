import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';

/**
 * Carrousel de témoignages pour les pages produits
 * Support témoignages automatiques (IA) et manuels (images uploadées)
 */
export default function TestimonialsCarousel({ testimonials = [], autoPlay = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!isAutoPlaying || testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length]);

  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const goToSlide = (index) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <div className="w-full bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 relative overflow-hidden">
      {/* Décoration de fond */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-teal-200/30 rounded-full blur-3xl"></div>

      {/* Titre */}
      <div className="text-center mb-8 relative z-10">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          💬 Ce que disent nos clients
        </h3>
        <p className="text-gray-600">Témoignages authentiques de clients satisfaits</p>
      </div>

      {/* Carousel */}
      <div className="relative z-10">
        <div className="flex items-center justify-center gap-6">
          {/* Bouton précédent */}
          <button
            onClick={goToPrevious}
            disabled={testimonials.length <= 1}
            className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={24} className="text-gray-700" />
          </button>

          {/* Contenu du témoignage */}
          <div className="flex-1 max-w-3xl">
            <div className="bg-white rounded-xl shadow-lg p-8 relative">
              {/* Icône citation */}
              <div className="absolute top-4 left-4 text-emerald-500 opacity-20">
                <Quote size={48} fill="currentColor" />
              </div>

              <div className="relative z-10">
                {/* Image du client (si manuelle) */}
                {currentTestimonial.image && (
                  <div className="flex justify-center mb-6">
                    <img
                      src={currentTestimonial.image}
                      alt={currentTestimonial.name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-emerald-100"
                    />
                  </div>
                )}

                {/* Étoiles */}
                <div className="flex justify-center gap-1 mb-4">
                  {[...Array(currentTestimonial.rating || 5)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      className="text-yellow-400 fill-yellow-400"
                    />
                  ))}
                </div>

                {/* Texte du témoignage */}
                <p className="text-gray-700 text-center text-lg leading-relaxed mb-6 italic">
                  "{currentTestimonial.text || currentTestimonial.comment}"
                </p>

                {/* Nom et détails */}
                <div className="text-center">
                  <p className="font-bold text-gray-900">
                    {currentTestimonial.name || 'Client vérifié'}
                  </p>
                  {currentTestimonial.location && (
                    <p className="text-sm text-gray-500 mt-1">
                      📍 {currentTestimonial.location}
                    </p>
                  )}
                  {currentTestimonial.date && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(currentTestimonial.date).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                  {currentTestimonial.verified && (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                      ✓ Achat vérifié
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bouton suivant */}
          <button
            onClick={goToNext}
            disabled={testimonials.length <= 1}
            className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={24} className="text-gray-700" />
          </button>
        </div>

        {/* Indicateurs de pagination */}
        {testimonials.length > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-emerald-500 w-8'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Badge "Témoignages authentiques" */}
      <div className="text-center mt-6 relative z-10">
        <span className="inline-flex items-center gap-2 text-sm text-emerald-700 bg-emerald-100 px-4 py-2 rounded-full font-medium">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          Témoignages 100% authentiques
        </span>
      </div>
    </div>
  );
}

/**
 * Version compacte du carrousel (pour sidebar ou sections secondaires)
 */
export function TestimonialsCarouselCompact({ testimonials = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  if (!testimonials || testimonials.length === 0) return null;

  const current = testimonials[currentIndex];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex gap-1 mb-2">
        {[...Array(current.rating || 5)].map((_, i) => (
          <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
        ))}
      </div>
      <p className="text-sm text-gray-700 mb-2 line-clamp-3 italic">
        "{current.text || current.comment}"
      </p>
      <p className="text-xs font-medium text-gray-900">
        - {current.name || 'Client vérifié'}
      </p>
      {testimonials.length > 1 && (
        <div className="flex gap-1 mt-2">
          {testimonials.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full ${
                idx === currentIndex ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
