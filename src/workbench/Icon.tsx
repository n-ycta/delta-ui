import icons from "./icons.json";
export const iconNames = Object.keys(icons).sort();
export function WIcon({ name, size = 20 }: { name: string; size?: number }) {
  const svg = (icons as Record<string, string>)[name] || icons["square"];
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
