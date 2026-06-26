import { useSyncExternalStore } from "react";
import { Engine } from "./engine";

export function useEngine() {
  useSyncExternalStore(
    (callback) => Engine.inst.subscribe(callback),
    () => Engine.inst.updateCount,
    () => 0,
  );

  return Engine.inst;
}
