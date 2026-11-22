// Artist photo, or their colour and initial when there's no photo (or it fails to load).
import { useState } from 'react';
import { initial } from '../lib/format';

interface Props {
  artist: { name: string; image_url: string; color: string };
  size?: number;
  radius?: number;
}

export function ArtistImage({ artist, size = 48, radius = 12 }: Props) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, borderRadius: radius };
  if (artist.image_url && !broken) {
    return <img className="artist-img" src={artist.image_url} alt="" style={style} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className="artist-img fallback" aria-hidden="true" style={{ ...style, background: artist.color, fontSize: size * 0.42 }}>
      {initial(artist.name)}
    </span>
  );
}
