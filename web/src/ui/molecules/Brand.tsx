import { BrandMark } from '../atoms/BrandMark';

/** Brand mark and name, for the navy frame. */
export function Brand() {
  return (
    <span className="mr-3 flex items-center gap-2">
      <BrandMark />
      <span className="text-title font-bold font-stretch-condensed">Minovsky Maps</span>
    </span>
  );
}
