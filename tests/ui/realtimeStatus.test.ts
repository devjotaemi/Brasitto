import { describe, expect, it } from 'vitest';
import {
  getRealtimeStatusPresentation,
  type RealtimeConnectionStatus,
} from '../../src/ui/admin/realtimeStatus';

describe('getRealtimeStatusPresentation', () => {
  it.each<[RealtimeConnectionStatus, string]>([
    ['connected', 'Conectado'],
    ['connecting', 'Conectando'],
    ['disconnected', 'Desconectado'],
    ['error', 'Indisponivel'],
    ['unavailable', 'Indisponivel'],
    ['idle', 'Indisponivel'],
  ])('exibe o texto esperado para %s', (status, expectedLabel) => {
    expect(getRealtimeStatusPresentation(status).label).toBe(expectedLabel);
  });
});
