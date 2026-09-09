import common from "./common";

// Unified login flow, shared by every role (admins and staff types alike).
const auth = {
  en: {
    ...common.en,

    loginPanelTitle: "Sinan Sentry",
    loginPanelSubtitle: "Enter your credentials to access the Sinan Sentry portal.",
    loginTitle: "Sign in",
    loginSubtitle: "Enter your credentials to continue to your Sinan Sentry account.",
    loginEmail: "Email",
    loginPassword: "Password",
    loginSigning: "Signing...",
    loginButton: "Login",
  },
  ar: {
    ...common.ar,

    loginPanelTitle: "سنان سنتري",
    loginPanelSubtitle: "أدخل بيانات اعتمادك للوصول إلى بوابة سنان سنتري.",
    loginTitle: "تسجيل الدخول",
    loginSubtitle: "أدخل بيانات اعتمادك لمتابعة الدخول إلى حسابك في سنان سنتري.",
    loginEmail: "البريد الإلكتروني",
    loginPassword: "كلمة المرور",
    loginSigning: "جارٍ التسجيل...",
    loginButton: "تسجيل الدخول",
  },
};

export default auth;
