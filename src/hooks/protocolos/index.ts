/**
 * Exportação centralizada dos hooks de protocolos
 */

export { useProtocoloWizardData } from './useProtocoloWizardData';
export type {
  ReceptoraLocal,
  ReceptoraComStatus,
  ReceptoraFiltrada,
  ProtocoloFormData,
  UseProtocoloWizardDataReturn,
} from './useProtocoloWizardData';

export { useProtocoloWizardReceptoras } from './useProtocoloWizardReceptoras';
export type {
  AddReceptoraFormData,
  CreateReceptoraFormData,
  UseProtocoloWizardReceptorasProps,
  UseProtocoloWizardReceptorasReturn,
} from './useProtocoloWizardReceptoras';

export { useProtocoloWizardSubmit } from './useProtocoloWizardSubmit';
export type {
  UseProtocoloWizardSubmitProps,
  UseProtocoloWizardSubmitReturn,
} from './useProtocoloWizardSubmit';

export { useProtocolosData } from './useProtocolosData';
export type {
  ProtocoloWithFazenda,
  ProtocolosFiltros,
  UseProtocolosDataReturn,
} from './useProtocolosData';
