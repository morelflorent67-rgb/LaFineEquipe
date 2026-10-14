import { describe, expect, it } from 'vitest';
import { clipEmbedUrl, parseClipSource } from './providers';
import { clipInputSchema } from './schemas';

describe('Sources des clips', () => {
  it('normalise les formats YouTube et retire les paramètres de tracking', () => {
    const expected = {
      provider: 'youtube',
      externalId: 'M7lc1UVf-VE',
      sourceUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    };
    for (const url of [
      'https://youtu.be/M7lc1UVf-VE?si=tracking',
      'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=10',
      'https://youtube.com/shorts/M7lc1UVf-VE',
    ])
      expect(parseClipSource(url)).toEqual(expected);
  });
  it('normalise Twitch et garde Allstar comme lien externe', () => {
    expect(parseClipSource('https://www.twitch.tv/player/clip/SomeClip-Ab12?tt=1')?.sourceUrl).toBe(
      'https://clips.twitch.tv/SomeClip-Ab12',
    );
    expect(parseClipSource('https://twitch.tv/videos/12345')?.externalId).toBe('video:12345');
    expect(
      parseClipSource('https://www.allstar.gg/clip?clip=abcdef123456abcdef123456&utm=x')?.sourceUrl,
    ).toBe('https://allstar.gg/clip?clip=abcdef123456abcdef123456');
    expect(clipEmbedUrl('https://allstar.gg/clip?clip=abcdef123456abcdef123456', 'example.com')).toBeNull();
  });
  it.each([
    'http://youtube.com/watch?v=M7lc1UVf-VE',
    'javascript:alert(1)',
    'https://localhost/test',
    'https://127.0.0.1/test',
    'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
    'https://user:password@youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtube.com:444/watch?v=M7lc1UVf-VE',
    'https://youtu.be/M7lc1UVf-VE/more',
    'https://twitch.tv/somechannel',
    'https://clips.twitch.tv/embed?clip=Hello',
    'https://allstar.gg/redirect?url=bad',
    'https://faceit.com/fr/players/demo',
  ])('refuse les liens non pris en charge : %s', (u) => expect(parseClipSource(u)).toBeNull());
  it('construit le parent Twitch et interdit un parent injecté', () => {
    const u = new URL(clipEmbedUrl('https://clips.twitch.tv/SomeClip', 'lfe.example.com')!);
    expect(u.searchParams.get('parent')).toBe('lfe.example.com');
    expect(u.searchParams.get('autoplay')).toBe('false');
    expect(clipEmbedUrl('https://clips.twitch.tv/SomeClip', 'x&parent=evil')).toBeNull();
  });
  it('interdit une date impossible et une publication sans accord', () => {
    const base = {
      id: null,
      title: 'Un clip',
      sourceUrl: 'https://youtu.be/M7lc1UVf-VE',
      playerId: null,
      mapSlug: null,
      recordedOn: '2026-10-13',
      description: '',
      published: false,
      embedAllowed: false,
      consentConfirmed: false,
    };
    expect(clipInputSchema.safeParse(base).success).toBe(true);
    expect(clipInputSchema.safeParse({ ...base, recordedOn: '2026-02-31' }).success).toBe(false);
    expect(clipInputSchema.safeParse({ ...base, published: true }).success).toBe(false);
  });
});
