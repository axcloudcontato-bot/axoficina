import { BadRequestException } from '@nestjs/common';
import { WhatsAppChatManager } from './whatsapp-chat.manager';

const connection = { baseUrl: 'https://chat.example.com/api', sessionId: 'oficina-a', apiKey: 'key' };

function build() {
  const whatsapp = {
    getConnection: jest.fn().mockResolvedValue(connection),
    listChats: jest.fn(),
    chatMessages: jest.fn(),
    markChatRead: jest.fn().mockResolvedValue(undefined),
    sendText: jest.fn().mockResolvedValue(undefined),
    mediaFile: jest.fn().mockResolvedValue({ body: Buffer.from('x'), contentType: 'image/jpeg' }),
  };
  const customers = { allForMatching: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Maria Souza', phone: '(11) 98888-7777' }]) };
  return { manager: new WhatsAppChatManager(whatsapp as never, customers as never), whatsapp, customers };
}

describe('WhatsAppChatManager', () => {
  it('refuses to open the chat when WhatsApp is not active for the workshop', async () => {
    const { manager, whatsapp } = build();
    whatsapp.getConnection.mockResolvedValue(null);
    await expect(manager.conversations('tenant-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(manager.send('tenant-1', '5511988887777@s.whatsapp.net', 'Oi')).rejects.toBeInstanceOf(BadRequestException);
    expect(whatsapp.sendText).not.toHaveBeenCalled();
  });

  it('always reads the session of the signed-in workshop', async () => {
    const { manager, whatsapp } = build();
    whatsapp.listChats.mockResolvedValue([]);
    await manager.conversations('tenant-1');
    expect(whatsapp.getConnection).toHaveBeenCalledWith('tenant-1');
    expect(whatsapp.listChats).toHaveBeenCalledWith(connection);
  });

  it('lists only one-to-one chats and links them to registered customers', async () => {
    const { manager, whatsapp } = build();
    whatsapp.listChats.mockResolvedValue([
      { jid: '5511988887777@s.whatsapp.net', name: null, notify: 'Maria', lastMessage: { content: 'Bom dia', type: 'TEXT', timestamp: '2026-11-20T13:00:00.000Z' } },
      { jid: '120363408711191097@g.us', name: 'Grupo', lastMessage: { content: 'x', type: 'TEXT', timestamp: '2026-11-20T12:00:00.000Z' } },
      { jid: 'status@broadcast' },
      { jid: '82391095840940@lid', name: null, notify: null, lastMessage: { content: null, type: 'IMAGE', timestamp: '2026-11-20T11:00:00.000Z' } },
    ]);
    const { conversations } = await manager.conversations('tenant-1');
    expect(conversations).toEqual([
      { jid: '5511988887777@s.whatsapp.net', phone: '5511988887777', name: 'Maria', customer: { id: 'c1', name: 'Maria Souza' }, lastMessage: { text: 'Bom dia', type: 'TEXT', at: '2026-11-20T13:00:00.000Z' } },
      { jid: '82391095840940@lid', lastMessage: { text: undefined, type: 'IMAGE', at: '2026-11-20T11:00:00.000Z' } },
    ]);
  });

  it('returns the messages, marks the chat read and exposes only media of its own session', async () => {
    const { manager, whatsapp } = build();
    whatsapp.markChatRead.mockRejectedValue(new Error('offline'));
    whatsapp.chatMessages.mockResolvedValue([
      { id: 'db1', keyId: 'K1', fromMe: false, pushName: 'Maria', type: 'IMAGE', content: 'Foto do painel', timestamp: '2026-11-20T13:00:00.000Z', status: 'READ', mediaUrl: '/api/media/oficina-a-K1.jpg' },
      { id: 'db2', keyId: 'K2', fromMe: true, type: 'TEXT', content: 'Recebido', timestamp: '2026-11-20T13:01:00.000Z', mediaUrl: '/api/media/oficina-b-K9.jpg' },
      { id: 'db3', keyId: 'K3', fromMe: false, type: 'POLL', content: null, timestamp: 'invalid' },
    ]);
    const result = await manager.messages('tenant-1', '5511988887777@s.whatsapp.net');
    expect(whatsapp.markChatRead).toHaveBeenCalledWith(connection, '5511988887777@s.whatsapp.net');
    expect(result.conversation).toEqual({ jid: '5511988887777@s.whatsapp.net', phone: '5511988887777', name: 'Maria', customer: { id: 'c1', name: 'Maria Souza' } });
    expect(result.messages).toEqual([
      { id: 'K1', fromMe: false, type: 'IMAGE', text: 'Foto do painel', at: '2026-11-20T13:00:00.000Z', status: 'READ', media: 'oficina-a-K1.jpg' },
      { id: 'K2', fromMe: true, type: 'TEXT', text: 'Recebido', at: '2026-11-20T13:01:00.000Z' },
      { id: 'K3', fromMe: false, type: 'OTHER', text: undefined, at: '1970-01-01T00:00:00.000Z' },
    ]);
  });

  it('sends text through the workshop session', async () => {
    const { manager, whatsapp } = build();
    await expect(manager.send('tenant-1', '5511988887777@s.whatsapp.net', 'Seu carro está pronto')).resolves.toEqual({ sent: true });
    expect(whatsapp.sendText).toHaveBeenCalledWith(connection, '5511988887777@s.whatsapp.net', 'Seu carro está pronto');
  });

  it('opens media through the workshop session', async () => {
    const { manager, whatsapp } = build();
    await manager.media('tenant-1', 'oficina-a-K1.jpg');
    expect(whatsapp.mediaFile).toHaveBeenCalledWith(connection, 'oficina-a-K1.jpg');
  });
});
