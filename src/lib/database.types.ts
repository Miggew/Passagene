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
      acasalamento_embrioes_media: {
        Row: {
          altura: number | null
          arquivo_nome: string
          arquivo_path: string
          arquivo_tamanho: number | null
          arquivo_url: string
          created_at: string | null
          data_gravacao: string | null
          descricao: string | null
          duracao_segundos: number | null
          id: string
          largura: number | null
          lote_fiv_acasalamento_id: string
          mime_type: string | null
          observacoes: string | null
          tipo_media: string
          updated_at: string | null
        }
        Insert: {
          altura?: number | null
          arquivo_nome: string
          arquivo_path: string
          arquivo_tamanho?: number | null
          arquivo_url: string
          created_at?: string | null
          data_gravacao?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          id?: string
          largura?: number | null
          lote_fiv_acasalamento_id: string
          mime_type?: string | null
          observacoes?: string | null
          tipo_media: string
          updated_at?: string | null
        }
        Update: {
          altura?: number | null
          arquivo_nome?: string
          arquivo_path?: string
          arquivo_tamanho?: number | null
          arquivo_url?: string
          created_at?: string | null
          data_gravacao?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          id?: string
          largura?: number | null
          lote_fiv_acasalamento_id?: string
          mime_type?: string | null
          observacoes?: string | null
          tipo_media?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acasalamento_embrioes_media_lote_fiv_acasalamento_id_fkey"
            columns: ["lote_fiv_acasalamento_id"]
            isOneToOne: false
            referencedRelation: "lote_fiv_acasalamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_acasalamento_media"
            columns: ["lote_fiv_acasalamento_id"]
            isOneToOne: false
            referencedRelation: "lote_fiv_acasalamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      animais: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_nascimento: string
          embriao_id: string | null
          fazenda_id: string | null
          id: string
          mae_nome: string | null
          observacoes: string | null
          pai_nome: string | null
          raca: string | null
          receptora_id: string | null
          sexo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_nascimento: string
          embriao_id?: string | null
          fazenda_id?: string | null
          id?: string
          mae_nome?: string | null
          observacoes?: string | null
          pai_nome?: string | null
          raca?: string | null
          receptora_id?: string | null
          sexo: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_nascimento?: string
          embriao_id?: string | null
          fazenda_id?: string | null
          id?: string
          mae_nome?: string | null
          observacoes?: string | null
          pai_nome?: string | null
          raca?: string | null
          receptora_id?: string | null
          sexo?: string
        }
        Relationships: [
          {
            foreignKeyName: "animais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "animais_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "embrioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "v_embrioes_disponiveis_te"
            referencedColumns: ["embriao_id"]
          },
          {
            foreignKeyName: "animais_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      aspiracoes_doadoras: {
        Row: {
          atresicos: number
          created_at: string
          data_aspiracao: string
          degenerados: number
          desnudos: number
          doadora_id: string
          expandidos: number
          fazenda_id: string
          hora_final: string | null
          horario_aspiracao: string
          id: string
          observacoes: string | null
          pacote_aspiracao_id: string | null
          recomendacao_touro: string | null
          tecnico_responsavel: string
          total_oocitos: number
          veterinario_responsavel: string
          viaveis: number
        }
        Insert: {
          atresicos?: number
          created_at?: string
          data_aspiracao: string
          degenerados?: number
          desnudos?: number
          doadora_id: string
          expandidos?: number
          fazenda_id: string
          hora_final?: string | null
          horario_aspiracao: string
          id?: string
          observacoes?: string | null
          pacote_aspiracao_id?: string | null
          recomendacao_touro?: string | null
          tecnico_responsavel: string
          total_oocitos?: number
          veterinario_responsavel: string
          viaveis?: number
        }
        Update: {
          atresicos?: number
          created_at?: string
          data_aspiracao?: string
          degenerados?: number
          desnudos?: number
          doadora_id?: string
          expandidos?: number
          fazenda_id?: string
          hora_final?: string | null
          horario_aspiracao?: string
          id?: string
          observacoes?: string | null
          pacote_aspiracao_id?: string | null
          recomendacao_touro?: string | null
          tecnico_responsavel?: string
          total_oocitos?: number
          veterinario_responsavel?: string
          viaveis?: number
        }
        Relationships: [
          {
            foreignKeyName: "aspiracoes_doadoras_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiracoes_doadoras_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "vw_doadoras_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiracoes_doadoras_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiracoes_doadoras_pacote_aspiracao_id_fkey"
            columns: ["pacote_aspiracao_id"]
            isOneToOne: false
            referencedRelation: "pacotes_aspiracao"
            referencedColumns: ["id"]
          },
        ]
      }
      atributos_definicoes: {
        Row: {
          codigo: string
          created_at: string | null
          filtravel: boolean
          id: string
          label: string
          opcoes: Json | null
          ordem: number
          raca: string
          tipo: string
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          filtravel?: boolean
          id?: string
          label: string
          opcoes?: Json | null
          ordem?: number
          raca: string
          tipo: string
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          filtravel?: boolean
          id?: string
          label?: string
          opcoes?: Json | null
          ordem?: number
          raca?: string
          tipo?: string
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      catalogo_genetica: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          destaque: boolean | null
          doadora_id: string | null
          foto_principal: string | null
          fotos_galeria: string[] | null
          id: string
          ordem: number | null
          preco: number | null
          preco_negociavel: boolean | null
          tipo: string
          touro_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          destaque?: boolean | null
          doadora_id?: string | null
          foto_principal?: string | null
          fotos_galeria?: string[] | null
          id?: string
          ordem?: number | null
          preco?: number | null
          preco_negociavel?: boolean | null
          tipo: string
          touro_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          destaque?: boolean | null
          doadora_id?: string | null
          foto_principal?: string | null
          fotos_galeria?: string[] | null
          id?: string
          ordem?: number | null
          preco?: number | null
          preco_negociavel?: boolean | null
          tipo?: string
          touro_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_genetica_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_genetica_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "vw_doadoras_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_genetica_touro_id_fkey"
            columns: ["touro_id"]
            isOneToOne: false
            referencedRelation: "touros"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_daily_summaries: {
        Row: {
          cliente_id: string
          generated_at: string
          id: string
          summary_date: string
          summary_text: string
        }
        Insert: {
          cliente_id: string
          generated_at?: string
          id?: string
          summary_date: string
          summary_text: string
        }
        Update: {
          cliente_id?: string
          generated_at?: string
          id?: string
          summary_date?: string
          summary_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_daily_summaries_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_daily_summaries_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      cliente_preferences: {
        Row: {
          cliente_id: string
          created_at: string | null
          default_fazenda_id: string | null
          email_reports: boolean | null
          font_size: string | null
          id: string
          notif_dg: boolean | null
          notif_parto: boolean | null
          notif_sexagem: boolean | null
          notif_te: boolean | null
          notification_email: string | null
          report_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          default_fazenda_id?: string | null
          email_reports?: boolean | null
          font_size?: string | null
          id?: string
          notif_dg?: boolean | null
          notif_parto?: boolean | null
          notif_sexagem?: boolean | null
          notif_te?: boolean | null
          notification_email?: string | null
          report_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          default_fazenda_id?: string | null
          email_reports?: boolean | null
          font_size?: string | null
          id?: string
          notif_dg?: boolean | null
          notif_parto?: boolean | null
          notif_sexagem?: boolean | null
          notif_te?: boolean | null
          notification_email?: string | null
          report_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_preferences_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_preferences_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cliente_preferences_default_fazenda_id_fkey"
            columns: ["default_fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      diagnosticos_gestacao: {
        Row: {
          created_at: string
          data_diagnostico: string
          data_te: string
          fazenda_id: string | null
          id: string
          numero_gestacoes: number
          observacoes: string | null
          receptora_id: string
          resultado: string
          sexagem: string | null
          tecnico_responsavel: string | null
          tipo_diagnostico: string
          veterinario_responsavel: string | null
        }
        Insert: {
          created_at?: string
          data_diagnostico: string
          data_te: string
          fazenda_id?: string | null
          id?: string
          numero_gestacoes: number
          observacoes?: string | null
          receptora_id: string
          resultado: string
          sexagem?: string | null
          tecnico_responsavel?: string | null
          tipo_diagnostico: string
          veterinario_responsavel?: string | null
        }
        Update: {
          created_at?: string
          data_diagnostico?: string
          data_te?: string
          fazenda_id?: string | null
          id?: string
          numero_gestacoes?: number
          observacoes?: string | null
          receptora_id?: string
          resultado?: string
          sexagem?: string | null
          tecnico_responsavel?: string | null
          tipo_diagnostico?: string
          veterinario_responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_gestacao_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_gestacao_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_gestacao_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
          {
            foreignKeyName: "fk_diagnosticos_gestacao_receptora"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_diagnosticos_gestacao_receptora"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      doadora_atributos: {
        Row: {
          created_at: string | null
          definicao_id: string
          doadora_id: string
          id: string
          updated_at: string | null
          valor_bool: boolean | null
          valor_num: number | null
          valor_select: string | null
          valor_text: string | null
        }
        Insert: {
          created_at?: string | null
          definicao_id: string
          doadora_id: string
          id?: string
          updated_at?: string | null
          valor_bool?: boolean | null
          valor_num?: number | null
          valor_select?: string | null
          valor_text?: string | null
        }
        Update: {
          created_at?: string | null
          definicao_id?: string
          doadora_id?: string
          id?: string
          updated_at?: string | null
          valor_bool?: boolean | null
          valor_num?: number | null
          valor_select?: string | null
          valor_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doadora_atributos_definicao_id_fkey"
            columns: ["definicao_id"]
            isOneToOne: false
            referencedRelation: "atributos_definicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doadora_atributos_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doadora_atributos_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "vw_doadoras_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      doadoras: {
        Row: {
          avo_materno_nome: string | null
          avo_paterno_nome: string | null
          beta_caseina: string | null
          classificacao: number | null
          classificacao_genetica: string | null
          controle_leiteiro: number | null
          created_at: string
          data_inicio_gestacao: string | null
          disponivel_aspiracao: boolean | null
          fazenda_id: string
          foto_url: string | null
          genealogia_texto: string | null
          gpta: number | null
          id: string
          link_abcz: string | null
          mae_nome: string | null
          mae_registro: string | null
          nome: string | null
          pai_nome: string | null
          pai_registro: string | null
          prenhe: boolean | null
          raca: string | null
          registro: string
        }
        Insert: {
          avo_materno_nome?: string | null
          avo_paterno_nome?: string | null
          beta_caseina?: string | null
          classificacao?: number | null
          classificacao_genetica?: string | null
          controle_leiteiro?: number | null
          created_at?: string
          data_inicio_gestacao?: string | null
          disponivel_aspiracao?: boolean | null
          fazenda_id: string
          foto_url?: string | null
          genealogia_texto?: string | null
          gpta?: number | null
          id?: string
          link_abcz?: string | null
          mae_nome?: string | null
          mae_registro?: string | null
          nome?: string | null
          pai_nome?: string | null
          pai_registro?: string | null
          prenhe?: boolean | null
          raca?: string | null
          registro: string
        }
        Update: {
          avo_materno_nome?: string | null
          avo_paterno_nome?: string | null
          beta_caseina?: string | null
          classificacao?: number | null
          classificacao_genetica?: string | null
          controle_leiteiro?: number | null
          created_at?: string
          data_inicio_gestacao?: string | null
          disponivel_aspiracao?: boolean | null
          fazenda_id?: string
          foto_url?: string | null
          genealogia_texto?: string | null
          gpta?: number | null
          id?: string
          link_abcz?: string | null
          mae_nome?: string | null
          mae_registro?: string | null
          nome?: string | null
          pai_nome?: string | null
          pai_registro?: string | null
          prenhe?: boolean | null
          raca?: string | null
          registro?: string
        }
        Relationships: [
          {
            foreignKeyName: "doadoras_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      doses_semen: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          partida: string | null
          quantidade: number | null
          quantidade_adicionada: number | null
          quantidade_total: number | null
          tipo_semen: string | null
          touro_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          partida?: string | null
          quantidade?: number | null
          quantidade_adicionada?: number | null
          quantidade_total?: number | null
          tipo_semen?: string | null
          touro_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          partida?: string | null
          quantidade?: number | null
          quantidade_adicionada?: number | null
          quantidade_total?: number | null
          tipo_semen?: string | null
          touro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doses_semen_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doses_semen_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "doses_semen_touro_id_fkey"
            columns: ["touro_id"]
            isOneToOne: false
            referencedRelation: "touros"
            referencedColumns: ["id"]
          },
        ]
      }
      embrioes: {
        Row: {
          acasalamento_media_id: string | null
          classificacao: string | null
          cliente_id: string | null
          created_at: string
          data_classificacao: string | null
          data_congelamento: string | null
          data_descarte: string | null
          data_envase: string | null
          data_saida_laboratorio: string | null
          estrela: boolean | null
          fazenda_destino_id: string | null
          id: string
          identificacao: string | null
          localizacao_atual: string | null
          lote_fiv_acasalamento_id: string | null
          lote_fiv_id: string
          observacoes: string | null
          queue_id: string | null
          status_atual: string
          tipo_embriao: string | null
        }
        Insert: {
          acasalamento_media_id?: string | null
          classificacao?: string | null
          cliente_id?: string | null
          created_at?: string
          data_classificacao?: string | null
          data_congelamento?: string | null
          data_descarte?: string | null
          data_envase?: string | null
          data_saida_laboratorio?: string | null
          estrela?: boolean | null
          fazenda_destino_id?: string | null
          id?: string
          identificacao?: string | null
          localizacao_atual?: string | null
          lote_fiv_acasalamento_id?: string | null
          lote_fiv_id: string
          observacoes?: string | null
          queue_id?: string | null
          status_atual: string
          tipo_embriao?: string | null
        }
        Update: {
          acasalamento_media_id?: string | null
          classificacao?: string | null
          cliente_id?: string | null
          created_at?: string
          data_classificacao?: string | null
          data_congelamento?: string | null
          data_descarte?: string | null
          data_envase?: string | null
          data_saida_laboratorio?: string | null
          estrela?: boolean | null
          fazenda_destino_id?: string | null
          id?: string
          identificacao?: string | null
          localizacao_atual?: string | null
          lote_fiv_acasalamento_id?: string | null
          lote_fiv_id?: string
          observacoes?: string | null
          queue_id?: string | null
          status_atual?: string
          tipo_embriao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embrioes_acasalamento_media_id_fkey"
            columns: ["acasalamento_media_id"]
            isOneToOne: false
            referencedRelation: "acasalamento_embrioes_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embrioes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embrioes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "embrioes_fazenda_destino_id_fkey"
            columns: ["fazenda_destino_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embrioes_lote_fiv_acasalamento_id_fkey"
            columns: ["lote_fiv_acasalamento_id"]
            isOneToOne: false
            referencedRelation: "lote_fiv_acasalamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embrioes_lote_fiv_id_fkey"
            columns: ["lote_fiv_id"]
            isOneToOne: false
            referencedRelation: "lotes_fiv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embrioes_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "embryo_analysis_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      embryo_analysis_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          crop_paths: Json | null
          detected_bboxes: Json | null
          detection_confidence: string | null
          error_log: string | null
          error_message: string | null
          expected_count: number | null
          id: string
          lote_fiv_acasalamento_id: string
          manual_bboxes: Json | null
          media_id: string
          plate_frame_path: string | null
          retry_count: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          crop_paths?: Json | null
          detected_bboxes?: Json | null
          detection_confidence?: string | null
          error_log?: string | null
          error_message?: string | null
          expected_count?: number | null
          id?: string
          lote_fiv_acasalamento_id: string
          manual_bboxes?: Json | null
          media_id: string
          plate_frame_path?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          crop_paths?: Json | null
          detected_bboxes?: Json | null
          detection_confidence?: string | null
          error_log?: string | null
          error_message?: string | null
          expected_count?: number | null
          id?: string
          lote_fiv_acasalamento_id?: string
          manual_bboxes?: Json | null
          media_id?: string
          plate_frame_path?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "embryo_analysis_queue_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "acasalamento_embrioes_media"
            referencedColumns: ["id"]
          },
        ]
      }
      embryo_references: {
        Row: {
          acasalamento_id: string | null
          ai_confidence: number | null
          ai_suggested_class: string | null
          best_frame_path: string | null
          biologist_agreed: boolean | null
          camera_device: string | null
          classification: string
          composite_path: string | null
          created_at: string | null
          crop_image_path: string | null
          embedding: string
          embriao_id: string | null
          id: string
          kinetic_bg_noise: number | null
          kinetic_harmony: number | null
          kinetic_intensity: number | null
          kinetic_stability: number | null
          kinetic_symmetry: number | null
          lab_id: string
          lote_fiv_id: string | null
          microscope_model: string | null
          motion_map_path: string | null
          pregnancy_checked_at: string | null
          pregnancy_result: boolean | null
          review_mode: string | null
          source: string
          species: string
          stage_iets: number | null
          zoom_level: string | null
        }
        Insert: {
          acasalamento_id?: string | null
          ai_confidence?: number | null
          ai_suggested_class?: string | null
          best_frame_path?: string | null
          biologist_agreed?: boolean | null
          camera_device?: string | null
          classification: string
          composite_path?: string | null
          created_at?: string | null
          crop_image_path?: string | null
          embedding: string
          embriao_id?: string | null
          id?: string
          kinetic_bg_noise?: number | null
          kinetic_harmony?: number | null
          kinetic_intensity?: number | null
          kinetic_stability?: number | null
          kinetic_symmetry?: number | null
          lab_id: string
          lote_fiv_id?: string | null
          microscope_model?: string | null
          motion_map_path?: string | null
          pregnancy_checked_at?: string | null
          pregnancy_result?: boolean | null
          review_mode?: string | null
          source?: string
          species?: string
          stage_iets?: number | null
          zoom_level?: string | null
        }
        Update: {
          acasalamento_id?: string | null
          ai_confidence?: number | null
          ai_suggested_class?: string | null
          best_frame_path?: string | null
          biologist_agreed?: boolean | null
          camera_device?: string | null
          classification?: string
          composite_path?: string | null
          created_at?: string | null
          crop_image_path?: string | null
          embedding?: string
          embriao_id?: string | null
          id?: string
          kinetic_bg_noise?: number | null
          kinetic_harmony?: number | null
          kinetic_intensity?: number | null
          kinetic_stability?: number | null
          kinetic_symmetry?: number | null
          lab_id?: string
          lote_fiv_id?: string | null
          microscope_model?: string | null
          motion_map_path?: string | null
          pregnancy_checked_at?: string | null
          pregnancy_result?: boolean | null
          review_mode?: string | null
          source?: string
          species?: string
          stage_iets?: number | null
          zoom_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embryo_references_acasalamento_id_fkey"
            columns: ["acasalamento_id"]
            isOneToOne: false
            referencedRelation: "lote_fiv_acasalamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embryo_references_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: true
            referencedRelation: "embrioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embryo_references_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: true
            referencedRelation: "v_embrioes_disponiveis_te"
            referencedColumns: ["embriao_id"]
          },
          {
            foreignKeyName: "embryo_references_lote_fiv_id_fkey"
            columns: ["lote_fiv_id"]
            isOneToOne: false
            referencedRelation: "lotes_fiv"
            referencedColumns: ["id"]
          },
        ]
      }
      embryo_score_config: {
        Row: {
          active: boolean
          analysis_prompt: string | null
          calibration_prompt: string | null
          created_at: string
          id: string
          kinetic_weight: number
          model_name: string
          morph_weight: number
          notes: string | null
          prompt_version: string
        }
        Insert: {
          active?: boolean
          analysis_prompt?: string | null
          calibration_prompt?: string | null
          created_at?: string
          id?: string
          kinetic_weight?: number
          model_name?: string
          morph_weight?: number
          notes?: string | null
          prompt_version?: string
        }
        Update: {
          active?: boolean
          analysis_prompt?: string | null
          calibration_prompt?: string | null
          created_at?: string
          id?: string
          kinetic_weight?: number
          model_name?: string
          morph_weight?: number
          notes?: string | null
          prompt_version?: string
        }
        Relationships: []
      }
      embryo_score_secrets: {
        Row: {
          id: string
          key_name: string
          key_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          key_name: string
          key_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          key_name?: string
          key_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      embryo_scores: {
        Row: {
          activity_score: number | null
          ai_confidence: number | null
          analysis_version: number | null
          bbox_height_percent: number | null
          bbox_width_percent: number | null
          bbox_x_percent: number | null
          bbox_y_percent: number | null
          biologist_agreed: boolean | null
          biologist_classification: string | null
          biologo_concorda: boolean | null
          biologo_descricao_erros: string[] | null
          biologo_estagio: string | null
          biologo_nota: string | null
          biologo_score: number | null
          blastocele_pattern: string | null
          blastocele_pulsation: string | null
          classification: string
          combined_classification: string | null
          combined_confidence: number | null
          combined_source: string | null
          composite_path: string | null
          confidence: string
          created_at: string
          crop_image_path: string | null
          detection_method: string | null
          embedding: string | null
          embriao_id: string
          embryo_score: number
          expansion_observed: boolean | null
          fragmentation: string | null
          gemini_classification: string | null
          gemini_reasoning: string | null
          global_motion: string | null
          icm_activity: string | null
          icm_description: string | null
          id: string
          is_current: boolean | null
          is_ground_truth: boolean | null
          kinetic_bg_noise: number | null
          kinetic_harmony: number | null
          kinetic_intensity: number | null
          kinetic_stability: number | null
          kinetic_symmetry: number | null
          kinetic_weight: number | null
          knn_classification: string | null
          knn_confidence: number | null
          knn_neighbor_ids: string[] | null
          knn_real_bovine_count: number | null
          knn_votes: Json | null
          manual_grade_override: string | null
          media_id: string | null
          mlp_classification: string | null
          mlp_confidence: number | null
          mlp_probabilities: Json | null
          model_used: string | null
          morph_weight: number | null
          most_active_region: string | null
          motion_asymmetry: string | null
          motion_map_path: string | null
          position_description: string | null
          processing_time_ms: number | null
          prompt_version: string | null
          quality_checklist: Json | null
          quality_grade: number | null
          raw_response: Json | null
          reasoning: string | null
          stability: string | null
          stage_code: number | null
          te_activity: string | null
          te_description: string | null
          temporal_analysis: Json | null
          transfer_recommendation: string
          viability_indicators: Json | null
          viability_prediction: Json | null
          visual_features: Json | null
          zp_status: string | null
        }
        Insert: {
          activity_score?: number | null
          ai_confidence?: number | null
          analysis_version?: number | null
          bbox_height_percent?: number | null
          bbox_width_percent?: number | null
          bbox_x_percent?: number | null
          bbox_y_percent?: number | null
          biologist_agreed?: boolean | null
          biologist_classification?: string | null
          biologo_concorda?: boolean | null
          biologo_descricao_erros?: string[] | null
          biologo_estagio?: string | null
          biologo_nota?: string | null
          biologo_score?: number | null
          blastocele_pattern?: string | null
          blastocele_pulsation?: string | null
          classification: string
          combined_classification?: string | null
          combined_confidence?: number | null
          combined_source?: string | null
          composite_path?: string | null
          confidence?: string
          created_at?: string
          crop_image_path?: string | null
          detection_method?: string | null
          embedding?: string | null
          embriao_id: string
          embryo_score: number
          expansion_observed?: boolean | null
          fragmentation?: string | null
          gemini_classification?: string | null
          gemini_reasoning?: string | null
          global_motion?: string | null
          icm_activity?: string | null
          icm_description?: string | null
          id?: string
          is_current?: boolean | null
          is_ground_truth?: boolean | null
          kinetic_bg_noise?: number | null
          kinetic_harmony?: number | null
          kinetic_intensity?: number | null
          kinetic_stability?: number | null
          kinetic_symmetry?: number | null
          kinetic_weight?: number | null
          knn_classification?: string | null
          knn_confidence?: number | null
          knn_neighbor_ids?: string[] | null
          knn_real_bovine_count?: number | null
          knn_votes?: Json | null
          manual_grade_override?: string | null
          media_id?: string | null
          mlp_classification?: string | null
          mlp_confidence?: number | null
          mlp_probabilities?: Json | null
          model_used?: string | null
          morph_weight?: number | null
          most_active_region?: string | null
          motion_asymmetry?: string | null
          motion_map_path?: string | null
          position_description?: string | null
          processing_time_ms?: number | null
          prompt_version?: string | null
          quality_checklist?: Json | null
          quality_grade?: number | null
          raw_response?: Json | null
          reasoning?: string | null
          stability?: string | null
          stage_code?: number | null
          te_activity?: string | null
          te_description?: string | null
          temporal_analysis?: Json | null
          transfer_recommendation: string
          viability_indicators?: Json | null
          viability_prediction?: Json | null
          visual_features?: Json | null
          zp_status?: string | null
        }
        Update: {
          activity_score?: number | null
          ai_confidence?: number | null
          analysis_version?: number | null
          bbox_height_percent?: number | null
          bbox_width_percent?: number | null
          bbox_x_percent?: number | null
          bbox_y_percent?: number | null
          biologist_agreed?: boolean | null
          biologist_classification?: string | null
          biologo_concorda?: boolean | null
          biologo_descricao_erros?: string[] | null
          biologo_estagio?: string | null
          biologo_nota?: string | null
          biologo_score?: number | null
          blastocele_pattern?: string | null
          blastocele_pulsation?: string | null
          classification?: string
          combined_classification?: string | null
          combined_confidence?: number | null
          combined_source?: string | null
          composite_path?: string | null
          confidence?: string
          created_at?: string
          crop_image_path?: string | null
          detection_method?: string | null
          embedding?: string | null
          embriao_id?: string
          embryo_score?: number
          expansion_observed?: boolean | null
          fragmentation?: string | null
          gemini_classification?: string | null
          gemini_reasoning?: string | null
          global_motion?: string | null
          icm_activity?: string | null
          icm_description?: string | null
          id?: string
          is_current?: boolean | null
          is_ground_truth?: boolean | null
          kinetic_bg_noise?: number | null
          kinetic_harmony?: number | null
          kinetic_intensity?: number | null
          kinetic_stability?: number | null
          kinetic_symmetry?: number | null
          kinetic_weight?: number | null
          knn_classification?: string | null
          knn_confidence?: number | null
          knn_neighbor_ids?: string[] | null
          knn_real_bovine_count?: number | null
          knn_votes?: Json | null
          manual_grade_override?: string | null
          media_id?: string | null
          mlp_classification?: string | null
          mlp_confidence?: number | null
          mlp_probabilities?: Json | null
          model_used?: string | null
          morph_weight?: number | null
          most_active_region?: string | null
          motion_asymmetry?: string | null
          motion_map_path?: string | null
          position_description?: string | null
          processing_time_ms?: number | null
          prompt_version?: string | null
          quality_checklist?: Json | null
          quality_grade?: number | null
          raw_response?: Json | null
          reasoning?: string | null
          stability?: string | null
          stage_code?: number | null
          te_activity?: string | null
          te_description?: string | null
          temporal_analysis?: Json | null
          transfer_recommendation?: string
          viability_indicators?: Json | null
          viability_prediction?: Json | null
          visual_features?: Json | null
          zp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embryo_scores_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "embrioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embryo_scores_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "v_embrioes_disponiveis_te"
            referencedColumns: ["embriao_id"]
          },
          {
            foreignKeyName: "embryo_scores_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "acasalamento_embrioes_media"
            referencedColumns: ["id"]
          },
        ]
      }
      fazendas: {
        Row: {
          cliente_id: string
          contato_responsavel: string | null
          created_at: string
          id: string
          latitude: number | null
          localizacao: string | null
          longitude: number | null
          nome: string
          responsavel: string | null
          sigla: string | null
        }
        Insert: {
          cliente_id: string
          contato_responsavel?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          localizacao?: string | null
          longitude?: number | null
          nome: string
          responsavel?: string | null
          sigla?: string | null
        }
        Update: {
          cliente_id?: string
          contato_responsavel?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          localizacao?: string | null
          longitude?: number | null
          nome?: string
          responsavel?: string | null
          sigla?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fazendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fazendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      historico_embrioes: {
        Row: {
          created_at: string | null
          data_mudanca: string | null
          embriao_id: string
          fazenda_id: string | null
          id: string
          observacoes: string | null
          status_anterior: string | null
          status_novo: string
          tipo_operacao: string | null
        }
        Insert: {
          created_at?: string | null
          data_mudanca?: string | null
          embriao_id: string
          fazenda_id?: string | null
          id?: string
          observacoes?: string | null
          status_anterior?: string | null
          status_novo: string
          tipo_operacao?: string | null
        }
        Update: {
          created_at?: string | null
          data_mudanca?: string | null
          embriao_id?: string
          fazenda_id?: string | null
          id?: string
          observacoes?: string | null
          status_anterior?: string | null
          status_novo?: string
          tipo_operacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_historico_embriao"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "embrioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_historico_embriao"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "v_embrioes_disponiveis_te"
            referencedColumns: ["embriao_id"]
          },
          {
            foreignKeyName: "historico_embrioes_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "embrioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_embrioes_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "v_embrioes_disponiveis_te"
            referencedColumns: ["embriao_id"]
          },
          {
            foreignKeyName: "historico_embrioes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      hubs: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          display_order: number
          icon: string | null
          id: string
          name: string
          routes: string[]
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          routes?: string[]
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          routes?: string[]
        }
        Relationships: []
      }
      lote_fiv_acasalamentos: {
        Row: {
          aspiracao_doadora_id: string
          created_at: string | null
          dose_semen_id: string
          embrioes_clivados_d3: number | null
          id: string
          lote_fiv_id: string
          observacoes: string | null
          quantidade_embrioes: number | null
          quantidade_fracionada: number
          quantidade_oocitos: number | null
          updated_at: string | null
        }
        Insert: {
          aspiracao_doadora_id: string
          created_at?: string | null
          dose_semen_id: string
          embrioes_clivados_d3?: number | null
          id?: string
          lote_fiv_id: string
          observacoes?: string | null
          quantidade_embrioes?: number | null
          quantidade_fracionada?: number
          quantidade_oocitos?: number | null
          updated_at?: string | null
        }
        Update: {
          aspiracao_doadora_id?: string
          created_at?: string | null
          dose_semen_id?: string
          embrioes_clivados_d3?: number | null
          id?: string
          lote_fiv_id?: string
          observacoes?: string | null
          quantidade_embrioes?: number | null
          quantidade_fracionada?: number
          quantidade_oocitos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lote_fiv_acasalamentos_aspiracao_doadora_id_fkey"
            columns: ["aspiracao_doadora_id"]
            isOneToOne: false
            referencedRelation: "aspiracoes_doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_fiv_acasalamentos_dose_semen_id_fkey"
            columns: ["dose_semen_id"]
            isOneToOne: false
            referencedRelation: "doses_semen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_fiv_acasalamentos_lote_fiv_id_fkey"
            columns: ["lote_fiv_id"]
            isOneToOne: false
            referencedRelation: "lotes_fiv"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_fiv_fazendas_destino: {
        Row: {
          fazenda_id: string
          lote_fiv_id: string
        }
        Insert: {
          fazenda_id: string
          lote_fiv_id: string
        }
        Update: {
          fazenda_id?: string
          lote_fiv_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lote_fiv_fazendas_destino_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_fiv_fazendas_destino_lote_fiv_id_fkey"
            columns: ["lote_fiv_id"]
            isOneToOne: false
            referencedRelation: "lotes_fiv"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_fiv: {
        Row: {
          aspiracao_id: string | null
          created_at: string
          data_abertura: string | null
          data_avaliacao: string | null
          data_fecundacao: string | null
          disponivel_para_transferencia: boolean | null
          dose_semen_id: string | null
          doses_selecionadas: string[] | null
          fazenda_destino_id: string | null
          id: string
          observacoes: string | null
          oocitos_utilizados: number | null
          pacote_aspiracao_id: string | null
          pacote_producao_id: string | null
          status: string | null
        }
        Insert: {
          aspiracao_id?: string | null
          created_at?: string
          data_abertura?: string | null
          data_avaliacao?: string | null
          data_fecundacao?: string | null
          disponivel_para_transferencia?: boolean | null
          dose_semen_id?: string | null
          doses_selecionadas?: string[] | null
          fazenda_destino_id?: string | null
          id?: string
          observacoes?: string | null
          oocitos_utilizados?: number | null
          pacote_aspiracao_id?: string | null
          pacote_producao_id?: string | null
          status?: string | null
        }
        Update: {
          aspiracao_id?: string | null
          created_at?: string
          data_abertura?: string | null
          data_avaliacao?: string | null
          data_fecundacao?: string | null
          disponivel_para_transferencia?: boolean | null
          dose_semen_id?: string | null
          doses_selecionadas?: string[] | null
          fazenda_destino_id?: string | null
          id?: string
          observacoes?: string | null
          oocitos_utilizados?: number | null
          pacote_aspiracao_id?: string | null
          pacote_producao_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_fiv_aspiracao_id_fkey"
            columns: ["aspiracao_id"]
            isOneToOne: false
            referencedRelation: "aspiracoes_doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_fiv_dose_semen_id_fkey"
            columns: ["dose_semen_id"]
            isOneToOne: false
            referencedRelation: "doses_semen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_fiv_fazenda_destino_id_fkey"
            columns: ["fazenda_destino_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_fiv_pacote_aspiracao_id_fkey"
            columns: ["pacote_aspiracao_id"]
            isOneToOne: false
            referencedRelation: "pacotes_aspiracao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_fiv_pacote_producao_id_fkey"
            columns: ["pacote_producao_id"]
            isOneToOne: false
            referencedRelation: "pacotes_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_corrections: {
        Row: {
          corrected_value: string
          created_at: string | null
          fazenda_id: string | null
          field_type: string
          id: string
          raw_value: string
          report_type: string
          veterinario: string | null
        }
        Insert: {
          corrected_value: string
          created_at?: string | null
          fazenda_id?: string | null
          field_type: string
          id?: string
          raw_value: string
          report_type: string
          veterinario?: string | null
        }
        Update: {
          corrected_value?: string
          created_at?: string | null
          fazenda_id?: string | null
          field_type?: string
          id?: string
          raw_value?: string
          report_type?: string
          veterinario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_corrections_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes_aspiracao: {
        Row: {
          created_at: string | null
          data_aspiracao: string
          fazenda_destino_id: string
          fazenda_id: string
          horario_inicio: string | null
          id: string
          observacoes: string | null
          status: string
          tecnico_responsavel: string | null
          total_oocitos: number | null
          updated_at: string | null
          usado_em_lote_fiv: boolean | null
          veterinario_responsavel: string | null
        }
        Insert: {
          created_at?: string | null
          data_aspiracao: string
          fazenda_destino_id: string
          fazenda_id: string
          horario_inicio?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tecnico_responsavel?: string | null
          total_oocitos?: number | null
          updated_at?: string | null
          usado_em_lote_fiv?: boolean | null
          veterinario_responsavel?: string | null
        }
        Update: {
          created_at?: string | null
          data_aspiracao?: string
          fazenda_destino_id?: string
          fazenda_id?: string
          horario_inicio?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tecnico_responsavel?: string | null
          total_oocitos?: number | null
          updated_at?: string | null
          usado_em_lote_fiv?: boolean | null
          veterinario_responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_aspiracao_fazenda_destino_id_fkey"
            columns: ["fazenda_destino_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_aspiracao_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes_aspiracao_fazendas_destino: {
        Row: {
          created_at: string | null
          fazenda_destino_id: string
          id: string
          pacote_aspiracao_id: string
        }
        Insert: {
          created_at?: string | null
          fazenda_destino_id: string
          id?: string
          pacote_aspiracao_id: string
        }
        Update: {
          created_at?: string | null
          fazenda_destino_id?: string
          id?: string
          pacote_aspiracao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_aspiracao_fazendas_destino_fazenda_destino_id_fkey"
            columns: ["fazenda_destino_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_aspiracao_fazendas_destino_pacote_aspiracao_id_fkey"
            columns: ["pacote_aspiracao_id"]
            isOneToOne: false
            referencedRelation: "pacotes_aspiracao"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes_producao: {
        Row: {
          created_at: string
          data_fecundacao: string
          data_te_prevista: string | null
          id: string
          janela_te_dias: number
          nome: string | null
          observacoes: string | null
        }
        Insert: {
          created_at?: string
          data_fecundacao: string
          data_te_prevista?: string | null
          id?: string
          janela_te_dias?: number
          nome?: string | null
          observacoes?: string | null
        }
        Update: {
          created_at?: string
          data_fecundacao?: string
          data_te_prevista?: string | null
          id?: string
          janela_te_dias?: number
          nome?: string | null
          observacoes?: string | null
        }
        Relationships: []
      }
      protocolo_receptoras: {
        Row: {
          ciclando_classificacao: string | null
          created_at: string
          data_inclusao: string
          data_retirada: string | null
          evento_fazenda_id: string | null
          id: string
          motivo_inapta: string | null
          observacoes: string | null
          protocolo_id: string
          qualidade_coracoes: number
          qualidade_semaforo: number | null
          receptora_id: string
          status: string
        }
        Insert: {
          ciclando_classificacao?: string | null
          created_at?: string
          data_inclusao: string
          data_retirada?: string | null
          evento_fazenda_id?: string | null
          id?: string
          motivo_inapta?: string | null
          observacoes?: string | null
          protocolo_id: string
          qualidade_coracoes?: number
          qualidade_semaforo?: number | null
          receptora_id: string
          status?: string
        }
        Update: {
          ciclando_classificacao?: string | null
          created_at?: string
          data_inclusao?: string
          data_retirada?: string | null
          evento_fazenda_id?: string | null
          id?: string
          motivo_inapta?: string | null
          observacoes?: string | null
          protocolo_id?: string
          qualidade_coracoes?: number
          qualidade_semaforo?: number | null
          receptora_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_receptoras_fazenda_atual_id_fkey"
            columns: ["evento_fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_receptoras_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos_sincronizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_receptoras_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_receptoras_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      protocolos_sincronizacao: {
        Row: {
          created_at: string
          data_inicio: string
          data_retirada: string | null
          fazenda_id: string
          id: string
          observacoes: string | null
          pacote_producao_id: string | null
          passo2_data: string | null
          passo2_tecnico_responsavel: string | null
          protocolo_origem_id: string | null
          responsavel_inicio: string
          responsavel_retirada: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data_inicio: string
          data_retirada?: string | null
          fazenda_id: string
          id?: string
          observacoes?: string | null
          pacote_producao_id?: string | null
          passo2_data?: string | null
          passo2_tecnico_responsavel?: string | null
          protocolo_origem_id?: string | null
          responsavel_inicio: string
          responsavel_retirada?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data_inicio?: string
          data_retirada?: string | null
          fazenda_id?: string
          id?: string
          observacoes?: string | null
          pacote_producao_id?: string | null
          passo2_data?: string | null
          passo2_tecnico_responsavel?: string | null
          protocolo_origem_id?: string | null
          responsavel_inicio?: string
          responsavel_retirada?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_sincronizacao_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_sincronizacao_pacote_producao_id_fkey"
            columns: ["pacote_producao_id"]
            isOneToOne: false
            referencedRelation: "pacotes_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_sincronizacao_protocolo_origem_id_fkey"
            columns: ["protocolo_origem_id"]
            isOneToOne: false
            referencedRelation: "protocolos_sincronizacao"
            referencedColumns: ["id"]
          },
        ]
      }
      receptora_fazenda_historico: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          data_saida: string | null
          fazenda_id: string
          id: string
          observacoes: string | null
          receptora_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          data_saida?: string | null
          fazenda_id: string
          id?: string
          observacoes?: string | null
          receptora_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          data_saida?: string | null
          fazenda_id?: string
          id?: string
          observacoes?: string | null
          receptora_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receptora_fazenda_historico_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptora_fazenda_historico_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptora_fazenda_historico_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      receptora_renomeacoes_historico: {
        Row: {
          brinco_anterior: string
          brinco_novo: string
          created_at: string | null
          data_renomeacao: string
          id: string
          motivo: string | null
          observacoes: string | null
          receptora_id: string
        }
        Insert: {
          brinco_anterior: string
          brinco_novo: string
          created_at?: string | null
          data_renomeacao?: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
          receptora_id: string
        }
        Update: {
          brinco_anterior?: string
          brinco_novo?: string
          created_at?: string | null
          data_renomeacao?: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
          receptora_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptora_renomeacoes_historico_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptora_renomeacoes_historico_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      receptoras: {
        Row: {
          created_at: string
          data_provavel_parto: string | null
          fazenda_atual_id: string | null
          id: string
          identificacao: string
          is_cio_livre: boolean
          nome: string | null
          status_cio_livre: string | null
          status_reprodutivo: string | null
        }
        Insert: {
          created_at?: string
          data_provavel_parto?: string | null
          fazenda_atual_id?: string | null
          id?: string
          identificacao: string
          is_cio_livre?: boolean
          nome?: string | null
          status_cio_livre?: string | null
          status_reprodutivo?: string | null
        }
        Update: {
          created_at?: string
          data_provavel_parto?: string | null
          fazenda_atual_id?: string | null
          id?: string
          identificacao?: string
          is_cio_livre?: boolean
          nome?: string | null
          status_cio_livre?: string | null
          status_reprodutivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receptoras_fazenda_atual_id_fkey"
            columns: ["fazenda_atual_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      receptoras_cio_livre: {
        Row: {
          ativa: boolean
          created_at: string
          data_cio: string
          fazenda_id: string
          id: string
          observacoes: string | null
          receptora_id: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          data_cio: string
          fazenda_id: string
          id?: string
          observacoes?: string | null
          receptora_id: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          data_cio?: string
          fazenda_id?: string
          id?: string
          observacoes?: string | null
          receptora_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptoras_cio_livre_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptoras_cio_livre_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptoras_cio_livre_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      report_imports: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          extracted_data: Json | null
          fazenda_id: string | null
          final_data: Json
          id: string
          image_path: string | null
          pacote_aspiracao_id: string | null
          protocolo_id: string | null
          report_type: string
          reverted_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          fazenda_id?: string | null
          final_data: Json
          id?: string
          image_path?: string | null
          pacote_aspiracao_id?: string | null
          protocolo_id?: string | null
          report_type: string
          reverted_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          fazenda_id?: string | null
          final_data?: Json
          id?: string
          image_path?: string | null
          pacote_aspiracao_id?: string | null
          protocolo_id?: string | null
          report_type?: string
          reverted_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_imports_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      touros: {
        Row: {
          caseinas: Json | null
          created_at: string | null
          dados_conformacao: Json | null
          dados_geneticos: Json | null
          dados_producao: Json | null
          dados_saude_reproducao: Json | null
          data_nascimento: string | null
          disponivel: boolean | null
          fazenda_nome: string | null
          foto_url: string | null
          genealogia_texto: string | null
          id: string
          link_catalogo: string | null
          link_video: string | null
          mae_nome: string | null
          mae_registro: string | null
          medidas_fisicas: Json | null
          nome: string
          observacoes: string | null
          outros_dados: Json | null
          pai_nome: string | null
          pai_registro: string | null
          proprietario: string | null
          raca: string
          registro: string
          updated_at: string | null
        }
        Insert: {
          caseinas?: Json | null
          created_at?: string | null
          dados_conformacao?: Json | null
          dados_geneticos?: Json | null
          dados_producao?: Json | null
          dados_saude_reproducao?: Json | null
          data_nascimento?: string | null
          disponivel?: boolean | null
          fazenda_nome?: string | null
          foto_url?: string | null
          genealogia_texto?: string | null
          id?: string
          link_catalogo?: string | null
          link_video?: string | null
          mae_nome?: string | null
          mae_registro?: string | null
          medidas_fisicas?: Json | null
          nome: string
          observacoes?: string | null
          outros_dados?: Json | null
          pai_nome?: string | null
          pai_registro?: string | null
          proprietario?: string | null
          raca: string
          registro: string
          updated_at?: string | null
        }
        Update: {
          caseinas?: Json | null
          created_at?: string | null
          dados_conformacao?: Json | null
          dados_geneticos?: Json | null
          dados_producao?: Json | null
          dados_saude_reproducao?: Json | null
          data_nascimento?: string | null
          disponivel?: boolean | null
          fazenda_nome?: string | null
          foto_url?: string | null
          genealogia_texto?: string | null
          id?: string
          link_catalogo?: string | null
          link_video?: string | null
          mae_nome?: string | null
          mae_registro?: string | null
          medidas_fisicas?: Json | null
          nome?: string
          observacoes?: string | null
          outros_dados?: Json | null
          pai_nome?: string | null
          pai_registro?: string | null
          proprietario?: string | null
          raca?: string
          registro?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transferencias_embrioes: {
        Row: {
          created_at: string
          data_te: string
          embriao_id: string
          evento_fazenda_id: string | null
          id: string
          idade_embriao_dias: number | null
          observacoes: string | null
          protocolo_receptora_id: string | null
          receptora_id: string
          status_te: string
          tecnico_responsavel: string
          tipo_te: string | null
          veterinario_responsavel: string
        }
        Insert: {
          created_at?: string
          data_te: string
          embriao_id: string
          evento_fazenda_id?: string | null
          id?: string
          idade_embriao_dias?: number | null
          observacoes?: string | null
          protocolo_receptora_id?: string | null
          receptora_id: string
          status_te: string
          tecnico_responsavel: string
          tipo_te?: string | null
          veterinario_responsavel: string
        }
        Update: {
          created_at?: string
          data_te?: string
          embriao_id?: string
          evento_fazenda_id?: string | null
          id?: string
          idade_embriao_dias?: number | null
          observacoes?: string | null
          protocolo_receptora_id?: string | null
          receptora_id?: string
          status_te?: string
          tecnico_responsavel?: string
          tipo_te?: string | null
          veterinario_responsavel?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_embrioes_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "embrioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "v_embrioes_disponiveis_te"
            referencedColumns: ["embriao_id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_fazenda_id_fkey"
            columns: ["evento_fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_protocolo_receptora_id_fkey"
            columns: ["protocolo_receptora_id"]
            isOneToOne: false
            referencedRelation: "protocolo_receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_protocolo_receptora_id_fkey"
            columns: ["protocolo_receptora_id"]
            isOneToOne: false
            referencedRelation: "v_protocolo_receptoras_status"
            referencedColumns: ["protocolo_receptora_id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      transferencias_sessoes: {
        Row: {
          created_at: string
          data_passo2: string | null
          data_te: string | null
          fazenda_id: string
          filtro_cliente_id: string | null
          filtro_raca: string | null
          id: string
          incluir_cio_livre: boolean | null
          origem_embriao: string | null
          pacote_id: string | null
          permitir_duplas: boolean
          protocolo_id: string | null
          protocolo_receptora_ids: Json | null
          status: string
          tecnico_responsavel: string | null
          transferencias_ids: Json | null
          updated_at: string
          veterinario_responsavel: string | null
        }
        Insert: {
          created_at?: string
          data_passo2?: string | null
          data_te?: string | null
          fazenda_id: string
          filtro_cliente_id?: string | null
          filtro_raca?: string | null
          id?: string
          incluir_cio_livre?: boolean | null
          origem_embriao?: string | null
          pacote_id?: string | null
          permitir_duplas?: boolean
          protocolo_id?: string | null
          protocolo_receptora_ids?: Json | null
          status?: string
          tecnico_responsavel?: string | null
          transferencias_ids?: Json | null
          updated_at?: string
          veterinario_responsavel?: string | null
        }
        Update: {
          created_at?: string
          data_passo2?: string | null
          data_te?: string | null
          fazenda_id?: string
          filtro_cliente_id?: string | null
          filtro_raca?: string | null
          id?: string
          incluir_cio_livre?: boolean | null
          origem_embriao?: string | null
          pacote_id?: string | null
          permitir_duplas?: boolean
          protocolo_id?: string | null
          protocolo_receptora_ids?: Json | null
          status?: string
          tecnico_responsavel?: string | null
          transferencias_ids?: Json | null
          updated_at?: string
          veterinario_responsavel?: string | null
        }
        Relationships: []
      }
      user_clientes: {
        Row: {
          cliente_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "user_clientes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_clientes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_hub_permissions: {
        Row: {
          can_access: boolean | null
          created_at: string | null
          hub_code: string
          id: string
          user_id: string
        }
        Insert: {
          can_access?: boolean | null
          created_at?: string | null
          hub_code: string
          id?: string
          user_id: string
        }
        Update: {
          can_access?: boolean | null
          created_at?: string | null
          hub_code?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hub_permissions_hub_code_fkey"
            columns: ["hub_code"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_hub_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_hub_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active: boolean | null
          cliente_id: string | null
          created_at: string | null
          email: string
          id: string
          nome: string
          updated_at: string | null
          user_type: string
        }
        Insert: {
          active?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          email: string
          id: string
          nome: string
          updated_at?: string | null
          user_type?: string
        }
        Update: {
          active?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          updated_at?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
    }
    Views: {
      v_embrioes_disponiveis_te: {
        Row: {
          classificacao: string | null
          d7_pronto: boolean | null
          d8_limite: boolean | null
          data_fecundacao: string | null
          disponivel_congelado: boolean | null
          disponivel_fresco_hoje: boolean | null
          embriao_id: string | null
          identificacao: string | null
          localizacao_atual: string | null
          lote_fiv_id: string | null
          status_atual: string | null
          tipo_embriao: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embrioes_lote_fiv_id_fkey"
            columns: ["lote_fiv_id"]
            isOneToOne: false
            referencedRelation: "lotes_fiv"
            referencedColumns: ["id"]
          },
        ]
      }
      v_protocolo_receptoras_status: {
        Row: {
          brinco: string | null
          data_limite_te: string | null
          data_te_prevista: string | null
          fase_ciclo: string | null
          fazenda_atual_id: string | null
          fazenda_protocolo_id: string | null
          motivo_efetivo: string | null
          pacote_producao_id: string | null
          protocolo_id: string | null
          protocolo_receptora_id: string | null
          receptora_id: string | null
          status_efetivo: string | null
          teve_te_realizada: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_receptoras_fazenda_atual_id_fkey"
            columns: ["fazenda_atual_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_receptoras_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos_sincronizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_receptoras_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_receptoras_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
          {
            foreignKeyName: "protocolos_sincronizacao_fazenda_id_fkey"
            columns: ["fazenda_protocolo_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_sincronizacao_pacote_producao_id_fkey"
            columns: ["pacote_producao_id"]
            isOneToOne: false
            referencedRelation: "pacotes_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tentativas_te_status: {
        Row: {
          brinco: string | null
          created_at_primeira_te: string | null
          created_at_ultima_te: string | null
          data_te: string | null
          dg_data: string | null
          dg_resultado: string | null
          fase_ciclo: string | null
          fazenda_id: string | null
          fazenda_nome: string | null
          protocolo_receptora_id: string | null
          receptora_id: string | null
          sexagem_data: string | null
          sexagem_resultado: string | null
          sexagem_sexo: string | null
          status_tentativa: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_embrioes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_protocolo_receptora_id_fkey"
            columns: ["protocolo_receptora_id"]
            isOneToOne: false
            referencedRelation: "protocolo_receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_protocolo_receptora_id_fkey"
            columns: ["protocolo_receptora_id"]
            isOneToOne: false
            referencedRelation: "v_protocolo_receptoras_status"
            referencedColumns: ["protocolo_receptora_id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      v_user_permissions: {
        Row: {
          active: boolean | null
          allowed_hubs: string[] | null
          cliente_id: string | null
          email: string | null
          nome: string | null
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          active?: boolean | null
          allowed_hubs?: never
          cliente_id?: string | null
          email?: string | null
          nome?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          active?: boolean | null
          allowed_hubs?: never
          cliente_id?: string | null
          email?: string | null
          nome?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_fazenda_atual"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      vw_catalogo_destaques: {
        Row: {
          catalogo_id: string | null
          destaque: boolean | null
          doadora_id: string | null
          foto_principal: string | null
          foto_url: string | null
          nome: string | null
          ordem: number | null
          preco: number | null
          publicado_em: string | null
          raca: string | null
          registro: string | null
          tipo: string | null
          touro_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_genetica_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_genetica_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "vw_doadoras_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_genetica_touro_id_fkey"
            columns: ["touro_id"]
            isOneToOne: false
            referencedRelation: "touros"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_catalogo_doadoras: {
        Row: {
          ativo: boolean | null
          catalogo_id: string | null
          classificacao_genetica: string | null
          cliente_nome: string | null
          descricao: string | null
          destaque: boolean | null
          doadora_id: string | null
          embrioes_disponiveis: number | null
          fazenda_nome: string | null
          foto_principal: string | null
          foto_url: string | null
          fotos_galeria: string[] | null
          mae_nome: string | null
          mae_registro: string | null
          nome: string | null
          ordem: number | null
          pai_nome: string | null
          pai_registro: string | null
          preco: number | null
          preco_negociavel: boolean | null
          publicado_em: string | null
          raca: string | null
          registro: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_genetica_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_genetica_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "vw_doadoras_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_catalogo_touros: {
        Row: {
          ativo: boolean | null
          catalogo_id: string | null
          descricao: string | null
          destaque: boolean | null
          doses_disponiveis: number | null
          foto_principal: string | null
          foto_url: string | null
          fotos_galeria: string[] | null
          mae_nome: string | null
          mae_registro: string | null
          nome: string | null
          ordem: number | null
          pai_nome: string | null
          pai_registro: string | null
          preco: number | null
          preco_negociavel: boolean | null
          proprietario: string | null
          publicado_em: string | null
          raca: string | null
          registro: string | null
          touro_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_genetica_touro_id_fkey"
            columns: ["touro_id"]
            isOneToOne: false
            referencedRelation: "touros"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_doadora_atributos_completos: {
        Row: {
          codigo: string | null
          created_at: string | null
          doadora_id: string | null
          label: string | null
          opcoes: Json | null
          raca: string | null
          tipo: string | null
          unidade: string | null
          updated_at: string | null
          valor: string | null
          valor_bool: boolean | null
          valor_num: number | null
          valor_select: string | null
          valor_text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doadora_atributos_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "doadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doadora_atributos_doadora_id_fkey"
            columns: ["doadora_id"]
            isOneToOne: false
            referencedRelation: "vw_doadoras_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_doadoras_resumo: {
        Row: {
          avo_materno_nome: string | null
          avo_paterno_nome: string | null
          classificacao: number | null
          created_at: string | null
          data_inicio_gestacao: string | null
          dias_desde_ultima_aspiracao: number | null
          fazenda_id: string | null
          id: string | null
          mae_nome: string | null
          nome: string | null
          pai_nome: string | null
          prenhe: boolean | null
          raca: string | null
          registro: string | null
          ultima_aspiracao_data: string | null
          ultima_aspiracao_total_oocitos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doadoras_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_receptoras_fazenda_atual: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          data_inicio_atual: string | null
          fazenda_id_atual: string | null
          fazenda_nome_atual: string | null
          receptora_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receptora_fazenda_historico_fazenda_id_fkey"
            columns: ["fazenda_id_atual"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptora_fazenda_historico_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptora_fazenda_historico_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
      vw_receptoras_protocolo_ativo: {
        Row: {
          ciclando_classificacao: string | null
          data_inclusao_protocolo: string | null
          protocolo_data_inicio: string | null
          protocolo_id_ativo: string | null
          protocolo_status: string | null
          qualidade_semaforo: number | null
          receptora_brinco: string | null
          receptora_id: string | null
          receptora_nome: string | null
          receptora_status_no_protocolo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_receptoras_protocolo_id_fkey"
            columns: ["protocolo_id_ativo"]
            isOneToOne: false
            referencedRelation: "protocolos_sincronizacao"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_transferencias_com_idade_embriao: {
        Row: {
          categoria_idade: string | null
          created_at: string | null
          data_fecundacao: string | null
          data_te: string | null
          embriao_id: string | null
          fazenda_id: string | null
          id: string | null
          idade_embriao_dias: number | null
          observacoes: string | null
          protocolo_receptora_id: string | null
          receptora_id: string | null
          status_te: string | null
          tecnico_responsavel: string | null
          tipo_te: string | null
          veterinario_responsavel: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_embrioes_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "embrioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_embriao_id_fkey"
            columns: ["embriao_id"]
            isOneToOne: false
            referencedRelation: "v_embrioes_disponiveis_te"
            referencedColumns: ["embriao_id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_protocolo_receptora_id_fkey"
            columns: ["protocolo_receptora_id"]
            isOneToOne: false
            referencedRelation: "protocolo_receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_protocolo_receptora_id_fkey"
            columns: ["protocolo_receptora_id"]
            isOneToOne: false
            referencedRelation: "v_protocolo_receptoras_status"
            referencedColumns: ["protocolo_receptora_id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "receptoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_embrioes_receptora_id_fkey"
            columns: ["receptora_id"]
            isOneToOne: false
            referencedRelation: "vw_receptoras_protocolo_ativo"
            referencedColumns: ["receptora_id"]
          },
        ]
      }
    }
    Functions: {
      confirmar_p2_batch: {
        Args: {
          p_data_confirmacao: string
          p_perdas_ids: string[]
          p_protocolo_id: string
          p_tecnico: string
          p_veterinario: string
        }
        Returns: Json
      }
      criar_protocolo_passo1_atomico: {
        Args: {
          p_data_inclusao: string
          p_data_inicio: string
          p_fazenda_id: string
          p_observacoes?: string
          p_receptoras_ids: string[]
          p_receptoras_observacoes?: string[]
          p_responsavel_inicio: string
        }
        Returns: string
      }
      decrementar_estoque_semen: {
        Args: { p_dose_id: string; p_quantidade: number }
        Returns: number
      }
      descartar_embrioes_d9: { Args: never; Returns: undefined }
      encerrar_sessao_te: {
        Args: { p_protocolo_receptora_ids: string[]; p_receptora_ids: string[] }
        Returns: undefined
      }
      fechar_protocolo: {
        Args: { p_protocolo_id: string }
        Returns: {
          data_limite: string
          data_te_prevista: string
          protocolo_id: string
          receptoras_marcadas_nao_utilizadas: number
          tes_realizadas: number
        }[]
      }
      gerar_identificacao_embriao: {
        Args: { p_classificacao: string; p_embriao_id: string }
        Returns: string
      }
      get_descartes_te_cliente:
        | {
            Args: { p_cliente_id: string; p_dias_atras?: number }
            Returns: {
              identificacao: string
              motivo_inapta: string
              receptora_id: string
              updated_at: string
            }[]
          }
        | {
            Args: { p_data_inicio?: string; p_fazenda_ids: string[] }
            Returns: {
              identificacao: string
              motivo_inapta: string
              receptora_id: string
              updated_at: string
            }[]
          }
      get_receptora_fazenda_atual: {
        Args: { p_receptora_id: string }
        Returns: string
      }
      get_receptoras_status: {
        Args: { p_fazenda_id: string }
        Returns: {
          dias_gestacao: number
          id: string
          identificacao: string
          nome: string
          numero_gestacoes: number
          raca: string
          status_calculado: string
          ultima_atualizacao: string
        }[]
      }
      get_resumo_lotes_fiv: {
        Args: { p_cliente_id: string }
        Returns: {
          codigo: string
          data_aspiracao: string
          id: string
          taxa_conversao: number
          total_embrioes: number
          total_oocitos: number
        }[]
      }
      get_user_cliente_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_operacional: { Args: never; Returns: boolean }
      is_cliente: { Args: never; Returns: boolean }
      match_embryos: {
        Args: {
          filter_lab_id?: string
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          best_frame_path: string
          classification: string
          id: string
          kinetic_harmony: number
          kinetic_intensity: number
          motion_map_path: string
          pregnancy_result: boolean
          similarity: number
          species: string
        }[]
      }
      match_embryos_v2: {
        Args: {
          alpha?: number
          beta?: number
          filter_lab_id?: string
          match_count?: number
          min_similarity?: number
          query_embedding: string
          query_kinetic_harmony?: number
          query_kinetic_intensity?: number
          query_kinetic_stability?: number
          visual_top_n?: number
        }
        Returns: {
          best_frame_path: string
          classification: string
          composite_score: number
          id: string
          kinetic_harmony: number
          kinetic_intensity: number
          kinetic_similarity: number
          kinetic_stability: number
          motion_map_path: string
          pregnancy_result: boolean
          species: string
          visual_similarity: number
        }[]
      }
      mover_receptora_fazenda: {
        Args: {
          p_data_mudanca?: string
          p_nova_fazenda_id: string
          p_observacoes?: string
          p_receptora_id: string
        }
        Returns: string
      }
      receptora_belongs_to_cliente: {
        Args: { p_receptora_id: string }
        Returns: boolean
      }
      registrar_aspiracao_batch: {
        Args: {
          p_data_aspiracao: string
          p_doadoras: Json
          p_fazenda_destino_id: string
          p_fazenda_id: string
          p_horario_inicio: string
          p_observacoes: string
          p_tecnico: string
          p_veterinario: string
        }
        Returns: Json
      }
      registrar_dg_batch: {
        Args: {
          p_data_diagnostico: string
          p_fazenda_id: string
          p_resultados: Json
          p_tecnico: string
          p_veterinario: string
        }
        Returns: Json
      }
      registrar_sexagem_batch: {
        Args: {
          p_data_sexagem: string
          p_fazenda_id: string
          p_resultados: Json
          p_tecnico: string
          p_veterinario: string
        }
        Returns: Json
      }
      registrar_te_batch: {
        Args: {
          p_data_te: string
          p_fazenda_id: string
          p_tecnico: string
          p_transferencias: Json
          p_veterinario: string
        }
        Returns: Json
      }
      reverter_import: { Args: { p_import_id: string }; Returns: Json }
      upsert_atributo_definicao: {
        Args: {
          p_codigo: string
          p_filtravel?: boolean
          p_label: string
          p_opcoes?: Json
          p_ordem?: number
          p_raca: string
          p_tipo: string
          p_unidade?: string
        }
        Returns: string
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
    Enums: {},
  },
} as const
