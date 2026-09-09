import type { ReactNode } from "react";
import {
  Backpack,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FlaskConical,
  Heart,
  KeyRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { GameAssets } from "@/lib/game/assets";
import { APP_NAME, ENEMIES, ITEMS, SKILLS, floorName, xpToNext } from "@/lib/game/content";
import { getTile } from "@/lib/game/dungeon";
import { useGame } from "@/lib/game/store";
import { TILE_DOOR, TILE_LOCKED, TILE_WALL } from "@/lib/game/types";
import { publicUrl } from "@/lib/public-url";

function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function Btn({
  children,
  onClick,
  variant = "ghost",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "min-h-11 rounded-md px-4 text-sm font-medium tracking-wide transition-transform duration-150 ease-out",
        "enabled:active:scale-[0.98] disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg",
        variant === "ghost" && "border border-line bg-raised text-fg",
        variant === "danger" && "bg-hp text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TitleScreen({ ready }: { ready: boolean }) {
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const hasSave = useGame((s) => s.hasSave);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <img
        src={publicUrl("/game/title.jpg")}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/25" />
      <div className="pad-safe relative z-10 flex min-h-full flex-col justify-end pb-8">
        <div className="mx-auto w-full max-w-md px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.28em] text-muted">
            A cripta do rei morto
          </p>
          <h1 className="font-display text-6xl font-semibold leading-none tracking-tight text-fg md:text-7xl">
            {APP_NAME}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Explore a masmorra em primeira pessoa, lute por turnos, saqueie os ossos e desça
            até o trono.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {hasSave && (
              <Btn variant="primary" onClick={continueGame} className="w-full text-base" disabled={!ready}>
                Continuar
              </Btn>
            )}
            <Btn
              variant={hasSave ? "ghost" : "primary"}
              onClick={newGame}
              className="w-full text-base"
              disabled={!ready}
            >
              {ready ? "Nova expedição" : "Carregando a cripta…"}
            </Btn>
            <button
              type="button"
              onClick={toggleMute}
              className="self-start text-xs text-faint"
            >
              Som: {muted ? "off" : "on"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const dungeon = useGame((s) => s.dungeon);
  const player = useGame((s) => s.player);

  useEffect(() => {
    const c = ref.current;
    if (!c || !dungeon) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const n = Math.max(dungeon.w, dungeon.h);
    const s = c.width / n;
    ctx.fillStyle = "#0a0908";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < dungeon.h; y++) {
      for (let x = 0; x < dungeon.w; x++) {
        if (!dungeon.explored[y * dungeon.w + x]) continue;
        const t = getTile(dungeon, x, y);
        if (t === TILE_WALL) ctx.fillStyle = "#2a2622";
        else if (t === TILE_DOOR || t === TILE_LOCKED) ctx.fillStyle = "#6a5344";
        else ctx.fillStyle = "#3d342c";
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    ctx.fillStyle = "#ece8e1";
    const px = (player.x + 0.5) * s;
    const py = (player.y + 0.5) * s;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.2, s * 0.28), 0, Math.PI * 2);
    ctx.fill();
    const v = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ][player.dir]!;
    ctx.strokeStyle = "#ece8e1";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + v[0] * s * 0.7, py + v[1] * s * 0.7);
    ctx.stroke();
  }, [dungeon, player]);

  return (
    <canvas
      ref={ref}
      width={120}
      height={120}
      className="h-[7.5rem] w-[7.5rem] rounded-md border border-line/80 bg-bg/70"
    />
  );
}

export function Hud({ assets }: { assets: GameAssets }) {
  const player = useGame((s) => s.player);
  const floor = useGame((s) => s.floor);
  const toast = useGame((s) => s.toast);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const setScreen = useGame((s) => s.setScreen);
  const screen = useGame((s) => s.screen);
  const hpPct = Math.max(0, player.hp / Math.max(1, player.maxHp));

  if (screen === "title" || screen === "dead") return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 pad-safe">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-start justify-between gap-3 px-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <img
              src={assets.sprites["hero-bust"]?.src}
              alt=""
              className="h-10 w-10 rounded-md border border-line object-cover object-top"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg leading-none text-fg">{floorName(floor)}</span>
                <span className="font-mono text-xs tabular-nums text-muted">Nv {player.level}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hp-dim">
                <div
                  className="h-full rounded-full bg-hp transition-[width] duration-300"
                  style={{ width: `${hpPct * 100}%` }}
                />
              </div>
              <div className="mt-1 flex gap-3 text-[11px] tabular-nums text-muted">
                <span>
                  {player.hp}/{player.maxHp}
                </span>
                <span>{player.gold} ouros</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMute}
            className="grid h-11 w-11 place-items-center rounded-md border border-line bg-surface/80 text-fg"
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (screen === "inventory") setScreen("playing");
              else if (screen === "playing") setScreen("inventory");
            }}
            disabled={screen !== "playing" && screen !== "inventory"}
            className="grid h-11 w-11 place-items-center rounded-md border border-line bg-surface/80 text-fg disabled:opacity-40"
            aria-label="Inventário"
          >
            <Backpack className="size-4" />
          </button>
        </div>
      </div>
      {toast && (
        <p className="mx-auto mt-3 max-w-md px-4 text-center text-sm text-accent">{toast}</p>
      )}
    </div>
  );
}

export function TouchPad() {
  const screen = useGame((s) => s.screen);
  const tryMove = useGame((s) => s.tryMove);
  const tryTurn = useGame((s) => s.tryTurn);
  const interact = useGame((s) => s.interact);
  const player = useGame((s) => s.player);

  if (screen !== "playing") return null;

  const cell =
    "grid h-12 w-12 place-items-center rounded-md border border-line bg-surface/80 text-fg active:bg-raised";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pad-safe">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-end justify-between px-4 pb-2">
        <div className="grid grid-cols-3 gap-1.5">
          <span />
          <button type="button" className={cell} onClick={() => tryMove(1)} aria-label="Frente">
            <ChevronUp className="size-5" />
          </button>
          <span />
          <button type="button" className={cell} onClick={() => tryTurn(-1)} aria-label="Virar esquerda">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className={cell} onClick={() => tryMove(-1)} aria-label="Trás">
            <ChevronDown className="size-5" />
          </button>
          <button type="button" className={cell} onClick={() => tryTurn(1)} aria-label="Virar direita">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <KeyRound className="size-3.5" /> {player.keys}
            </span>
            <span className="inline-flex items-center gap-1">
              <FlaskConical className="size-3.5" /> {player.potions}
            </span>
          </div>
          <button
            type="button"
            onClick={interact}
            className="min-h-14 min-w-28 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Agir
          </button>
        </div>
      </div>
    </div>
  );
}

export function CombatPanel({ assets }: { assets: GameAssets }) {
  const combat = useGame((s) => s.combat);
  const dungeon = useGame((s) => s.dungeon);
  const player = useGame((s) => s.player);
  const combatAction = useGame((s) => s.combatAction);
  const screen = useGame((s) => s.screen);
  if (screen !== "combat" || !combat || !dungeon) return null;
  const enemy = dungeon.enemies.find((e) => e.id === combat.enemyId);
  if (!enemy) return null;
  const def = ENEMIES[enemy.kind]!;
  const readySkill = [...SKILLS]
    .reverse()
    .find((s) => player.level >= s.unlock && (player.skillCd[s.id] ?? 0) <= 0);
  const skill =
    readySkill ?? [...SKILLS].reverse().find((s) => player.level >= s.unlock);
  const cd = skill ? (player.skillCd[skill.id] ?? 0) : 99;
  const busy = combat.phase !== "player";
  const hpPct = Math.max(0, enemy.hp / Math.max(1, enemy.maxHp));

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 pad-safe">
      <div className="mx-auto max-w-lg rounded-t-xl border border-line bg-surface/95 px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <img
            src={assets.sprites[def.sprite]?.src}
            alt=""
            className="h-12 w-12 object-contain"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-xl leading-none">{def.name}</span>
              <span className="font-mono text-xs tabular-nums text-muted">
                {Math.max(0, enemy.hp)}/{enemy.maxHp}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hp-dim">
              <div className="h-full bg-hp" style={{ width: `${hpPct * 100}%` }} />
            </div>
          </div>
        </div>
        <p className="mt-3 min-h-10 text-sm leading-snug text-muted">{combat.log}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn variant="primary" disabled={busy} onClick={() => combatAction("attack")}>
            Atacar
          </Btn>
          <Btn disabled={busy} onClick={() => combatAction("defend")}>
            Defender
          </Btn>
          <Btn
            disabled={busy || !skill || cd > 0}
            onClick={() => combatAction("skill")}
          >
            {skill ? (cd > 0 ? `${skill.name} (${cd})` : skill.name) : "Habilidade"}
          </Btn>
          <Btn
            disabled={busy || player.potions <= 0}
            onClick={() => combatAction("potion")}
          >
            Poção ({player.potions})
          </Btn>
          {player.flasks > 0 && (
            <Btn
              className="col-span-2"
              disabled={busy}
              onClick={() => combatAction("flask")}
            >
              Frasco ({player.flasks})
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

export function InventoryPanel({ assets }: { assets: GameAssets }) {
  const screen = useGame((s) => s.screen);
  const player = useGame((s) => s.player);
  const setScreen = useGame((s) => s.setScreen);
  if (screen !== "inventory") return null;
  const slots = [
    ["Arma", player.weapon],
    ["Armadura", player.armor],
    ["Relíquia", player.relic],
  ] as const;
  const xp = xpToNext(player.level);

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-bg/60 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-xl border border-line bg-surface p-5 sm:rounded-xl">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Fardo</h2>
          <button type="button" className="text-sm text-muted" onClick={() => setScreen("playing")}>
            Fechar
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Nv {player.level} · {player.xp}/{xp} XP · {player.kills} {player.kills === 1 ? "queda" : "quedas"}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
          <div className="rounded-md bg-raised py-2">
            ATQ
            <div className="font-display text-lg text-fg">{player.atk}</div>
          </div>
          <div className="rounded-md bg-raised py-2">
            DEF
            <div className="font-display text-lg text-fg">{player.def}</div>
          </div>
          <div className="rounded-md bg-raised py-2">
            VIDA
            <div className="font-display text-lg text-fg">
              {player.hp}/{player.maxHp}
            </div>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {slots.map(([label, id]) => {
            const it = id ? ITEMS[id] : null;
            return (
              <li key={label} className="flex items-center gap-3 rounded-md border border-line bg-raised p-2.5">
                <img
                  src={assets.sprites[it?.icon ?? "item-ring"]?.src}
                  alt=""
                  className="h-11 w-11 object-contain"
                />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
                  <p className="truncate text-sm">{it?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted">{it?.desc ?? "Vazio"}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <FlaskConical className="size-4" /> {player.potions} poções
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-4" /> {player.flasks} frascos
          </span>
          <span className="inline-flex items-center gap-1">
            <KeyRound className="size-4" /> {player.keys}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LootPanel({ assets }: { assets: GameAssets }) {
  const loot = useGame((s) => s.loot);
  const screen = useGame((s) => s.screen);
  const collectLoot = useGame((s) => s.collectLoot);
  const cancelLoot = useGame((s) => s.cancelLoot);
  const floor = useGame((s) => s.floor);
  if (screen !== "loot" || !loot) return null;
  const item = loot.itemId ? ITEMS[loot.itemId] : null;

  if (loot.source === "stairs") {
    return (
      <div className="absolute inset-0 z-30 flex items-end bg-bg/55 sm:items-center sm:justify-center">
        <div className="w-full max-w-md rounded-t-xl border border-line bg-surface p-5 sm:rounded-xl">
          <h2 className="font-display text-2xl">Escadas de osso</h2>
          <p className="mt-2 text-sm text-muted">
            O andar {floor} está quieto. Descer para {floorName(floor + 1)}?
          </p>
          <div className="mt-6 flex gap-2">
            <Btn variant="primary" className="flex-1" onClick={collectLoot}>
              Descer
            </Btn>
            <Btn className="flex-1" onClick={cancelLoot}>
              Ficar
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-bg/55 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-xl border border-line bg-surface p-5 sm:rounded-xl">
        <h2 className="font-display text-2xl">{loot.source === "boss" ? "Espólio do senhor" : "Você encontrou"}</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {loot.gold > 0 && <li className="text-muted">{loot.gold} ouros</li>}
          {loot.potions > 0 && (
            <li className="text-muted">
              {loot.potions} {loot.potions === 1 ? "poção" : "poções"}
            </li>
          )}
          {loot.flasks > 0 && (
            <li className="text-muted">
              {loot.flasks} {loot.flasks === 1 ? "frasco maior" : "frascos maiores"}
            </li>
          )}
          {loot.keys > 0 && (
            <li className="text-muted">
              {loot.keys} {loot.keys === 1 ? "chave" : "chaves"}
            </li>
          )}
          {item && (
            <li className="flex items-center gap-3 rounded-md border border-line bg-raised p-2">
              <img src={assets.sprites[item.icon]?.src} alt="" className="h-12 w-12 object-contain" />
              <div>
                <p>{item.name}</p>
                <p className="text-xs text-muted">{item.desc}</p>
                {loot.replaced && ITEMS[loot.replaced] && (
                  <p className="text-xs text-faint">Substitui {ITEMS[loot.replaced]!.name}</p>
                )}
              </div>
            </li>
          )}
        </ul>
        <Btn variant="primary" className="mt-5 w-full" onClick={collectLoot}>
          Tomar
        </Btn>
      </div>
    </div>
  );
}

export function DeadPanel() {
  const screen = useGame((s) => s.screen);
  const player = useGame((s) => s.player);
  const floor = useGame((s) => s.floor);
  const newGame = useGame((s) => s.newGame);
  const setScreen = useGame((s) => s.setScreen);
  if (screen !== "dead") return null;
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-bg/80 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-xl border border-line bg-surface p-6 sm:rounded-xl">
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Expedição encerrada</p>
        <h2 className="mt-2 font-display text-4xl">Você caiu</h2>
        <p className="mt-3 text-sm text-muted">
          Andar {floor} · {player.kills} inimigos · {player.gold} ouros · nível {player.level}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Btn variant="primary" onClick={newGame}>
            Nova expedição
          </Btn>
          <Btn onClick={() => setScreen("title")}>Título</Btn>
        </div>
      </div>
    </div>
  );
}

export function HelpPanel() {
  const screen = useGame((s) => s.screen);
  const ackHelp = useGame((s) => s.ackHelp);
  if (screen !== "help") return null;
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-bg/55 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-xl border border-line bg-surface p-5 sm:rounded-xl">
        <h2 className="font-display text-2xl">Como descer vivo</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>Ande célula a célula. Inimigos agem depois de você.</li>
          <li>Baús, portas e escadas pedem o botão Agir. Chefes guardam a saída.</li>
          <li>O progresso fica neste aparelho. A morte apaga a expedição.</li>
        </ol>
        <Btn variant="primary" className="mt-6 w-full" onClick={ackHelp}>
          Entendi
        </Btn>
      </div>
    </div>
  );
}

export function MinimapDock() {
  const screen = useGame((s) => s.screen);
  if (screen !== "playing") return null;
  return (
    <div className="pointer-events-none absolute right-3 top-24 z-10">
      <Minimap />
    </div>
  );
}
