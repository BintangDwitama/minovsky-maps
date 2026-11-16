import { useEffect, useMemo, useState } from 'react';
import sampleDoc from '../../../../schema/examples/sample-mesa.scenario.json';
import { loadScenario } from '../../domain/serialization';
import { HttpScenarioBrowser } from '../../infrastructure/httpScenarioBrowser';
import { Button } from '../atoms/Button';
import { Icon, type IconName } from '../atoms/Icon';
import { BoardView, boardBounds } from '../organisms/BoardView';
import { LatestScenarios } from '../organisms/LatestScenarios';
import { BROWSE_PATH, goToPath, openEditor } from '../router';
import { SiteLayout } from '../templates/SiteLayout';
import { BOARD } from '../theme';

const STEPS: readonly { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'brush',
    title: 'Make it',
    text: 'Paint terrain, stack elevation, place bases, garrisons and objectives, and write the goals.',
  },
  {
    icon: 'eye',
    title: 'Test it',
    text: 'Check line of sight and movement reach from any hex before anyone sets up the table.',
  },
  {
    icon: 'link',
    title: 'Share it',
    text: 'Send a link, print a setup sheet, or list it so every player can find it.',
  },
];

/** The board picture in the hero: the sample scenario, drawn by the app itself. */
function HeroBoard() {
  const scenario = useMemo(() => {
    const r = loadScenario(sampleDoc);
    return r.ok ? r.scenario : null;
  }, []);
  if (!scenario) return null;
  const size = BOARD.hexSize;
  const b = boardBounds(scenario, size);
  return (
    <figure className="deck p-3 chamfer">
      <svg
        className="mx-auto block max-h-[440px] w-full"
        viewBox={`${b.minX} ${b.minY} ${b.width} ${b.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Example scenario board: a stepped central mesa with objectives and both sides' bases"
      >
        <BoardView scenario={scenario} size={size} />
      </svg>
    </figure>
  );
}

/** `/`: what Minovsky Maps is, and the ways in (create, browse, the newest scenarios). */
export function LandingPage() {
  const [browser] = useState(() => new HttpScenarioBrowser());
  useEffect(() => {
    document.title = 'Minovsky Maps – scenario maker for Gundam Assemble';
  }, []);

  return (
    <SiteLayout current="home">
      <section
        className="grid items-center gap-8 pt-2 pb-4 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] min-[900px]:pt-8"
        aria-labelledby="landing-title"
      >
        <div>
          <h1
            id="landing-title"
            className="mb-4 text-[44px] leading-[1.02] font-extrabold font-stretch-condensed min-[900px]:text-[60px]"
          >
            Design your own Gundam Assemble scenarios.
          </h1>
          <p className="mb-6 max-w-[46ch] text-lg leading-relaxed text-muted">
            Build the battlefield hex by hex, set the goals, test sight lines, then share it with
            your group or with every player.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="new" onClick={openEditor} className="px-4 py-2.5">
              Create a scenario
            </Button>
            <Button icon="grid" onClick={() => goToPath(BROWSE_PATH)} className="px-4 py-2.5">
              Browse scenarios
            </Button>
          </div>
        </div>
        <HeroBoard />
      </section>

      <section aria-label="How it works" className="mt-10">
        <ol className="grid gap-4 min-[700px]:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.title} className="bg-panel p-4 chamfer">
              <h2 className="mb-1.5 flex items-center gap-2 text-title font-bold font-stretch-condensed">
                <span className="text-accent">
                  <Icon name={s.icon} />
                </span>
                {s.title}
              </h2>
              <p className="leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <LatestScenarios browser={browser} />
    </SiteLayout>
  );
}
