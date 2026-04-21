export type DeliveryStage = 'init' | 'design' | 'prototype' | 'development' | 'testing' | 'deployment' | 'done';

export interface ArtifactStatus {
  hasPrd: boolean;
  hasDesign: boolean;
  hasPrototype: boolean;
  hasSourceCode: boolean;
  hasTests: boolean;
}

export interface DeliveryState {
  currentStage: DeliveryStage;
  artifacts: ArtifactStatus;
  lastUpdated: string;
}
