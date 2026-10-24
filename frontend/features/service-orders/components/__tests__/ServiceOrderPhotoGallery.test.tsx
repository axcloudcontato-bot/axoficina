import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemPhotosSection, VehiclePhotoSection } from '../ServiceOrderPhotoGallery';

vi.mock('../../hooks/use-service-orders', () => ({
  useServiceOrderPhotos: () => ({ data: { photos: [] }, isLoading: false, isError: false }),
  useUploadServiceOrderPhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeleteServiceOrderPhoto: () => ({ isPending: false, mutate: vi.fn() }),
  useServiceOrderPhotoBlob: () => ({ data: undefined }),
}));

const item = { id: 'item-1', serviceOrderId: 'order-1', type: 'PART' as const, description: 'Pastilha de freio', quantity: 1, unitPriceCents: 1000, lineTotalCents: 1000, createdAt: new Date().toISOString() };

describe('VehiclePhotoSection', () => {
  it('shows all 6 required angle slots for the entry section', () => {
    render(<VehiclePhotoSection serviceOrderId="order-1" category="ENTRY" canManage />);
    expect(screen.getByRole('heading', { name: /fotos de entrada do veículo/i })).toBeInTheDocument();
    expect(screen.getByText('Frente')).toBeInTheDocument();
    expect(screen.getByText('Traseira')).toBeInTheDocument();
    expect(screen.getByText('Lateral esquerda')).toBeInTheDocument();
    expect(screen.getByText('Lateral direita')).toBeInTheDocument();
    expect(screen.getByText('Estepe/porta-malas')).toBeInTheDocument();
    expect(screen.getByText('Painel (km)')).toBeInTheDocument();
    expect(screen.getAllByText('Câmera')).toHaveLength(6);
    expect(screen.getAllByText('Arquivo')).toHaveLength(6);
  });

  it('shows all 6 required angle slots for the exit section', () => {
    render(<VehiclePhotoSection serviceOrderId="order-1" category="EXIT" canManage />);
    expect(screen.getByRole('heading', { name: /fotos de saída do veículo/i })).toBeInTheDocument();
    expect(screen.getAllByText('Câmera')).toHaveLength(6);
    expect(screen.getAllByText('Arquivo')).toHaveLength(6);
  });

  it('hides upload actions for users without management permission', () => {
    render(<VehiclePhotoSection serviceOrderId="order-1" category="ENTRY" canManage={false} />);
    expect(screen.queryByText('Câmera')).not.toBeInTheDocument();
    expect(screen.queryByText('Arquivo')).not.toBeInTheDocument();
  });
});

describe('ItemPhotosSection', () => {
  it('shows an empty state when the order has no items yet', () => {
    render(<ItemPhotosSection serviceOrderId="order-1" items={[]} canManage />);
    expect(screen.getByText(/nenhum item lançado nesta os ainda/i)).toBeInTheDocument();
  });

  it('shows a before/after slot pair for each service order item', () => {
    render(<ItemPhotosSection serviceOrderId="order-1" items={[item]} canManage />);
    expect(screen.getByText('Pastilha de freio')).toBeInTheDocument();
    expect(screen.getByText(/antes \(problema\)/i)).toBeInTheDocument();
    expect(screen.getByText(/depois \(solução\)/i)).toBeInTheDocument();
  });

  it('hides upload actions for users without management permission', () => {
    render(<ItemPhotosSection serviceOrderId="order-1" items={[item]} canManage={false} />);
    expect(screen.queryByText('Câmera')).not.toBeInTheDocument();
    expect(screen.queryByText('Arquivo')).not.toBeInTheDocument();
  });
});

describe('PhotoSlot capture inputs', () => {
  it('offers a camera input (rear camera) and a regular file input per slot', () => {
    const { container } = render(<ItemPhotosSection serviceOrderId="order-1" items={[item]} canManage />);
    expect(container.querySelectorAll('input[type="file"][capture="environment"]')).toHaveLength(2);
    expect(container.querySelectorAll('input[type="file"]:not([capture])')).toHaveLength(2);
  });
});
