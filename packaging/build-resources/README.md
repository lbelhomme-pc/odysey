# Build Resources

Place ici les icones et visuels utilises par `electron-builder`.

Fichiers recommandes :

- `icon.png` comme source graphique principale
- `icon.ico` pour Windows
- `icon.icns` pour macOS
- `icons/` pour Linux

Tant que ces ressources ne sont pas ajoutees, le packaging peut fonctionner avec des valeurs par defaut selon la plateforme, mais il est preferable de fournir des icones dediees avant une diffusion publique.

Etat actuel :

- `icon.png` est deja present et correspond au logo Odysey
- pour un packaging Windows final propre, il faudra idealement generer ensuite un vrai `icon.ico`
