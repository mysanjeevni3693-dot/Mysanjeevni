'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Service {
  icon: string;
  label: string;
  desc: string;
  href: string;
  bgGradient: string;
  image: string;
}

const SERVICES: Service[] = [
  { icon: '🧪', label: 'Lab Tests', desc: 'Get tested at home, reports in 24hrs', href: '/lab-tests#products-section', bgGradient: 'from-blue-500 to-cyan-500', image: '/Lab-Tests.png' },
  { icon: '👨‍⚕️', label: 'Doctor Consultation', desc: 'Video, audio & in-person consultations', href: '/doctor-consultation#products-section', bgGradient: 'from-purple-500 to-pink-500', image: '/Doctor-Consultation.png' },
  { icon: '🌿', label: 'Ayurveda', desc: '100% authentic ayurvedic products', href: '/ayurveda#products-section', bgGradient: 'from-amber-500 to-yellow-500', image: '/Ayurveda.png' },
  { icon: '🌸', label: 'Homeopathy', desc: 'FDA approved homeopathic remedies', href: '/homeopathy#products-section', bgGradient: 'from-rose-500 to-pink-500', image: '/Homeopathy.png' },
  { icon: '🏥', label: 'Wellness', desc: 'Complete health and wellness programs', href: '/medicines?category=sexual%20wellness#products-section', bgGradient: 'from-teal-500 to-cyan-500', image: '/Wellness.png' },
];

export default function PrimaryServicesCarousel() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <section className="bg-linear-to-b from-white via-gray-50 to-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">Our Primary Services</h2>
            <p className="text-gray-600 text-lg">Comprehensive healthcare solutions at your fingertips</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {SERVICES.map((service) => (
              <div key={service.label} className="mb-4">
                <div className="relative overflow-hidden rounded-3xl h-80 bg-gray-200/70 animate-pulse" />
                <div className="text-center mt-5">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{service.label}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{service.desc}</p>
                  <span className="inline-block px-6 py-2.5 rounded-full font-bold text-sm bg-gray-900 text-white">Explore →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-linear-to-b from-white via-gray-50 to-white py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-3">Our Primary Services</h2>
          <p className="text-gray-600 text-lg">Comprehensive healthcare solutions at your fingertips</p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((service) => (
            <Link key={service.label} href={service.href} className="group">
              {/* Card Container */}
              <div className="mb-4">
                {/* Image Card */}
                <div className="relative overflow-hidden rounded-3xl h-80 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                  {/* Background Image */}
                  <Image
                    src={service.image}
                    alt={service.label}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />

                  {/* Gradient Overlay */}
                  <div className={`absolute inset-0 bg-linear-to-br ${service.bgGradient} opacity-20 group-hover:opacity-10 transition-all duration-300`}></div>

                  {/* Subtle dark overlay for depth */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 via-black/5 to-transparent group-hover:via-black/0 transition-all duration-300"></div>

                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-300"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16 group-hover:scale-125 transition-transform duration-300"></div>

                </div>

                {/* Text Below Card */}
                <div className="text-center mt-5">
                  {/* Label */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-teal-600 transition-colors duration-300">
                    {service.label}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {service.desc}
                  </p>

                  {/* CTA Button */}
                  <button className="px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 bg-linear-to-r from-gray-900 to-gray-700 text-white hover:from-teal-600 hover:to-teal-700 shadow-md hover:shadow-lg hover:-translate-y-1">
                    Explore →
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
      `}</style>
    </section>
  );
}
