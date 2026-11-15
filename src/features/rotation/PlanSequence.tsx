import type { CropSeason } from "@fw/contracts";
import { cropLabel } from "./logicBridge";
import { yearSeason } from "./format";

/** Crop-by-season sequence as an ordered list of chips (season + year, crop name). */
export function PlanSequence({ seasons, label, changedFrom }: { seasons: CropSeason[]; label: string; changedFrom?: CropSeason[] }) {
  return (
    <ol className="rot-seq" aria-label={label}>
      {seasons.map((s, i) => {
        const before = changedFrom?.[i];
        const changed = !!before && before.cropId !== s.cropId;
        return (
          <li key={`${s.yearOffset}-${s.season}-${i}`} className={changed ? "rot-seq__item rot-seq__item--changed" : "rot-seq__item"}>
            <span className="rot-seq__when">{yearSeason(s.yearOffset, s.season)}</span>
            <span className="rot-seq__crop">
              {cropLabel(s.cropId)}
              {changed ? <span className="rot-seq__note"> (changed)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
