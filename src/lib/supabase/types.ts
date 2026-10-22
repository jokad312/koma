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
        }
        Relationships: []
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
      declarer_age: {
        Args: { p_age: number; p_auteur: Json; p_compte: string }
        Returns: undefined
      }
      definir_langue_profil: {
        Args: { p_auteur: Json; p_compte: string; p_langue: string }
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
      enregistrer_questions_accueil: {
        Args: {
          p_auteur: Json
          p_compte: string
          p_origine: string
          p_preference: string
        }
        Returns: undefined
      }
      enregistrer_reglage: {
        Args: { p_auteur: Json; p_cle: string; p_valeur: string }
        Returns: undefined
      }
      est_mineur: { Args: { p_compte: string }; Returns: boolean }
      exiger_admin: { Args: { p_auteur: Json }; Returns: undefined }
      marquer_message_traite: {
        Args: { p_auteur: Json; p_id: string }
        Returns: undefined
      }
      masquer_donnee_personnelle: { Args: { p_valeur: Json }; Returns: Json }
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
