const COLORS = ['#6D2FB0', '#B0442F', '#2F8FB0', '#C2479C', '#4F7A3A', '#B08A2F', '#2F5FB0', '#8A5FC2', '#3A7A6E'];
// Light colours for avatars (dark initials on top).
const AVATAR_COLORS = ['#F29AD3', '#8FD3F2', '#F2C38F', '#A7F28F', '#C9A7F2', '#F28F8F', '#8FF2D3'];

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export const randomColor = () => pick(COLORS);
export const randomAvatarColor = () => pick(AVATAR_COLORS);
