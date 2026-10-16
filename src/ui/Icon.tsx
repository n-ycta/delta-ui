import { icons, type IconProps } from './icons';

const toPascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Resolves icon names coming from plugin manifests ("heart-pulse") to Phosphor components. Unknown → Box. */
export function Icon({ name, size = 16, ...rest }: { name: string } & IconProps) {
  const C = (icons as Record<string, React.ComponentType<IconProps>>)[toPascal(name)] ?? icons.Box;
  return <C size={size} {...rest} />;
}
export const hasIcon = (name: string) => toPascal(name) in icons;
