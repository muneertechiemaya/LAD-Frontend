"use client";
import React from 'react';
import Login from '../../components/auth/Login';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

export default function LoginPage() {
  const { isDark } = useTheme();
  // Same hero character used on the home page, theme-aware so its baked
  // background blends with the login screen's light/dark background.
  const videoSrc = isDark ? '/hero-character-dark.mp4' : '/hero-character.mp4';
  const posterSrc = isDark
    ? '/hero-character-dark-poster.jpg'
    : '/hero-character-poster.jpg';

  return (
    <div className="py-4 md:py-6 relative bg-background dark:bg-[#010726] flex flex-col justify-center min-h-[calc(100vh-100px)]">
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center px-4 sm:px-6 lg:px-8">
          {/* Left: Hero / Illustration + marketing */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="hidden lg:flex lg:col-span-7 flex-col items-center justify-center"
          >
            <div className="relative w-full h-[480px] lg:h-[580px] xl:h-[640px]">
              <video
                key={videoSrc}
                src={videoSrc}
                poster={posterSrc}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
                className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-lighten"
              />
            </div>
          </motion.div>

          {/* Right: Login form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full lg:col-span-5 flex flex-col justify-center items-center lg:items-start p-2"
          >
            <Login />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
