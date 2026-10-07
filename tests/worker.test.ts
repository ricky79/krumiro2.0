import { describe, expect, it, vi } from 'vitest';
import worker from '../src/worker';

function envFinto() {
  const fetch = vi.fn(async () => new Response('asset'));
  return { env: { ASSETS: { fetch } }, fetch };
}

describe('worker di sbeggio.app', () => {
  it('www.sbeggio.app rimanda a sbeggio.app con 301, tenendo percorso e query', async () => {
    const { env, fetch } = envFinto();
    const r = await worker.fetch(new Request('http://www.sbeggio.app/prova?x=1'), env);
    expect(r.status).toBe(301);
    expect(r.headers.get('Location')).toBe('https://sbeggio.app/prova?x=1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sbeggio.app serve i file statici', async () => {
    const { env, fetch } = envFinto();
    const richiesta = new Request('https://sbeggio.app/');
    const r = await worker.fetch(richiesta, env);
    expect(await r.text()).toBe('asset');
    expect(fetch).toHaveBeenCalledWith(richiesta);
  });
});
