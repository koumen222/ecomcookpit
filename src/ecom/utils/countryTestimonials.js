const COUNTRY_TESTIMONIALS = {
  Cameroun: [
    { name: "Thierry M.", location: "Douala", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine. Je recommande a 100%.", verified: true, date: "Il y a 3 jours" },
    { name: "Astride N.", location: "Yaoundé", rating: 5, text: "Avant j'avais essaye plein de produits sans resultats. Depuis que j'utilise celui-ci, la difference est flagrante !", verified: true, date: "Il y a 5 jours" },
    { name: "Rodrigue K.", location: "Bafoussam", rating: 5, text: "Super qualite, livraison rapide. Le produit depasse mes attentes. Je vais en commander encore.", verified: true, date: "Il y a 1 semaine" },
    { name: "Christelle B.", location: "Douala", rating: 5, text: "J'etais sceptique au depart mais apres 2 semaines je ne peux plus m'en passer. Resultats durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Paul E.", location: "Yaoundé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant. Je recommande cette boutique.", verified: true, date: "Il y a 3 semaines" },
  ],
  "Cote d'Ivoire": [
    { name: "Fatou K.", location: "Abidjan", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Kouame A.", location: "Bouaké", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Aya D.", location: "Abidjan", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Seydou T.", location: "Yamoussoukro", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Marie L.", location: "Abidjan", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Senegal: [
    { name: "Aminata D.", location: "Dakar", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine. Je recommande.", verified: true, date: "Il y a 3 jours" },
    { name: "Ibrahima S.", location: "Thiès", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Fatou N.", location: "Dakar", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Moussa B.", location: "Mbour", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Aissatou F.", location: "Saint-Louis", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Ghana: [
    { name: "Kwame A.", location: "Accra", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Abena M.", location: "Kumasi", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Kofi D.", location: "Accra", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Ama T.", location: "Takoradi", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Yaw K.", location: "Tamale", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Togo: [
    { name: "Kossi M.", location: "Lomé", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Afi K.", location: "Kara", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Kodjo A.", location: "Lomé", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Akouavi D.", location: "Sokodé", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Yao T.", location: "Atakpamé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Benin: [
    { name: "Ganiou A.", location: "Cotonou", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Fifame D.", location: "Porto-Novo", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Hospice K.", location: "Cotonou", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Aurore B.", location: "Parakou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Léonce T.", location: "Abomey-Calavi", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Nigeria: [
    { name: "Chinedu O.", location: "Lagos", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Ngozi A.", location: "Abuja", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Emeka U.", location: "Lagos", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Blessing I.", location: "Port Harcourt", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Tunde B.", location: "Ibadan", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Gabon: [
    { name: "Steeve M.", location: "Libreville", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Ornella N.", location: "Port-Gentil", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Brice A.", location: "Libreville", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Chancelle O.", location: "Franceville", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Davy E.", location: "Oyem", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Mali: [
    { name: "Mamadou C.", location: "Bamako", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Fatoumata T.", location: "Sikasso", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Oumar D.", location: "Bamako", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Aïssata K.", location: "Ségou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Boubacar S.", location: "Kayes", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  "Burkina Faso": [
    { name: "Wendkouni O.", location: "Ouagadougou", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Mariam Z.", location: "Bobo-Dioulasso", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Abdoulaye K.", location: "Ouagadougou", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Salamata S.", location: "Koudougou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Hamidou T.", location: "Ouahigouya", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Guinee: [
    { name: "Alpha B.", location: "Conakry", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Mariama D.", location: "Kankan", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Mamadou S.", location: "Conakry", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Fatoumata C.", location: "Kindia", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Ibrahima K.", location: "Labé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Congo: [
    { name: "Gloire M.", location: "Brazzaville", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Merveille N.", location: "Pointe-Noire", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Christ B.", location: "Brazzaville", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Grâce O.", location: "Dolisie", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Parfait K.", location: "Nkayi", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  RDC: [
    { name: "Patrick M.", location: "Kinshasa", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Carine L.", location: "Lubumbashi", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Jonathan K.", location: "Kinshasa", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Esther N.", location: "Goma", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "David B.", location: "Kisangani", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
};
COUNTRY_TESTIMONIALS.default = COUNTRY_TESTIMONIALS.Cameroun;

export default COUNTRY_TESTIMONIALS;

export function getDefaultTestimonials(country) {
  if (!country) return COUNTRY_TESTIMONIALS.default;
  const key = Object.keys(COUNTRY_TESTIMONIALS).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return COUNTRY_TESTIMONIALS[key] || COUNTRY_TESTIMONIALS.default;
}
