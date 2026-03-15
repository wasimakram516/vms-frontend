const fontFamilies = {
  arial: {
    name: "Arial",
    family: "Arial",
    files: [
      { path: "/fonts/arial/ArialBold.ttf", weight: 700, style: "normal" },
      { path: "/fonts/arial/ArialRegular.ttf", weight: 400, style: "normal" }
    ]
  },

  futura: {
    name: "Futura",
    family: "Futura",
    files: [
      { path: "/fonts/futura/FuturaStdBold.otf", weight: 700, style: "normal" },
      { path: "/fonts/futura/FuturaStdBoldOblique.otf", weight: 700, style: "italic" },
      { path: "/fonts/futura/FuturaStdBook.otf", weight: 400, style: "normal" },
      { path: "/fonts/futura/FuturaStdBookOblique.otf", weight: 400, style: "italic" },
      { path: "/fonts/futura/FuturaStdCondensed.otf", weight: 400, style: "normal" },
      { path: "/fonts/futura/FuturaStdCondensedBold.otf", weight: 700, style: "normal" },
      { path: "/fonts/futura/FuturaStdCondensedBoldObl.otf", weight: 700, style: "italic" },
      { path: "/fonts/futura/FuturaStdCondensedExtraBd.otf", weight: 900, style: "normal" },
      { path: "/fonts/futura/FuturaStdCondensedLight.otf", weight: 300, style: "normal" },
      { path: "/fonts/futura/FuturaStdCondensedLightObl.otf", weight: 300, style: "italic" },
      { path: "/fonts/futura/FuturaStdCondensedOblique.otf", weight: 400, style: "italic" },
      { path: "/fonts/futura/FuturaStdCondExtraBoldObl.otf", weight: 700, style: "italic" },
      { path: "/fonts/futura/FuturaStdExtraBold.otf", weight: 700, style: "normal" },
      { path: "/fonts/futura/FuturaStdExtraBoldOblique.otf", weight: 700, style: "italic" },
      { path: "/fonts/futura/FuturaStdHeavy.otf", weight: 800, style: "normal" },
      { path: "/fonts/futura/FuturaStdHeavyOblique.otf", weight: 800, style: "italic" },
      { path: "/fonts/futura/FuturaStdLight.otf", weight: 300, style: "normal" },
      { path: "/fonts/futura/FuturaStdLightOblique.otf", weight: 300, style: "italic" },
      { path: "/fonts/futura/FuturaStdMedium.otf", weight: 500, style: "normal" },
      { path: "/fonts/futura/FuturaStdMediumOblique.otf", weight: 500, style: "italic" }
    ]
  },

  IBMPlexSansArabic: {
    name: "IBM Plex Sans Arabic",
    family: "IBM Plex Sans Arabic",
    files: [
      { path: "/fonts/IBMPlexSansArabic/IBMPlexSansArabic-Bold.ttf", weight: 700, style: "normal" },
      { path: "/fonts/IBMPlexSansArabic/IBMPlexSansArabic-Medium.ttf", weight: 500, style: "normal" },
      { path: "/fonts/IBMPlexSansArabic/IBMPlexSansArabic-Regular.ttf", weight: 400, style: "normal" }
    ]
  },

  love: {
    name: "Love",
    family: "Love",
    files: [
      { path: "/fonts/love/LoveDays-2v7Oe.ttf", weight: 400, style: "normal" }
    ]
  },

  Midable: {
    name: "Midable",
    family: "Midable",
    files: [
      { path: "/fonts/Midable/Midable.ttf", weight: 400, style: "normal" }
    ]
  },

  romeo: {
    name: "Romeo",
    family: "Romeo",
    files: [
      { path: "/fonts/romeo/Pinky Peace.otf", weight: 400, style: "normal" }
    ]
  },

  welcome: {
    name: "Welcome",
    family: "Welcome",
    files: [
      { path: "/fonts/welcome/Welcome September.ttf", weight: 400, style: "normal" }
    ]
  }
};

export function scanFonts() {
  return Object.values(fontFamilies);
}

export function getFontFamily(fontName) {
  const font = Object.values(fontFamilies).find(f => f.name === fontName || f.family === fontName);
  return font ? font.family : "Arial";
}
