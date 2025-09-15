import { CollectionFieldState, EntityFormCallbackActions } from './formCustomization';

// State machine action configuration
export type StateMachineAction = {
  mutation: string;
  from: string;
  to: string;
  onBeforeSubmit?: (
    formData: Record<string, unknown>,
    collectionChanges: Record<string, CollectionFieldState>,
    transformedData: Record<string, unknown>,
    actions: EntityFormCallbackActions
  ) => Promise<{ shouldProceed: boolean; error?: string }>;
  onSuccess?: (
    result: unknown,
    formData: Record<string, unknown>,
    collectionChanges: Record<string, CollectionFieldState>,
    transformedData: Record<string, unknown>,
    actions: EntityFormCallbackActions
  ) => Promise<void>;
  onError?: (
    error: Error,
    formData: Record<string, unknown>,
    collectionChanges: Record<string, CollectionFieldState>,
    transformedData: Record<string, unknown>,
    actions: EntityFormCallbackActions
  ) => Promise<void>;
};

// State machine configuration for an entity
export type EntityStateMachineConfig = {
  actions: Record<string, StateMachineAction>;
};

// Registry for state machine configurations
const stateMachineRegistry = new Map<string, EntityStateMachineConfig>();

/**
 * Register state machine configuration for an entity
 * @param entityType - The entity type name (e.g., "season")
 * @param config - The state machine configuration
 */
export function registerEntityStateMachine(
  entityType: string,
  config: EntityStateMachineConfig
): void {
  console.log(`Registering state machine for ${entityType}:`, config);
  stateMachineRegistry.set(entityType, config);
}

/**
 * Get state machine configuration for an entity
 * @param entityType - The entity type name
 * @returns The state machine configuration or undefined if not registered
 */
export function getEntityStateMachine(entityType: string): EntityStateMachineConfig | undefined {
  return stateMachineRegistry.get(entityType);
}

/**
 * Get available state machine actions for an entity in a specific state
 * @param entityType - The entity type name
 * @param currentState - The current state of the entity
 * @returns Array of available actions
 */
export function getAvailableStateMachineActions(
  entityType: string,
  currentState: string
): Array<{ name: string; action: StateMachineAction }> {
  const config = stateMachineRegistry.get(entityType);
  if (!config) return [];

  return Object.entries(config.actions)
    .filter(([, action]) => action.from === currentState)
    .map(([name, action]) => ({ name, action }));
}

/**
 * Check if an entity type has state machine support
 * @param entityType - The entity type name
 * @returns True if the entity has state machine support
 */
export function hasStateMachineSupport(entityType: string): boolean {
  return stateMachineRegistry.has(entityType);
}
