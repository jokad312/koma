export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      acces_kit: {
        Row: {
          commande_origine: string
          compte_id: string
          cree_le: string
          id: string
          produit_id: string
        }
        Insert: {
          commande_origine: string
          compte_id: string
          cree_le?: string
          id?: string
          produit_id: string
        }
        Update: {
          commande_origine?: string
          compte_id?: string
          cree_le?: string
          id?: string
          produit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acces_kit_commande_origine_fkey"
            columns: ["commande_origine"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acces_kit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      anomalie: {
        Row: {
          cible_id: string
          cible_type: string
          cree_le: string
          details: Json
          gravite: string
          id: string
          resolue_le: string | null
          resolue_par: string | null
          type: Database["public"]["Enums"]["anomalie_type"]
        }
        Insert: {
          cible_id: string
          cible_type: string
          cree_le?: string
          details?: Json
          gravite?: string
          id?: string
          resolue_le?: string | null
          resolue_par?: string | null
          type: Database["public"]["Enums"]["anomalie_type"]
        }
        Update: {
          cible_id?: string
          cible_type?: string
          cree_le?: string
          details?: Json
          gravite?: string
          id?: string
          resolue_le?: string | null
          resolue_par?: string | null
          type?: Database["public"]["Enums"]["anomalie_type"]
        }
        Relationships: []
      }
      article: {
        Row: {
          auteur_id: string
          cree_le: string
          id: string
          images: Json
          lien_produit_id: string | null
          modifie_le: string
          publie_le: string | null
          slug: string | null
          texte_en: string | null
          texte_fr: string | null
          titre_en: string | null
          titre_fr: string
        }
        Insert: {
          auteur_id: string
          cree_le?: string
          id?: string
          images?: Json
          lien_produit_id?: string | null
          modifie_le?: string
          publie_le?: string | null
          slug?: string | null
          texte_en?: string | null
          texte_fr?: string | null
          titre_en?: string | null
          titre_fr: string
        }
        Update: {
          auteur_id?: string
          cree_le?: string
          id?: string
          images?: Json
          lien_produit_id?: string | null
          modifie_le?: string
          publie_le?: string | null
          slug?: string | null
          texte_en?: string | null
          texte_fr?: string | null
          titre_en?: string | null
          titre_fr?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_lien_produit_id_fkey"
            columns: ["lien_produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      chapitre_kit: {
        Row: {
          cree_le: string
          debut_secondes: number
          id: string
          ordre: number
          produit_id: string
          titre_en: string
          titre_fr: string
        }
        Insert: {
          cree_le?: string
          debut_secondes: number
          id?: string
          ordre: number
          produit_id: string
          titre_en: string
          titre_fr: string
        }
        Update: {
          cree_le?: string
          debut_secondes?: number
          id?: string
          ordre?: number
          produit_id?: string
          titre_en?: string
          titre_fr?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapitre_kit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      commande: {
        Row: {
          acceptations: Json
          adresse: string | null
          cle_idempotence: string | null
          compte_id: string
          cree_le: string
          devise: string
          expire_le: string | null
          forfait_cents: number
          id: string
          mis_a_jour_le: string
          mode_remise: string | null
          numero: string
          offerte: boolean
          origine: string | null
          paye_le: string | null
          prestataire: string | null
          reference_transaction: string | null
          sous_total_cents: number
          statut: string
          telephone: string | null
          total_cents: number
          type: string
          zone: string | null
        }
        Insert: {
          acceptations?: Json
          adresse?: string | null
          cle_idempotence?: string | null
          compte_id: string
          cree_le?: string
          devise?: string
          expire_le?: string | null
          forfait_cents?: number
          id?: string
          mis_a_jour_le?: string
          mode_remise?: string | null
          numero?: string
          offerte?: boolean
          origine?: string | null
          paye_le?: string | null
          prestataire?: string | null
          reference_transaction?: string | null
          sous_total_cents: number
          statut: string
          telephone?: string | null
          total_cents: number
          type: string
          zone?: string | null
        }
        Update: {
          acceptations?: Json
          adresse?: string | null
          cle_idempotence?: string | null
          compte_id?: string
          cree_le?: string
          devise?: string
          expire_le?: string | null
          forfait_cents?: number
          id?: string
          mis_a_jour_le?: string
          mode_remise?: string | null
          numero?: string
          offerte?: boolean
          origine?: string | null
          paye_le?: string | null
          prestataire?: string | null
          reference_transaction?: string | null
          sous_total_cents?: number
          statut?: string
          telephone?: string | null
          total_cents?: number
          type?: string
          zone?: string | null
        }
        Relationships: []
      }
      couverture: {
        Row: {
          cree_le: string
          etat: string
          id: string
          modifie_le: string
          operateur: string
          pays: string
          prestataire: string
          source: string
        }
        Insert: {
          cree_le?: string
          etat?: string
          id?: string
          modifie_le?: string
          operateur: string
          pays: string
          prestataire: string
          source: string
        }
        Update: {
          cree_le?: string
          etat?: string
          id?: string
          modifie_le?: string
          operateur?: string
          pays?: string
          prestataire?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "couverture_prestataire_fkey"
            columns: ["prestataire"]
            isOneToOne: false
            referencedRelation: "prestataire"
            referencedColumns: ["code"]
          },
        ]
      }
      envoi: {
        Row: {
          cle: string
          compte_id: string
          cree_le: string
          derniere_erreur: string | null
          donnees: Json
          envoye_le: string | null
          id: string
          id_prestataire: string | null
          langue: string
          modele: Database["public"]["Enums"]["envoi_modele"]
          prochain_essai: string
          statut: Database["public"]["Enums"]["envoi_statut"]
          tentatives: number
        }
        Insert: {
          cle: string
          compte_id: string
          cree_le?: string
          derniere_erreur?: string | null
          donnees?: Json
          envoye_le?: string | null
          id?: string
          id_prestataire?: string | null
          langue: string
          modele: Database["public"]["Enums"]["envoi_modele"]
          prochain_essai?: string
          statut?: Database["public"]["Enums"]["envoi_statut"]
          tentatives?: number
        }
        Update: {
          cle?: string
          compte_id?: string
          cree_le?: string
          derniere_erreur?: string | null
          donnees?: Json
          envoye_le?: string | null
          id?: string
          id_prestataire?: string | null
          langue?: string
          modele?: Database["public"]["Enums"]["envoi_modele"]
          prochain_essai?: string
          statut?: Database["public"]["Enums"]["envoi_statut"]
          tentatives?: number
        }
        Relationships: []
      }
      fichier_filigrane: {
        Row: {
          chemin_stockage: string
          compte_id: string
          cree_le: string
          fichier_id: string
          id: string
          version: number
        }
        Insert: {
          chemin_stockage: string
          compte_id: string
          cree_le?: string
          fichier_id: string
          id?: string
          version: number
        }
        Update: {
          chemin_stockage?: string
          compte_id?: string
          cree_le?: string
          fichier_id?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fichier_filigrane_fichier_id_fkey"
            columns: ["fichier_id"]
            isOneToOne: false
            referencedRelation: "fichier_kit"
            referencedColumns: ["id"]
          },
        ]
      }
      fichier_kit: {
        Row: {
          cree_le: string
          format: string
          id: string
          nom_en: string
          nom_fr: string
          ordre: number
          produit_id: string
          taille_octets: number
          version: number
        }
        Insert: {
          cree_le?: string
          format: string
          id?: string
          nom_en: string
          nom_fr: string
          ordre: number
          produit_id: string
          taille_octets: number
          version?: number
        }
        Update: {
          cree_le?: string
          format?: string
          id?: string
          nom_en?: string
          nom_fr?: string
          ordre?: number
          produit_id?: string
          taille_octets?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fichier_kit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      fichier_kit_prive: {
        Row: {
          chemin_stockage: string
          fichier_id: string
        }
        Insert: {
          chemin_stockage: string
          fichier_id: string
        }
        Update: {
          chemin_stockage?: string
          fichier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichier_kit_prive_fichier_id_fkey"
            columns: ["fichier_id"]
            isOneToOne: true
            referencedRelation: "fichier_kit"
            referencedColumns: ["id"]
          },
        ]
      }
      heros_accueil: {
        Row: {
          id: boolean
          mis_a_jour_le: string
          produit_id: string | null
          repli_alt_en: string | null
          repli_alt_fr: string | null
          repli_fichier: string | null
          video_fichier: string | null
          video_id: string | null
        }
        Insert: {
          id?: boolean
          mis_a_jour_le?: string
          produit_id?: string | null
          repli_alt_en?: string | null
          repli_alt_fr?: string | null
          repli_fichier?: string | null
          video_fichier?: string | null
          video_id?: string | null
        }
        Update: {
          id?: boolean
          mis_a_jour_le?: string
          produit_id?: string | null
          repli_alt_en?: string | null
          repli_alt_fr?: string | null
          repli_fichier?: string | null
          video_fichier?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heros_accueil_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_audit: {
        Row: {
          action: string
          apres: Json | null
          auteur: Json
          avant: Json | null
          cible_id: string
          cible_table: string
          cree_le: string
          id: number
        }
        Insert: {
          action: string
          apres?: Json | null
          auteur: Json
          avant?: Json | null
          cible_id: string
          cible_table: string
          cree_le?: string
          id?: never
        }
        Update: {
          action?: string
          apres?: Json | null
          auteur?: Json
          avant?: Json | null
          cible_id?: string
          cible_table?: string
          cree_le?: string
          id?: never
        }
        Relationships: []
      }
      ligne_commande: {
        Row: {
          commande_id: string
          cree_le: string
          delai_fabrication_jours: number | null
          id: string
          nombre: number
          origine: string | null
          prix_cents: number
          produit_id: string
          reduction_cents: number
          variante_id: string | null
        }
        Insert: {
          commande_id: string
          cree_le?: string
          delai_fabrication_jours?: number | null
          id?: string
          nombre?: number
          origine?: string | null
          prix_cents: number
          produit_id: string
          reduction_cents?: number
          variante_id?: string | null
        }
        Update: {
          commande_id?: string
          cree_le?: string
          delai_fabrication_jours?: number | null
          id?: string
          nombre?: number
          origine?: string | null
          prix_cents?: number
          produit_id?: string
          reduction_cents?: number
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ligne_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_commande_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_commande_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variante"
            referencedColumns: ["id"]
          },
        ]
      }
      ligne_panier: {
        Row: {
          cree_le: string
          id: string
          nombre: number
          panier_id: string
          produit_id: string
          variante_id: string | null
        }
        Insert: {
          cree_le?: string
          id?: string
          nombre: number
          panier_id: string
          produit_id: string
          variante_id?: string | null
        }
        Update: {
          cree_le?: string
          id?: string
          nombre?: number
          panier_id?: string
          produit_id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ligne_panier_panier_id_fkey"
            columns: ["panier_id"]
            isOneToOne: false
            referencedRelation: "panier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_panier_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_panier_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variante"
            referencedColumns: ["id"]
          },
        ]
      }
      limite_essai: {
        Row: {
          cle: string
          compteur: number
          fenetre_debut: string
        }
        Insert: {
          cle: string
          compteur?: number
          fenetre_debut: string
        }
        Update: {
          cle?: string
          compteur?: number
          fenetre_debut?: string
        }
        Relationships: []
      }
      message_contact: {
        Row: {
          cree_le: string
          email: string
          id: string
          langue: string
          message: string
          nom: string
          statut: string
          traite_le: string | null
        }
        Insert: {
          cree_le?: string
          email: string
          id?: string
          langue: string
          message: string
          nom: string
          statut?: string
          traite_le?: string | null
        }
        Update: {
          cree_le?: string
          email?: string
          id?: string
          langue?: string
          message?: string
          nom?: string
          statut?: string
          traite_le?: string | null
        }
        Relationships: []
      }
      notification_recue: {
        Row: {
          id: string
          id_notification: string
          prestataire: string
          recue_le: string
          signature_valide: boolean
          tentative_id: string | null
        }
        Insert: {
          id?: string
          id_notification: string
          prestataire: string
          recue_le?: string
          signature_valide: boolean
          tentative_id?: string | null
        }
        Update: {
          id?: string
          id_notification?: string
          prestataire?: string
          recue_le?: string
          signature_valide?: boolean
          tentative_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_recue_prestataire_fkey"
            columns: ["prestataire"]
            isOneToOne: false
            referencedRelation: "prestataire"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "notification_recue_tentative_id_fkey"
            columns: ["tentative_id"]
            isOneToOne: false
            referencedRelation: "tentative_paiement"
            referencedColumns: ["id"]
          },
        ]
      }
      panier: {
        Row: {
          compte_id: string | null
          cree_le: string
          id: string
          kit_possede_retire_le: string | null
          mis_a_jour_le: string
        }
        Insert: {
          compte_id?: string | null
          cree_le?: string
          id?: string
          kit_possede_retire_le?: string | null
          mis_a_jour_le?: string
        }
        Update: {
          compte_id?: string | null
          cree_le?: string
          id?: string
          kit_possede_retire_le?: string | null
          mis_a_jour_le?: string
        }
        Relationships: []
      }
      prestataire: {
        Row: {
          actif: boolean
          carte: boolean
          code: string
          mobile_money: boolean
          modifie_le: string
          nom: string
          ordre: number | null
          type: string
        }
        Insert: {
          actif?: boolean
          carte: boolean
          code: string
          mobile_money: boolean
          modifie_le?: string
          nom: string
          ordre?: number | null
          type: string
        }
        Update: {
          actif?: boolean
          carte?: boolean
          code?: string
          mobile_money?: boolean
          modifie_le?: string
          nom?: string
          ordre?: number | null
          type?: string
        }
        Relationships: []
      }
      produit: {
        Row: {
          cree_le: string
          delai_fabrication_jours: number | null
          description_en: string | null
          description_fr: string | null
          devise: string
          famille: string
          id: string
          materiel_en: string | null
          materiel_fr: string | null
          modifie_le: string
          niveau: string | null
          prix_cents: number | null
          produit_lie_id: string | null
          publie_le: string | null
          slug: string
          titre_en: string | null
          titre_fr: string
          univers_id: string | null
        }
        Insert: {
          cree_le?: string
          delai_fabrication_jours?: number | null
          description_en?: string | null
          description_fr?: string | null
          devise?: string
          famille: string
          id?: string
          materiel_en?: string | null
          materiel_fr?: string | null
          modifie_le?: string
          niveau?: string | null
          prix_cents?: number | null
          produit_lie_id?: string | null
          publie_le?: string | null
          slug: string
          titre_en?: string | null
          titre_fr: string
          univers_id?: string | null
        }
        Update: {
          cree_le?: string
          delai_fabrication_jours?: number | null
          description_en?: string | null
          description_fr?: string | null
          devise?: string
          famille?: string
          id?: string
          materiel_en?: string | null
          materiel_fr?: string | null
          modifie_le?: string
          niveau?: string | null
          prix_cents?: number | null
          produit_lie_id?: string | null
          publie_le?: string | null
          slug?: string
          titre_en?: string | null
          titre_fr?: string
          univers_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produit_produit_lie_id_fkey"
            columns: ["produit_lie_id"]
            isOneToOne: true
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produit_univers_id_fkey"
            columns: ["univers_id"]
            isOneToOne: false
            referencedRelation: "univers"
            referencedColumns: ["id"]
          },
        ]
      }
      produit_photo: {
        Row: {
          alt_en: string
          alt_fr: string
          cree_le: string
          fichier: string
          id: string
          position: number
          produit_id: string
        }
        Insert: {
          alt_en: string
          alt_fr: string
          cree_le?: string
          fichier: string
          id?: string
          position: number
          produit_id: string
        }
        Update: {
          alt_en?: string
          alt_fr?: string
          cree_le?: string
          fichier?: string
          id?: string
          position?: number
          produit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produit_photo_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      profil: {
        Row: {
          age_declare: number | null
          age_declare_le: string | null
          cree_le: string
          id: string
          langue: string
          origine: string | null
          preference_creation: string | null
          questions_accueil_le: string | null
          univers_prefere: string | null
        }
        Insert: {
          age_declare?: number | null
          age_declare_le?: string | null
          cree_le?: string
          id: string
          langue?: string
          origine?: string | null
          preference_creation?: string | null
          questions_accueil_le?: string | null
          univers_prefere?: string | null
        }
        Update: {
          age_declare?: number | null
          age_declare_le?: string | null
          cree_le?: string
          id?: string
          langue?: string
          origine?: string | null
          preference_creation?: string | null
          questions_accueil_le?: string | null
          univers_prefere?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profil_univers_prefere_fkey"
            columns: ["univers_prefere"]
            isOneToOne: false
            referencedRelation: "univers"
            referencedColumns: ["id"]
          },
        ]
      }
      progression_video: {
        Row: {
          compte_id: string
          max_position_secondes: number
          modifie_le: string
          position_secondes: number
          produit_id: string
          terminee_le: string | null
        }
        Insert: {
          compte_id: string
          max_position_secondes?: number
          modifie_le?: string
          position_secondes?: number
          produit_id: string
          terminee_le?: string | null
        }
        Update: {
          compte_id?: string
          max_position_secondes?: number
          modifie_le?: string
          position_secondes?: number
          produit_id?: string
          terminee_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progression_video_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "video_kit"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      reglage: {
        Row: {
          cle: string
          mis_a_jour_le: string
          valeur: string | null
        }
        Insert: {
          cle: string
          mis_a_jour_le?: string
          valeur?: string | null
        }
        Update: {
          cle?: string
          mis_a_jour_le?: string
          valeur?: string | null
        }
        Relationships: []
      }
      reservation: {
        Row: {
          commande_id: string
          cree_le: string
          expire_le: string
          id: string
          liberee_le: string | null
          ligne_id: string
          nombre: number
          origine: string
          variante_id: string
        }
        Insert: {
          commande_id: string
          cree_le?: string
          expire_le: string
          id?: string
          liberee_le?: string | null
          ligne_id: string
          nombre: number
          origine: string
          variante_id: string
        }
        Update: {
          commande_id?: string
          cree_le?: string
          expire_le?: string
          id?: string
          liberee_le?: string | null
          ligne_id?: string
          nombre?: number
          origine?: string
          variante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: true
            referencedRelation: "ligne_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variante"
            referencedColumns: ["id"]
          },
        ]
      }
      role_utilisateur: {
        Row: {
          compte: string
          cree_le: string
          evenement: string | null
          id: string
          role: string
          valide_au: string | null
          valide_du: string | null
        }
        Insert: {
          compte: string
          cree_le?: string
          evenement?: string | null
          id?: string
          role: string
          valide_au?: string | null
          valide_du?: string | null
        }
        Update: {
          compte?: string
          cree_le?: string
          evenement?: string | null
          id?: string
          role?: string
          valide_au?: string | null
          valide_du?: string | null
        }
        Relationships: []
      }
      sous_titre_kit: {
        Row: {
          cree_le: string
          id: string
          langue: string
          produit_id: string
          taille_octets: number
          version: number
        }
        Insert: {
          cree_le?: string
          id?: string
          langue: string
          produit_id: string
          taille_octets: number
          version?: number
        }
        Update: {
          cree_le?: string
          id?: string
          langue?: string
          produit_id?: string
          taille_octets?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sous_titre_kit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      sous_titre_kit_prive: {
        Row: {
          chemin_stockage: string
          sous_titre_id: string
        }
        Insert: {
          chemin_stockage: string
          sous_titre_id: string
        }
        Update: {
          chemin_stockage?: string
          sous_titre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sous_titre_kit_prive_sous_titre_id_fkey"
            columns: ["sous_titre_id"]
            isOneToOne: true
            referencedRelation: "sous_titre_kit"
            referencedColumns: ["id"]
          },
        ]
      }
      tentative_paiement: {
        Row: {
          cause: string | null
          commande_id: string
          cree_le: string
          devise_recue: string | null
          id: string
          modifie_le: string
          montant_attendu_cents: number
          montant_recu: number | null
          moyen: string
          operateur: string | null
          pays: string | null
          prestataire: string
          reference_interne: string
          reference_transaction: string | null
          statut: string
          telephone_masque: string | null
        }
        Insert: {
          cause?: string | null
          commande_id: string
          cree_le?: string
          devise_recue?: string | null
          id?: string
          modifie_le?: string
          montant_attendu_cents: number
          montant_recu?: number | null
          moyen: string
          operateur?: string | null
          pays?: string | null
          prestataire: string
          reference_interne: string
          reference_transaction?: string | null
          statut?: string
          telephone_masque?: string | null
        }
        Update: {
          cause?: string | null
          commande_id?: string
          cree_le?: string
          devise_recue?: string | null
          id?: string
          modifie_le?: string
          montant_attendu_cents?: number
          montant_recu?: number | null
          moyen?: string
          operateur?: string | null
          pays?: string | null
          prestataire?: string
          reference_interne?: string
          reference_transaction?: string | null
          statut?: string
          telephone_masque?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tentative_paiement_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentative_paiement_prestataire_fkey"
            columns: ["prestataire"]
            isOneToOne: false
            referencedRelation: "prestataire"
            referencedColumns: ["code"]
          },
        ]
      }
      tranche_prix: {
        Row: {
          bas_cents: number
          haut_cents: number | null
          id: string
          libelle_en: string
          libelle_fr: string
          ordre: number
        }
        Insert: {
          bas_cents: number
          haut_cents?: number | null
          id?: string
          libelle_en: string
          libelle_fr: string
          ordre: number
        }
        Update: {
          bas_cents?: number
          haut_cents?: number | null
          id?: string
          libelle_en?: string
          libelle_fr?: string
          ordre?: number
        }
        Relationships: []
      }
      trop_percu: {
        Row: {
          clos_le: string | null
          commande_id: string
          cree_le: string
          devise_recue: string
          id: string
          montant_attendu_cents: number
          montant_recu: number
          motif: string
          statut: string
          tentative_id: string
        }
        Insert: {
          clos_le?: string | null
          commande_id: string
          cree_le?: string
          devise_recue: string
          id?: string
          montant_attendu_cents: number
          montant_recu: number
          motif: string
          statut?: string
          tentative_id: string
        }
        Update: {
          clos_le?: string | null
          commande_id?: string
          cree_le?: string
          devise_recue?: string
          id?: string
          montant_attendu_cents?: number
          montant_recu?: number
          motif?: string
          statut?: string
          tentative_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trop_percu_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trop_percu_tentative_id_fkey"
            columns: ["tentative_id"]
            isOneToOne: true
            referencedRelation: "tentative_paiement"
            referencedColumns: ["id"]
          },
        ]
      }
      univers: {
        Row: {
          cree_le: string
          id: string
          nom_en: string
          nom_fr: string
        }
        Insert: {
          cree_le?: string
          id?: string
          nom_en: string
          nom_fr: string
        }
        Update: {
          cree_le?: string
          id?: string
          nom_en?: string
          nom_fr?: string
        }
        Relationships: []
      }
      variante: {
        Row: {
          cree_le: string
          delai_fabrication_jours: number | null
          fabrication_sur_commande: boolean
          id: string
          produit_id: string
          stock: number
          taille: string
        }
        Insert: {
          cree_le?: string
          delai_fabrication_jours?: number | null
          fabrication_sur_commande?: boolean
          id?: string
          produit_id: string
          stock?: number
          taille: string
        }
        Update: {
          cree_le?: string
          delai_fabrication_jours?: number | null
          fabrication_sur_commande?: boolean
          id?: string
          produit_id?: string
          stock?: number
          taille?: string
        }
        Relationships: [
          {
            foreignKeyName: "variante_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      video_kit: {
        Row: {
          cree_le: string
          duree_secondes: number
          extrait_bunny_id: string | null
          extrait_le: string | null
          extrait_sans_parole: boolean
          extrait_sous_titres: string[]
          prete_le: string
          produit_id: string
        }
        Insert: {
          cree_le?: string
          duree_secondes: number
          extrait_bunny_id?: string | null
          extrait_le?: string | null
          extrait_sans_parole?: boolean
          extrait_sous_titres?: string[]
          prete_le?: string
          produit_id: string
        }
        Update: {
          cree_le?: string
          duree_secondes?: number
          extrait_bunny_id?: string | null
          extrait_le?: string | null
          extrait_sans_parole?: boolean
          extrait_sous_titres?: string[]
          prete_le?: string
          produit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_kit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: true
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
        ]
      }
      video_kit_prive: {
        Row: {
          bunny_video_id_prive: string
          produit_id: string
        }
        Insert: {
          bunny_video_id_prive: string
          produit_id: string
        }
        Update: {
          bunny_video_id_prive?: string
          produit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_kit_prive_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: true
            referencedRelation: "video_kit"
            referencedColumns: ["produit_id"]
          },
        ]
      }
    }
    Views: {
      taches_admin: {
        Row: {
          cible_id: string | null
          cible_type: string | null
          cree_le: string | null
          details: Json | null
          gravite: string | null
          id: string | null
          type: string | null
        }
        Insert: {
          cible_id?: string | null
          cible_type?: string | null
          cree_le?: string | null
          details?: Json | null
          gravite?: string | null
          id?: string | null
          type?: never
        }
        Update: {
          cible_id?: string | null
          cible_type?: string | null
          cree_le?: string | null
          details?: Json | null
          gravite?: string | null
          id?: string | null
          type?: never
        }
        Relationships: []
      }
    }
    Functions: {
      a_le_role: {
        Args: { p_compte: string; p_evenement?: string; p_role: string }
        Returns: boolean
      }
      admin_sante: { Args: never; Returns: number }
      ajouter_au_panier: {
        Args: {
          p_auteur: Json
          p_compte: string
          p_nombre: number
          p_panier: string
          p_produit: string
          p_taille: string
        }
        Returns: Json
      }
      ajouter_chapitre_kit: {
        Args: {
          p_auteur: Json
          p_debut: number
          p_produit_id: string
          p_titre_en: string
          p_titre_fr: string
        }
        Returns: string
      }
      ajouter_couverture: {
        Args: {
          p_auteur: Json
          p_operateur: string
          p_pays: string
          p_prestataire: string
          p_source: string
        }
        Returns: string
      }
      ajouter_fichier_kit: {
        Args: {
          p_auteur: Json
          p_chemin: string
          p_format: string
          p_nom_en: string
          p_nom_fr: string
          p_produit_id: string
          p_taille: number
        }
        Returns: string
      }
      ajouter_photo_produit: {
        Args: {
          p_alt_en: string
          p_alt_fr: string
          p_auteur: Json
          p_fichier: string
          p_produit_id: string
        }
        Returns: string
      }
      assurer_profil: {
        Args: { p_auteur: Json; p_compte: string; p_langue: string }
        Returns: undefined
      }
      attribuer_role: {
        Args: {
          p_auteur: Json
          p_compte: string
          p_evenement?: string
          p_role: string
          p_valide_au?: string
          p_valide_du?: string
        }
        Returns: undefined
      }
      avis_kit_possede: { Args: { p_panier: string }; Returns: boolean }
      bibliotheque_enregistrer_filigrane: {
        Args: {
          p_chemin: string
          p_compte: string
          p_fichier: string
          p_version: number
        }
        Returns: string
      }
      bibliotheque_enregistrer_progression: {
        Args: { p_compte: string; p_position: number; p_produit: string }
        Returns: boolean
      }
      bibliotheque_fichier_a_servir: {
        Args: { p_compte: string; p_fichier: string }
        Returns: Json
      }
      bibliotheque_kit: {
        Args: { p_compte: string; p_slug: string }
        Returns: Json
      }
      bibliotheque_lister: {
        Args: { p_compte: string }
        Returns: {
          acces_le: string
          alt_en: string
          alt_fr: string
          photo: string
          produit_id: string
          slug: string
          titre_en: string
          titre_fr: string
        }[]
      }
      bibliotheque_ouvrir_acces: {
        Args: { p_commande: string; p_compte: string; p_produit: string }
        Returns: boolean
      }
      bibliotheque_progressions: {
        Args: { p_compte: string }
        Returns: {
          debuts: number[]
          max_position_secondes: number
          position_secondes: number
          produit_id: string
          terminee: boolean
        }[]
      }
      bibliotheque_video_a_lire: {
        Args: { p_compte: string; p_slug: string }
        Returns: Json
      }
      capacite_fabrication_atteinte: { Args: never; Returns: boolean }
      choisir_vedette_heros: {
        Args: { p_auteur: Json; p_produit_id: string }
        Returns: undefined
      }
      commande_calculer: {
        Args: {
          p_compte: string
          p_mode: string
          p_panier: string
          p_strict: boolean
          p_zone: string
        }
        Returns: Json
      }
      compte_complet: { Args: { p_compte: string }; Returns: boolean }
      compter_panier: { Args: { p_panier: string }; Returns: number }
      confirmer_couverture: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      consommer_essai: {
        Args: { p_cle: string; p_fenetre_secondes: number; p_maximum: number }
        Returns: boolean
      }
      corriger_age: {
        Args: {
          p_age: number
          p_auteur: Json
          p_compte: string
          p_raison: string
        }
        Returns: boolean
      }
      creer_commande: {
        Args: {
          p_acceptations: Json
          p_adresse: string
          p_auteur: Json
          p_cle_idempotence: string
          p_empreinte: string
          p_mode: string
          p_origine: string
          p_panier: string
          p_telephone: string
          p_total_attendu_cents: number
          p_zone: string
        }
        Returns: Json
      }
      creer_panier: { Args: { p_auteur: Json }; Returns: string }
      creer_univers: {
        Args: { p_auteur: Json; p_nom_en: string; p_nom_fr: string }
        Returns: string
      }
      declarer_age: {
        Args: { p_age: number; p_auteur: Json; p_compte: string }
        Returns: undefined
      }
      definir_extrait_sans_parole: {
        Args: { p_auteur: Json; p_produit_id: string; p_valeur: boolean }
        Returns: undefined
      }
      definir_langue_profil: {
        Args: { p_auteur: Json; p_compte: string; p_langue: string }
        Returns: undefined
      }
      definir_prestataire_actif: {
        Args: { p_actif: boolean; p_auteur: Json; p_code: string }
        Returns: undefined
      }
      demarrer_tentative: {
        Args: {
          p_compte: string
          p_moyen: string
          p_numero: string
          p_operateur: string
          p_pays: string
          p_prestataire: string
          p_reference_interne: string
          p_telephone_masque: string
        }
        Returns: Json
      }
      deplacer_chapitre_kit: {
        Args: { p_auteur: Json; p_chapitre_id: string; p_sens: string }
        Returns: undefined
      }
      deplacer_photo_produit: {
        Args: { p_auteur: Json; p_photo_id: string; p_sens: string }
        Returns: undefined
      }
      deplacer_prestataire: {
        Args: { p_auteur: Json; p_code: string; p_sens: string }
        Returns: undefined
      }
      depublier_article: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      depublier_produit: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      disponibilite_variantes: {
        Args: { p_produit: string }
        Returns: {
          delai_jours: number
          etat: string
          taille: string
        }[]
      }
      donnees_envoi_valides: { Args: { p_donnees: Json }; Returns: boolean }
      echouer_tentative: {
        Args: { p_cause: string; p_tentative: string }
        Returns: boolean
      }
      enregistrer_article: {
        Args: { p_article: Json; p_auteur: Json; p_id: string; p_images: Json }
        Returns: string
      }
      enregistrer_extrait_kit: {
        Args: { p_auteur: Json; p_extrait: string; p_produit_id: string }
        Returns: string
      }
      enregistrer_initiation: {
        Args: { p_reference_transaction: string; p_tentative: string }
        Returns: undefined
      }
      enregistrer_kit: {
        Args: { p_auteur: Json; p_id: string; p_kit: Json }
        Returns: string
      }
      enregistrer_message_contact: {
        Args: {
          p_auteur: Json
          p_email: string
          p_langue: string
          p_message: string
          p_nom: string
        }
        Returns: undefined
      }
      enregistrer_produit: {
        Args: {
          p_auteur: Json
          p_id: string
          p_produit: Json
          p_variantes: Json
        }
        Returns: string
      }
      enregistrer_questions_accueil: {
        Args: {
          p_auteur: Json
          p_compte: string
          p_origine: string
          p_preference: string
          p_univers?: string
        }
        Returns: undefined
      }
      enregistrer_reglage: {
        Args: { p_auteur: Json; p_cle: string; p_valeur: string }
        Returns: undefined
      }
      enregistrer_repli_heros: {
        Args: {
          p_alt_en: string
          p_alt_fr: string
          p_auteur: Json
          p_fichier: string
        }
        Returns: string
      }
      enregistrer_sous_titre_kit: {
        Args: {
          p_auteur: Json
          p_chemin: string
          p_langue: string
          p_produit_id: string
          p_taille: number
        }
        Returns: string
      }
      enregistrer_sous_titres_extrait_kit: {
        Args: { p_auteur: Json; p_langue: string; p_produit_id: string }
        Returns: undefined
      }
      enregistrer_tranches_prix: {
        Args: { p_auteur: Json; p_tranches: Json }
        Returns: undefined
      }
      enregistrer_video_heros: {
        Args: { p_auteur: Json; p_video_id: string }
        Returns: string
      }
      enregistrer_video_kit: {
        Args: {
          p_auteur: Json
          p_bunny_id: string
          p_duree: number
          p_produit_id: string
        }
        Returns: string
      }
      envois_declencher: { Args: never; Returns: boolean }
      envois_ignorer: {
        Args: { p_id: string; p_raison: string }
        Returns: boolean
      }
      envois_marquer_echec: {
        Args: { p_erreur: string; p_id: string }
        Returns: string
      }
      envois_marquer_envoye: {
        Args: { p_id: string; p_id_prestataire: string }
        Returns: boolean
      }
      envois_planifier: {
        Args: {
          p_cle: string
          p_compte: string
          p_donnees: Json
          p_modele: Database["public"]["Enums"]["envoi_modele"]
        }
        Returns: string
      }
      envois_reserver_lot: {
        Args: { p_limite: number }
        Returns: {
          compte_id: string
          donnees: Json
          id: string
          langue: string
          modele: string
          tentatives: number
        }[]
      }
      est_mineur: { Args: { p_compte: string }; Returns: boolean }
      etat_disponibilite: {
        Args: {
          p_capacite_atteinte: boolean
          p_fabrication: boolean
          p_stock: number
        }
        Returns: string
      }
      etat_paiement_commande: {
        Args: { p_compte: string; p_numero: string }
        Returns: Json
      }
      exiger_admin: { Args: { p_auteur: Json }; Returns: undefined }
      exiger_client: { Args: { p_auteur: Json }; Returns: string }
      expirer_commandes_echues: { Args: never; Returns: number }
      extension_fichier_kit: { Args: { p_format: string }; Returns: string }
      familles_commande: {
        Args: { p_commande: string; p_compte: string }
        Returns: string[]
      }
      fusionner_panier: {
        Args: { p_auteur: Json; p_compte: string; p_panier: string }
        Returns: Json
      }
      lire_panier: {
        Args: { p_panier: string }
        Returns: {
          delai_jours: number
          etat: string
          famille: string
          ligne_id: string
          nombre: number
          prix_cents: number
          produit_id: string
          slug: string
          taille: string
          titre_en: string
          titre_fr: string
        }[]
      }
      lister_catalogue: {
        Args: {
          p_curseur_date?: string
          p_curseur_id?: string
          p_curseur_prix?: number
          p_dispo?: string
          p_famille: string
          p_langue?: string
          p_limite?: number
          p_niveau?: string
          p_prix_bas?: number
          p_prix_haut?: number
          p_tri?: string
          p_univers?: string
        }
        Returns: {
          curseur_date: string
          disponibilite: string
          famille: string
          id: string
          niveau: string
          photo_alt: string
          photo_fichier: string
          prix_cents: number
          slug: string
          titre: string
          univers_id: string
        }[]
      }
      manques_publication: { Args: { p_produit_id: string }; Returns: string[] }
      marquer_message_traite: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      masquer_donnee_personnelle: { Args: { p_valeur: Json }; Returns: Json }
      modifier_alt_photo: {
        Args: {
          p_alt_en: string
          p_alt_fr: string
          p_auteur: Json
          p_photo_id: string
        }
        Returns: undefined
      }
      modifier_chapitre_kit: {
        Args: {
          p_auteur: Json
          p_chapitre_id: string
          p_debut: number
          p_titre_en: string
          p_titre_fr: string
        }
        Returns: undefined
      }
      modifier_ligne_panier: {
        Args: {
          p_auteur: Json
          p_ligne: string
          p_nombre: number
          p_panier: string
        }
        Returns: undefined
      }
      offrir_commande: {
        Args: {
          p_acceptations: Json
          p_auteur: Json
          p_cle_idempotence: string
          p_produit: string
        }
        Returns: Json
      }
      panier_accessible: {
        Args: { p_compte: string; p_panier: string }
        Returns: boolean
      }
      places_fabrication_utilisees: { Args: never; Returns: number }
      possede_kit: {
        Args: { p_compte: string; p_produit: string }
        Returns: boolean
      }
      publier_article: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      publier_produit: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      questions_accueil_vues: { Args: { p_compte: string }; Returns: boolean }
      rang_disponibilite: { Args: { p_etat: string }; Returns: number }
      recapitulatif_commande: {
        Args: {
          p_compte: string
          p_mode: string
          p_panier: string
          p_zone: string
        }
        Returns: Json
      }
      remplacer_fichier_kit: {
        Args: {
          p_auteur: Json
          p_chemin: string
          p_fichier_id: string
          p_taille: number
        }
        Returns: string
      }
      retirer_couverture: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      retirer_ligne_panier: {
        Args: { p_auteur: Json; p_ligne: string; p_panier: string }
        Returns: undefined
      }
      seuil_dernieres_pieces: { Args: never; Returns: number }
      stock_disponible: { Args: { p_variante: string }; Returns: number }
      supprimer_chapitre_kit: {
        Args: { p_auteur: Json; p_chapitre_id: string }
        Returns: undefined
      }
      supprimer_fichier_kit: {
        Args: { p_auteur: Json; p_fichier_id: string }
        Returns: string
      }
      supprimer_photo_produit: {
        Args: { p_auteur: Json; p_photo_id: string }
        Returns: string
      }
      supprimer_sous_titre_kit: {
        Args: { p_auteur: Json; p_langue: string; p_produit_id: string }
        Returns: string
      }
      supprimer_sous_titres_extrait_kit: {
        Args: { p_auteur: Json; p_langue: string; p_produit_id: string }
        Returns: undefined
      }
      supprimer_video_kit: {
        Args: { p_auteur: Json; p_produit_id: string }
        Returns: Json
      }
      valider_video_heros: {
        Args: { p_auteur: Json; p_fichier: string; p_video_id: string }
        Returns: undefined
      }
      verifier_chapitre_kit: {
        Args: {
          p_debut: number
          p_produit_id: string
          p_titre_en: string
          p_titre_fr: string
        }
        Returns: undefined
      }
      verrouiller_kit: { Args: { p_produit_id: string }; Returns: undefined }
    }
    Enums: {
      anomalie_type:
        | "envoi_echec_definitif"
        | "montant_insuffisant"
        | "notification_invalide"
        | "transition_refusee"
        | "kit_deja_possede"
      envoi_modele: "commande_payee" | "kit_ouvert"
      envoi_statut: "a_envoyer" | "envoye" | "echec" | "abandonne" | "ignore"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      anomalie_type: [
        "envoi_echec_definitif",
        "montant_insuffisant",
        "notification_invalide",
        "transition_refusee",
        "kit_deja_possede",
      ],
      envoi_modele: ["commande_payee", "kit_ouvert"],
      envoi_statut: ["a_envoyer", "envoye", "echec", "abandonne", "ignore"],
    },
  },
} as const
