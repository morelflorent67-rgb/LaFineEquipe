# Clips V1 — liens gérés par l'administration

## Publier un clip

1. Ouvrir **Admin → Clips → Nouveau clip**.
2. Coller un lien YouTube, Twitch, Allstar ou une vidéo FACEIT. La prévisualisation reconnaît le format et nettoie le lien ; elle ne vérifie pas que la vidéo existe ou est publique.
3. Renseigner titre, date et, si souhaité, joueur, map et description.
4. Vérifier la vidéo sur sa plateforme. Cocher l'autorisation de lecture intégrée seulement si elle est disponible ; confirmer l'accord du joueur et les droits de partage avant publication.
5. Enregistrer en brouillon ou publier. Un brouillon est réservé aux administrateurs, y compris lors d'un accès direct à la base avec un rôle public ou membre.

Une même vidéo ne peut être ajoutée deux fois, même via deux variantes d'URL. Le formulaire permet de modifier le clip, le repasser en brouillon ou le supprimer après confirmation. Supprimer un clip du site ne supprime pas la vidéo d'origine.

Les visiteurs filtrent par joueur, map, titre/pseudo et dates ; les filtres restent dans l'URL. L'accueil présente les trois clips publiés les plus récents. Les cartes utilisent le visuel de la map comme illustration, pas comme miniature de la vidéo.

## Sources et limites

- **YouTube** : liens watch, youtu.be, Shorts, live et embed reconnus. Lecteur chargé uniquement après clic, sans lecture automatique. [Paramètres officiels](https://developers.google.com/youtube/player_parameters).
- **Twitch** : clips et vidéos enregistrées, avec paramètre `parent` construit à partir du domaine de la page. Le lecteur exige HTTPS et une largeur minimale de 400 px : en local HTTP ou sur petit écran, un lien externe est proposé. [Documentation officielle](https://dev.twitch.tv/docs/embed/video-and-clips/).
- **Allstar** : lien de partage `allstar.gg/clip/<id>` (format actuel, constaté le 14/10/2026) ou ancien `/clip?clip=<id>`, identifiant hexadécimal de 24 caractères. Les **vidéos FACEIT** (`faceit.com/<langue>/players/<pseudo>/videos/<id>`) sont des clips Allstar : même identifiant, enregistrées comme clip Allstar. Lecture intégrée via le lecteur `allstar.gg/iframe?clip=<id>` (exposé par Allstar pour l'oEmbed, vérifié avec un vrai clip de la team le 14/10/2026) ; il affiche d'abord la demande de consentement aux cookies d'Allstar.
- **FACEIT** : liens clips non pris en charge tant qu'un format et une intégration fiables ne sont pas validés. Aucun endpoint de clips inventé.

Les URL sont limitées à des hôtes précis en HTTPS et reconstruites côté serveur. Aucune récupération de miniature, de vidéo ou de HTML externe. La disponibilité des vidéos, les restrictions géographiques et les droits d'intégration restent contrôlés par les plateformes. Le lien externe reste accessible si un lecteur refuse la vidéo.

## Stockage et vérifications

Migration additive `20261013001300_clips.sql` : table `clips`, unicité fournisseur/identifiant, contraintes sur les URL et la publication, RLS et fonctions SQL avec les droits de l'appelant. En local, les migrations sont appliquées automatiquement ; sur Supabase, appliquer la nouvelle migration via le SQL Editor ou l'outil habituel. Aucun nouveau secret nécessaire.

Les exemples fictifs existent uniquement dans le jeu de démonstration, avec lecteurs et liens externes désactivés. Ne pas réinitialiser une base réelle pour les charger. Playwright utilise exclusivement `.data/e2e`.

Les tests couvrent les liens malveillants, les doublons, la publication, les droits admin/membre/visiteur, les filtres, les dialogues et le rendu mobile. Le lecteur YouTube est intercepté dans le test navigateur : cela vérifie son intégration et son chargement à la demande, pas la lecture d'une vraie vidéo sur Internet. La vérification réelle se fera avec les premiers liens de la team.
