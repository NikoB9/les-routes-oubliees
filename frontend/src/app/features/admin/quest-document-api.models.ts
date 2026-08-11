/**
 * Document d'organisation d'une quête, réservé à l'organisateur.
 *
 * Ni le chemin de stockage ni le nom serveur n'y figurent : le téléchargement passe par
 * `contentUrl`, et l'interface n'a aucun usage d'un chemin système.
 */
export interface AdminQuestDocument {
  id: string;
  label: string;
  originalFilename: string;
  sizeBytes: number;
  contentUrl: string;
  createdAt: string;
  uploadedBy: string | null;
}
