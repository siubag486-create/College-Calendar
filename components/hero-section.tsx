"use client";

import React, { useEffect, useRef } from "react";

const HeroSection: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;

      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;

      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        const depth = (index + 1) * 15;
        const moveX = x * (index + 1) * 0.2;
        const moveY = y * (index + 1) * 0.2;
        layer.style.transform = `translateZ(${depth}px) translate(${moveX}px, ${moveY}px)`;
      });
    };

    canvas.style.opacity = "0";
    canvas.style.transform = "rotateX(90deg) rotateZ(0deg) scale(0.8)";

    const timeout = setTimeout(() => {
      canvas.style.transition = "all 2.5s cubic-bezier(0.16, 1, 0.3, 1)";
      canvas.style.opacity = "1";
      canvas.style.transform = "rotateX(55deg) rotateZ(-25deg) scale(1)";
    }, 300);

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&display=swap');

        .halide-root {
          background-color: #0a0a0a;
          color: #e0e0e0;
          font-family: 'Syncopate', sans-serif;
          overflow: hidden;
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .halide-grain {
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
          z-index: 100;
          opacity: 0.15;
        }

        .viewport {
          perspective: 2000px;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .canvas-3d {
          position: relative;
          width: 800px;
          height: 500px;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .layer {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(224, 224, 224, 0.1);
          background-size: cover;
          background-position: center;
          transition: transform 0.5s ease;
        }

        .layer-1 {
          background-image: url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.2) brightness(0.5);
        }
        .layer-2 {
          background-image: url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.1) brightness(0.7);
          opacity: 0.6;
          mix-blend-mode: screen;
        }
        .layer-3 {
          background-image: url('https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.3) brightness(0.8);
          opacity: 0.4;
          mix-blend-mode: overlay;
        }

        .contours {
          position: absolute;
          width: 200%;
          height: 200%;
          top: -50%;
          left: -50%;
          background-image: repeating-radial-gradient(
            circle at 50% 50%,
            transparent 0,
            transparent 40px,
            rgba(255, 255, 255, 0.05) 41px,
            transparent 42px
          );
          transform: translateZ(120px);
          pointer-events: none;
        }

        .interface-grid {
          position: fixed;
          inset: 0;
          padding: 4rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr auto;
          z-index: 10;
          pointer-events: none;
        }

        .hero-title {
          grid-column: 1 / -1;
          align-self: center;
          font-size: clamp(3rem, 10vw, 10rem);
          line-height: 0.85;
          letter-spacing: -0.04em;
          mix-blend-mode: difference;
        }

        .cta-button {
          pointer-events: auto;
          background: #e0e0e0;
          color: #0a0a0a;
          padding: 1rem 2rem;
          text-decoration: none;
          font-weight: 700;
          font-family: 'Syncopate', sans-serif;
          font-size: 0.75rem;
          clip-path: polygon(0 0, 100% 0, 100% 70%, 85% 100%, 0 100%);
          transition: 0.3s;
          letter-spacing: 0.05em;
        }

        .cta-button:hover {
          background: #ff3c00;
          transform: translateY(-5px);
        }

        .scroll-hint {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          width: 1px;
          height: 60px;
          background: linear-gradient(to bottom, #e0e0e0, transparent);
          animation: flow 2s infinite ease-in-out;
        }

        @keyframes flow {
          0%, 100% { transform: scaleY(0); transform-origin: top; }
          50% { transform: scaleY(1); transform-origin: top; }
          51% { transform: scaleY(1); transform-origin: bottom; }
        }
      `}</style>

      <div className="halide-root">
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>

        <div className="halide-grain" style={{ filter: "url(#grain)" }} />

        <div className="interface-grid">
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
            }}
          >
            HALIDE_CORE
          </div>
          <div
            style={{
              textAlign: "right",
              fontFamily: "monospace",
              color: "#ff3c00",
              fontSize: "0.7rem",
              lineHeight: "1.6",
            }}
          >
            <div>LATITUDE: 34.0522° N</div>
            <div>FOCAL DEPTH: 80MM</div>
          </div>

          <h1 className="hero-title">
            COLLEGE
            <br />
            CALENDAR
          </h1>

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                lineHeight: "1.8",
              }}
            >
              <p>[ ARCHIVE 2024 ]</p>
              <p>SURFACE TENSION &amp; TOPOGRAPHICAL LIGHT</p>
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
              <a
                href="/downloads/college-calendar-setup.exe"
                download
                className="cta-button"
              >
                WINDOWS
              </a>
              <a
                href="/downloads/college-calendar-mac.dmg"
                download
                className="cta-button"
              >
                macOS
              </a>
            </div>
          </div>
        </div>

        <div className="viewport">
          <div className="canvas-3d" ref={canvasRef}>
            <div
              className="layer layer-1"
              ref={(el) => {
                if (el) layersRef.current[0] = el;
              }}
            />
            <div
              className="layer layer-2"
              ref={(el) => {
                if (el) layersRef.current[1] = el;
              }}
            />
            <div
              className="layer layer-3"
              ref={(el) => {
                if (el) layersRef.current[2] = el;
              }}
            />
            <div className="contours" />
          </div>
        </div>

        <div className="scroll-hint" />
      </div>
    </>
  );
};

export default HeroSection;
