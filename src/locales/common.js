// Shared keys used across flows (buttons, navbar, loader, theme switch,
// purpose-of-visit options, registration statuses, ID types).
// Flow dictionaries (registration, auth, gateStaff) spread this in.
const common = {
  en: {
    back: "Back",
    cancel: "Cancel",
    close: "Close",
    agree: "I Agree",
    submit: "Submit",
    sending: "Sending...",
    retry: "Retry",
    fieldRequired: "{{field}} is required",
    department: "Visiting Department",
    purposeOfVisit: "Purpose of Visit",
    pleaseSpecify: "Please specify",

    // Theme / loader
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    switchingToDark: "Switching to Dark Mode",
    switchingToLight: "Switching to Light Mode",
    dimmingLights: "Dimming the lights...",
    brighteningUp: "Brightening things up...",
    loaderTitle: "Loading Sinan Sentry",
    loaderDescription: "Preparing your experience...",

    // Layout / Navbar
    navbarBrand: "Sentry Visitor Portal",
    layoutBrandTitle: "Sinan Sentry",
    layoutBrandSubtitle:
      "Experience a seamless visitor journey at Sinan. Please select your visit type to proceed.",
    navSwitchToDark: "Switch to dark mode",
    navSwitchToLight: "Switch to light mode",
    navViewProfile: "View profile",
    navLoggedInAs: "logged in as",
    navGoToDashboard: "Go to Dashboard",
    navLogout: "Logout",
    navConfirmLogoutTitle: "Confirm Logout",
    navConfirmLogoutMessage: "Are you sure you want to log out of your account?",

    // Purpose of visit options (display labels — internal values stay in English)
    purposeMeeting: "Meeting",
    purposeVendorVisit: "Vendor Visit",
    purposeContractorWork: "Contractor Work",
    purposeAuditInspection: "Audit / Inspection",
    purposeDelivery: "Delivery",
    purposeInterview: "Interview",
    purposeTraining: "Training",
    purposeMaintenance: "Maintenance",
    purposeGovernmentVisit: "Government Visit",
    purposeVipVisit: "VIP Visit",
    purposeOther: "Other",

    // Registration statuses
    statusPending: "Pending",
    statusAdminApproved: "Dept. Approved",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusCheckedIn: "Checked In",
    statusCheckedOut: "Checked Out",
    statusVisitEnded: "Visit Ended",
    statusCancelled: "Cancelled",
    statusExpired: "Expired",

    // ID types
    idTypeOmanId: "Oman ID",
    idTypePassport: "Passport",
    idTypeId: "ID",
  },
  ar: {
    back: "رجوع",
    cancel: "إلغاء",
    close: "إغلاق",
    agree: "أوافق",
    submit: "إرسال",
    sending: "جارٍ الإرسال...",
    retry: "إعادة المحاولة",
    fieldRequired: "{{field}} مطلوب",
    department: "القسم الزائر",
    purposeOfVisit: "الغرض من الزيارة",
    pleaseSpecify: "حدد من فضلك",

    // Theme / loader
    darkMode: "الوضع الداكن",
    lightMode: "الوضع الفاتح",
    switchingToDark: "التبديل إلى الوضع الداكن",
    switchingToLight: "التبديل إلى الوضع الفاتح",
    dimmingLights: "تخفيف الإضاءة...",
    brighteningUp: "إضاءة الشاشة...",
    loaderTitle: "جارٍ تحميل سنان سنتري",
    loaderDescription: "تجهيز تجربتك...",

    // Layout / Navbar
    navbarBrand: "بوابة زوار سنتري",
    layoutBrandTitle: "سنان سنتري",
    layoutBrandSubtitle:
      "استمتع برحلة زيارة سلسة في سنان. يرجى اختيار نوع زيارتك للمتابعة.",
    navSwitchToDark: "التبديل إلى الوضع الداكن",
    navSwitchToLight: "التبديل إلى الوضع الفاتح",
    navViewProfile: "عرض الملف الشخصي",
    navLoggedInAs: "مسجّل الدخول كـ",
    navGoToDashboard: "الانتقال إلى لوحة التحكم",
    navLogout: "تسجيل الخروج",
    navConfirmLogoutTitle: "تأكيد تسجيل الخروج",
    navConfirmLogoutMessage: "هل أنت متأكد أنك تريد تسجيل الخروج من حسابك؟",

    // Purpose of visit options (display labels — internal values stay in English)
    purposeMeeting: "اجتماع",
    purposeVendorVisit: "زيارة مورّد",
    purposeContractorWork: "أعمال مقاولة",
    purposeAuditInspection: "تدقيق / تفتيش",
    purposeDelivery: "توصيل",
    purposeInterview: "مقابلة عمل",
    purposeTraining: "تدريب",
    purposeMaintenance: "صيانة",
    purposeGovernmentVisit: "زيارة حكومية",
    purposeVipVisit: "زيارة VIP",
    purposeOther: "أخرى",

    // Registration statuses
    statusPending: "قيد الانتظار",
    statusAdminApproved: "معتمد من القسم",
    statusApproved: "معتمد",
    statusRejected: "مرفوض",
    statusCheckedIn: "تم تسجيل الدخول",
    statusCheckedOut: "تم تسجيل الخروج",
    statusVisitEnded: "انتهت الزيارة",
    statusCancelled: "ملغاة",
    statusExpired: "منتهية الصلاحية",

    // ID types
    idTypeOmanId: "الهوية العمانية",
    idTypePassport: "جواز السفر",
    idTypeId: "الهوية",
  },
};

export default common;
