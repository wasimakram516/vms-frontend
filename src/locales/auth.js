import common from "./common";

// Admin/staff login flow.
const auth = {
  en: {
    ...common.en,

    loginPanelTitle: "Admin Portal",
    loginPanelSubtitle: "Enter your credentials to access the Sinan Sentry admin tools.",
    loginTitle: "Admin sign in",
    loginSubtitle: "Enter your credentials to access the Sinan Sentry admin portal.",
    loginEmail: "Email",
    loginPassword: "Password",
    loginSigning: "Signing...",
    loginButton: "Login",
  },
  ar: {
    ...common.ar,

    loginPanelTitle: "بوابة الإدارة",
    loginPanelSubtitle: "أدخل بيانات اعتمادك للوصول إلى أدوات مسؤول سنان سنتري.",
    loginTitle: "تسجيل دخول المسؤول",
    loginSubtitle: "أدخل بيانات اعتمادك للوصول إلى بوابة مسؤول سنان سنتري.",
    loginEmail: "البريد الإلكتروني",
    loginPassword: "كلمة المرور",
    loginSigning: "جارٍ التسجيل...",
    loginButton: "تسجيل الدخول",
  },
};

export default auth;
