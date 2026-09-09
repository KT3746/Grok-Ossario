import { useEffect, useRef } from "react";
import { tickAmbience } from "@/lib/game/audio";
import { getAssets, type GameAssets } from "@/lib/game/assets";
import { juice, tickJuice } from "@/lib/game/juice";
import { renderFrame, type Cam } from "@/lib/game/raycast";
import { useGame } from "@/lib/game/store";
import { DIR_ANGLE } from "@/lib/game/types";

function unwrap(from: number, to: number) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

export function DungeonCanvas({ assets }: { assets: GameAssets }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const player = useGame((s) => s.player);
  const dungeon = useGame((s) => s.dungeon);
  const floor = useGame((s) => s.floor);
  const combat = useGame((s) => s.combat);
  const shake = useGame((s) => s.shake);
  const screen = useGame((s) => s.screen);

  const live = useRef({ player, dungeon, floor, combat, shake, screen });
  live.current = { player, dungeon, floor, combat, shake, screen };

  const cam = useRef<Cam>({ x: player.x + 0.5, y: player.y + 0.5, ang: DIR_ANGLE[player.dir] });
  const tween = useRef({
    fx: player.x + 0.5,
    fy: player.y + 0.5,
    fa: DIR_ANGLE[player.dir] as number,
    tx: player.x + 0.5,
    ty: player.y + 0.5,
    ta: DIR_ANGLE[player.dir] as number,
    t0: 0,
    dur: 210,
  });

  useEffect(() => {
    const c = cam.current;
    const tw = tween.current;
    tw.fx = c.x;
    tw.fy = c.y;
    tw.fa = c.ang;
    tw.tx = player.x + 0.5;
    tw.ty = player.y + 0.5;
    tw.ta = unwrap(c.ang, DIR_ANGLE[player.dir]);
    tw.t0 = performance.now();
    tw.dur = 210;
  }, [player.x, player.y, player.dir]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth ?? window.innerWidth;
      const cssH = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const iw = Math.max(320, Math.round(Math.min(cssW, 720) * (dpr > 1.5 ? 0.7 : 0.85)));
      const ih = Math.max(240, Math.round(iw * (cssH / Math.max(1, cssW))));
      if (canvas.width !== iw || canvas.height !== ih) {
        canvas.width = iw;
        canvas.height = ih;
      }
      const loaded = getAssets();
      const { player: p, dungeon: d, floor: fl, combat: co, shake: sh } = live.current;
      if (!loaded || !d) {
        ctx.fillStyle = "#0a0908";
        ctx.fillRect(0, 0, iw, ih);
        return;
      }

      const tw = tween.current;
      const u = Math.min(1, (now - tw.t0) / tw.dur);
      const e = easeOut(u);
      cam.current.x = tw.fx + (tw.tx - tw.fx) * e;
      cam.current.y = tw.fy + (tw.ty - tw.fy) * e;
      cam.current.ang = tw.fa + (tw.ta - tw.fa) * e;

      if (juice.embers.length < 16) {
        juice.embers.push({
          x: Math.random() * iw,
          y: ih * (0.52 + Math.random() * 0.42),
          vx: (Math.random() - 0.5) * 10,
          vy: -14 - Math.random() * 22,
          life: 1,
          max: 1.6 + Math.random() * 1.8,
          r: 0.7 + Math.random() * 1.4,
        });
      }
      tickJuice(dt, now / 1000, sh);
      tickAmbience(now);

      renderFrame(ctx, iw, ih, cam.current, d, p, loaded, now / 1000, fl, co?.enemyId ?? null);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ imageRendering: "auto" }}
    />
  );
}
