import { useState, useCallback } from 'react';
import { CollectionFieldState } from '../CollectionFieldGrid';

export interface FormCollectionState {
  [fieldName: string]: CollectionFieldState;
}

export function useCollectionState() {
  const [collectionStates, setCollectionStates] = useState<FormCollectionState>({});

  const updateCollectionState = useCallback((fieldName: string, newState: CollectionFieldState) => {
    setCollectionStates(prev => ({
      ...prev,
      [fieldName]: newState
    }));
  }, []);

  const getCollectionState = useCallback((fieldName: string): CollectionFieldState => {
    return collectionStates[fieldName] || { added: [], modified: [], deleted: [] };
  }, [collectionStates]);

  const resetCollectionState = useCallback((fieldName: string) => {
    setCollectionStates(prev => {
      const newStates = { ...prev };
      delete newStates[fieldName];
      return newStates;
    });
  }, []);

  const resetAllCollectionStates = useCallback(() => {
    setCollectionStates({});
  }, []);

  const getCollectionChanges = useCallback(() => {
    return collectionStates;
  }, [collectionStates]);

  return {
    collectionStates,
    updateCollectionState,
    getCollectionState,
    resetCollectionState,
    resetAllCollectionStates,
    getCollectionChanges
  };
}
