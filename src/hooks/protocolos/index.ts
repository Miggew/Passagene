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
  FiltroDataTipo,
  UseProtocolosDataReturn,
} from './useProtocolosData';

export { useProtocoloData, type ReceptoraWithStatus, type ReceptoraParaSelecao } from './useProtocoloData';
export { useAddReceptoraProtocolo } from './useAddReceptoraProtocolo';
export type { AddReceptoraFormData as AddReceptoraProtocoloFormData } from './useAddReceptoraProtocolo';
export { useCreateReceptoraProtocolo } from './useCreateReceptoraProtocolo';
export type { CreateReceptoraFormData as CreateReceptoraProtocoloFormData } from './useCreateReceptoraProtocolo';
