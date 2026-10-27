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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      a_le_role: {
        Args: { p_compte: string; p_evenement?: string; p_role: string }
        Returns: boolean
      }
      admin_sante: { Args: never; Returns: number }
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
      capacite_fabrication_atteinte: { Args: never; Returns: boolean }
      choisir_vedette_heros: {
        Args: { p_auteur: Json; p_produit_id: string }
        Returns: undefined
      }
      compte_complet: { Args: { p_compte: string }; Returns: boolean }
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
      creer_univers: {
        Args: { p_auteur: Json; p_nom_en: string; p_nom_fr: string }
        Returns: string
      }
      declarer_age: {
        Args: { p_age: number; p_auteur: Json; p_compte: string }
        Returns: undefined
      }
      definir_langue_profil: {
        Args: { p_auteur: Json; p_compte: string; p_langue: string }
        Returns: undefined
      }
      deplacer_photo_produit: {
        Args: { p_auteur: Json; p_photo_id: string; p_sens: string }
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
      enregistrer_tranches_prix: {
        Args: { p_auteur: Json; p_tranches: Json }
        Returns: undefined
      }
      enregistrer_video_heros: {
        Args: { p_auteur: Json; p_video_id: string }
        Returns: string
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
      exiger_admin: { Args: { p_auteur: Json }; Returns: undefined }
      extension_fichier_kit: { Args: { p_format: string }; Returns: string }
      lister_catalogue: {
        Args: {
          p_curseur_date?: string
          p_curseur_id?: string
          p_curseur_prix?: number
          p_dispo?: string
          p_famille: string
          p_langue?: string
          p_limite?: number
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
      places_fabrication_utilisees: { Args: never; Returns: number }
      publier_produit: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      questions_accueil_vues: { Args: { p_compte: string }; Returns: boolean }
      rang_disponibilite: { Args: { p_etat: string }; Returns: number }
      remplacer_fichier_kit: {
        Args: {
          p_auteur: Json
          p_chemin: string
          p_fichier_id: string
          p_taille: number
        }
        Returns: string
      }
      seuil_dernieres_pieces: { Args: never; Returns: number }
      stock_disponible: { Args: { p_variante: string }; Returns: number }
      supprimer_fichier_kit: {
        Args: { p_auteur: Json; p_fichier_id: string }
        Returns: string
      }
      supprimer_photo_produit: {
        Args: { p_auteur: Json; p_photo_id: string }
        Returns: string
      }
      valider_video_heros: {
        Args: { p_auteur: Json; p_fichier: string; p_video_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
