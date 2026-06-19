export default async function globalTeardown() {
  const pid = process.env._E2E_ELECTRON_PID;
  if (pid) {
    try {
      process.kill(parseInt(pid, 10));
    } catch {
      // process may already be gone
    }
  }
}
