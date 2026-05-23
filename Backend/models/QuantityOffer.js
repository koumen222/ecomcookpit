import mongoose from 'mongoose';

const offerItemSchema = new mongoose.Schema({
  // Wizard fields
  quantity:      { type: Number, required: true, min: 1 },
  price:         { type: Number, required: true, min: 0 },
  compare_price: { type: Number, default: null },
  discount:      { type: Number, default: 0 },
  label:         { type: String, trim: true, default: '' },
  // Modal-compatible aliases (saved alongside for direct use)
  qty:           { type: Number, default: 1 },
  comparePrice:  { type: Number, default: 0 },
  badge:         { type: String, trim: true, default: '' },
  selected:      { type: Boolean, default: false },
}, { _id: false });

const designSchema = new mongoose.Schema({
  template:          { type: String, default: 'modern' },
  position:          { type: String, default: 'inside_form' },
  border_style:      { type: String, default: 'solid' },
  border_radius:     { type: Number, default: 12 },
  highlight_offer:   { type: Number, default: null },
  display_type:      { type: String, default: 'radio' },
  offerSectionLabel: { type: String, default: '' },
  colors: {
    primary:    { type: String, default: '#be123c' },
    background: { type: String, default: '#ffffff' },
    border:     { type: String, default: '#e5e7eb' },
    text:       { type: String, default: '#111827' },
  },
  // Selected card
  sel_bg:     { type: String, default: '' },
  sel_border: { type: String, default: '' },
  // Unselected card
  unsel_bg:     { type: String, default: '' },
  unsel_border: { type: String, default: '' },
  // Radio
  radio_color: { type: String, default: '' },
  // Badge (texte fixe)
  badge_gradient:   { type: String, default: '' },
  badge_text_color: { type: String, default: '#ffffff' },
  badge_font_size:  { type: Number, default: 11 },
  badge_style:      { type: String, default: 'pill' },
  // Discount label
  label_gradient:   { type: String, default: '' },
  label_text_color: { type: String, default: '#ffffff' },
  label_font_size:  { type: Number, default: 11 },
  label_style:      { type: String, default: 'banner' },
  // Discount chip
  discount_bg:    { type: String, default: '#FEE2E2' },
  discount_color: { type: String, default: '#EF4444' },
  // Title
  title_text_color:  { type: String, default: '#000000' },
  title_font_size:   { type: Number, default: 14 },
  title_font_weight: { type: String, default: 'bold' },
  // Price
  price_text_color:  { type: String, default: '' },
  price_font_size:   { type: Number, default: 15 },
  price_font_weight: { type: String, default: 'bold' },
  // Compare price
  compare_color: { type: String, default: '#9ca3af' },
  // Theme tracking
  _themeId: { type: String, default: '' },
}, { _id: false });

const quantityOfferSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreProduct',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  offers: [offerItemSchema],
  design: { type: designSchema, default: () => ({}) },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  collection: 'quantity_offers',
  timestamps: true
});

quantityOfferSchema.index({ workspaceId: 1, productId: 1, isActive: 1 });
quantityOfferSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.model('QuantityOffer', quantityOfferSchema);
