import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemPhotosSection, VehiclePhotoSection } from '../ServiceOrderPhotoGallery';
import { compressImageFile, ImagePreparationError } from '@/lib/compress-image';

const { mutateAsync, photoQuery } = vi.hoisted(() => ({ mutateAsync: vi.fn(), photoQuery: vi.fn() }));
vi.mock('@/lib/compress-image', async (original) => ({ ...await original<typeof import('@/lib/compress-image')>(), compressImageFile: vi.fn() }));

vi.mock('../../hooks/use-service-orders', () => ({
  useServiceOrderPhotos: () => ({ data: { photos: [] }, isLoading: false, isError: false }),
  useUploadServiceOrderPhoto: () => ({ isPending: false, mutateAsync }),
  useDeleteServiceOrderPhoto: () => ({ isPending: false, mutate: vi.fn() }),
  useServiceOrderPhotoBlob: () => photoQuery(),
}));

beforeEach(() => { vi.clearAllMocks(); photoQuery.mockReturnValue({ data: undefined }); });

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
  it('asks for photos only on parts, not on labor or products', () => {
    const labor = { ...item, id: 'item-2', type: 'LABOR' as const, description: 'Alinhamento' };
    const product = { ...item, id: 'item-3', type: 'PRODUCT' as const, description: 'Fluido de freio' };
    render(<ItemPhotosSection serviceOrderId="order-1" items={[item, labor, product]} canManage />);
    expect(screen.getByText('Pastilha de freio')).toBeInTheDocument();
    expect(screen.queryByText('Alinhamento')).not.toBeInTheDocument();
    expect(screen.queryByText('Fluido de freio')).not.toBeInTheDocument();
  });

  it('explains that no photo is needed when the order has only labor and products', () => {
    render(<ItemPhotosSection serviceOrderId="order-1" items={[{ ...item, type: 'LABOR' as const }]} canManage />);
    expect(screen.getByText(/serviços e produtos não exigem foto/i)).toBeInTheDocument();
  });

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

  it('blocks repeated captures while preparing, then confirms the saved upload', async () => {
    let prepare!: (file: File) => void;
    vi.mocked(compressImageFile).mockReturnValue(new Promise<File>((resolve) => { prepare = resolve; }));
    mutateAsync.mockResolvedValue({});
    render(<VehiclePhotoSection serviceOrderId="order-1" category="ENTRY" canManage />);
    const slot = screen.getByRole('group', { name: /^Foto: Frente$/ });
    const input = slot.querySelector('input[capture]')!;
    const file = new File(['camera'], 'camera.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(within(slot).getByRole('status')).toHaveTextContent('Preparando foto');
    expect(within(slot).getByRole('button', { name: 'Câmera' })).toBeDisabled();
    fireEvent.change(input, { target: { files: [file] } });
    expect(compressImageFile).toHaveBeenCalledTimes(1);
    expect(mutateAsync).not.toHaveBeenCalled();
    prepare(file);
    await waitFor(() => expect(within(slot).getByRole('status')).toHaveTextContent('Foto salva na OS.'));
    expect(mutateAsync).toHaveBeenCalledWith({ serviceOrderId: 'order-1', category: 'ENTRY', angle: 'FRONT', file });
    expect(within(slot).getByRole('button', { name: 'Câmera' })).toBeEnabled();
  });

  it('keeps the prepared photo for a manual retry when the server refuses the upload', async () => {
    const file = new File(['small jpeg'], 'camera.jpg', { type: 'image/jpeg' });
    vi.mocked(compressImageFile).mockResolvedValue(file);
    mutateAsync.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
    render(<VehiclePhotoSection serviceOrderId="order-1" category="ENTRY" canManage />);
    const slot = screen.getByRole('group', { name: /^Foto: Frente$/ });
    fireEvent.change(slot.querySelector('input[capture]')!, { target: { files: [file] } });
    await waitFor(() => expect(within(slot).getByRole('alert')).toHaveTextContent('Não foi possível enviar a foto.'));
    fireEvent.click(within(slot).getByRole('button', { name: 'Tentar enviar novamente' }));
    await waitFor(() => expect(within(slot).getByRole('status')).toHaveTextContent('Foto salva na OS.'));
    expect(compressImageFile).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1][0].file).toBe(file);
  });

  it('shows preparation errors inline and never uploads an unsupported original', async () => {
    vi.mocked(compressImageFile).mockRejectedValue(new ImagePreparationError('Selecione uma cópia em JPEG.'));
    render(<VehiclePhotoSection serviceOrderId="order-1" category="ENTRY" canManage />);
    const slot = screen.getByRole('group', { name: /^Foto: Frente$/ });
    fireEvent.change(slot.querySelector('input[capture]')!, { target: { files: [new File(['heic'], 'camera.heic', { type: 'image/heic' })] } });
    await waitFor(() => expect(within(slot).getByRole('alert')).toHaveTextContent('Selecione uma cópia em JPEG.'));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(within(slot).queryByRole('button', { name: 'Tentar enviar novamente' })).not.toBeInTheDocument();
  });
});
