/**
 * Triggers a single short vibration pulse when enabled and supported.
 * Unsupported devices behave normally with no error or side effect.
 */
export function triggerTapVibration(enabled: boolean): void {
    if (!enabled) return;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
            navigator.vibrate(20);
        } catch {
            // Ignore hardware/permission vibration errors.
        }
    }
}

export function isVibrationSupported(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}
