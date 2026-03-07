import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import ecomApi from "../services/ecommApi.js";

const TEMPLATES = [
  { id: "relance_pending", label: "En attente", name: "Relance commandes en attente", orderStatus: ["pending"], message: "Bonjour {firstName},\n\nNous avons bien reçu votre commande et elle est actuellement en attente de confirmation.\n\nPour finaliser votre livraison, notre équipe a besoin de valider quelques informations.\n\nPouvez-vous confirmer que vous êtes toujours intéressé(e) ?\n\nRépondez OUI et nous nous occupons du reste.\n\nCordialement,\nL'équipe Scalor" },
  { id: "relance_unreachable", label: "Injoignables", name: "Relance clients injoignables", orderStatus: ["unreachable"], message: "Bonjour {firstName},\n\nNous avons tenté de vous joindre par téléphone à plusieurs reprises sans succès concernant votre commande.\n\nVotre colis est prêt. Merci de nous confirmer votre disponibilité via ce message afin de planifier la livraison.\n\nCordialement,\nL'équipe Scalor" },
  { id: "relance_called", label: "Appelés", name: "Relance après appel", orderStatus: ["called"], message: "Bonjour {firstName},\n\nSuite à notre échange téléphonique, nous confirmons que votre commande ({product}) est bien enregistrée.\n\nNous souhaitons vous informer que tout est en ordre de notre côté. Votre livraison sera traitée dans les meilleurs délais.\n\nDes questions ? Nous sommes disponibles.\n\nCordialement,\nL'équipe Scalor" },
  { id: "relance_postponed", label: "Reportés", name: "Relance commandes reportées", orderStatus: ["postponed"], message: "Bonjour {firstName},\n\nLors de notre dernier contact, vous nous aviez demandé de vous recontacter ultérieurement.\n\nNous revenons vers vous pour savoir si le moment est venu de finaliser votre commande.\n\nNous sommes disponibles pour répondre à toutes vos questions.\n\nCordialement,\nL'équipe Scalor" },
  { id: "relance_cancelled", label: "Annulés", name: "Relance clients ayant annulé", orderStatus: ["cancelled"], message: "Bonjour {firstName},\n\nNous avons constaté que votre commande a été annulée.\n\nNous souhaitons comprendre ce qui s'est passé et voir comment nous pouvons vous aider au mieux.\n\nN'hésitez pas à nous contacter directement via ce message.\n\nCordialement,\nL'équipe Scalor" },
  { id: "relance_returned", label: "Retours produit", name: "Relance après retour", orderStatus: ["returned"], message: "Bonjour {firstName},\n\nNous avons bien reçu le retour de votre commande.\n\nVotre satisfaction est notre priorité. Nous souhaitons comprendre ce qui n'a pas correspondu à vos attentes.\n\nMerci de nous indiquer la raison du retour afin que nous puissions vous proposer une solution adaptée.\n\nCordialement,\nL'équipe Scalor" },
  { id: "relance_confirmed", label: "Confirmés non expédiés", name: "Relance confirmés en attente expédition", orderStatus: ["confirmed"], message: "Bonjour {firstName},\n\nVotre commande ({product}) a bien été confirmée. Nous préparons actuellement votre colis avec soin.\n\nVous serez informé dès que votre envoi sera pris en charge par notre service de livraison.\n\nMerci de votre confiance.\n\nCordialement,\nL'équipe Scalor" },
  { id: "promo_city", label: "Promo par ville", name: "Offre ciblée par ville", orderStatus: [], message: "Bonjour {firstName},\n\nNous lançons une offre exclusive pour nos clients de {city}.\n\nPour vous remercier de votre fidélité, bénéficiez d'une réduction sur votre prochaine commande.\n\nCette offre est valable pour une durée limitée. Répondez à ce message pour en savoir plus.\n\nCordialement,\nL'équipe Scalor" },
  { id: "promo_product", label: "Promo par produit", name: "Promotion ciblée par produit", orderStatus: [], message: "Bonjour {firstName},\n\nVous avez déjà commandé {product}  merci pour votre confiance.\n\nNous avons une offre spéciale sur ce produit, disponible pour une durée limitée.\n\nRépondez à ce message pour en profiter.\n\nCordialement,\nL'équipe Scalor" },
  { id: "followup_delivered", label: "Suivi livraison", name: "Suivi satisfaction après livraison", orderStatus: ["delivered"], message: "Bonjour {firstName},\n\nVotre commande a été livrée. Nous espérons qu'elle vous donne entière satisfaction.\n\nVotre avis nous importe. N'hésitez pas à nous faire un retour sur votre expérience.\n\nMerci pour votre confiance.\n\nCordialement,\nL'équipe Scalor" },
  { id: "relance_reachat", label: "Réachat fidèles", name: "Relance réachat clients fidèles", orderStatus: [], message: "Bonjour {firstName},\n\nVous faites partie de nos clients fidèles avec {totalOrders} commande(s) enregistrée(s).\n\nNous vous remercions de votre confiance et souhaitons vous proposer une offre exclusive réservée à nos meilleurs clients.\n\nRépondez à ce message pour en savoir plus.\n\nCordialement,\nL'équipe Scalor" },
  { id: "suivi_expedition", label: "Expédition", name: "Notification d'expédition colis", orderStatus: ["shipped"], message: "Bonjour {firstName},\n\nVotre colis ({product}) vient d'être expédié.\n\nIl est en route vers {city}. Notre livreur vous contactera avant le passage.\n\nMerci de vous assurer d'être disponible à la réception.\n\nCordialement,\nL'équipe Scalor" },
];

const STATUS_GROUPS = [
  { id: "pending",     label: "En attente",      desc: "Commandes en attente de confirmation" },
  { id: "confirmed",   label: "Confirmé",        desc: "Commandes confirmées non encore expédiées" },
  { id: "shipped",     label: "Expédié",          desc: "Commandes en cours de livraison" },
  { id: "delivered",   label: "Livré",            desc: "Commandes livrées au client" },
  { id: "returned",    label: "Retour",           desc: "Commandes retournées ou renvoyées" },
  { id: "cancelled",   label: "Annulé",           desc: "Commandes annulées" },
  { id: "unreachable", label: "Injoignable",      desc: "Clients non joignables par téléphone" },
  { id: "called",      label: "Appelé",           desc: "Clients déjà contactés par téléphone" },
  { id: "postponed",   label: "Reporté",          desc: "Commandes reportées à une date ultérieure" },
];

const VARIABLES = [
  { var: "{firstName}", label: "Prénom" },
  { var: "{lastName}",  label: "Nom" },
  { var: "{city}",      label: "Ville" },
  { var: "{product}",   label: "Produit" },
  { var: "{totalOrders}", label: "Nb commandes" },
  { var: "{totalSpent}",  label: "Total dépensé" },
  { var: "{status}",    label: "Statut" },
  { var: "{phone}",     label: "Téléphone" },
  { var: "{orderDate}", label: "Date commande" },
  { var: "{lastContact}", label: "Dernier contact" },
];

const renderMsg = (msg) => {
  if (!msg) return "";
  return msg
    .replace(/\{firstName\}/g, "Aminata").replace(/\{lastName\}/g, "Koné")
    .replace(/\{city\}/g, "Douala").replace(/\{product\}/g, "Crème Glow")
    .replace(/\{totalOrders\}/g, "3").replace(/\{totalSpent\}/g, "45 000")
    .replace(/\{status\}/g, "En attente").replace(/\{phone\}/g, "+237 699 63 33 58")
    .replace(/\{orderDate\}/g, "11/02/2026").replace(/\{lastContact\}/g, "05/02/2026")
    .replace(/\{fullName\}/g, "Aminata Koné").replace(/\{price\}/g, "15 000");
};

const IconCheck = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
  </svg>
);
const IconChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
  </svg>
);
const IconSpinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

const CampaignForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const textareaRef = useRef(null);

  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [citySearch, setCitySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "", type: "custom", messageTemplate: "",
    targetFilters: { orderStatus: [], orderCity: [], orderAddress: "", orderProduct: [], orderDateFrom: "", orderDateTo: "", orderMinPrice: 0, orderMaxPrice: 0 },
    scheduledAt: "", tags: "",
    media: { type: "none", url: "", fileName: "", caption: "" }
  });

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState("");
  const [previewSending, setPreviewSending] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ cities: [], products: [], addresses: [] });
  const [mediaUploading, setMediaUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    ecomApi.get("/campaigns/filter-options").then(res => setFilterOptions(res.data.data)).catch(() => {});
    if (isEdit) {
      ecomApi.get(`/campaigns/${id}`).then(res => {
        const c = res.data.data;
        setFormData({
          name: c.name || "", type: c.type || "custom", messageTemplate: c.messageTemplate || "",
          targetFilters: { orderStatus: [], orderCity: [], orderAddress: "", orderProduct: [], orderDateFrom: "", orderDateTo: "", orderMinPrice: 0, orderMaxPrice: 0, ...(c.targetFilters || {}) },
          scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : "",
          tags: (c.tags || []).join(", "),
          media: c.media || { type: "none", url: "", fileName: "", caption: "" }
        });
      }).catch(() => setError("Campagne introuvable")).finally(() => setFetchLoading(false));
    }
  }, [id, isEdit]);

  const toggleStatus = (statusId) => {
    setFormData(prev => {
      const cur = prev.targetFilters.orderStatus || [];
      const next = cur.includes(statusId) ? cur.filter(x => x !== statusId) : [...cur, statusId];
      return { ...prev, targetFilters: { ...prev.targetFilters, orderStatus: next } };
    });
  };

  const toggleArrayFilter = (key, value) => {
    setFormData(prev => {
      const cur = Array.isArray(prev.targetFilters[key]) ? prev.targetFilters[key] : [];
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...prev, targetFilters: { ...prev.targetFilters, [key]: next } };
    });
  };

  const updateFilter = (key, value) => {
    setFormData(prev => ({ ...prev, targetFilters: { ...prev.targetFilters, [key]: value } }));
  };

  const resetFilters = () => {
    setFormData(prev => ({ ...prev, targetFilters: { orderStatus: [], orderCity: [], orderAddress: "", orderProduct: [], orderDateFrom: "", orderDateTo: "", orderMinPrice: 0, orderMaxPrice: 0 } }));
    setPreview(null);
  };

  const hasAnyFilter = () => {
    const tf = formData.targetFilters;
    return (tf.orderStatus||[]).length>0||(tf.orderCity||[]).length>0||(tf.orderProduct||[]).length>0||!!tf.orderDateFrom||!!tf.orderDateTo||tf.orderMinPrice>0||tf.orderMaxPrice>0;
  };

  const handlePreview = async () => {
    if (!hasAnyFilter()) { setPreview({ count: 0, clients: [], empty: true }); return; }
    setPreviewLoading(true);
    try {
      const res = await ecomApi.post("/campaigns/preview", { targetFilters: formData.targetFilters });
      setPreview(res.data.data);
      setSelectedClients(new Set(res.data.data.clients.map(c => c._id)));
    } catch { setError("Erreur lors du chargement de l'audience"); }
    finally { setPreviewLoading(false); }
  };

  const applyTemplate = (tpl) => {
    setSelectedTemplate(tpl.id);
    setFormData(prev => ({
      ...prev,
      name: prev.name || tpl.name,
      type: tpl.id,
      messageTemplate: tpl.message,
      targetFilters: { ...prev.targetFilters, orderStatus: tpl.orderStatus || [] }
    }));
  };

  const insertVariable = (v) => {
    const ta = textareaRef.current;
    if (!ta) { setFormData(p => ({ ...p, messageTemplate: p.messageTemplate + v })); return; }
    const s = ta.selectionStart, e = ta.selectionEnd;
    const newVal = formData.messageTemplate.slice(0, s) + v + formData.messageTemplate.slice(e);
    setFormData(p => ({ ...p, messageTemplate: newVal }));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); }, 0);
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setError("");
    if (!formData.name.trim()) { setError("Le nom de la campagne est requis"); return; }
    if (!formData.messageTemplate.trim()) { setError("Le message WhatsApp est requis"); return; }
    setLoading(true);
    try {
      const payload = { 
        ...formData, 
        tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [], 
        scheduledAt: formData.scheduledAt || null, 
        selectedClientIds: selectedClients.size > 0 ? Array.from(selectedClients) : [],
        media: formData.media.type !== 'none' ? formData.media : { type: 'none', url: '', fileName: '', caption: '' }
      };
      console.log('💾 Saving campaign with media:', payload.media);
      if (isEdit) { await ecomApi.put(`/campaigns/${id}`, payload); } else { await ecomApi.post("/campaigns", payload); }
      navigate("/ecom/campaigns");
    } catch (err) { setError(err.response?.data?.message || "Erreur enregistrement"); }
    finally { setLoading(false); }
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isImage && !isAudio) {
      setError("Fichier non supporté. Utilisez une image (JPG, PNG, GIF, WebP) ou un audio (MP3, OGG, WAV, M4A)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 10 MB)");
      return;
    }

    setMediaUploading(true);
    setError("");

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const res = await ecomApi.post('/media-upload/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setFormData(prev => ({
        ...prev,
        media: {
          type: isImage ? 'image' : 'audio',
          url: res.data.data.url,
          fileName: res.data.data.fileName,
          caption: isImage ? prev.messageTemplate : ''
        }
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'upload");
    } finally {
      setMediaUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = () => {
    setFormData(prev => ({ ...prev, media: { type: "none", url: "", fileName: "", caption: "" } }));
  };

  const handlePreviewSend = async (client) => {
    if (!formData.messageTemplate.trim()) { setError("Rédigez d'abord le message"); return; }
    setPreviewSending(client._id);
    try { 
      await ecomApi.post("/campaigns/preview-send", { 
        messageTemplate: formData.messageTemplate, 
        clientId: client._id,
        media: formData.media.type !== 'none' ? formData.media : null
      }); 
    }
    catch (err) { setError(err.response?.data?.message || "Erreur envoi test"); }
    finally { setPreviewSending(null); }
  };

  if (fetchLoading) return <div className="flex items-center justify-center h-64"><IconSpinner /></div>;

  const inp = "block w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white";
  const statusCount = (formData.targetFilters.orderStatus||[]).length;
  const cityCount = (formData.targetFilters.orderCity||[]).length;
  const productCount = (formData.targetFilters.orderProduct||[]).length;
  const filteredCities = (filterOptions.cities||[]).filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));
  const filteredProducts = (filterOptions.products||[]).filter(p => p.toLowerCase().includes(productSearch.toLowerCase()));
  const activeStatusLabels = (formData.targetFilters.orderStatus||[]).map(s => STATUS_GROUPS.find(g => g.id===s)?.label||s);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => navigate("/ecom/campaigns")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition flex-shrink-0">
              <IconChevronLeft />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate">{isEdit ? "Modifier la campagne" : "Nouvelle campagne WhatsApp"}</h1>
              {!isEdit && <p className="text-xs text-gray-400 hidden sm:block">Etape {step} sur 3</p>}
            </div>
          </div>
          {!isEdit && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {[{n:1,l:"Template"},{n:2,l:"Ciblage"},{n:3,l:"Message"}].map((s,i) => (
                <React.Fragment key={s.n}>
                  <button type="button" onClick={() => setStep(s.n)}
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${step===s.n?"bg-emerald-600 text-white":step>s.n?"bg-emerald-50 text-emerald-700 hover:bg-emerald-100":"bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${step===s.n?"bg-white text-emerald-600":step>s.n?"bg-emerald-500 text-white":"bg-gray-300 text-white"}`}>
                      {step>s.n?<IconCheck/>:s.n}
                    </span>
                    {s.l}
                  </button>
                  {i<2&&<div className={`hidden sm:block w-5 h-px ${step>s.n?"bg-emerald-400":"bg-gray-200"}`}/>}
                </React.Fragment>
              ))}
              <span className="sm:hidden text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{step}/3</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {error}
          </div>
        )}

        {/*  STEP 1 : TEMPLATE  */}
        {(!isEdit && step===1) && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">Nom de la campagne <span className="text-red-500">*</span></label>
              <input type="text" value={formData.name} onChange={e => setFormData(p=>({...p,name:e.target.value}))} className={inp} placeholder="Ex : Relance injoignables  mars 2026" />
              <p className="text-xs text-gray-400 mt-1.5">Donnez un nom clair pour identifier cette campagne dans votre liste</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Choisissez un template de message</h2>
                <p className="text-xs text-gray-400 mt-0.5">Le template applique automatiquement le ciblage correspondant. Vous pourrez ajuster les filtres à l'étape suivante.</p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {TEMPLATES.map(tpl => {
                    const active = selectedTemplate===tpl.id;
                    return (
                      <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${active?"border-emerald-500 bg-emerald-50":"border-gray-100 bg-gray-50 hover:border-gray-300 hover:bg-white"}`}>
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <p className="text-xs font-semibold text-gray-800 leading-snug">{tpl.label}</p>
                          {active && <span className="flex-shrink-0 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white"><IconCheck/></span>}
                        </div>
                        {tpl.orderStatus.length>0&&(
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tpl.orderStatus.map(s=>(
                              <span key={s} className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">{STATUS_GROUPS.find(g=>g.id===s)?.label||s}</span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedTemplate && (() => {
                  const tpl = TEMPLATES.find(t=>t.id===selectedTemplate);
                  return tpl ? (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 mb-1">{tpl.name}</p>
                          <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-4 font-mono">{renderMsg(tpl.message)}</p>
                        </div>
                        <button type="button" onClick={() => setStep(2)}
                          className="flex-shrink-0 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition">
                          Continuer
                        </button>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button type="button" onClick={() => navigate("/ecom/campaigns")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">Annuler</button>
              <button type="button" onClick={() => setStep(2)} disabled={!formData.name.trim()}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                Suivant  Ciblage
              </button>
            </div>
          </div>
        )}

        {/*  STEP 2 : CIBLAGE  */}
        {(isEdit||step===2) && (
          <div className="space-y-5">
            {isEdit && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Informations</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la campagne <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.name} onChange={e=>setFormData(p=>({...p,name:e.target.value}))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Programmer l'envoi</label>
                    <input type="datetime-local" value={formData.scheduledAt} onChange={e=>setFormData(p=>({...p,scheduledAt:e.target.value}))} className={inp} />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Ciblage des clients</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Définissez quels clients recevront ce message</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasAnyFilter()&&<button type="button" onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 underline">Réinitialiser</button>}
                  <button type="button" onClick={handlePreview} disabled={previewLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
                    {previewLoading?<><IconSpinner/>Calcul...</>:"Voir l'audience"}
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Applied from template notice */}
                {!isEdit && selectedTemplate && statusCount>0 && (
                  <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-800">Filtre appliqué depuis le template</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Statuts : <strong>{activeStatusLabels.join(", ")}</strong>. Vous pouvez modifier ou ajouter d'autres statuts ci-dessous.</p>
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="flex-shrink-0 text-[10px] text-emerald-700 underline hover:text-emerald-900">Changer</button>
                  </div>
                )}

                {/* Status groups */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">Statut des commandes</p>
                    {statusCount>0&&<span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{statusCount} sélectionné{statusCount>1?"s":""}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_GROUPS.map(({id,label,desc}) => {
                      const sel = (formData.targetFilters.orderStatus||[]).includes(id);
                      return (
                        <button key={id} type="button" title={desc}
                          onClick={() => { toggleStatus(id); setTimeout(handlePreview, 300); }}
                          className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${sel?"border-emerald-500 bg-emerald-50 text-emerald-800":"border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"}`}>
                          {sel&&<span className="mr-1 text-emerald-500"></span>}{label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Survolez un statut pour voir sa description. Vous pouvez en sélectionner plusieurs.</p>
                </div>

                {/* Cities + Products */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-gray-700">Villes {cityCount>0&&<span className="ml-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">{cityCount}</span>}</p>
                      {filteredCities.length>0&&<button type="button" onClick={()=>{const all=cityCount===filteredCities.length;setFormData(p=>({...p,targetFilters:{...p.targetFilters,orderCity:all?[]:filteredCities}}));setTimeout(handlePreview,300);}} className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium">{cityCount===filteredCities.length&&filteredCities.length>0?"Désélectionner tout":"Tout sélectionner"}</button>}
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <input type="text" value={citySearch} onChange={e=>setCitySearch(e.target.value)} placeholder="Rechercher..." className="w-full text-xs bg-transparent outline-none placeholder-gray-400" />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredCities.length===0&&<p className="text-xs text-gray-400 p-3 text-center">Aucune ville</p>}
                        {filteredCities.map(c=>{const sel=(formData.targetFilters.orderCity||[]).includes(c);return(
                          <label key={c} className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 transition ${sel?"bg-emerald-50":""}`}>
                            <input type="checkbox" checked={sel} onChange={()=>{toggleArrayFilter("orderCity",c);setTimeout(handlePreview,300);}} className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 flex-shrink-0" />
                            <span className={`text-xs truncate ${sel?"font-semibold text-emerald-800":"text-gray-700"}`}>{c}</span>
                          </label>
                        );})}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-gray-700">Produits {productCount>0&&<span className="ml-1 text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-200">{productCount}</span>}</p>
                      {filteredProducts.length>0&&<button type="button" onClick={()=>{const all=productCount===filteredProducts.length;setFormData(p=>({...p,targetFilters:{...p.targetFilters,orderProduct:all?[]:filteredProducts}}));setTimeout(handlePreview,300);}} className="text-[10px] text-purple-600 hover:text-purple-800 font-medium">{productCount===filteredProducts.length&&filteredProducts.length>0?"Désélectionner tout":"Tout sélectionner"}</button>}
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <input type="text" value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Rechercher..." className="w-full text-xs bg-transparent outline-none placeholder-gray-400" />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredProducts.length===0&&<p className="text-xs text-gray-400 p-3 text-center">Aucun produit</p>}
                        {filteredProducts.map(p=>{const sel=(formData.targetFilters.orderProduct||[]).includes(p);return(
                          <label key={p} className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 transition ${sel?"bg-purple-50":""}`}>
                            <input type="checkbox" checked={sel} onChange={()=>{toggleArrayFilter("orderProduct",p);setTimeout(handlePreview,300);}} className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 flex-shrink-0" />
                            <span className={`text-xs truncate ${sel?"font-semibold text-purple-800":"text-gray-700"}`} title={p}>{p}</span>
                          </label>
                        );})}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date + price */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Date début</label><input type="date" value={formData.targetFilters.orderDateFrom} onChange={e=>{updateFilter("orderDateFrom",e.target.value);setTimeout(handlePreview,300);}} className={inp}/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Date fin</label><input type="date" value={formData.targetFilters.orderDateTo} onChange={e=>{updateFilter("orderDateTo",e.target.value);setTimeout(handlePreview,300);}} className={inp}/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Prix min (FCFA)</label><input type="number" min="0" value={formData.targetFilters.orderMinPrice||""} placeholder="0" onChange={e=>updateFilter("orderMinPrice",parseInt(e.target.value)||0)} className={inp}/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Prix max (FCFA)</label><input type="number" min="0" value={formData.targetFilters.orderMaxPrice||""} placeholder="0" onChange={e=>updateFilter("orderMaxPrice",parseInt(e.target.value)||0)} className={inp}/></div>
                </div>

                {/* Audience result */}
                {preview && (
                  <div className={`rounded-xl border p-4 ${preview.empty?"bg-gray-50 border-gray-200":preview.count===0?"bg-red-50 border-red-200":"bg-emerald-50 border-emerald-200"}`}>
                    {preview.empty ? (
                      <p className="text-sm text-gray-500 text-center">Sélectionnez au moins un filtre pour calculer l'audience</p>
                    ) : preview.count===0 ? (
                      <p className="text-sm text-red-600 text-center font-medium">Aucun client trouvé avec ces filtres</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-emerald-700">{preview.count}</span>
                            <span className="text-sm text-emerald-600 font-medium">client{preview.count>1?"s":""} correspondant{preview.count>1?"s":""}</span>
                            <span className="text-xs text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-200">{selectedClients.size} sélectionné{selectedClients.size>1?"s":""}</span>
                          </div>
                          <button type="button" onClick={()=>setSelectedClients(selectedClients.size===preview.clients.length?new Set():new Set(preview.clients.map(c=>c._id)))} className="text-xs text-emerald-700 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition font-medium">
                            {selectedClients.size===preview.clients.length?"Désélectionner tout":"Tout sélectionner"}
                          </button>
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-1">
                          {preview.clients.map(c => (
                            <label key={c._id||c.phone} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition text-xs ${selectedClients.has(c._id)?"bg-white border border-emerald-200 shadow-sm":"bg-white/50 border border-transparent hover:bg-white"}`}>
                              <input type="checkbox" checked={selectedClients.has(c._id)} onChange={()=>setSelectedClients(prev=>{const n=new Set(prev);n.has(c._id)?n.delete(c._id):n.add(c._id);return n;})} className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 flex-shrink-0" />
                              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0">
                                {(c.firstName||c.clientName||"?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-gray-800">{c.firstName||c.clientName} {c.lastName||""}</span>
                                {c.city&&<span className="text-gray-400 ml-1.5 text-[10px]"> {c.city}</span>}
                                {c.status&&<span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">{c.status}</span>}
                              </div>
                              <span className="text-gray-400 font-mono text-[10px] flex-shrink-0">{c.phone}</span>
                              <button type="button" onClick={e=>{e.preventDefault();handlePreviewSend(c);}} disabled={previewSending===c._id||!formData.messageTemplate.trim()} className="flex-shrink-0 px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition text-[10px] font-medium disabled:opacity-40">
                                {previewSending===c._id?"...":"Tester"}
                              </button>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              {!isEdit&&<button type="button" onClick={()=>setStep(1)} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"><IconChevronLeft/>Retour</button>}
              <button type="button" onClick={()=>setStep(3)} className="ml-auto px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
                Suivant  Message
              </button>
            </div>
          </div>
        )}

        {/*  STEP 3 : MESSAGE  */}
        {(isEdit||step===3) && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Message WhatsApp</h2>
                <p className="text-xs text-gray-400 mt-0.5">Utilisez *texte* pour le gras et _texte_ pour l'italique dans WhatsApp</p>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <button key={v.var} type="button" onClick={()=>insertVariable(v.var)}
                    className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition flex items-center gap-1">
                    {v.label}<code className="text-[10px] text-gray-400 ml-0.5">{v.var}</code>
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                <div className="p-5">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Rédaction</label>
                  <textarea ref={textareaRef} rows={11} value={formData.messageTemplate}
                    onChange={e=>setFormData(p=>({...p,messageTemplate:e.target.value}))}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono resize-none bg-gray-50"
                    placeholder={"Bonjour {firstName},\n\nVotre message ici...\n\nCordialement,\nL'équipe Scalor"}
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5">{formData.messageTemplate.length} caractère{formData.messageTemplate.length>1?"s":""}{formData.messageTemplate.length>500&&"  message long"}</p>
                </div>
                <div className="p-5 bg-gray-50">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Aperçu (client exemple : Aminata  Douala)</label>
                  <div className="bg-[#ece5dd] rounded-xl p-3 min-h-[200px] flex flex-col justify-end">
                    {formData.messageTemplate ? (
                      <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm max-w-[85%] self-end">
                        <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{renderMsg(formData.messageTemplate)}</p>
                        <p className="text-[9px] text-gray-400 text-right mt-1">12:34 </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">L'aperçu apparaîtra ici</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Media Upload Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Médias (optionnel)</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ajoutez une image ou un message vocal à votre campagne</p>
              </div>
              <div className="p-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/mp4,audio/m4a"
                  onChange={handleMediaUpload}
                  className="hidden"
                />
                
                {formData.media.type === 'none' ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={mediaUploading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition text-sm font-medium text-gray-600 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mediaUploading ? (
                        <>
                          <IconSpinner />
                          <span>Upload en cours...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Ajouter une image</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={mediaUploading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-sm font-medium text-gray-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mediaUploading ? (
                        <>
                          <IconSpinner />
                          <span>Upload en cours...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span>Ajouter un vocal</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className={`p-4 rounded-lg border-2 ${formData.media.type === 'image' ? 'border-emerald-200 bg-emerald-50' : 'border-purple-200 bg-purple-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {formData.media.type === 'image' ? (
                          <>
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-emerald-200 flex-shrink-0">
                              <img src={formData.media.url} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-emerald-800">Image ajoutée</p>
                              <p className="text-xs text-emerald-600 truncate">{formData.media.fileName}</p>
                              <p className="text-[10px] text-emerald-500 mt-1">Le message sera envoyé comme légende de l'image</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-purple-800">Message vocal ajouté</p>
                              <p className="text-xs text-purple-600 truncate">{formData.media.fileName}</p>
                              <p className="text-[10px] text-purple-500 mt-1">Le vocal sera envoyé, suivi du message texte</p>
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveMedia}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-2">Formats acceptés : Images (JPG, PNG, GIF, WebP) • Audio (MP3, OGG, WAV, M4A) • Taille max : 10 MB</p>
              </div>
            </div>

            {!isEdit && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Options</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Programmer l'envoi (facultatif)</label>
                    <input type="datetime-local" value={formData.scheduledAt} onChange={e=>setFormData(p=>({...p,scheduledAt:e.target.value}))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tags (facultatif)</label>
                    <input type="text" value={formData.tags} onChange={e=>setFormData(p=>({...p,tags:e.target.value}))} className={inp} placeholder="relance, janvier..." />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-900 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-white mb-1">{isEdit?"Enregistrer les modifications":"Créer la campagne"}</p>
                  <div className="flex flex-wrap gap-3 text-gray-400 text-xs">
                    <span>{formData.name||"(sans nom)"}</span>
                    <span></span>
                    <span>{selectedClients.size>0?`${selectedClients.size} client${selectedClients.size>1?"s":""}`:preview?.count?`${preview.count} clients`:"Audience non calculée"}</span>
                    <span></span>
                    <span>{formData.messageTemplate?`${formData.messageTemplate.length} caractères`:"Message vide"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!isEdit&&<button type="button" onClick={()=>setStep(2)} className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition flex items-center gap-1.5"><IconChevronLeft/>Retour</button>}
                  <button type="submit" disabled={loading||!formData.name.trim()||!formData.messageTemplate.trim()}
                    className="px-6 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-400 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                    {loading?<><IconSpinner/>Enregistrement...</>:<>{isEdit?"Enregistrer":"Créer la campagne"}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default CampaignForm;
