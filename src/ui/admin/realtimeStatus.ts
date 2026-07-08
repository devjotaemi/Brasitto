export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'unavailable';

type RealtimeStatusPresentation = {
  label: string;
  className: string;
};

export const getRealtimeStatusPresentation = (
  status: RealtimeConnectionStatus,
): RealtimeStatusPresentation => {
  if (status === 'connected') {
    return {
      label: 'Conectado',
      className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    };
  }

  if (status === 'connecting') {
    return {
      label: 'Conectando',
      className: 'border-amber-300 bg-amber-50 text-amber-950',
    };
  }

  if (status === 'disconnected') {
    return {
      label: 'Desconectado',
      className: 'border-zinc-300 bg-white text-zinc-700',
    };
  }

  if (status === 'error') {
    return {
      label: 'Indisponivel',
      className: 'border-rose-300 bg-rose-50 text-rose-900',
    };
  }

  if (status === 'unavailable') {
    return {
      label: 'Indisponivel',
      className: 'border-zinc-300 bg-white text-zinc-700',
    };
  }

  return {
    label: 'Indisponivel',
    className: 'border-zinc-300 bg-white text-zinc-700',
  };
};
