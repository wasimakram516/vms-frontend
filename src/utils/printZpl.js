export async function printZpl(zpl, { timeoutMs = 8000 } = {}) {
  if (typeof window === "undefined") throw new Error("Not in browser");
  if (!zpl || typeof zpl !== "string") throw new Error("Invalid ZPL payload");

  const waitForBP = () =>
    new Promise((resolve, reject) => {
      if (window.BrowserPrint) return resolve(window.BrowserPrint);
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if (window.BrowserPrint) {
          clearInterval(iv);
          resolve(window.BrowserPrint);
        } else if (tries > 40) { // ~4s
          clearInterval(iv);
          reject(new Error("Zebra Browser Print not loaded"));
        }
      }, 100);
    });

  const BP = window.BrowserPrint || (await waitForBP());

  const getPrinter = () =>
    new Promise((resolve, reject) => {
      BP.getDefaultDevice(
        "printer",
        (device) => {
          if (device) return resolve(device);
          // Fallback: first available printer
          BP.getLocalDevices(
            (devices = []) =>
              resolve(devices.find((d) => d.deviceType === "printer") || null),
            () => resolve(null)
          );
        },
        (err) => reject(err || new Error("BrowserPrint error"))
      );
    });

  const device = await getPrinter();
  if (!device) throw new Error("No Zebra printer found");

  await new Promise((resolve, reject) => {
    let settled = false;
    const to = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Print timed out"));
      }
    }, timeoutMs);

    device.send(
      zpl,
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(to);
          resolve();
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(to);
          reject(err || new Error("Send failed"));
        }
      }
    );
  });
}
