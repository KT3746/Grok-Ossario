import { useEffect, useState } from "react";
import { loadAssets, type GameAssets } from "@/lib/game/assets";
import { unlockAudio } from "@/lib/game/audio";
import { juice } from "@/lib/game/juice";
import { useGame } from "@/lib/game/store";
import { DungeonCanvas } from "./DungeonCanvas";
import {
  CombatPanel,
  DeadPanel,
  HelpPanel,
  Hud,
  InventoryPanel,
  LootPanel,
  MinimapDock,
  TitleScreen,
  TouchPad,
} from "./Overlays";

export function GameApp() {
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const hydrate = useGame((s) => s.hydrate);
  const hydrated = useGame((s) => s.hydrated);
  const screen = useGame((s) => s.screen);
  const tryMove = useGame((s) => s.tryMove);
  const tryTurn = useGame((s) => s.tryTurn);
  const interact = useGame((s) => s.interact);
  const combatAction = useGame((s) => s.combatAction);
  const setScreen = useGame((s) => s.setScreen);
  const collectLoot = useGame((s) => s.collectLoot);
  const cancelLoot = useGame((s) => s.cancelLoot);
  const ackHelp = useGame((s) => s.ackHelp);
  const animating = useGame((s) => s.animating);

  useEffect(() => {
    hydrate();
    loadAssets()
      .then(setAssets)
      .catch((e: Error) => setErr(e.message));
  }, [hydrate]);

  useEffect(() => {
    juice.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      unlockAudio();
      if (e.repeat) return;
      if (screen === "title") return;
      if (screen === "help") {
        if (e.code === "Enter" || e.code === "Space") ackHelp();
        return;
      }
      if (screen === "loot") {
        if (e.code === "Enter" || e.code === "Space") collectLoot();
        if (e.code === "Escape") cancelLoot();
        return;
      }
      if (screen === "inventory") {
        if (e.code === "Escape" || e.code === "KeyI") setScreen("playing");
        return;
      }
      if (screen === "combat") {
        if (e.code === "Digit1" || e.code === "KeyA") combatAction("attack");
        if (e.code === "Digit2" || e.code === "KeyS") combatAction("defend");
        if (e.code === "Digit3" || e.code === "KeyD") combatAction("skill");
        if (e.code === "Digit4" || e.code === "KeyQ") combatAction("potion");
        if (e.code === "Digit5" || e.code === "KeyF") combatAction("flask");
        return;
      }
      if (screen !== "playing" || animating) return;
      if (e.code === "KeyW" || e.code === "ArrowUp") tryMove(1);
      else if (e.code === "KeyS" || e.code === "ArrowDown") tryMove(-1);
      else if (e.code === "KeyA" || e.code === "ArrowLeft") tryTurn(-1);
      else if (e.code === "KeyD" || e.code === "ArrowRight") tryTurn(1);
      else if (e.code === "KeyE" || e.code === "Space") {
        e.preventDefault();
        interact();
      } else if (e.code === "KeyI") setScreen("inventory");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    screen,
    animating,
    tryMove,
    tryTurn,
    interact,
    combatAction,
    setScreen,
    collectLoot,
    cancelLoot,
    ackHelp,
  ]);

  if (err) {
    return (
      <div className="game-root grid place-items-center px-6 text-center">
        <p className="text-sm text-muted">Não foi possível carregar a cripta.</p>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="game-root grid place-items-center bg-bg">
        <p className="font-display text-3xl tracking-wide text-muted">OSSÁRIO</p>
      </div>
    );
  }

  return (
    <div className="game-root">
      {assets && <DungeonCanvas assets={assets} />}
      {screen === "title" && <TitleScreen ready={!!assets} />}
      {assets && (
        <>
          <Hud assets={assets} />
          <MinimapDock />
          <TouchPad />
          <CombatPanel assets={assets} />
          <InventoryPanel assets={assets} />
          <LootPanel assets={assets} />
          <DeadPanel />
          <HelpPanel />
        </>
      )}
    </div>
  );
}
