/**
 * Header com indicador de passos do protocolo
 */

import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';

interface ProtocoloStepHeaderProps {
  currentStep: 1 | 2;
  title: string;
  subtitle?: string;
  onBack: () => void;
  onExit?: () => void;
  showExit?: boolean;
}

export function ProtocoloStepHeader({
  currentStep,
  title,
  subtitle,
  onBack,
  onExit,
  showExit = true,
}: ProtocoloStepHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        <StepIndicator step={1} currentStep={currentStep} label="1º Passo" />
        <div className="w-16 h-0.5 bg-border" />
        <StepIndicator step={2} currentStep={currentStep} label="2º Passo" />
      </div>

      {/* Title and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {showExit && onExit && (
          <Button variant="outline" onClick={onExit}>
            <X className="w-4 h-4 mr-2" />
            Sair
          </Button>
        )}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  step: 1 | 2;
  currentStep: 1 | 2;
  label: string;
}

function StepIndicator({ step, currentStep, label }: StepIndicatorProps) {
  const isActive = step === currentStep;
  const isCompleted = step < currentStep;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
          transition-colors
          ${isActive
            ? 'bg-primary text-primary-foreground'
            : isCompleted
              ? 'bg-primary-dark text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }
        `}
      >
        {isCompleted ? '✓' : step}
      </div>
      <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}
