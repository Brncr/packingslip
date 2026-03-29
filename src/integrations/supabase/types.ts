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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_notifications: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string
          customer_name: string
          description: string
          id: string
          order_number: string
          workflow_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by?: string
          customer_name: string
          description: string
          id?: string
          order_number: string
          workflow_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string
          customer_name?: string
          description?: string
          id?: string
          order_number?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_notifications_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          customer_name: string | null
          description: string
          id: string
          metadata: Json | null
          order_number: string | null
          performed_by: string
        }
        Insert: {
          action_type: string
          created_at?: string
          customer_name?: string | null
          description: string
          id?: string
          metadata?: Json | null
          order_number?: string | null
          performed_by?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          customer_name?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          order_number?: string | null
          performed_by?: string
        }
        Relationships: []
      }
      card_read_status: {
        Row: {
          id: string
          last_read_at: string
          user_name: string
          workflow_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          user_name: string
          workflow_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          user_name?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_read_status_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      general_chat_messages: {
        Row: {
          id: string
          author_name: string
          content: string
          order_number: string | null
          order_workflow_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          author_name?: string
          content: string
          order_number?: string | null
          order_workflow_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          author_name?: string
          content?: string
          order_number?: string | null
          order_workflow_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_chat_messages_order_workflow_id_fkey"
            columns: ["order_workflow_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_spreadsheets: {
        Row: {
          created_at: string
          customer_name: string
          file_name: string
          id: string
          order_number: string
          spreadsheet_id: string
          spreadsheet_url: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          file_name: string
          id?: string
          order_number: string
          spreadsheet_id: string
          spreadsheet_url: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          file_name?: string
          id?: string
          order_number?: string
          spreadsheet_id?: string
          spreadsheet_url?: string
        }
        Relationships: []
      }
      notification_read_status: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_name: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_name: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_read_status_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "activity_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      order_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          workflow_id: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          id?: string
          workflow_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          quantity: number
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price?: number
          quantity?: number
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          quantity?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stage_history: {
        Row: {
          changed_at: string
          from_stage: Database["public"]["Enums"]["order_stage"] | null
          id: string
          notified_customer: boolean
          to_stage: Database["public"]["Enums"]["order_stage"]
          workflow_id: string
        }
        Insert: {
          changed_at?: string
          from_stage?: Database["public"]["Enums"]["order_stage"] | null
          id?: string
          notified_customer?: boolean
          to_stage: Database["public"]["Enums"]["order_stage"]
          workflow_id: string
        }
        Update: {
          changed_at?: string
          from_stage?: Database["public"]["Enums"]["order_stage"] | null
          id?: string
          notified_customer?: boolean
          to_stage?: Database["public"]["Enums"]["order_stage"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_stage_history_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      order_workflow: {
        Row: {
          archived: boolean
          created_at: string
          current_stage: Database["public"]["Enums"]["order_stage"]
          customer_email: string | null
          customer_name: string
          freight_agent: string | null
          id: string
          notes: string | null
          notify_customer: boolean
          order_id: string
          order_number: string
          payment_status: string
          spreadsheet_id: string | null
          spreadsheet_url: string | null
          stage_id: string | null
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          current_stage?: Database["public"]["Enums"]["order_stage"]
          customer_email?: string | null
          customer_name: string
          freight_agent?: string | null
          id?: string
          notes?: string | null
          notify_customer?: boolean
          order_id: string
          order_number: string
          payment_status?: string
          spreadsheet_id?: string | null
          spreadsheet_url?: string | null
          stage_id?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          current_stage?: Database["public"]["Enums"]["order_stage"]
          customer_email?: string | null
          customer_name?: string
          freight_agent?: string | null
          id?: string
          notes?: string | null
          notify_customer?: boolean
          order_id?: string
          order_number?: string
          payment_status?: string
          spreadsheet_id?: string | null
          spreadsheet_url?: string | null
          stage_id?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_workflow_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_debits: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          customer_name: string
          debit_type: string
          description: string | null
          id: string
          item_name: string | null
          item_price: number | null
          item_quantity: number | null
          new_total_cost: number | null
          order_number: string
          previous_total_cost: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          workflow_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          customer_name: string
          debit_type?: string
          description?: string | null
          id?: string
          item_name?: string | null
          item_price?: number | null
          item_quantity?: number | null
          new_total_cost?: number | null
          order_number: string
          previous_total_cost?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          workflow_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          customer_name?: string
          debit_type?: string
          description?: string | null
          id?: string
          item_name?: string | null
          item_price?: number | null
          item_quantity?: number | null
          new_total_cost?: number | null
          order_number?: string
          previous_total_cost?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          workflow_id?: string
        }
        Relationships: []
      }
      wallet: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          order_id: string | null
          receipt_url: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          order_id?: string | null
          receipt_url?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          order_id?: string | null
          receipt_url?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_workflow"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          wip_limit: number | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          wip_limit?: number | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          wip_limit?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_wallet_balance: {
        Args: { p_amount: number; p_operation: string; p_wallet_id: string }
        Returns: number
      }
    }
    Enums: {
      order_stage: "novo" | "em_producao" | "pronto" | "enviado" | "entregue"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_stage: ["novo", "em_producao", "pronto", "enviado", "entregue"],
    },
  },
} as const
