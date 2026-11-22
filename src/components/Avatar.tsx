import { initial } from '../lib/format';

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <span className="avatar" aria-hidden="true" style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}>
      {initial(name)}
    </span>
  );
}
