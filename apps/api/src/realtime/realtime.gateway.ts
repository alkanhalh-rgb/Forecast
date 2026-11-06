import { OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { loadConfig } from '../config';
import { PrismaService } from '../common/prisma.service';
import { SESSION_COOKIE, verifySession } from '../common/session';
import { RealtimeService } from './realtime.service';

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export const questionRoom = (id: string) => `q:${id}`;
export const userRoom = (id: string) => `u:${id}`;

@WebSocketGateway({ cors: { origin: loadConfig().WEB_ORIGIN.split(','), credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  constructor(private rt: RealtimeService, private prisma: PrismaService) {}

  afterInit(server: Server) {
    this.rt.attach(server);
  }

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string | undefined) ?? cookieValue(client.handshake.headers.cookie, SESSION_COOKIE);
    const userId = token ? await verifySession(token) : null;
    client.data.userId = userId;
    if (userId) await client.join(userRoom(userId));
  }

  /** Crowd % is only streamed to users who already forecast on the question. */
  @SubscribeMessage('subscribe')
  async subscribe(client: Socket, payload: { questionId?: string }) {
    const userId = client.data.userId as string | null;
    if (!userId || !payload?.questionId) return { ok: false };
    const f = await this.prisma.forecast.findUnique({ where: { userId_questionId: { userId, questionId: payload.questionId } } });
    if (!f) return { ok: false };
    await client.join(questionRoom(payload.questionId));
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(client: Socket, payload: { questionId?: string }) {
    if (payload?.questionId) await client.leave(questionRoom(payload.questionId));
    return { ok: true };
  }
}
