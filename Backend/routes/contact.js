import express from 'express';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

// POST /api/ecom/contact - Formulaire de contact depuis bannière marketing
router.post('/', async (req, res) => {
  try {
    const { name, email, message, subject } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Nom, email et message sont requis'
      });
    }

    // Envoyer l'email à l'administrateur
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@scalor.site',
      subject: subject || 'Nouvelle demande de contact',
      template: 'contact-request',
      data: {
        name,
        email,
        message,
        subject: subject || 'Nouvelle demande de contact',
        date: new Date().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    });

    // Envoyer un accusé de réception à l'utilisateur
    try {
      await sendEmail({
        to: email,
        subject: 'Nous avons bien reçu votre demande',
        template: 'contact-confirmation',
        data: {
          name,
          subject: subject || 'Nouvelle demande de contact'
        }
      });
    } catch (confirmError) {
      console.warn('Erreur envoi confirmation client:', confirmError.message);
      // Ne pas bloquer la réponse si l'email de confirmation échoue
    }

    console.log(`📧 Nouvelle demande contact: ${name} (${email})`);

    res.json({
      success: true,
      message: 'Message envoyé avec succès'
    });

  } catch (error) {
    console.error('Erreur contact:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message'
    });
  }
});

export default router;
