import express from 'express';
import multer from 'multer';
import path from 'path';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

router.post('/product-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Aucun fichier reçu' });
  // URL accessible (à adapter selon config serveur)
  const url = `/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

export default router;
