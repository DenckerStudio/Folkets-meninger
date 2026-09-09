'use client';

import React, { useId } from 'react';
import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import { Autoplay, EffectCoverflow, Navigation, Pagination } from 'swiper/modules';
import { SparklesIcon } from 'lucide-react';

import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CardCarouselImage = { src: string; alt: string };

type CardCarouselProps = {
  images?: CardCarouselImage[];
  slides?: React.ReactNode[];
  autoplayDelay?: number;
  showPagination?: boolean;
  showNavigation?: boolean;
  badge?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  slideClassName?: string;
  loop?: boolean;
  onSlideClick?: (index: number) => void;
  onSwiper?: (swiper: SwiperType) => void;
};

export const CardCarousel: React.FC<CardCarouselProps> = ({
  images,
  slides,
  autoplayDelay = 1500,
  showPagination = true,
  showNavigation = true,
  badge,
  title,
  description,
  className,
  slideClassName,
  loop,
  onSlideClick,
  onSwiper,
}) => {
  const uid = useId().replace(/:/g, '');

  const contentSlides =
    slides ??
    (images ?? []).map((image, index) => (
      <div key={`${image.src}-${index}`} className="size-full overflow-hidden rounded-3xl">
        <Image
          src={image.src}
          width={500}
          height={500}
          className="size-full rounded-xl object-cover"
          alt={image.alt}
        />
      </div>
    ));

  const canLoop = loop ?? contentSlides.length >= 4;
  const autoplay =
    autoplayDelay > 0 && contentSlides.length > 1
      ? { delay: autoplayDelay, disableOnInteraction: true, pauseOnMouseEnter: true }
      : false;

  return (
    <section className={cn('w-full space-y-4', className)}>
      <style>{`
        .card-carousel-${uid} .swiper {
          width: 100%;
          padding-bottom: 50px;
        }
        .card-carousel-${uid} .swiper-slide {
          background-position: center;
          background-size: cover;
          width: 280px;
        }
        .card-carousel-${uid} .swiper-3d .swiper-slide-shadow-left,
        .card-carousel-${uid} .swiper-3d .swiper-slide-shadow-right {
          background-image: none;
          background: none;
        }
        .card-carousel-${uid} .swiper-pagination-bullet-active {
          background: var(--brand);
        }
        .card-carousel-${uid} .swiper-button-next,
        .card-carousel-${uid} .swiper-button-prev {
          color: var(--brand);
        }
      `}</style>
      <div className="mx-auto w-full max-w-4xl rounded-[24px] border border-border p-2 shadow-sm md:rounded-t-[44px]">
        <div className="relative mx-auto flex w-full flex-col rounded-[24px] border border-border bg-muted/30 p-2 shadow-sm md:items-start md:gap-8 md:rounded-b-[20px] md:rounded-t-[40px] md:p-2">
          {badge !== null ? (
            <Badge
              variant="outline"
              className="absolute left-4 top-6 rounded-[14px] border border-border bg-card text-base text-foreground md:left-6"
            >
              {badge ?? (
                <>
                  <SparklesIcon className="fill-brand-accent/30 stroke-1 text-brand" /> Reels
                </>
              )}
            </Badge>
          ) : null}
          {(title || description) && (
            <div className="flex flex-col justify-center pb-2 pl-4 pt-14 md:items-center">
              <div className="flex gap-2">
                <div>
                  {title ? (
                    <h3 className="text-3xl font-bold tracking-tight text-foreground opacity-90 md:text-4xl">
                      {title}
                    </h3>
                  ) : null}
                  {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
                </div>
              </div>
            </div>
          )}

          <div className="flex w-full items-center justify-center gap-4">
            <div className={cn('w-full', `card-carousel-${uid}`)}>
              {contentSlides.length === 0 ? (
                <div className="flex min-h-[18rem] items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
                  Ingen kort å vise ennå.
                </div>
              ) : (
                <Swiper
                  spaceBetween={50}
                  autoplay={autoplay}
                  effect="coverflow"
                  grabCursor
                  centeredSlides
                  loop={canLoop}
                  slidesPerView="auto"
                  coverflowEffect={{
                    rotate: 0,
                    stretch: 0,
                    depth: 100,
                    modifier: 2.5,
                  }}
                  pagination={showPagination}
                  navigation={showNavigation}
                  modules={[EffectCoverflow, Autoplay, Pagination, Navigation]}
                  onSwiper={onSwiper}
                >
                  {contentSlides.map((slide, index) => (
                    <SwiperSlide
                      key={index}
                      className={slideClassName}
                      onClick={() => onSlideClick?.(index)}
                    >
                      {slide}
                    </SwiperSlide>
                  ))}
                </Swiper>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
