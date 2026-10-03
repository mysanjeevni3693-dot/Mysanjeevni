'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface HealthConcern {
  icon: string;
  label: string;
  href: string;
}

interface HealthConcernCarouselProps {
  concerns?: HealthConcern[];
}

const DEFAULT_CONCERNS: HealthConcern[] = [
  { icon: '🛡️', label: 'Immunity', href: '/medicines?concern=immunity#products-section' },
  { icon: '🫕', label: 'Digestion', href: '/medicines?concern=digestion#products-section' },
  { icon: '😴', label: 'Sleep & Stress', href: '/medicines?concern=sleep#products-section' },
  { icon: '⚡', label: 'Energy & Vitality', href: '/medicines?concern=energy#products-section' },
  { icon: '💆', label: 'Pain Relief', href: '/medicines?concern=pain#products-section' },
  { icon: '👨‍⚕️', label: 'Heart Health', href: '/medicines?concern=heart#products-section' },
  { icon: '🧠', label: 'Brain Health', href: '/medicines?concern=brain#products-section' },
  { icon: '💪', label: 'Bone & Joint', href: '/medicines?concern=bone#products-section' },
];

export default function HealthConcernCarousel({ concerns = DEFAULT_CONCERNS }: HealthConcernCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !containerRef.current || !wrapperRef.current || !concerns || concerns.length === 0) return;

    const container = containerRef.current;
    const wrapper = wrapperRef.current;

    // Clone items for infinite loop
    const items = Array.from(container.children) as HTMLElement[];
    items.forEach((item) => {
      const clone = item.cloneNode(true);
      container.appendChild(clone);
    });

    // Setup animation
    let animationFrameId: number;
    let translateX = 0;
    const speed = 0.5; // Very slow speed - adjust this value to control speed
    const itemWidth = items[0]?.offsetWidth || 180;
    const gap = 16; // tailwind gap-4 = 1rem = 16px
    const totalWidth = (itemWidth + gap) * concerns.length;

    const animate = () => {
      translateX -= speed;

      // Reset when scrolled enough to prevent memory issues
      if (Math.abs(translateX) >= totalWidth) {
        translateX = 0;
      }

      container.style.transform = `translateX(${translateX}px)`;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [concerns.length, isLoaded]);

  return (
    <section className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Shop by Health Concern</h2>
          <p className="text-gray-600">Select your health concern to find relevant medicines and products</p>
        </div>

        {/* Carousel Container */}
        <div
          ref={wrapperRef}
          className="overflow-hidden"
        >
          <div
            ref={containerRef}
            className="flex gap-4"
            style={{
              willChange: 'transform',
            }}
          >
            {concerns.map((concern) => (
              <Link
                key={concern.label}
                href={concern.href}
                className="group flex-shrink-0"
              >
                <div className="w-32 h-40 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 text-center hover:shadow-lg hover:from-emerald-100 hover:to-teal-100 transition-all duration-300 cursor-pointer border border-emerald-200 hover:border-emerald-400 flex flex-col items-center justify-center">
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    {concern.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors line-clamp-2 flex-shrink-0">
                    {concern.label}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
