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
  it('normalise Twitch, Allstar (ancien et nouveau format) et les vidéos FACEIT ; lecteur Allstar intégré', () => {
    expect(parseClipSource('https://www.twitch.tv/player/clip/SomeClip-Ab12?tt=1')?.sourceUrl).toBe(
      'https://clips.twitch.tv/SomeClip-Ab12',
    );
    expect(parseClipSource('https://twitch.tv/videos/12345')?.externalId).toBe('video:12345');
    const expected = { provider: 'allstar', externalId: '6a359b3b407ff13d680ea1ec', sourceUrl: 'https://allstar.gg/clip/6a359b3b407ff13d680ea1ec' };
    expect(parseClipSource('https://allstar.gg/clip/6a359b3b407ff13d680ea1ec')).toEqual(expected);
    expect(parseClipSource('https://www.allstar.gg/clip/6A359B3B407FF13D680EA1EC/?utm_source=share')).toEqual(expected);
    expect(parseClipSource('https://allstar.gg/clip?clip=6a359b3b407ff13d680ea1ec&utm=x')).toEqual(expected);
    expect(clipEmbedUrl('https://allstar.gg/clip/6a359b3b407ff13d680ea1ec', 'example.com')).toBe(
      'https://allstar.gg/iframe?clip=6a359b3b407ff13d680ea1ec',
    );
    // Lien constaté le 14/10/2026 : la « vidéo » FACEIT a le même identifiant que le clip Allstar.
    expect(parseClipSource('https://www.faceit.com/en/players/db_/videos/6acfa6e4f9dd919bc3364e1b')).toEqual({
      provider: 'allstar',
      externalId: '6acfa6e4f9dd919bc3364e1b',
      sourceUrl: 'https://allstar.gg/clip/6acfa6e4f9dd919bc3364e1b',
    });
    expect(parseClipSource('https://allstar.gg/clip/6acfc50e99d1eaf085159f55?ref=64aaba889f46fd1506af7b39')?.externalId).toBe(
      '6acfc50e99d1eaf085159f55',
    );
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
    'https://allstar.gg/clip/pas-un-identifiant',
    'https://allstar.gg.evil.test/clip/6a359b3b407ff13d680ea1ec',
    'https://allstar.gg/iframe?clip=6a359b3b407ff13d680ea1ec',
    'https://faceit.com/fr/players/demo',
    'https://www.faceit.com/en/players/db_/videos/pas-un-id',
    'https://www.faceit.com.evil.test/en/players/db_/videos/6acfa6e4f9dd919bc3364e1b',
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
