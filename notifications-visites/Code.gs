/**
 * Notifications de visites du portfolio de Delon Boyou.
 *
 * Le portfolio envoie un petit message à ce script à chaque visite.
 * Le script note la visite dans une feuille Google Sheets et vous envoie un e-mail.
 * Installation : voir README.md dans le même dossier.
 */

// E-mail qui reçoit les alertes. Laisser vide pour utiliser le compte Google qui déploie le script.
var EMAIL_ALERTES = '';

// Nombre maximum d'e-mails par jour (Gmail limite les comptes gratuits à 100).
var MAX_EMAILS_PAR_JOUR = 40;

var FUSEAU = 'Africa/Abidjan';

function doPost(e) {
  var data = {};
  try { data = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}

  var maintenant = new Date();
  var quand = Utilities.formatDate(maintenant, FUSEAU, "dd/MM/yyyy 'à' HH:mm");
  var provenance = provenanceLisible_(String(data.referrer || ''));
  var appareil = data.mobile ? 'Téléphone ou tablette' : 'Ordinateur';
  var page = String(data.page || '').slice(0, 300);

  enregistrer_([maintenant, provenance, String(data.referrer || '').slice(0, 300), appareil,
                String(data.langue || ''), String(data.ecran || ''), String(data.fuseau || ''), page]);

  if (peutEnvoyer_()) {
    var destinataire = EMAIL_ALERTES || Session.getEffectiveUser().getEmail();
    var corps = [
      'Quelqu\'un consulte votre portfolio.',
      '',
      'Quand : ' + quand + ' (heure d\'Abidjan)',
      'Provenance : ' + provenance,
      'Appareil : ' + appareil,
      'Langue du navigateur : ' + (data.langue || 'inconnue'),
      'Fuseau horaire du visiteur : ' + (data.fuseau || 'inconnu'),
      'Page : ' + page,
      '',
      'Toutes les visites sont notées dans la feuille « Visites du portfolio » de votre Google Drive.'
    ].join('\n');
    MailApp.sendEmail(destinataire, '👀 Nouvelle visite sur votre portfolio (' + provenance + ')', corps);
  }

  return ContentService.createTextOutput('ok');
}

// Ouvrir l'adresse du script dans un navigateur affiche ce message : pratique pour vérifier le déploiement.
function doGet() {
  return ContentService.createTextOutput('Le script des visites du portfolio fonctionne.');
}

// À lancer une fois depuis l'éditeur (bouton Exécuter) pour accorder les autorisations et recevoir un e-mail de test.
function testerAlerte() {
  doPost({ postData: { contents: JSON.stringify({
    referrer: 'https://www.linkedin.com/', page: 'https://suzune22.github.io/portfolio/ (test)',
    mobile: false, langue: 'fr-FR', ecran: '1366×768', fuseau: 'Africa/Abidjan'
  }) } });
}

function provenanceLisible_(ref) {
  if (!ref) return 'Lien direct ou QR code';
  var hotes = [
    ['linkedin', 'LinkedIn'], ['google', 'Google'], ['facebook', 'Facebook'], ['instagram', 'Instagram'],
    ['tiktok', 'TikTok'], ['whatsapp', 'WhatsApp'], ['t.co', 'X (Twitter)'], ['twitter', 'X (Twitter)'],
    ['github', 'GitHub'], ['bing', 'Bing'], ['mail', 'Messagerie']
  ];
  var h = ref.toLowerCase();
  for (var i = 0; i < hotes.length; i++) { if (h.indexOf(hotes[i][0]) !== -1) return hotes[i][1]; }
  try { return h.split('/')[2] || ref; } catch (err) { return ref; }
}

function enregistrer_(ligne) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FEUILLE_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Visites du portfolio');
    ss.getSheets()[0].appendRow(['Date', 'Provenance', 'Page précédente', 'Appareil', 'Langue', 'Écran', 'Fuseau du visiteur', 'Page']);
    ss.getSheets()[0].setFrozenRows(1);
    props.setProperty('FEUILLE_ID', ss.getId());
  }
  ss.getSheets()[0].appendRow(ligne);
}

function peutEnvoyer_() {
  var props = PropertiesService.getScriptProperties();
  var jour = Utilities.formatDate(new Date(), FUSEAU, 'yyyy-MM-dd');
  var cle = 'EMAILS_' + jour;
  var n = Number(props.getProperty(cle) || 0);
  if (n >= MAX_EMAILS_PAR_JOUR || MailApp.getRemainingDailyQuota() < 5) return false;
  props.setProperty(cle, String(n + 1));
  return true;
}
