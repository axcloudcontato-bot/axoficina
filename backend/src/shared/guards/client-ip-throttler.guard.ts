import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Behind Cloudflare Tunnel and Caddy every request reaches the API from the proxy's address, so limits keyed by
// req.ip are shared by every user: five failed logins anywhere lock everyone out, and brute force is not slowed per
// attacker. CLIENT_IP_HEADER names the header the edge sets with the real client (cf-connecting-ip on Cloudflare).
// Only set it when the API cannot be reached without passing through that edge, or the header could be forged.
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
    const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
    const value = header ? headers?.[header] : undefined;
    const client = (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();
    return client && client.length <= 45 ? client : String(req.ip ?? '');
  }
}
