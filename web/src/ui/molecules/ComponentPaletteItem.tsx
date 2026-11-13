import type { ComponentKind, Owner } from '../../domain/scenario';
import { Button } from '../atoms/Button';
import { ComponentGlyph } from '../atoms/ComponentGlyph';

export interface ComponentPaletteItemProps {
  kind: ComponentKind;
  label: string;
  owner: Owner;
  active: boolean;
  onSelect(): void;
}

export function ComponentPaletteItem({
  kind,
  label,
  owner,
  active,
  onSelect,
}: ComponentPaletteItemProps) {
  return (
    <Button className="flex w-full justify-start gap-2" small active={active} onClick={onSelect}>
      <svg className="flex-none" width="24" height="24" viewBox="-16 -16 32 32" aria-hidden>
        <ComponentGlyph
          kind={kind}
          center={{ x: 0, y: 0 }}
          size={kind === 'carrier' ? 22 : 18}
          owner={owner}
          variant="controllable"
        />
      </svg>
      {label}
    </Button>
  );
}
