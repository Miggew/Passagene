/**
 * Schemas de validação Zod centralizados
 * - Mensagens de erro em português
 * - Reutilizáveis em formulários
 */

import { z } from 'zod';

// ============================================
// MENSAGENS PADRÃO
// ============================================

export const errorMessages = {
  required: 'Campo obrigatório',
  minLength: (min: number) => `Mínimo de ${min} caracteres`,
  maxLength: (max: number) => `Máximo de ${max} caracteres`,
  invalidEmail: 'E-mail inválido',
  invalidPhone: 'Telefone inválido',
  invalidDate: 'Data inválida',
  positiveNumber: 'Deve ser um número positivo',
  invalidFormat: 'Formato inválido',
};

// ============================================
// SCHEMAS BÁSICOS REUTILIZÁVEIS
// ============================================

export const requiredString = z
  .string({ required_error: errorMessages.required })
  .min(1, errorMessages.required);

// String opcional que aceita string vazia
export const optionalString = z.string();

// Helper para criar string opcional com max length
export const optionalStringMax = (max: number) =>
  z.string().max(max, errorMessages.maxLength(max)).optional().or(z.literal(''));

export const requiredEmail = z
  .string({ required_error: errorMessages.required })
  .email(errorMessages.invalidEmail);

export const optionalEmail = z
  .string()
  .email(errorMessages.invalidEmail)
  .optional()
  .or(z.literal(''));

export const phoneSchema = z
  .string()
  .regex(/^(\(\d{2}\)\s?)?\d{4,5}-?\d{4}$/, errorMessages.invalidPhone)
  .optional()
  .or(z.literal(''));

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, errorMessages.invalidDate)
  .optional()
  .or(z.literal(''));

export const requiredDate = z
  .string({ required_error: errorMessages.required })
  .regex(/^\d{4}-\d{2}-\d{2}$/, errorMessages.invalidDate);

export const positiveNumber = z
  .number({ required_error: errorMessages.required })
  .positive(errorMessages.positiveNumber);

export const optionalPositiveNumber = z
  .number()
  .positive(errorMessages.positiveNumber)
  .optional()
  .nullable();

// ============================================
// RECEPTORA
// ============================================

export const receptoraSchema = z.object({
  identificacao: requiredString.max(50, errorMessages.maxLength(50)),
  nome: optionalString.transform((v) => v || undefined),
});

export type ReceptoraInput = z.infer<typeof receptoraSchema>;

// ============================================
// DOADORA
// ============================================

export const doadoraSchema = z.object({
  registro: requiredString.max(100, errorMessages.maxLength(100)),
  nome: optionalString.transform((v) => v || undefined),
  raca: requiredString,
  fazenda_id: requiredString,
  disponivel_aspiracao: z.boolean().default(true),
  // Campos opcionais
  data_nascimento: dateSchema,
  pai: optionalString,
  mae: optionalString,
  observacoes: optionalString,
  // Campos específicos de raça (Gir)
  gpta: optionalString,
  controle_leiteiro: optionalString,
  beta_caseina: optionalString,
  link_abcz: optionalString,
  classificacao_genetica: z.enum(['1_estrela', '2_estrelas', '3_estrelas', 'diamante']).optional(),
});

export type DoadoraInput = z.infer<typeof doadoraSchema>;

// Schema simplificado para criação rápida
export const doadoraCreateSchema = z.object({
  registro: requiredString.max(100, errorMessages.maxLength(100)),
  raca: requiredString,
});

export type DoadoraCreateInput = z.infer<typeof doadoraCreateSchema>;

// ============================================
// TOURO
// ============================================

export const touroSchema = z.object({
  nome: requiredString.max(100, errorMessages.maxLength(100)),
  registro: optionalString.transform((v) => v || undefined),
  raca: requiredString,
  // Campos opcionais
  central: optionalString,
  codigo_central: optionalString,
  observacoes: optionalString,
  pai: optionalString,
  mae: optionalString,
  avo_materno: optionalString,
  // Campos específicos de raça (Gir)
  gpta: optionalString,
  controle_leiteiro: optionalString,
  beta_caseina: optionalString,
  link_abcz: optionalString,
});

export type TouroInput = z.infer<typeof touroSchema>;

// ============================================
// FAZENDA
// ============================================

export const fazendaSchema = z.object({
  nome: requiredString.max(100, errorMessages.maxLength(100)),
  sigla: optionalStringMax(10),
  cliente_id: requiredString,
  // Localização
  cidade: optionalString,
  estado: optionalString,
  // Contato
  responsavel: optionalString,
  telefone: phoneSchema,
  // Coordenadas
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type FazendaInput = z.infer<typeof fazendaSchema>;

// ============================================
// CLIENTE
// ============================================

export const clienteSchema = z.object({
  nome: requiredString.max(100, errorMessages.maxLength(100)),
  email: optionalEmail,
  telefone: phoneSchema,
  cpf_cnpj: optionalString,
  endereco: optionalString,
  cidade: optionalString,
  estado: optionalString,
  observacoes: optionalString,
});

export type ClienteInput = z.infer<typeof clienteSchema>;

// ============================================
// PROTOCOLO
// ============================================

export const protocoloSchema = z.object({
  nome: requiredString.max(100, errorMessages.maxLength(100)),
  fazenda_id: requiredString,
  data_inicio: requiredDate,
  observacoes: optionalString,
});

export type ProtocoloInput = z.infer<typeof protocoloSchema>;

// ============================================
// NASCIMENTO
// ============================================

export const nascimentoSchema = z.object({
  data_nascimento: requiredDate,
  sexo: z.enum(['MACHO', 'FEMEA']),
  peso: optionalPositiveNumber,
  observacoes: optionalString,
});

export type NascimentoInput = z.infer<typeof nascimentoSchema>;

// ============================================
// HELPER: Validar e retornar erros formatados
// ============================================

export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });

  return { success: false, errors };
}
