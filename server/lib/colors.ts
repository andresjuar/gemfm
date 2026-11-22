const COLORS = ['#6D2FB0', '#B0442F', '#2F8FB0', '#C2479C', '#4F7A3A', '#B08A2F', '#2F5FB0', '#8A5FC2', '#3A7A6E'];

export const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
