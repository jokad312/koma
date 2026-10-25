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
          modifie_le: string
          prix_cents: number | null
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
          modifie_le?: string
          prix_cents?: number | null
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
          modifie_le?: string
          prix_cents?: number | null
          publie_le?: string | null
          slug?: string
          titre_en?: string | null
          titre_fr?: string
          univers_id?: string | null
        }
        Relationships: [
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
      est_mineur: { Args: { p_compte: string }; Returns: boolean }
      exiger_admin: { Args: { p_auteur: Json }; Returns: undefined }
      manques_publication: { Args: { p_produit_id: string }; Returns: string[] }
      marquer_message_traite: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      masquer_donnee_personnelle: { Args: { p_valeur: Json }; Returns: Json }
      publier_produit: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      questions_accueil_vues: { Args: { p_compte: string }; Returns: boolean }
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
