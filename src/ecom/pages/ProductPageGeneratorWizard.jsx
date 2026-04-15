import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductPageGeneratorModal from '../components/ProductPageGeneratorModal.jsx';

const ProductPageGeneratorWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/ecom/boutique') ? '/ecom/boutique' : '/ecom/store';
  const returnTo = location.state?.from || `${basePath}/product-page-studio/generations`;
  const loadTaskId = location.state?.loadTaskId || null;

  const handleClose = () => {
    navigate(returnTo);
  };

  const handleApply = (productData) => {
    navigate(`${basePath}/products/new`, {
      state: {
        prefill: productData,
        fromGenerator: true,
      },
    });
  };

  return (
    <ProductPageGeneratorModal
      onClose={handleClose}
      onApply={handleApply}
      pageMode
      initialTaskId={loadTaskId}
    />
  );
};

export default ProductPageGeneratorWizard;