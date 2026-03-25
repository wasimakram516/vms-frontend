"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DarkMode as DarkModeIcon, LightMode as LightModeIcon } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

const PALETTE = {
  dark: {
    overlayBg:     "rgba(18, 25, 34, 0.94)",
    skyGradient:   null,
    // Card
    cardBgImg:     `linear-gradient(145deg, rgba(24,32,46,0.97) 0%, rgba(15,21,33,0.97) 100%),
                    linear-gradient(135deg, rgba(140,175,245,0.48) 0%, rgba(80,110,200,0.1) 50%, rgba(140,175,245,0.4) 100%)`,
    cardShadow:    "0 32px 64px rgba(4,8,16,0.65), 0 0 50px rgba(100,130,215,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
    edgeHighlight: "linear-gradient(90deg, transparent, rgba(155,195,255,0.38), transparent)",
    sweep:         "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 55%, rgba(255,255,255,0.08) 100%)",
    // Icon
    outerAura:     "radial-gradient(circle, rgba(110,150,245,0.22) 0%, transparent 70%)",
    ringOuter:     "rgba(255,255,255,0.08)",
    ring:          "rgba(255,255,255,0.18)",
    ringTop:       "rgba(255,255,255,0.72)",
    ringDash:      "rgba(255,255,255,0.18)",
    pulse:         "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 62%, transparent 100%)",
    iconColor:     "#c4d0ea",
    iconGlow:      "rgba(150,185,245,0.4)",
    iconCoreBg:    "radial-gradient(circle, rgba(100,130,215,0.22) 0%, transparent 72%)",
    // Text + badge
    titleGradient: "linear-gradient(135deg, #ffffff 15%, #adc4f5 100%)",
    textSub:       "rgba(255,255,255,0.58)",
    title:         "Switching to Dark Mode",
    subtitle:      "Dimming the lights...",
    badgeBg:       "rgba(130,165,245,0.1)",
    badgeBorder:   "rgba(130,165,245,0.24)",
    badgeText:     "rgba(170,200,255,0.85)",
    badgeDot:      "rgba(160,195,255,0.9)",
  },
  light: {
    overlayBg:     "rgba(210, 230, 255, 0.88)",
    skyGradient:   "linear-gradient(180deg, rgba(160,205,255,0.55) 0%, rgba(220,238,255,0.3) 40%, rgba(248,249,250,0) 100%)",
    // Card
    cardBgImg:     `linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(244,250,255,0.98) 100%),
                    linear-gradient(135deg, rgba(255,210,40,0.52) 0%, rgba(255,160,20,0.12) 50%, rgba(255,210,40,0.46) 100%)`,
    cardShadow:    "0 32px 64px rgba(10,18,36,0.2), 0 0 50px rgba(255,185,20,0.1)",
    edgeHighlight: "linear-gradient(90deg, transparent, rgba(255,215,40,0.5), transparent)",
    sweep:         "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.04) 100%)",
    // Icon
    outerAura:     "radial-gradient(circle, rgba(255,195,25,0.28) 0%, transparent 70%)",
    ringOuter:     "rgba(0,0,0,0.06)",
    ring:          "rgba(0,0,0,0.1)",
    ringTop:       "rgba(0,0,0,0.42)",
    ringDash:      "rgba(0,0,0,0.12)",
    pulse:         "radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.03) 62%, transparent 100%)",
    iconColor:     "#ffc107",
    iconGlow:      "rgba(255,195,30,0.5)",
    iconCoreBg:    "radial-gradient(circle, rgba(255,200,30,0.22) 0%, transparent 72%)",
    // Text + badge
    titleGradient: "linear-gradient(135deg, #0a1628 15%, #1a4a8a 100%)",
    textSub:       "rgba(0,0,0,0.55)",
    title:         "Switching to Light Mode",
    subtitle:      "Brightening things up...",
    badgeBg:       "rgba(255,190,20,0.1)",
    badgeBorder:   "rgba(255,190,20,0.3)",
    badgeText:     "rgba(130,70,0,0.88)",
    badgeDot:      "rgba(255,160,20,0.95)",
  },
};

const HOLD_MS  = 700;
const FADE_S   = 0.28;

// ─── Cloud SVG ────────────────────────────────────────────────────────────────
function CloudShape({ width = 140, opacity = 0.82 }) {
  return (
    <svg
      width={width}
      height={Math.round(width * 0.58)}
      viewBox="0 0 140 82"
      fill="none"
      style={{ display: "block", filter: "drop-shadow(0 6px 14px rgba(80,120,200,0.18))" }}
    >
      {/* Base pill */}
      <ellipse cx="70" cy="64" rx="60" ry="16" fill={`rgba(255,255,255,${opacity})`} />
      {/* Bumps */}
      <circle cx="50"  cy="50" r="22" fill={`rgba(255,255,255,${opacity})`} />
      <circle cx="78"  cy="42" r="28" fill={`rgba(255,255,255,${opacity + 0.03})`} />
      <circle cx="106" cy="52" r="18" fill={`rgba(255,255,255,${opacity})`} />
      <circle cx="30"  cy="58" r="14" fill={`rgba(255,255,255,${opacity - 0.05})`} />
      {/* Subtle inner highlight */}
      <ellipse cx="76" cy="36" rx="18" ry="10" fill={`rgba(255,255,255,${opacity * 0.5})`} />
    </svg>
  );
}

// left/top positions; drift is how many px rightward during the hold
const CLOUDS = [
  { width: 170, left: "-2%",  top: "6%",  drift: 28, opacity: 0.82, delay: 0.04, dur: 1.1 },
  { width: 230, left: "58%",  top: "10%", drift: 22, opacity: 0.72, delay: 0.0,  dur: 1.3 },
  { width: 120, left: "1%",   top: "60%", drift: 20, opacity: 0.75, delay: 0.1,  dur: 1.2 },
  { width: 190, left: "62%",  top: "68%", drift: 25, opacity: 0.68, delay: 0.06, dur: 1.4 },
  { width: 105, left: "78%",  top: "36%", drift: 16, opacity: 0.6,  delay: 0.14, dur: 1.0 },
  { width: 140, left: "20%",  top: "80%", drift: 18, opacity: 0.55, delay: 0.18, dur: 1.6 },
];

function DayScene() {
  return (
    <>
      {/* Sun glow — top-right corner */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 340, height: 340, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,220,60,0.45) 0%, rgba(255,180,20,0.18) 45%, transparent 70%)",
        filter: "blur(24px)", pointerEvents: "none",
      }} />

      {/* Animated clouds */}
      {CLOUDS.map((c, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: c.drift, opacity: 1 }}
          transition={{ delay: c.delay, duration: c.dur, ease: "easeOut" }}
          style={{ position: "absolute", top: c.top, left: c.left, pointerEvents: "none" }}
        >
          <CloudShape width={c.width} opacity={c.opacity} />
        </motion.div>
      ))}
    </>
  );
}

// ─── Stars + shooting stars ───────────────────────────────────────────────────
const STARS = [
  { top: "4%",  left: "7%",   s: 3,   dur: 2.1, d: 0.00 },
  { top: "2%",  left: "70%",  s: 4.5, dur: 1.8, d: 0.08 },
  { top: "10%", left: "86%",  s: 2.5, dur: 2.4, d: 0.14 },
  { top: "7%",  left: "43%",  s: 2,   dur: 1.6, d: 0.04 },
  { top: "18%", left: "13%",  s: 3.5, dur: 2.2, d: 0.10 },
  { top: "16%", left: "91%",  s: 2,   dur: 1.9, d: 0.06 },
  { top: "33%", left: "3%",   s: 2.5, dur: 2.0, d: 0.18 },
  { top: "30%", left: "94%",  s: 3,   dur: 1.7, d: 0.12 },
  { top: "54%", left: "5%",   s: 4,   dur: 2.3, d: 0.09 },
  { top: "50%", left: "90%",  s: 2.5, dur: 1.8, d: 0.20 },
  { top: "66%", left: "9%",   s: 3,   dur: 2.1, d: 0.24 },
  { top: "63%", left: "84%",  s: 2,   dur: 2.5, d: 0.16 },
  { top: "76%", left: "18%",  s: 3.5, dur: 1.9, d: 0.07 },
  { top: "80%", left: "76%",  s: 2.5, dur: 2.2, d: 0.28 },
  { top: "88%", left: "38%",  s: 3,   dur: 2.0, d: 0.22 },
  { top: "86%", left: "58%",  s: 2,   dur: 1.6, d: 0.11 },
  { top: "70%", left: "48%",  s: 1.5, dur: 2.4, d: 0.32 },
  { top: "24%", left: "60%",  s: 1.5, dur: 2.3, d: 0.30 },
  { top: "46%", left: "26%",  s: 2.5, dur: 2.1, d: 0.15 },
  { top: "13%", left: "33%",  s: 2,   dur: 1.9, d: 0.34 },
  { top: "58%", left: "68%",  s: 3,   dur: 1.7, d: 0.19 },
  { top: "40%", left: "97%",  s: 1.5, dur: 2.0, d: 0.26 },
];

const SHOOTS = [
  { top: "10%", left: "68%", animDelay: "0.25s" },
  { top: "22%", left: "12%", animDelay: "0.55s" },
];

const starContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.022, delayChildren: 0.06 } },
};
const starItem = {
  hidden:  { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: "easeOut" } },
};

function NightScene() {
  return (
    <>
      {/* Moon ambient glow */}
      <div style={{
        position: "absolute", top: "4%", right: "6%",
        width: 220, height: 220, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(130,165,255,0.22) 0%, transparent 70%)",
        filter: "blur(22px)", pointerEvents: "none",
      }} />

      {/* Stars — staggered pop-in then twinkle */}
      <motion.div
        variants={starContainer}
        initial="hidden"
        animate="visible"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {STARS.map((star, i) => (
          <motion.div
            key={i}
            variants={starItem}
            style={{ position: "absolute", top: star.top, left: star.left }}
          >
            <div style={{
              width: star.s, height: star.s,
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: `0 0 ${star.s * 2.4}px #fff, 0 0 ${star.s * 5}px rgba(200,220,255,0.6)`,
              animation: `ts-twinkle ${star.dur}s ease-in-out ${star.d}s infinite`,
            }} />
          </motion.div>
        ))}
      </motion.div>

      {/* Shooting stars */}
      {SHOOTS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute", top: s.top, left: s.left,
            width: 110, height: 1.5, borderRadius: 2,
            background: "linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0))",
            animation: `ts-shoot 0.72s ease-out ${s.animDelay} both`,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

// ─── OverlayInner ─────────────────────────────────────────────────────────────
function OverlayInner({ targetMode, onMidpoint, onRequestExit }) {
  const onMidpointRef    = useRef(onMidpoint);
  const onRequestExitRef = useRef(onRequestExit);
  useEffect(() => { onMidpointRef.current    = onMidpoint;    }, [onMidpoint]);
  useEffect(() => { onRequestExitRef.current = onRequestExit; }, [onRequestExit]);

  useEffect(() => {
    async function run() {
      await new Promise((r) => setTimeout(r, HOLD_MS));
      onMidpointRef.current?.();
      await new Promise((r) => setTimeout(r, 55));
      onRequestExitRef.current?.();
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDark = targetMode === "dark";
  const p = PALETTE[targetMode] ?? PALETTE.dark;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: FADE_S, ease: "easeInOut" }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        pointerEvents: "none", overflow: "hidden",
        background: p.overlayBg,
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Sky gradient layer (day only) */}
      {p.skyGradient && (
        <div style={{
          position: "absolute", inset: 0,
          background: p.skyGradient,
          pointerEvents: "none",
        }} />
      )}

      {/* Scene elements — behind card */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        {isDark ? <NightScene /> : <DayScene />}
      </div>

      {/* Card — above scene */}
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: FADE_S, ease: [0.34, 1.1, 0.64, 1] }}
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: 400, margin: "0 16px",
          padding: "32px 32px 24px", borderRadius: 24,
          // Gradient border trick: first bg = card fill, second = border gradient
          border: "1.5px solid transparent",
          backgroundImage: p.cardBgImg,
          backgroundOrigin: "padding-box, border-box",
          backgroundClip: "padding-box, border-box",
          boxShadow: p.cardShadow,
          overflow: "hidden",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
        }}
      >
        {/* Inner top-edge highlight — glass effect */}
        <div style={{
          position: "absolute", top: 0, left: "12%", right: "12%", height: 1,
          background: p.edgeHighlight, pointerEvents: "none",
        }} />

        {/* Sweep bar */}
        <div style={{
          position: "absolute", top: 0, left: "-35%",
          width: "40%", height: 3,
          background: p.sweep,
          animation: "ts-sweep 2.6s linear infinite",
          pointerEvents: "none",
        }} />

        {/* Icon ring */}
        <div style={{
          position: "relative", width: 162, height: 162,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Soft outer aura */}
          <div style={{
            position: "absolute", width: 210, height: 210, borderRadius: "50%",
            background: p.outerAura, filter: "blur(22px)", pointerEvents: "none",
          }} />
          {/* Extra slow outer ring */}
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: `1px solid ${p.ringOuter}`,
            animation: "ts-spin-slow 9s linear infinite",
          }} />
          {/* Main spinning arc ring */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid ${p.ring}`,
            borderTopColor: p.ringTop, borderRightColor: p.ring,
            animation: "ts-spin 1s linear infinite",
          }} />
          {/* Inner dashed counter-spin */}
          <div style={{
            position: "absolute", inset: 14, borderRadius: "50%",
            border: `1.5px dashed ${p.ringDash}`,
            animation: "ts-spin-r 1.65s linear infinite",
          }} />
          {/* Pulse glow disk */}
          <div style={{
            position: "absolute", inset: 20, borderRadius: "50%",
            background: p.pulse,
            animation: "ts-pulse 2.6s ease-in-out infinite",
          }} />
          {/* Icon core */}
          <div style={{
            position: "relative", zIndex: 2,
            width: 78, height: 78, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: p.iconCoreBg,
            boxShadow: `0 0 32px ${p.iconGlow}, 0 0 64px ${p.iconGlow}`,
            animation: "ts-icon-pop 0.52s cubic-bezier(0.34,1.56,0.64,1) 0.06s both",
          }}>
            {isDark
              ? <DarkModeIcon  style={{ fontSize: 50, color: p.iconColor }} />
              : <LightModeIcon style={{ fontSize: 50, color: p.iconColor }} />
            }
          </div>
        </div>

        {/* Text */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            margin: "0 0 7px",
            fontFamily: "'Comfortaa', cursive, sans-serif",
            fontWeight: 800, fontSize: "1.15rem",
            background: p.titleGradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            {p.title}
          </p>
          <p style={{
            margin: 0,
            fontFamily: "'Comfortaa', cursive, sans-serif",
            fontSize: "0.85rem", color: p.textSub, lineHeight: 1.65,
          }}>
            {p.subtitle}
          </p>
        </div>

        {/* Mode badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.3, ease: [0.34, 1.2, 0.64, 1] }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 13px 4px 9px", borderRadius: 999,
            background: p.badgeBg, border: `1px solid ${p.badgeBorder}`,
            fontSize: "0.7rem", fontFamily: "'Comfortaa', cursive, sans-serif",
            fontWeight: 700, letterSpacing: "0.07em",
            color: p.badgeText,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: p.badgeDot,
            boxShadow: `0 0 7px ${p.badgeDot}`,
            animation: "ts-pulse 2s ease-in-out infinite",
          }} />
          {isDark ? "Dark Mode" : "Light Mode"}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Keyframes ────────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes ts-sweep   { 0%   { left:-35%; }  100% { left:105%; } }
  @keyframes ts-spin      { from { transform:rotate(0deg);   } to { transform:rotate(360deg);  } }
  @keyframes ts-spin-r    { from { transform:rotate(360deg); } to { transform:rotate(0deg);    } }
  @keyframes ts-spin-slow { from { transform:rotate(0deg);   } to { transform:rotate(360deg);  } }
  @keyframes ts-pulse   { 0%,100% { opacity:.62; transform:scale(.96); } 50% { opacity:.86; transform:scale(.99); } }
  @keyframes ts-icon-pop {
    0%   { opacity:0; transform:scale(.3) rotate(-20deg); }
    65%  { opacity:1; transform:scale(1.12) rotate(5deg); }
    100% { opacity:1; transform:scale(1)   rotate(0deg); }
  }
  @keyframes ts-twinkle {
    0%,100% { opacity:.18; transform:scale(.6);  }
    50%     { opacity:1;   transform:scale(1.35); }
  }
  @keyframes ts-shoot {
    0%   { transform:translate(0,0);          opacity:0;   }
    8%   { opacity:1; }
    88%  { opacity:.9; }
    100% { transform:translate(-220px,145px); opacity:0;   }
  }
`;

// ─── Public ────────────────────────────────────────────────────────────────────
export default function ThemeSwitchOverlay({ active, targetMode, onMidpoint, onDone }) {
  const [show, setShow] = useState(false);

  // Inject keyframes imperatively — avoids React hydration mismatch caused by
  // rendering a <style> tag inside the component tree (browser moves it in DOM)
  useEffect(() => {
    const el = document.createElement("style");
    el.setAttribute("data-ts-keyframes", "1");
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    if (active) setShow(true);
  }, [active]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <OverlayInner
          key={targetMode}
          targetMode={targetMode}
          onMidpoint={onMidpoint}
          onRequestExit={() => setShow(false)}
        />
      )}
    </AnimatePresence>
  );
}
