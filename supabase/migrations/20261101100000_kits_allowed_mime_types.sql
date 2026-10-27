-- Correctif revue 3.1 : types MIME autorisés pour les fichiers des Kits (constat 1.1 de la revue).
-- Le bucket kits-private a été créé (migration 20261030100000) sans allowed_mime_types : le type de contenu de
-- l'objet venait des métadonnées TUS du client. L'ajout est fait par une migration postérieure, sans toucher
-- à la migration déjà appliquée. Les types acceptés : PDF, SVG, STL et transcription texte.

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/svg+xml', 'model/stl', 'text/plain', 'application/octet-stream']
where id = 'kits-private';
