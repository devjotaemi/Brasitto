import { describe, expect, it } from 'vitest';
import { getCustomerUserFacingErrorMessage } from '../../src/ui/customer/CustomerApp';

describe('customer errors', () => {
  it('traduz erro de pedido ativo retornado pelo Supabase', () => {
    const message = getCustomerUserFacingErrorMessage(
      {
        code: 'P0001',
        message: 'Customer already has an active order',
      },
      'Nao foi possivel enviar o pedido.',
    );

    expect(message).toBe(
      'Voce ja tem um pedido realizado com este telefone. Consulte ou cancele o pedido atual antes de fazer outro.',
    );
  });
});
