# Recon map : GTA V (PC) → Babi City

Périmètre : **les mécaniques de jeu uniquement** (systèmes, boucles, écrans d'interface).
Rien de ce que Rockstar possède : ni nom, ni personnages, ni histoire, ni dialogues,
ni musique, ni modèles, ni code, ni carte de Los Santos.
Pour : le prototype Babi City (`babi-city/`), portfolio de l'utilisateur, monde ouvert à Abidjan.
Date : 2026-10-18

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Wikipédia, section Gameplay | https://en.wikipedia.org/wiki/Grand_Theft_Auto_V | lue le 2026-10-18 : liste des systèmes (3 héros, compétences, capacités spéciales, braquages, étoiles, téléphone, bourse, propriétés, personnalisation) |
| 2 | GTA Wiki (fandom), niveau de recherche | https://gta.fandom.com/wiki/Wanted_Level_in_GTA_V | **non lue** : HTTP 402. Les détails « police » ci-dessous viennent de la connaissance générale du jeu, à vérifier |
| 3 | Site officiel Rockstar | https://www.rockstargames.com/gta-v | non lue dans cette session |
| 4 | Le jeu, joué par l'utilisateur sur son propre compte | – | non utilisé : aucune capture n'a été faite, `screens/` est vide |

Pas de code, pas de fichiers du jeu, pas de rétro-ingénierie du binaire.

## Boucle principale

Se déplacer librement dans une grande ville vivante, enchaîner des missions
scénarisées avec trois personnages qu'on alterne, commettre des délits, fuir la
police, gagner de l'argent et le dépenser pour améliorer armes, véhicules et propriétés,
jusqu'aux braquages préparés.

## Écrans (états de jeu et interfaces)

| ID | écran | accès | rôle | composants clés | états |
| --- | --- | --- | --- | --- | --- |
| S01 | Menu titre / chargement | lancement | nouvelle partie, continuer | boutons, conseils de chargement | sans sauvegarde, avec sauvegarde |
| S02 | HUD à pied | jeu | info permanente | minimap rotative, barres santé/armure/capacité, argent, étoiles, arme+munitions, réticule | calme, recherché, en mission, visée |
| S03 | HUD en véhicule | monter dans un véhicule | conduite | nom du véhicule, nom de rue/quartier, station radio | jour, nuit, poursuite |
| S04 | Roue des personnages | maintenir touche | changer de héros | 3 portraits (+ multijoueur), état danger | indisponible (mission, recherché) |
| S05 | Roue des armes | maintenir touche | choisir arme | 8 catégories, munitions | vide, plein |
| S06 | Roue radio | maintenir en véhicule | choisir station | stations, « radio coupée » | – |
| S07 | Carte de pause | Échap / M | carte, waypoint, légende | carte zoomable, blips, filtre légende, GPS | – |
| S08 | Menu pause : stats, réglages, sauvegarde | Échap | compétences, réglages | onglets | – |
| S09 | Téléphone | flèche haut | contacts, SMS, internet, appareil photo | apps en grille | appel entrant, mission reçue |
| S10 | Cinématique de mission | marqueur de mission | narration | bandes noires, sous-titres, « passer » | – |
| S11 | Mission réussie / échouée | fin de mission | bilan, médaille | titre, objectifs, récompense, réessayer | or/argent/bronze, échec + raison |
| S12 | « Mort » | santé à 0 | pénalité | écran désaturé, texte, réapparition hôpital | – |
| S13 | « Arrêté » | arrestation | pénalité | idem, réapparition commissariat | – |
| S14 | Armurerie | entrer dans la boutique | acheter armes/munitions/améliorations | liste, prix, aperçu | argent insuffisant |
| S15 | Atelier de tuning / peinture | entrer avec un véhicule | modifier véhicule, effacer étoiles | catégories, prix, aperçu | recherché (repeinture efface les étoiles) |
| S16 | Boutique de vêtements / coiffeur / tatoueur | entrer | personnaliser le héros | catégories, aperçu | – |
| S17 | Planification de braquage | tableau dans la planque | choisir approche et équipe | tableau, cartes d'équipiers, parts | approche A/B, équipier faible/fort |
| S18 | Achat de propriété | panneau « à vendre » | acheter garage/commerce | prix, revenu hebdo | – |
| S19 | Garage personnel | planque / garage | ranger, reprendre véhicules | places | vide, plein |
| S20 | Aide contextuelle | proximité d'un élément | expliquer la touche | boîte d'aide en haut à gauche | – |

## Flux

```
F01 Lancer une mission d'histoire
    S02 → rejoindre la lettre sur S07/minimap → S10 → objectifs (S02/S03) → S11
    touches sur le chemin heureux : ~1 (entrer dans le marqueur)
    bords : héros déjà recherché, véhicule détruit, cible enfuie, mort (S12), arrêté (S13), réessayer au point de passage
F02 Changer de héros
    S02 → S04 → vue satellite → nouveau héros dans sa propre activité
    touches : 2 ; bords : en mission, recherché, héros en danger
F03 Voler un véhicule et conduire
    S02 → touche F près d'un véhicule → éjection du conducteur → S03
    bords : véhicule de police (étoiles), véhicule verrouillé, explosion
F04 Être recherché puis semer la police
    délit → étoiles → poursuite → sortir du cône de vision / zone → étoiles clignotent → disparaissent
    alternatives : repeinture (S15), cachette ; bords : 5 étoiles, hélico, barrages
F05 Mourir / être arrêté
    S12 ou S13 → frais/perte d'armes → réapparition
F06 Braquage
    mission de préparation → S17 (approche, équipe) → missions de prépa → exécution avec changement de héros → partage
F07 Acheter et améliorer
    S14/S15/S16/S18 → payer → effet immédiat
F08 Petits boulots et activités
    téléphone (S09) ou lieu → activité → récompense
F09 Poser un point GPS
    S07 → clic → itinéraire sur la minimap
```

## Composants

| composant | variantes | états | utilisé sur |
| --- | --- | --- | --- |
| Minimap rotative | à pied (zoom), véhicule (dézoom selon vitesse) | zone de recherche, GPS | S02, S03 |
| Blip | lettre de mission, objectif, cible, véhicule, boutique, waypoint | clignotant, hors cadre (bord) | S02, S07 |
| Étoiles | 0 à 5 | pleines, clignotantes (non vu) | S02 |
| Barres | santé, armure, capacité spéciale | basse (clignote) | S02 |
| Roue radiale | personnages, armes, radio | sélection, indisponible | S04-S06 |
| Boîte d'aide | texte + touche | – | S20 |
| Grand message | titre de mission, réussite, échec, mort, arrêté | – | S10-S13 |
| Sous-titres | locuteur coloré | file d'attente | S10, S02 |
| Liste boutique | articles, prix, aperçu 3D | trop cher, déjà possédé | S14-S16 |

## Modèle de données (déduit)

```
Personnage  argent, santé, armure, position, tenue, armes{type: munitions, améliorations},
            compétences{tir, conduite, endurance, force, discrétion, vol, mécanique, poumons} (0-100),
            jauge spéciale, véhicules possédés, propriétés
            preuve : source 1 (huit compétences, capacités spéciales) ; confiance : haute
Mission     id, personnage(s), prérequis, étapes, points de passage, médaille (objectifs bonus)
            preuve : source 1 ; confiance : haute pour l'existence, moyenne pour la structure
Braquage    approches[], équipiers{rôle, compétence, part %}, missions de préparation, butin
            preuve : source 1 ; confiance : haute
Recherche   niveau 0-5, dernière position vue, unités engagées
            preuve : source 1 ; détails des unités : à vérifier (source 2 non lue)
Véhicule    type, modifications, couleur, propriétaire
Propriété   prix, revenu, garage associé
Sauvegarde  progression missions, état des 3 personnages, heure
```

Relations : Personnage 1-n Véhicule, 1-n Propriété ; Braquage 1-n Mission ; Mission n-n Personnage.

## Matrice de fonctionnalités

Voir `features.csv`. La colonne `clone` reflète l'état **actuel** de Babi City
(le prototype existe déjà), pour que `/replica-diff` donne un score réel.

## Hors périmètre (à ne pas reprendre)

- Le nom, le logo, la police d'écriture et l'identité « GTA » / Rockstar.
- Les personnages, l'histoire, les dialogues, les missions telles qu'écrites.
- La carte de Los Santos et Blaine County (Babi City utilise Abidjan).
- Les musiques sous licence et les animateurs radio.
- GTA Online : serveurs, communauté, économie multijoueur.
- Les modèles 3D, textures, animations, sons, captures de mouvement.

## Taille

Écrans 20, flux 9, entités 7. Points durs : physique et IA de conduite à grande
échelle, combat avec couverture et IA ennemie à pied, contenu (missions, carte,
doublage). Taille : **XL pour une vraie parité** (des centaines de personnes chez
Rockstar). Recadré pour ce prototype : **L** pour atteindre les « must » et les
« should » ci-dessous, en gardant le rendu stylisé et un navigateur comme cible.
