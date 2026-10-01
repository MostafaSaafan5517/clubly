export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor: string;
          actor_user_id: string | null;
          business_id: string;
          changed_columns: string[];
          created_at: string;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string;
          table_name: string;
        };
        Insert: {
          action: string;
          actor: string;
          actor_user_id?: string | null;
          business_id: string;
          changed_columns?: string[];
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id: string;
          table_name: string;
        };
        Update: {
          action?: string;
          actor?: string;
          actor_user_id?: string | null;
          business_id?: string;
          changed_columns?: string[];
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string;
          table_name?: string;
        };
        Relationships: [];
      };
      business_staff: {
        Row: {
          business_id: string;
          created_at: string;
          role: Database["public"]["Enums"]["staff_role"];
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          role: Database["public"]["Enums"]["staff_role"];
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["staff_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_staff_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          charges_enabled: boolean;
          created_at: string;
          has_stripe_account: boolean | null;
          id: string;
          name: string;
          slug: string;
          stripe_account_id: string | null;
          stripe_portal_configuration_id: string | null;
        };
        Insert: {
          charges_enabled?: boolean;
          created_at?: string;
          has_stripe_account?: never;
          id?: string;
          name: string;
          slug: string;
          stripe_account_id?: string | null;
          stripe_portal_configuration_id?: string | null;
        };
        Update: {
          charges_enabled?: boolean;
          created_at?: string;
          has_stripe_account?: never;
          id?: string;
          name?: string;
          slug?: string;
          stripe_account_id?: string | null;
          stripe_portal_configuration_id?: string | null;
        };
        Relationships: [];
      };
      members: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["member_status"];
          stripe_customer_id?: string | null;
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["member_status"];
          stripe_customer_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          application_fee: number;
          business_id: string;
          created_at: string;
          currency: string;
          id: string;
          member_id: string;
          paid_at: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_invoice_id: string;
          subscription_id: string | null;
        };
        Insert: {
          amount: number;
          application_fee?: number;
          business_id: string;
          created_at?: string;
          currency: string;
          id?: string;
          member_id: string;
          paid_at?: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_invoice_id: string;
          subscription_id?: string | null;
        };
        Update: {
          amount?: number;
          application_fee?: number;
          business_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          member_id?: string;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          stripe_invoice_id?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_member_id_business_id_fkey";
            columns: ["member_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          amount: number;
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          business_id: string;
          created_at: string;
          currency: string;
          has_stripe_price: boolean | null;
          id: string;
          name: string;
          stripe_price_id: string | null;
        };
        Insert: {
          active?: boolean;
          amount: number;
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          business_id: string;
          created_at?: string;
          currency?: string;
          has_stripe_price?: never;
          id?: string;
          name: string;
          stripe_price_id?: string | null;
        };
        Update: {
          active?: boolean;
          amount?: number;
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          business_id?: string;
          created_at?: string;
          currency?: string;
          has_stripe_price?: never;
          id?: string;
          name?: string;
          stripe_price_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plans_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          account_id: string | null;
          event_id: string;
          processed_at: string;
          type: string;
        };
        Insert: {
          account_id?: string | null;
          event_id: string;
          processed_at?: string;
          type: string;
        };
        Update: {
          account_id?: string | null;
          event_id?: string;
          processed_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          business_id: string;
          cancel_at: string | null;
          created_at: string;
          current_period_end: string | null;
          id: string;
          member_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          cancel_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          member_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          cancel_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          member_id?: string;
          plan_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_member_id_business_id_fkey";
            columns: ["member_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_business_id_fkey";
            columns: ["plan_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_account_updated: {
        Args: {
          account_id: string;
          charges_enabled: boolean;
          event_id: string;
        };
        Returns: boolean;
      };
      apply_invoice_event: {
        Args: {
          account_id: string;
          event_id: string;
          event_type: string;
          invoice: Json;
          subscription: Json;
        };
        Returns: string;
      };
      apply_subscription_event: {
        Args: {
          account_id: string;
          event_id: string;
          event_type: string;
          subscription: Json;
        };
        Returns: string;
      };
      create_business: {
        Args: { business_name: string; business_slug: string };
        Returns: string;
      };
    };
    Enums: {
      billing_interval: "month" | "year";
      member_status: "active" | "suspended";
      payment_status: "paid" | "failed";
      staff_role: "owner" | "admin" | "staff";
      subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      billing_interval: ["month", "year"],
      member_status: ["active", "suspended"],
      payment_status: ["paid", "failed"],
      staff_role: ["owner", "admin", "staff"],
      subscription_status: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
  },
} as const;
