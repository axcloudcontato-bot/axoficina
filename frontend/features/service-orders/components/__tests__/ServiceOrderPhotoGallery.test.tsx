import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServiceOrderPhotoGallery } from '../ServiceOrderPhotoGallery';

vi.mock('../../hooks/use-service-orders', () => ({
  useServiceOrderPhotos: () => ({ data: { photos: [] }, isLoading: false, isError: false }),
  useUploadServiceOrderPhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeleteServiceOrderPhoto: () => ({ isPending: false, mutate: vi.fn() }),
  useServiceOrderPhotoBlob: () => ({ data: undefined }),
}));

const item = { id: 'item-1', serviceOrderId: 'order-1', type: 'PART' as const, description: 'Pastilha de freio', quantity: 1, unitPriceCents: 1000, lineTotalCents: 1000, createdAt: new Date().toISOString() };

describe('ServiceOrderPhotoGallery', () => {
  it('shows the entry and exit sections with all 6 required angle slots each', () => {
    render(<ServiceOrderPhotoGallery serviceOrderId="order-1" canManage />);
    expect(screen.getByRole('heading', { name: /entrada do veículo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /saída do veículo/i })).toBeInTheDocument();
    expect(screen.getAllByText('Frente')).toHaveLength(2);
    expect(screen.getAllByText('Traseira')).toHaveLength(2);
    expect(screen.getAllByText('Lateral esquerda')).toHaveLength(2);
    expect(screen.getAllByText('Lateral direita')).toHaveLength(2);
    expect(screen.getAllByText('Estepe/porta-malas')).toHaveLength(2);
    expect(screen.getAllByText('Painel (km)')).toHaveLength(2);
    expect(screen.getAllByText('Adicionar')).toHaveLength(12);
  });

  it('shows an empty state for item photos when the order has no items yet', () => {
    render(<ServiceOrderPhotoGallery serviceOrderId="order-1" canManage />);
    expect(screen.getByText(/nenhum item lançado nesta os ainda/i)).toBeInTheDocument();
  });

  it('shows a before/after slot pair for each service order item', () => {
    render(<ServiceOrderPhotoGallery serviceOrderId="order-1" canManage items={[item]} />);
    expect(screen.getByText('Pastilha de freio')).toBeInTheDocument();
    expect(screen.getByText(/antes \(problema\)/i)).toBeInTheDocument();
    expect(screen.getByText(/depois \(solução\)/i)).toBeInTheDocument();
  });

  it('hides upload actions for users without management permission', () => {
    render(<ServiceOrderPhotoGallery serviceOrderId="order-1" canManage={false} items={[item]} />);
    expect(screen.queryByText('Adicionar')).not.toBeInTheDocument();
  });
});
