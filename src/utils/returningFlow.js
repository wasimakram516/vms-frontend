/**
 * Shared post-verification handler for all returning-visitor paths.
 * Mirrors the success logic that was previously inline in /register/otp/page.js
 * so the ID+phone path produces the exact same downstream flow as email-OTP.
 *
 * @param {object} res            - response from verifyOtp / verifyReturningById
 * @param {object} ctx
 * @param {Function} ctx.setFlowState   - from useVisitor
 * @param {Function} ctx.setVisitorData - from useVisitor
 * @param {object}   ctx.router         - from useRouter
 * @param {Function} ctx.checkNdaValidity - from registrationService
 */
export async function applyReturningVerification(res, { setFlowState, setVisitorData, router, checkNdaValidity }) {
    const visitorEmail = res.user?.email;
    let ndaStillValid = true;

    if (visitorEmail) {
        try {
            const validityRes = await checkNdaValidity(visitorEmail);
            if (validityRes?.ndaRequired) ndaStillValid = false;
        } catch {
            // NDA check failure must not block the returning flow
        }
    }

    const activeReg = res.activeRegistration ?? null;

    setFlowState((prev) => ({
        ...prev,
        otpVerified: true,
        ndaAccepted: ndaStillValid,
        isReturning: true,
        isEditMode: Boolean(activeReg),
        activeRegistration: activeReg,
        currentStep: ndaStillValid ? "booking" : "nda",
    }));

    setVisitorData((prev) => {
        const newData = { ...prev };

        if (res.user) {
            newData.userId = res.user.id;
            newData.fullName = res.user.fullName || prev.fullName;
            newData.email = res.user.email || prev.email;
            newData.phone = res.user.phone || prev.phone;
        }

        if (res.lastFieldValues) {
            newData.dynamicFields = {
                ...prev.dynamicFields,
                ...res.lastFieldValues,
            };

            const isoCode =
                res.phoneIsoCode || res.phone_iso_code || res.isoCode || res.iso_code;
            if (isoCode) {
                newData.phoneIsoCode = isoCode;
            }

            if (res.user?.fullName && !newData.dynamicFields.full_name) {
                newData.dynamicFields.full_name = res.user.fullName;
            }
            if (res.user?.email && !newData.dynamicFields.email) {
                newData.dynamicFields.email = res.user.email;
            }
            if (res.user?.phone && !newData.dynamicFields.phone) {
                newData.dynamicFields.phone = res.user.phone;
            }
        }

        return newData;
    });

    router.push("/register/booking");
}
