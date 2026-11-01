# Notifications de visites du portfolio

À chaque visite du portfolio, ce script Google Apps Script :

- vous envoie un e-mail (date, provenance comme LinkedIn ou Google, type d'appareil, langue) ;
- note la visite dans une feuille Google Sheets « Visites du portfolio », créée automatiquement dans votre Drive.

Un même visiteur ne déclenche qu'une alerte par jour. Le script envoie au maximum 40 e-mails par jour ; au-delà, les visites sont seulement notées dans la feuille.

Aucune adresse IP ni donnée personnelle n'est collectée.

## Installation (une seule fois, environ 5 minutes)

1. Ouvrez https://script.google.com et cliquez sur **Nouveau projet**.
2. Renommez le projet « Visites du portfolio ».
3. Effacez le contenu de `Code.gs` et collez à la place le contenu du fichier `Code.gs` de ce dossier. Enregistrez (Ctrl + S).
4. Dans la liste des fonctions en haut, choisissez **testerAlerte**, puis cliquez sur **Exécuter**.
   Google demande des autorisations (envoyer des e-mails, créer une feuille) : acceptez-les.
   Vous recevez un e-mail de test et la feuille « Visites du portfolio » apparaît dans votre Drive.
5. Cliquez sur **Déployer → Nouveau déploiement**.
   - Type : **Application Web**
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
6. Cliquez sur **Déployer** et copiez l'**URL de l'application Web** (elle se termine par `/exec`).
7. Collez cette URL dans `index.html`, à la ligne `var VISITS_URL = '';`, entre les guillemets.
   Ou envoyez-la à Claude, qui l'ajoutera pour vous.

## Ne pas recevoir d'alerte pour vos propres visites

Ouvrez une fois, sur chacun de vos appareils :

https://suzune22.github.io/portfolio/?moi=1

Ce navigateur ne déclenchera plus d'alerte. Pour annuler, ouvrez `?moi=0`.

## Modifier le script plus tard

Après une modification de `Code.gs`, faites **Déployer → Gérer les déploiements → Modifier (crayon) → Version : Nouvelle version → Déployer**. L'URL reste la même.
