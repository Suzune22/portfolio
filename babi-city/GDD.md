# Babi City — Document de conception (GDD)

> Un monde ouvert à la GTA V, à Abidjan. Trois protagonistes, une ville vivante
> (Adjamé, le Plateau, Cocody) et des braquages en plusieurs étapes.

Ce document décrit le jeu complet visé. Le dossier `babi-city/` contient un
**prototype jouable dans le navigateur** qui met déjà en place la boucle de jeu
principale (voir § 9).

---

## 1. Vision

| | |
|---|---|
| **Genre** | Action-aventure en monde ouvert, vue à la troisième personne |
| **Références** | GTA V (structure, trio de héros, braquages, police), Sleeping Dogs (ville asiatique dense), Mafia (récit) |
| **Ton** | Satire sociale, humour nouchi, tension des braquages |
| **Cible** | 16 ans et plus, joueurs de GTA, public ivoirien et de la diaspora |
| **Plateformes** | PC d'abord, puis consoles ; le prototype tourne dans un navigateur (PC et mobile) |

**Promesse :** *« Babi ne dort jamais. »* Le joueur vit Abidjan de l'intérieur :
les embouteillages du Plateau, le chaos organisé d'Adjamé, les villas de Cocody,
les gbakas, les woro-woro, les maquis, le coupé-décalé à la radio.

## 2. Ce qu'on reprend de GTA V, et ce qu'on ne reprend pas

On reprend **les codes du genre**, qui ne sont la propriété de personne :

- trois personnages jouables et changement de personnage à tout moment, avec la vue aérienne ;
- missions scénarisées marquées par la lettre du personnage sur la carte ;
- braquages préparés (repérage, choix de l'approche, équipe, butin partagé) ;
- niveau de recherche à 5 étoiles, zone de recherche, « semer » la police ;
- conduite arcade, braquage de véhicules, radios, minimap rotative avec GPS ;
- petits boulots et activités annexes, économie séparée par personnage.

On **ne reprend pas** les éléments protégés : le nom « GTA » ou « Grand Theft Auto »,
le logo, la police d'écriture, les personnages (Michael, Franklin, Trevor),
l'histoire, les dialogues, les musiques, les modèles 3D ni aucun fichier du jeu.
Tout est original et ancré à Abidjan. C'est la condition pour pouvoir publier,
et même montrer le jeu publiquement (portfolio, salons, financement).

Garde-fous d'écriture : pas de personnalités politiques réelles, pas de vraies
bandes criminelles (on invente « la bande à Zézé »), pas de marques réelles
(on invente Babicom, Garba Express, Banque Lagunaire, Lagune Cola…).

## 3. La carte

Échelle du prototype : environ 1,5 km × 1,4 km. Version complète visée : 6 à 8 km²
construits à partir des données **OpenStreetMap** d'Abidjan (tracé réel des rues,
emprise des bâtiments), puis retravaillés à la main pour le gameplay.

| Quartier | Ambiance | Lieux phares | Gameplay |
|---|---|---|---|
| **Adjamé** (nord-ouest) | Dense, coloré, bruyant, rues saturées | Forum des Marchés, gare routière, mosquée, garage Moussa | Poursuites à pied dans les étals, gbakas, courses de woro-woro, ruelles étroites |
| **Le Plateau** (sud-ouest) | Centre d'affaires, tours de verre, boulevards | Tour Babi, La Pyramide, cathédrale Saint-Paul, Cité administrative, Banque Lagunaire, commissariat | Braquages, embouteillages, forte présence policière |
| **Cocody** (est) | Résidentiel huppé, villas, verdure | Villa de Koffi, Université FHB, CHU, Hôtel Ivoire | Infiltrations de villas, courses rapides sur larges avenues |
| **Forêt du Banco** (nord-ouest) | Forêt dense, pistes | Campement de Séry | Planques, échanges discrets, cascades hors-piste |
| **Lagune Ébrié et baie de Cocody** | Eau, pirogues, ponts | Pont de la Baie, pont vers Treichville | Fuites par les ponts ; plus tard, bateaux et pirogues |

**Extensions prévues :** Treichville (port, marché, vie nocturne), Yopougon
(maquis, la « rue Princesse »), Marcory, Koumassi, Port-Bouët (aéroport, plage),
Bingerville. Le pont vers Treichville est volontairement fermé dans le prototype.

## 4. Personnages

### Les trois protagonistes

| | Koffi Ahoussou | Bakary « Bak » Traoré | Séry « Tonnerre » Gnahoré |
|---|---|---|---|
| **Âge** | 45 ans | 24 ans | 38 ans |
| **Quartier** | Villa à Cocody | Adjamé | Campement en lisière du Banco |
| **Rôle** | Le cerveau : ancien « homme d'affaires » rangé | Le pilote : chauffeur de gbaka, recouvrements pour le garage Moussa | L'imprévisible : la force brute, l'humour noir |
| **Moteur** | Sa famille lui coûte trop cher ; il s'ennuie | Sortir d'Adjamé, devenir quelqu'un | Le respect, la vengeance, l'adrénaline |
| **Compétence spéciale** | Concentration : ralenti pendant les fusillades | Pilotage : ralenti au volant | Rage : dégâts doublés, encaisse mieux |
| **Couleur** | Or | Bleu | Rouge |

### Personnages secondaires

- **Moussa** : patron du garage d'Adjamé, mentor et exploiteur de Bakary.
- **Junior** : fils de Koffi, étudiant à l'Université FHB, éternellement à court de « polycopiés ».
- **Madame Ahoussou** : épouse de Koffi, qui le soupçonne de tout.
- **Kader** : bras droit de Séry, peureux, voix de la raison.
- **Zézé** : chef d'une bande rivale (fictive), revendeur de pièces volées.
- **Commissaire Yao** : flic du Plateau, honnête ou pas selon les choix du joueur.

## 5. Histoire

Structure en trois actes, sur le modèle « missions de personnage → préparation → braquage ».

**Acte I : Babi ne dort jamais (prototype).** Bakary fait des recouvrements pour
Moussa ; Koffi s'ennuie dans sa villa ; Séry règle ses comptes avec la bande à
Zézé. Koffi réunit les trois pour un premier coup : le fourgon blindé de la
Banque Lagunaire.

**Acte II : Les ennuis.** Le fourgon appartenait à des gens plus dangereux que la
banque. Le commissaire Yao tient les trois hommes et les oblige à travailler
pour lui. Missions de préparation dans toute la ville, trahisons internes.

**Acte III : Le grand coup.** Braquage de la réserve du Port autonome (Treichville),
avec deux approches au choix (discrète par la lagune, ou frontale par le pont).
Trois fins selon les choix du joueur.

### Missions du prototype

| # | Mission | Personnage | Mécaniques |
|---|---|---|---|
| 1 | Recouvrement au Plateau | Bakary | Voler une voiture, semer la police (1 étoile), livrer |
| 2 | Le voleur du Forum | Bakary | Course-poursuite dans Adjamé, immobiliser une cible |
| 3 | Le fils à papa | Koffi | Conduite chronométrée, passager |
| 4 | Tonnerre sur Adjamé | Séry | Destruction de véhicules, 2 étoiles |
| 5 | Le Coup du Plateau | Koffi | Braquage : embuscade, fourgon blindé, butin, 4 étoiles, retour à la planque |

### Braquages (version complète)

Chaque braquage suit le schéma de GTA V :
1. **Repérage** (photos, horaires, gardes) ;
2. **Choix de l'approche** (discrète ou frontale) ;
3. **Recrutement** (chauffeur, tireur, hacker : plus il est bon, plus il prend une grosse part) ;
4. **Préparation** (voler les véhicules, le matériel) ;
5. **Exécution** avec changement de personnage en pleine action ;
6. **Partage** du butin.

## 6. Systèmes de jeu

- **Déplacement à pied** : marche, course, saut, couverture (à faire), corps à corps, armes.
- **Conduite** : physique arcade, frein à main, dégâts, incendie puis explosion ; véhicules locaux (gbaka, woro-woro, taxi compteur, 4x4, berlines, sportives, police, fourgon blindé ; plus tard motos, pirogues).
- **Police** : 5 étoiles, zone de recherche visible sur la minimap, renforts, tirs à partir de 2 étoiles, arrestation. Version complète : barrages, hélicoptère, unités spéciales.
- **Changement de personnage** : vue aérienne, chaque héros garde sa position, son argent et sa santé.
- **Économie** : argent en FCFA par personnage ; frais d'hôpital, amendes ; achats (armes, véhicules, propriétés : maquis, garage, cabines de transfert).
- **Petits boulots** : courses de taxi et de woro-woro (prototype), apprenti gbaka (crier les destinations, encaisser), livraisons, recouvrements pour Moussa.
- **Activités** : maquis (danse coupé-décalé en jeu de rythme), football de quartier, awalé, paris, pêche sur la lagune.
- **Téléphone** : contacts, SMS, missions, navigateur parodique.
- **Monde vivant** : piétons (vendeuses avec bassines, étudiants, travailleurs), circulation dense par quartier, cycle jour/nuit, pluie de saison.

## 7. Direction artistique et son

- **Visuel** : couleurs saturées, façades défraîchies et colorées à Adjamé, verre et béton au Plateau, blanc et verdure à Cocody. Pagnes wax sur les passants.
- **Radios** (musique originale ou sous licence d'artistes locaux) :
  - *Babi FM* : coupé-décalé ;
  - *Zouglou FM* : zouglou et rumba ;
  - *Radio Lagune Info* : talk-show satirique, infos trafic qui réagissent aux actions du joueur ;
  - à venir : rap ivoire, afrobeats, gospel.
- **Dialogues** : français ivoirien et nouchi (« gaou », « on est ensemble », « c'est dja », « vié père », « corps habillés »…), sous-titres pour le public international.

## 8. Production de la version complète

Une vraie version « type GTA V » demande une équipe ; GTA V a mobilisé un millier de
personnes. Voici une trajectoire réaliste pour une équipe indépendante :

| Phase | Durée | Équipe | Livrable |
|---|---|---|---|
| Prototype web (fait) | – | 1 | Boucle de jeu, 5 missions, 3 quartiers stylisés |
| Vertical slice | 6 à 9 mois | 5 à 8 | Adjamé en haute qualité sous Unreal Engine 5, 1 braquage complet, doublage |
| Pré-production | 6 mois | 10 à 15 | Carte complète en blocs, outils, écriture complète |
| Production | 2 à 3 ans | 25 à 40 | Contenu de l'acte I à III, activités, radios |
| Lancement | – | – | PC (Steam), puis consoles |

**Moteur conseillé :** Unreal Engine 5 (monde ouvert, World Partition, MetaHuman pour
des visages africains crédibles, rendu de foule) ou Unity pour une équipe plus petite
au style plus stylisé.

**Pistes de financement :** prototype et vertical slice pour convaincre des
éditeurs, fonds de soutien au jeu vidéo africain, partenariats avec des
studios ivoiriens et la diaspora, financement participatif.

## 9. Le prototype (ce dossier)

Jouable dans un navigateur, sans installation : `babi-city/index.html`.

**Contenu :** carte stylisée d'Adjamé, du Plateau et de Cocody (environ 2 800
bâtiments générés, monuments, ponts, lagune) ; 3 personnages jouables avec
changement de personnage ; 5 missions d'histoire avec cinématiques ; circulation
et piétons ; police à 5 étoiles ; tir, braquage de véhicules, explosions ;
cycle jour/nuit ; 3 radios générées en direct ; courses de taxi ; minimap avec
GPS ; carte complète ; sauvegarde automatique ; commandes tactiles.

**Technique :** JavaScript (modules ES) et Three.js. Aucune image ni aucun son
externe : textures, musiques et effets sont générés par le code.

| Fichier | Rôle |
|---|---|
| `js/world.js` | Carte, routes, bâtiments, monuments, collisions, minimap |
| `js/vehicles.js` | Modèles, physique de conduite, IA de circulation |
| `js/people.js` | Personnages, piétons et leurs réactions |
| `js/police.js` | Niveau de recherche et poursuites |
| `js/missions.js` | Protagonistes, histoire, moteur de missions, courses de taxi |
| `js/hud.js` | Interface : minimap, étoiles, argent, sous-titres, carte |
| `js/audio.js` | Radios, sirènes, tirs, moteur (Web Audio) |
| `js/main.js` | Joueur, caméra, jour/nuit, cinématiques, sauvegarde, boucle de jeu |
