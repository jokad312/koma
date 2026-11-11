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
      acces_benevole: {
        Row: {
          compte_id: string
          cree_le: string
          cree_par: string
          evenement_id: string
          id: string
          modifie_le: string
          valable_du: string
          valable_jusqu_au: string
        }
        Insert: {
          compte_id: string
          cree_le?: string
          cree_par: string
          evenement_id: string
          id?: string
          modifie_le?: string
          valable_du: string
          valable_jusqu_au: string
        }
        Update: {
          compte_id?: string
          cree_le?: string
          cree_par?: string
          evenement_id?: string
          id?: string
          modifie_le?: string
          valable_du?: string
          valable_jusqu_au?: string
        }
        Relationships: [
          {
            foreignKeyName: "acces_benevole_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenement"
            referencedColumns: ["id"]
          },
        ]
      }
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
      alerte_evenement: {
        Row: {
          canal: string
          compte_id: string | null
          consentement_le: string
          consentement_version: string
          cree_le: string
          desinscrit_le: string | null
          email: string | null
          envoye_le: string | null
          evenement_id: string
          id: string
          langue: string
          whatsapp: string | null
        }
        Insert: {
          canal: string
          compte_id?: string | null
          consentement_le?: string
          consentement_version: string
          cree_le?: string
          desinscrit_le?: string | null
          email?: string | null
          envoye_le?: string | null
          evenement_id: string
          id?: string
          langue: string
          whatsapp?: string | null
        }
        Update: {
          canal?: string
          compte_id?: string | null
          consentement_le?: string
          consentement_version?: string
          cree_le?: string
          desinscrit_le?: string | null
          email?: string | null
          envoye_le?: string | null
          evenement_id?: string
          id?: string
          langue?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerte_evenement_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenement"
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
      code_promo: {
        Row: {
          actif: boolean
          affilie: string
          code: string
          commission_pct: number
          cree_le: string
          id: string
          modifie_le: string
          plafond: number
          reduction_pct: number
        }
        Insert: {
          actif?: boolean
          affilie: string
          code: string
          commission_pct: number
          cree_le?: string
          id?: string
          modifie_le?: string
          plafond?: number
          reduction_pct: number
        }
        Update: {
          actif?: boolean
          affilie?: string
          code?: string
          commission_pct?: number
          cree_le?: string
          id?: string
          modifie_le?: string
          plafond?: number
          reduction_pct?: number
        }
        Relationships: []
      }
      commande: {
        Row: {
          acceptations: Json
          adresse: string | null
          cle_idempotence: string | null
          compte_id: string
          cree_le: string
          devise: string
          expediee_le: string | null
          expire_le: string | null
          fabrication_le: string | null
          forfait_cents: number
          id: string
          livree_le: string | null
          mis_a_jour_le: string
          mode_remise: string | null
          numero: string
          numero_suivi: string | null
          offerte: boolean
          origine: string | null
          paye_le: string | null
          prestataire: string | null
          reference_transaction: string | null
          sous_total_cents: number
          statut: string
          stock_a_verifier: boolean
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
          expediee_le?: string | null
          expire_le?: string | null
          fabrication_le?: string | null
          forfait_cents?: number
          id?: string
          livree_le?: string | null
          mis_a_jour_le?: string
          mode_remise?: string | null
          numero?: string
          numero_suivi?: string | null
          offerte?: boolean
          origine?: string | null
          paye_le?: string | null
          prestataire?: string | null
          reference_transaction?: string | null
          sous_total_cents: number
          statut: string
          stock_a_verifier?: boolean
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
          expediee_le?: string | null
          expire_le?: string | null
          fabrication_le?: string | null
          forfait_cents?: number
          id?: string
          livree_le?: string | null
          mis_a_jour_le?: string
          mode_remise?: string | null
          numero?: string
          numero_suivi?: string | null
          offerte?: boolean
          origine?: string | null
          paye_le?: string | null
          prestataire?: string | null
          reference_transaction?: string | null
          sous_total_cents?: number
          statut?: string
          stock_a_verifier?: boolean
          telephone?: string | null
          total_cents?: number
          type?: string
          zone?: string | null
        }
        Relationships: []
      }
      commande_code_promo: {
        Row: {
          code: string
          code_promo_id: string
          commande_id: string
          commission_pct: number
          cree_le: string
          reduction_cents: number
          reduction_pct: number
        }
        Insert: {
          code: string
          code_promo_id: string
          commande_id: string
          commission_pct: number
          cree_le?: string
          reduction_cents: number
          reduction_pct: number
        }
        Update: {
          code?: string
          code_promo_id?: string
          commande_id?: string
          commission_pct?: number
          cree_le?: string
          reduction_cents?: number
          reduction_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "commande_code_promo_code_promo_id_fkey"
            columns: ["code_promo_id"]
            isOneToOne: false
            referencedRelation: "code_promo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_code_promo_code_promo_id_fkey"
            columns: ["code_promo_id"]
            isOneToOne: false
            referencedRelation: "commission_code_promo"
            referencedColumns: ["code_promo_id"]
          },
          {
            foreignKeyName: "commande_code_promo_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: true
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
        ]
      }
      consentement: {
        Row: {
          cible_id: string | null
          compte_id: string | null
          donne_le: string
          id: string
          objet: string
          retire_le: string | null
          source: string
          version: string
        }
        Insert: {
          cible_id?: string | null
          compte_id?: string | null
          donne_le?: string
          id?: string
          objet: string
          retire_le?: string | null
          source: string
          version: string
        }
        Update: {
          cible_id?: string | null
          compte_id?: string | null
          donne_le?: string
          id?: string
          objet?: string
          retire_le?: string | null
          source?: string
          version?: string
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
      demande_client: {
        Row: {
          commande_id: string
          cree_le: string
          description: string | null
          id: string
          ligne_id: string | null
          quantite_remplacee: number | null
          statut: string
          traitee_le: string | null
          type: string
        }
        Insert: {
          commande_id: string
          cree_le?: string
          description?: string | null
          id?: string
          ligne_id?: string | null
          quantite_remplacee?: number | null
          statut?: string
          traitee_le?: string | null
          type: string
        }
        Update: {
          commande_id?: string
          cree_le?: string
          description?: string | null
          id?: string
          ligne_id?: string | null
          quantite_remplacee?: number | null
          statut?: string
          traitee_le?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "demande_client_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demande_client_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: false
            referencedRelation: "ligne_commande"
            referencedColumns: ["id"]
          },
        ]
      }
      desinscription: {
        Row: {
          compte_id: string
          cree_le: string
          id: string
        }
        Insert: {
          compte_id: string
          cree_le?: string
          id?: string
        }
        Update: {
          compte_id?: string
          cree_le?: string
          id?: string
        }
        Relationships: []
      }
      envoi: {
        Row: {
          cle: string
          compte_id: string | null
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
          compte_id?: string | null
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
          compte_id?: string | null
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
      evenement: {
        Row: {
          auteur_id: string
          capacite: number | null
          cree_le: string
          debut_le: string | null
          description_en: string | null
          description_fr: string | null
          fin_le: string | null
          id: string
          images: Json
          lieu_en: string | null
          lieu_fr: string | null
          lieu_type: string | null
          modifie_le: string
          publie_le: string | null
          slug: string
          titre_en: string | null
          titre_fr: string
          vente_ferme_le: string | null
          vente_ouvre_le: string | null
        }
        Insert: {
          auteur_id: string
          capacite?: number | null
          cree_le?: string
          debut_le?: string | null
          description_en?: string | null
          description_fr?: string | null
          fin_le?: string | null
          id?: string
          images?: Json
          lieu_en?: string | null
          lieu_fr?: string | null
          lieu_type?: string | null
          modifie_le?: string
          publie_le?: string | null
          slug: string
          titre_en?: string | null
          titre_fr: string
          vente_ferme_le?: string | null
          vente_ouvre_le?: string | null
        }
        Update: {
          auteur_id?: string
          capacite?: number | null
          cree_le?: string
          debut_le?: string | null
          description_en?: string | null
          description_fr?: string | null
          fin_le?: string | null
          id?: string
          images?: Json
          lieu_en?: string | null
          lieu_fr?: string | null
          lieu_type?: string | null
          modifie_le?: string
          publie_le?: string | null
          slug?: string
          titre_en?: string | null
          titre_fr?: string
          vente_ferme_le?: string | null
          vente_ouvre_le?: string | null
        }
        Relationships: []
      }
      evenement_mesure: {
        Row: {
          action: string
          appareil: string
          cree_le: string
          duree_ms: number | null
          id: number
          langue: string
          origine: string | null
          page: string
          referent_domaine: string | null
          session_id: string
        }
        Insert: {
          action: string
          appareil: string
          cree_le?: string
          duree_ms?: number | null
          id?: never
          langue: string
          origine?: string | null
          page: string
          referent_domaine?: string | null
          session_id: string
        }
        Update: {
          action?: string
          appareil?: string
          cree_le?: string
          duree_ms?: number | null
          id?: never
          langue?: string
          origine?: string | null
          page?: string
          referent_domaine?: string | null
          session_id?: string
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
          annulee: boolean
          commande_id: string
          cree_le: string
          delai_fabrication_jours: number | null
          est_stand: boolean | null
          id: string
          mesures_recues_le: string | null
          nombre: number
          origine: string | null
          pass_nom_en: string | null
          pass_nom_fr: string | null
          prix_cents: number
          produit_id: string | null
          reduction_cents: number
          stock_retire: number | null
          titulaires: Json | null
          type_pass_id: string | null
          variante_id: string | null
        }
        Insert: {
          annulee?: boolean
          commande_id: string
          cree_le?: string
          delai_fabrication_jours?: number | null
          est_stand?: boolean | null
          id?: string
          mesures_recues_le?: string | null
          nombre?: number
          origine?: string | null
          pass_nom_en?: string | null
          pass_nom_fr?: string | null
          prix_cents: number
          produit_id?: string | null
          reduction_cents?: number
          stock_retire?: number | null
          titulaires?: Json | null
          type_pass_id?: string | null
          variante_id?: string | null
        }
        Update: {
          annulee?: boolean
          commande_id?: string
          cree_le?: string
          delai_fabrication_jours?: number | null
          est_stand?: boolean | null
          id?: string
          mesures_recues_le?: string | null
          nombre?: number
          origine?: string | null
          pass_nom_en?: string | null
          pass_nom_fr?: string | null
          prix_cents?: number
          produit_id?: string | null
          reduction_cents?: number
          stock_retire?: number | null
          titulaires?: Json | null
          type_pass_id?: string | null
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
            foreignKeyName: "ligne_commande_type_pass_id_fkey"
            columns: ["type_pass_id"]
            isOneToOne: false
            referencedRelation: "type_pass"
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
      pass: {
        Row: {
          code_court: string
          commande_id: string
          cree_le: string
          evenement_id: string
          id: string
          jeton: string
          ligne_commande_id: string
          nom_titulaire: string
          rang: number
          scanne_le: string | null
          scanne_par: string | null
          statut: string
          type_pass_id: string
        }
        Insert: {
          code_court: string
          commande_id: string
          cree_le?: string
          evenement_id: string
          id?: string
          jeton: string
          ligne_commande_id: string
          nom_titulaire: string
          rang: number
          scanne_le?: string | null
          scanne_par?: string | null
          statut?: string
          type_pass_id: string
        }
        Update: {
          code_court?: string
          commande_id?: string
          cree_le?: string
          evenement_id?: string
          id?: string
          jeton?: string
          ligne_commande_id?: string
          nom_titulaire?: string
          rang?: number
          scanne_le?: string | null
          scanne_par?: string | null
          statut?: string
          type_pass_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pass_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_ligne_commande_id_fkey"
            columns: ["ligne_commande_id"]
            isOneToOne: false
            referencedRelation: "ligne_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_type_pass_id_fkey"
            columns: ["type_pass_id"]
            isOneToOne: false
            referencedRelation: "type_pass"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_galerie: {
        Row: {
          accord_whatsapp_le: string | null
          alt_en: string | null
          alt_fr: string | null
          capture_accord: string | null
          compte_id: string | null
          cree_le: string
          decide_par: Json | null
          fichier_public: string | null
          id: string
          majeur_confirme_le: string | null
          nom_affiche: string | null
          objet: string
          publiee_le: string | null
          refusee_le: string | null
          retiree_le: string | null
          retrait_demande_le: string | null
          source: string
          statut: string
          ville: string | null
        }
        Insert: {
          accord_whatsapp_le?: string | null
          alt_en?: string | null
          alt_fr?: string | null
          capture_accord?: string | null
          compte_id?: string | null
          cree_le?: string
          decide_par?: Json | null
          fichier_public?: string | null
          id?: string
          majeur_confirme_le?: string | null
          nom_affiche?: string | null
          objet: string
          publiee_le?: string | null
          refusee_le?: string | null
          retiree_le?: string | null
          retrait_demande_le?: string | null
          source?: string
          statut?: string
          ville?: string | null
        }
        Update: {
          accord_whatsapp_le?: string | null
          alt_en?: string | null
          alt_fr?: string | null
          capture_accord?: string | null
          compte_id?: string | null
          cree_le?: string
          decide_par?: Json | null
          fichier_public?: string | null
          id?: string
          majeur_confirme_le?: string | null
          nom_affiche?: string | null
          objet?: string
          publiee_le?: string | null
          refusee_le?: string | null
          retiree_le?: string | null
          retrait_demande_le?: string | null
          source?: string
          statut?: string
          ville?: string | null
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
      realisation: {
        Row: {
          commande_preuve: string
          compte_id: string
          cree_le: string
          id: string
          photo_id: string
          produit_id: string
          rang: number | null
          validee_le: string | null
        }
        Insert: {
          commande_preuve: string
          compte_id: string
          cree_le?: string
          id?: string
          photo_id: string
          produit_id: string
          rang?: number | null
          validee_le?: string | null
        }
        Update: {
          commande_preuve?: string
          compte_id?: string
          cree_le?: string
          id?: string
          photo_id?: string
          produit_id?: string
          rang?: number | null
          validee_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realisation_commande_preuve_fkey"
            columns: ["commande_preuve"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realisation_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: true
            referencedRelation: "photo_galerie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realisation_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
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
      remboursement: {
        Row: {
          cible_id: string
          cible_type: string
          cree_le: string
          devise: string
          id: string
          montant_cents: number
          preuve_reference: string | null
          valide_le: string | null
          valide_par: Json | null
        }
        Insert: {
          cible_id: string
          cible_type: string
          cree_le?: string
          devise: string
          id?: string
          montant_cents: number
          preuve_reference?: string | null
          valide_le?: string | null
          valide_par?: Json | null
        }
        Update: {
          cible_id?: string
          cible_type?: string
          cree_le?: string
          devise?: string
          id?: string
          montant_cents?: number
          preuve_reference?: string | null
          valide_le?: string | null
          valide_par?: Json | null
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
      type_pass: {
        Row: {
          cree_le: string
          est_stand: boolean
          evenement_id: string
          id: string
          inclus_en: string | null
          inclus_fr: string | null
          modifie_le: string
          nom_en: string | null
          nom_fr: string
          ordre: number
          prix_cents: number
          quota: number | null
        }
        Insert: {
          cree_le?: string
          est_stand?: boolean
          evenement_id: string
          id?: string
          inclus_en?: string | null
          inclus_fr?: string | null
          modifie_le?: string
          nom_en?: string | null
          nom_fr: string
          ordre?: number
          prix_cents: number
          quota?: number | null
        }
        Update: {
          cree_le?: string
          est_stand?: boolean
          evenement_id?: string
          id?: string
          inclus_en?: string | null
          inclus_fr?: string | null
          modifie_le?: string
          nom_en?: string | null
          nom_fr?: string
          ordre?: number
          prix_cents?: number
          quota?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "type_pass_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenement"
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
      commission_code_promo: {
        Row: {
          code_promo_id: string | null
          commission_cents: number | null
          montant_cents: number | null
          ventes: number | null
        }
        Relationships: []
      }
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
      vue_desinscriptions_jour: {
        Row: {
          desinscriptions: number | null
          jour: string | null
        }
        Relationships: []
      }
      vue_deuxiemes_achats: {
        Row: {
          clients_deux_achats: number | null
          clients_payants: number | null
        }
        Relationships: []
      }
      vue_entonnoir_jour: {
        Row: {
          commandes: number | null
          etape: string | null
          jour: string | null
          sessions: number | null
        }
        Relationships: []
      }
      vue_origines_jour: {
        Row: {
          evenements: number | null
          jour: string | null
          origine: string | null
          sessions: number | null
        }
        Relationships: []
      }
      vue_paiements_jour: {
        Row: {
          jour: string | null
          moyen: string | null
          prestataire: string | null
          statut: string | null
          tentatives: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tentative_paiement_prestataire_fkey"
            columns: ["prestataire"]
            isOneToOne: false
            referencedRelation: "prestataire"
            referencedColumns: ["code"]
          },
        ]
      }
      vue_ventes_code_promo: {
        Row: {
          code: string | null
          commandes_payees: number | null
          montant_paye_cents: number | null
          reduction_cents: number | null
        }
        Relationships: []
      }
      vue_ventes_origine: {
        Row: {
          commandes_payees: number | null
          jour: string | null
          montant_paye_cents: number | null
          origine: string | null
        }
        Relationships: []
      }
      vue_visites_jour: {
        Row: {
          action: string | null
          appareil: string | null
          evenements: number | null
          jour: string | null
          langue: string | null
          sessions: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      a_deja_achete: {
        Args: { p_compte: string; p_sauf_commande?: string }
        Returns: boolean
      }
      a_le_role: {
        Args: { p_compte: string; p_evenement?: string; p_role: string }
        Returns: boolean
      }
      abandonner_tentatives_perimees: { Args: never; Returns: number }
      acces_benevole_fenetre: {
        Args: { p_debut: string; p_fin: string }
        Returns: {
          du: string
          jusqu_au: string
        }[]
      }
      acces_scan_valide: {
        Args: { p_compte: string; p_evenement: string }
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
      alerte_evenement_pour_envoi: { Args: { p_alerte: string }; Returns: Json }
      alertes_evenements_declencher: { Args: never; Returns: boolean }
      alt_nettoye: { Args: { p: string }; Returns: string }
      annuler_commande: {
        Args: { p_auteur: Json; p_commande: string }
        Returns: number
      }
      assurer_profil: {
        Args: { p_auteur: Json; p_compte: string; p_langue: string }
        Returns: undefined
      }
      attribuer_acces_benevole: {
        Args: { p_auteur: Json; p_email: string; p_evenement: string }
        Returns: Json
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
      avancer_statut: {
        Args: {
          p_auteur: Json
          p_numero: string
          p_numero_suivi?: string
          p_vers: string
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
      catalogue_decrementer_stock: {
        Args: { p_nombre: number; p_variante: string }
        Returns: undefined
      }
      choisir_vedette_heros: {
        Args: { p_auteur: Json; p_produit_id: string }
        Returns: undefined
      }
      code_promo_evaluer: {
        Args: { p_code: string; p_compte: string; p_sauf_commande?: string }
        Returns: Json
      }
      commande_calculer: {
        Args: {
          p_code?: string
          p_compte: string
          p_mode: string
          p_panier: string
          p_sauf_commande?: string
          p_strict: boolean
          p_zone: string
        }
        Returns: Json
      }
      commande_pass_calculer: {
        Args: {
          p_code: string
          p_compte: string
          p_evenement: string
          p_lignes: Json
          p_strict: boolean
        }
        Returns: Json
      }
      compte_complet: { Args: { p_compte: string }; Returns: boolean }
      compter_alertes_evenement: {
        Args: { p_auteur: Json; p_evenement: string }
        Returns: Json
      }
      compter_panier: { Args: { p_panier: string }; Returns: number }
      compter_photos_a_traiter: { Args: never; Returns: Json }
      confirmer_couverture: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      confirmer_mesures_recues: {
        Args: { p_auteur: Json; p_ligne: string }
        Returns: undefined
      }
      confirmer_paiement: {
        Args: {
          p_auteur: Json
          p_comparaison: string
          p_devise_recue: string
          p_montant_recu: number
          p_reference_transaction: string
          p_tentative: string
        }
        Returns: Json
      }
      confirmer_remboursement: {
        Args: {
          p_auteur: Json
          p_cible_id: string
          p_cible_type: string
          p_preuve: string
        }
        Returns: undefined
      }
      consommer_essai: {
        Args: { p_cle: string; p_fenetre_secondes: number; p_maximum: number }
        Returns: boolean
      }
      corriger_adresse_commande: {
        Args: { p_adresse: string; p_auteur: Json; p_numero: string }
        Returns: undefined
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
      creer_code_promo: {
        Args: {
          p_actif: boolean
          p_affilie: string
          p_auteur: Json
          p_code: string
          p_commission_pct: number
          p_plafond: number
          p_reduction_pct: number
        }
        Returns: string
      }
      creer_commande: {
        Args: {
          p_acceptations: Json
          p_adresse: string
          p_auteur: Json
          p_cle_idempotence: string
          p_code?: string
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
      creer_commande_pass: {
        Args: {
          p_acceptations: Json
          p_auteur: Json
          p_cle_idempotence: string
          p_code?: string
          p_evenement: string
          p_lignes: Json
          p_origine?: string
          p_total_attendu_cents: number
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
      demander_annulation: {
        Args: { p_compte: string; p_numero: string }
        Returns: string
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
      deposer_photo_galerie: {
        Args: {
          p_auteur: Json
          p_nom: string
          p_objet: string
          p_version_accord: string
          p_ville: string
        }
        Returns: string
      }
      deposer_photo_whatsapp: {
        Args: {
          p_accord_le: string
          p_auteur: Json
          p_capture: string
          p_compte: string
          p_majeur: boolean
          p_nom: string
          p_objet: string
          p_version: string
          p_ville: string
        }
        Returns: string
      }
      deposer_realisation: {
        Args: {
          p_auteur: Json
          p_kit: string
          p_nom: string
          p_objet: string
          p_version_accord: string
          p_ville: string
        }
        Returns: string
      }
      depublier_article: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      depublier_evenement: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      depublier_produit: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      desinscrire: { Args: { p_compte: string }; Returns: boolean }
      desinscrire_alerte: { Args: { p_alerte: string }; Returns: boolean }
      disponibilite_variantes: {
        Args: { p_produit: string }
        Returns: {
          delai_jours: number
          etat: string
          taille: string
        }[]
      }
      donnees_envoi_valides: { Args: { p_donnees: Json }; Returns: boolean }
      donner_consentements: {
        Args: {
          p_auteur: Json
          p_objets: string[]
          p_source: string
          p_version: string
        }
        Returns: number
      }
      echouer_tentative: {
        Args: { p_cause: string; p_tentative: string }
        Returns: boolean
      }
      email_commercial_autorise: { Args: { p_envoi: string }; Returns: Json }
      emails_commerciaux_bloques_mineur: {
        Args: { p_compte: string }
        Returns: boolean
      }
      enregistrer_article: {
        Args: { p_article: Json; p_auteur: Json; p_id: string; p_images: Json }
        Returns: string
      }
      enregistrer_evenement: {
        Args: { p_auteur: Json; p_evenement: Json; p_id: string; p_types: Json }
        Returns: string
      }
      enregistrer_evenement_mesure: {
        Args: {
          p_action: string
          p_appareil: string
          p_auteur: Json
          p_duree_ms?: number
          p_langue: string
          p_origine: string
          p_page: string
          p_referent: string
          p_session: string
        }
        Returns: undefined
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
      enregistrer_notification: {
        Args: {
          p_id_notification: string
          p_prestataire: string
          p_signature_valide: boolean
          p_tentative: string
        }
        Returns: boolean
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
      etat_vente_evenement: { Args: { p_evenement: string }; Returns: Json }
      evenements_emettre_pass: { Args: { p_commande: string }; Returns: number }
      exiger_admin: { Args: { p_auteur: Json }; Returns: undefined }
      exiger_client: { Args: { p_auteur: Json }; Returns: string }
      exiger_personnel: { Args: { p_auteur: Json }; Returns: undefined }
      expirer_commandes_echues: { Args: never; Returns: number }
      exporter_alertes_whatsapp: {
        Args: { p_auteur: Json; p_evenement: string }
        Returns: string[]
      }
      extension_fichier_kit: { Args: { p_format: string }; Returns: string }
      familles_commande: {
        Args: { p_commande: string; p_compte: string }
        Returns: string[]
      }
      fusionner_panier: {
        Args: { p_auteur: Json; p_compte: string; p_panier: string }
        Returns: Json
      }
      inscrire_alerte_evenement: {
        Args: {
          p_auteur: Json
          p_canal: string
          p_evenement: string
          p_langue: string
          p_valeur: string
          p_version: string
        }
        Returns: boolean
      }
      kits_payes: { Args: { p_compte: string }; Returns: Json }
      lignes_reclamables: {
        Args: { p_compte: string; p_numero: string }
        Returns: {
          ligne_id: string
        }[]
      }
      lire_acces_benevole_compte: {
        Args: { p_compte: string }
        Returns: {
          evenement_id: string
          valable_du: string
          valable_jusqu_au: string
          valide: boolean
        }[]
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
      lire_preferences: { Args: { p_compte: string }; Returns: Json }
      lister_acces_benevoles: {
        Args: { p_auteur: Json; p_evenement: string }
        Returns: {
          email: string
          id: string
          valable_du: string
          valable_jusqu_au: string
          valide: boolean
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
      lister_mes_photos: { Args: { p_compte: string }; Returns: Json }
      lister_mur_public: {
        Args: {
          p_curseur_date?: string
          p_curseur_id?: string
          p_limite?: number
        }
        Returns: {
          alt_en: string
          alt_fr: string
          curseur_date: string
          fait_avec_kit: boolean
          fichier: string
          id: string
          kit_slug: string
          kit_titre_en: string
          kit_titre_fr: string
          pseudo: string
          type: string
          valide_le: string
        }[]
      }
      lister_photos_admin: { Args: { p_auteur: Json }; Returns: Json }
      manques_publication: { Args: { p_produit_id: string }; Returns: string[] }
      manques_publication_evenement: {
        Args: { p_id: string }
        Returns: string[]
      }
      marquer_message_traite: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      marquer_stock_verifie: {
        Args: { p_auteur: Json; p_commande: string }
        Returns: undefined
      }
      masquer_donnee_personnelle: { Args: { p_valeur: Json }; Returns: Json }
      minuit_goma: { Args: { p_jours: number }; Returns: string }
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
      modifier_code_promo: {
        Args: {
          p_actif: boolean
          p_affilie: string
          p_auteur: Json
          p_commission_pct: number
          p_id: string
          p_plafond: number
          p_reduction_pct: number
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
      pass_code_court_generer: { Args: never; Returns: string }
      pass_jeton_generer: { Args: never; Returns: string }
      places_evenement_utilisees: {
        Args: { p_evenement: string }
        Returns: number
      }
      places_fabrication_utilisees: { Args: never; Returns: number }
      places_type_pass_utilisees: { Args: { p_type: string }; Returns: number }
      planifier_alertes_evenements: { Args: never; Returns: number }
      planifier_emails_cibles: { Args: never; Returns: number }
      possede_kit: {
        Args: { p_compte: string; p_produit: string }
        Returns: boolean
      }
      publier_article: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      publier_evenement: {
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
          p_code?: string
          p_compte: string
          p_mode: string
          p_panier: string
          p_zone: string
        }
        Returns: Json
      }
      recapitulatif_commande_pass: {
        Args: {
          p_code?: string
          p_compte: string
          p_evenement: string
          p_lignes: Json
        }
        Returns: Json
      }
      reconcilier_declencher: { Args: never; Returns: boolean }
      refuser_photo: {
        Args: { p_auteur: Json; p_photo: string }
        Returns: string
      }
      regler_preference: {
        Args: {
          p_actif: boolean
          p_auteur: Json
          p_objet: string
          p_version: string
        }
        Returns: boolean
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
      retirer_acces_benevole: {
        Args: { p_acces: string; p_auteur: Json; p_evenement: string }
        Returns: boolean
      }
      retirer_couverture: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      retirer_ligne_panier: {
        Args: { p_auteur: Json; p_ligne: string; p_panier: string }
        Returns: undefined
      }
      retirer_photo: {
        Args: { p_auteur: Json; p_photo: string }
        Returns: Json
      }
      retirer_photo_admin: {
        Args: { p_auteur: Json; p_photo: string }
        Returns: Json
      }
      scan_exiger_acces: {
        Args: { p_auteur: Json; p_evenement: string }
        Returns: undefined
      }
      scanner_pass: {
        Args: {
          p_auteur: Json
          p_code?: string
          p_evenement: string
          p_jeton?: string
        }
        Returns: Json
      }
      seuil_dernieres_pieces: { Args: never; Returns: number }
      signaler_montant_indetermine: {
        Args: {
          p_devise_recue: string
          p_montant_recu: number
          p_tentative: string
        }
        Returns: undefined
      }
      signaler_probleme: {
        Args: {
          p_compte: string
          p_description: string
          p_ligne: string
          p_numero: string
        }
        Returns: string
      }
      stock_disponible: { Args: { p_variante: string }; Returns: number }
      supprimer_acces_benevoles_echus: { Args: never; Returns: number }
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
      tableau_commandes_payees: {
        Args: { p_auteur: Json; p_depuis: string }
        Returns: {
          familles: string[]
          numero: string
          prestataire: string
          total_cents: number
        }[]
      }
      tableau_delai_mesures: {
        Args: { p_auteur: Json; p_depuis: string }
        Returns: {
          delai_moyen_heures: number
          lignes_en_attente: number
          lignes_recues: number
        }[]
      }
      tableau_echecs_paiement: {
        Args: { p_auteur: Json; p_depuis: string }
        Returns: {
          abandonnees: number
          echouees_client: number
          echouees_prestataire: number
          en_cours: number
          moyen: string
          prestataire: string
          reussies: number
          tentatives: number
        }[]
      }
      tableau_paiements: {
        Args: { p_auteur: Json; p_depuis: string }
        Returns: {
          commandes: number
          famille: string
          jour: string
          montant_cents: number
          prestataire: string
        }[]
      }
      tableau_trop_percus: {
        Args: { p_auteur: Json }
        Returns: {
          a_rembourser: number
          motif: string
          plus_ancien_le: string
        }[]
      }
      tentative_par_reference_interne: {
        Args: { p_reference: string }
        Returns: Json
      }
      tentatives_a_reconcilier: {
        Args: { p_delai_secondes: number; p_limite: number }
        Returns: {
          id: string
          montant_attendu_cents: number
          prestataire: string
          reference_interne: string
          reference_transaction: string
          statut: string
        }[]
      }
      toucher_tentative: { Args: { p_tentative: string }; Returns: undefined }
      traiter_demande: {
        Args: { p_auteur: Json; p_decision: string; p_demande: string }
        Returns: undefined
      }
      traiter_reclamation: {
        Args: {
          p_auteur: Json
          p_demande: string
          p_depuis_stock?: boolean
          p_etape: string
          p_quantite?: number
        }
        Returns: undefined
      }
      trouver_compte_par_email: {
        Args: { p_auteur: Json; p_email: string }
        Returns: string
      }
      utilisations_code_promo: { Args: { p_code: string }; Returns: number }
      valider_photo: {
        Args: {
          p_alt_en: string
          p_alt_fr: string
          p_auteur: Json
          p_fichier_public: string
          p_photo: string
        }
        Returns: undefined
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
        | "montant_indetermine"
        | "stock_insuffisant"
      envoi_modele:
        | "commande_payee"
        | "kit_ouvert"
        | "commande_en_fabrication"
        | "commande_expediee"
        | "commande_livree"
        | "commande_annulee"
        | "commande_remboursee"
        | "relance"
        | "panier_abandonne"
        | "rappel_kit"
        | "nouveau_produit"
        | "alerte_evenement"
        | "pass_emis"
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
        "montant_indetermine",
        "stock_insuffisant",
      ],
      envoi_modele: [
        "commande_payee",
        "kit_ouvert",
        "commande_en_fabrication",
        "commande_expediee",
        "commande_livree",
        "commande_annulee",
        "commande_remboursee",
        "relance",
        "panier_abandonne",
        "rappel_kit",
        "nouveau_produit",
        "alerte_evenement",
        "pass_emis",
      ],
      envoi_statut: ["a_envoyer", "envoye", "echec", "abandonne", "ignore"],
    },
  },
} as const
