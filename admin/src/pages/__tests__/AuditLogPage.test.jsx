import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditLogPage from '../AuditLogPage';
import { renderWithProviders, mockFetchFor, loginAs } from '../../test/renderWithProviders';

const LOGS_PAGE1 = {
  data: [
    { id: 'l1', actorName: 'Admin Real', actorEmail: 'admin@dravennx.com', action: 'coupon.deleted', details: { code: 'PROMO10' }, createdAt: '2026-08-17T10:00:00Z' },
    { id: 'l2', actorName: 'Admin Real', actorEmail: 'admin@dravennx.com', action: 'user.role_changed', details: { targetEmail: 'cliente@teste.com', newRole: 'operator' }, createdAt: '2026-08-17T09:00:00Z' },
    { id: 'l3', actorName: 'Admin Real', actorEmail: 'admin@dravennx.com', action: 'product.bulk_price_adjusted', details: { ids: ['p1', 'p2'], percentage: 10, updated: 2 }, createdAt: '2026-08-17T08:00:00Z' },
  ],
  total: 3, page: 1, pageSize: 30,
};

describe('AuditLogPage', () => {
  beforeEach(() => {
    localStorage.clear();
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    global.fetch = vi.fn(mockFetchFor([['admin/audit-logs', LOGS_PAGE1]]));
  });

  it('mostra o autor de cada ação (nome e e-mail)', async () => {
    renderWithProviders(<AuditLogPage />);
    expect(await screen.findAllByText('Admin Real')).toHaveLength(3);
    expect(screen.getAllByText('admin@dravennx.com')).toHaveLength(3);
  });

  it('traduz o código da ação pra um rótulo legível, em vez do nome técnico', async () => {
    renderWithProviders(<AuditLogPage />);
    expect(await screen.findByText('Excluiu cupom')).toBeInTheDocument();
    expect(screen.getByText('Alterou perfil de usuário')).toBeInTheDocument();
    expect(screen.queryByText('coupon.deleted')).not.toBeInTheDocument();
  });

  it('mostra os detalhes específicos de cada tipo de ação', async () => {
    renderWithProviders(<AuditLogPage />);
    expect(await screen.findByText('PROMO10')).toBeInTheDocument();
    expect(screen.getByText('cliente@teste.com → operator')).toBeInTheDocument();
    expect(screen.getByText(/\+10% em 2 produto\(s\)/)).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há nenhum registro', async () => {
    global.fetch = vi.fn(mockFetchFor([['admin/audit-logs', { data: [], total: 0, page: 1, pageSize: 30 }]]));
    renderWithProviders(<AuditLogPage />);
    expect(await screen.findByText(/nenhuma ação registrada/i)).toBeInTheDocument();
  });

  it('a paginação não aparece quando cabe tudo numa página só', async () => {
    renderWithProviders(<AuditLogPage />);
    await screen.findAllByText('Admin Real');
    expect(screen.queryByText(/página 1 de/i)).not.toBeInTheDocument();
  });

  it('avança de página ao clicar em "Próxima" quando há mais de uma página', async () => {
    global.fetch = vi.fn(mockFetchFor([['admin/audit-logs', { ...LOGS_PAGE1, total: 40 }]]));
    const user = userEvent.setup();
    renderWithProviders(<AuditLogPage />);

    await screen.findAllByText('Admin Real');
    expect(screen.getByText(/página 1 de 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /próxima/i }));

    const secondCall = global.fetch.mock.calls.find(([url]) => String(url).includes('page=2'));
    expect(secondCall).toBeTruthy();
  });
});
