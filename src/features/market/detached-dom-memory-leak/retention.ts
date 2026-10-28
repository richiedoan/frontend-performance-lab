export const MAX_DRAWER_ROOTS = 4;
export function createDrawerRetention(retainNodes: boolean) {
  // Named cache is the intentional baseline retainer; never exported to diagnostics.
  const retainedDrawerRoots: HTMLElement[] = [];
  const recordIds: string[] = [];
  return {
    capture(node: HTMLElement, recordId: string) {
      if (retainNodes && !retainedDrawerRoots.includes(node)) {
        retainedDrawerRoots.push(node);
        if (retainedDrawerRoots.length > MAX_DRAWER_ROOTS)
          retainedDrawerRoots.shift();
      }
      recordIds.push(recordId);
      if (recordIds.length > MAX_DRAWER_ROOTS) recordIds.shift();
    },
    inspect() {
      return {
        retainedRoots: retainedDrawerRoots.length,
        disconnectedRoots: retainedDrawerRoots.filter(
          (node) => !node.isConnected,
        ).length,
        retainedElements: retainedDrawerRoots.reduce(
          (count, node) => count + 1 + node.querySelectorAll('*').length,
          0,
        ),
        recordIds: [...recordIds],
      };
    },
    clear() {
      retainedDrawerRoots.length = 0;
      recordIds.length = 0;
    },
  };
}
export type DrawerRetention = ReturnType<typeof createDrawerRetention>;
// A bounded baseline cache intentionally survives SPA route unmounts.
export const baselineDrawerRetention = createDrawerRetention(true);
