'use client';

import type { CSSProperties } from 'react';
import { LazyMotion, domAnimation, m } from 'motion/react';

interface CardProps {
  number: string;
  title: string;
  description: string;
  colorTheme?: 'red' | 'blue' | 'navy';
  className?: string;
  rotate?: string;
  colors?: {
    bg: string;
    text: string;
    border: string;
  };
}

const Pin = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M16 3a1 1 0 0 1 .117 1.993l-.117 .007v4.764l1.894 3.789a1 1 0 0 1 .1 .331l.006 .116v2a1 1 0 0 1 -.883 .993l-.117 .007h-4v4a1 1 0 0 1 -1.993 .117l-.007 -.117v-4h-4a1 1 0 0 1 -.993 -.883l-.007 -.117v-2a1 1 0 0 1 .06 -.34l.046 -.107l1.894 -3.791v-4.762a1 1 0 0 1 -.117 -1.993l.117 -.007h8z" />
  </svg>
);

const Card = ({
  number,
  title,
  description,
  colorTheme = 'blue',
  className,
  rotate,
  colors: customColors,
}: CardProps) => {
  const defaultBgColors = {
    red: 'bg-[#ba0c2f]/[0.07]',
    blue: 'bg-[#00205b]/[0.06]',
    navy: 'bg-[#001433]/[0.05]',
  };
  const defaultTextColors = {
    red: 'text-[#ba0c2f]',
    blue: 'text-[#00205b]',
    navy: 'text-[#001433]',
  };
  const defaultBorderColors = {
    red: 'border-[#ba0c2f]/20',
    blue: 'border-[#00205b]/15',
    navy: 'border-[#001433]/12',
  };

  const bgColor = customColors?.bg || defaultBgColors[colorTheme];
  const textColor = customColors?.text || defaultTextColors[colorTheme];
  const borderColor = customColors?.border || defaultBorderColors[colorTheme];

  return (
    <div
      className={`relative w-full md:w-[280px] transition-transform duration-300 hover:z-30 hover:scale-105 ${rotate ?? ''} ${className ?? ''}`}
    >
      <div className="rounded-[25px] border border-[#00205b]/10 bg-white p-2 shadow-[0px_10px_28px_0px_rgba(0,32,91,0.08)]">
        <Pin className={`mx-auto mb-6 h-8 w-8 z-20 ${textColor}`} />
        <div
          className={`${bgColor} border ${borderColor} relative flex h-full flex-col overflow-hidden rounded-[15px] p-[15px]`}
        >
          <span className={`${textColor} mb-5 font-serif text-4xl font-semibold tracking-tight`}>
            {number}
          </span>
          <h3 className="mb-[10px] text-2xl font-semibold leading-none text-[#001433]">{title}</h3>
          <p className="text-sm/5 tracking-tight text-[#001433]/60">{description}</p>
        </div>
      </div>
    </div>
  );
};

export interface Step {
  title: string;
  description: string;
  colorTheme?: 'red' | 'blue' | 'navy';
  colors?: {
    bg: string;
    text: string;
    border: string;
  };
}

export interface StepPosition {
  className?: string;
  rotate?: string;
}

export interface HowItWorksProps {
  features?: Step[];
  className?: string;
  stepPositions?: StepPosition[];
  title?: string;
  eyebrow?: string;
  description?: string;
}

const DEFAULT_CARD_POSITIONS: StepPosition[] = [
  { className: 'md:absolute md:top-0 md:left-[15%]', rotate: 'rotate-8' },
  {
    className: 'md:absolute md:top-[120px] md:right-[15%]',
    rotate: '-rotate-8',
  },
  { className: 'md:absolute md:top-[450px] md:left-[15%]', rotate: 'rotate-8' },
  {
    className: 'md:absolute md:top-[570px] md:right-[10%]',
    rotate: '-rotate-8',
  },
];

export default function HowItWorks({
  features,
  className,
  stepPositions,
  title = 'Fra Stortinget til din stemme',
  eyebrow = 'Slik fungerer det',
  description = 'En enkel vei inn i demokratiet mellom valgene — med data direkte fra kilden.',
}: HowItWorksProps) {
  const defaultFeatures: Step[] = [
    {
      title: 'Direkte fra Stortinget',
      description:
        'Lovforslag og representantforslag hentes ufiltrert fra Stortingets åpne API — klare for ja/nei.',
      colorTheme: 'red',
    },
    {
      title: 'Stem på saker',
      description:
        'Si din mening med verifisert stemmegivning. Én person, én stemme — anonymt i statistikken.',
      colorTheme: 'blue',
    },
    {
      title: 'Delta i debatten',
      description:
        'Forum og høringer med navngitte innlegg — diskuter åpent med fornavn og etternavn.',
      colorTheme: 'navy',
    },
    {
      title: 'Innsikt for politikere',
      description:
        'Anonymisert statistikk hjelper representanter å forstå hva velgerne faktisk mener.',
      colorTheme: 'red',
    },
  ];

  const data = features && features.length > 0 ? features : defaultFeatures;
  const positions = stepPositions || DEFAULT_CARD_POSITIONS;

  let height = 900;
  if (data.length === 1) height = 400;
  else if (data.length === 2) height = 450;
  else if (data.length === 3) height = 800;
  else if (data.length === 4) height = 900;
  else height = 1130;

  return (
    <LazyMotion features={domAnimation}>
      <div className={`relative bg-transparent px-4 sm:px-8 max-md:pb-16 max-md:pt-4 md:py-8 ${className ?? ''}`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(#00205b 1px, transparent 1px)',
            backgroundSize: '100% 32px',
            marginTop: '4px',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-white" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-white" aria-hidden />

        <div className="relative z-10 mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">{eyebrow}</p>
          <h2 className="text-3xl font-bold tracking-tight text-[#001433] sm:text-4xl">{title}</h2>
          <p className="mt-3 text-[#001433]/65">{description}</p>
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <div
            className="relative mx-auto flex h-auto w-full max-w-[1000px] flex-col space-y-8 md:block md:h-[var(--md-height)] md:space-y-0"
            style={{ '--md-height': `${height}px` } as CSSProperties}
          >
            {data.length > 1 ? (
              <svg
                className="pointer-events-none absolute top-0 left-0 z-0 hidden h-full w-full text-[#00205b]/25 md:block"
                viewBox={`0 0 1000 ${height}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {(() => {
                  const pathD = data.reduce((acc, _, index) => {
                    if (index >= data.length - 1) return acc;
                    if (index === 0) return 'M 290 150 C 500 150, 550 270, 710 270';
                    if (index === 1) return `${acc} C 850 270, 500 350, 290 450`;
                    if (index === 2) return `${acc} C 290 600, 550 720, 750 720`;
                    if (index === 3) return `${acc} C 950 720, 500 800, 290 850`;
                    return acc;
                  }, '');
                  return (
                    <m.path
                      d={pathD}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="8 6"
                      fill="none"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: -140 }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                  );
                })()}
              </svg>
            ) : null}

            {data.map((step, index) => {
              const position = positions[index % positions.length];

              return (
                <Card
                  key={step.title}
                  number={`0${index + 1}`}
                  title={step.title}
                  description={step.description}
                  colorTheme={step.colorTheme || 'blue'}
                  colors={step.colors}
                  rotate={position.rotate}
                  className={position.className}
                />
              );
            })}
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}
