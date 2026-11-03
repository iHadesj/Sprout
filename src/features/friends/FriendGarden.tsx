// Visita ao jardim de um amigo (/amigos/:userId): a ilha 3D dele no centro (só olhando), as
// horas da semana e, logo abaixo da ilha, o coração com os outros carinhos num arco em volta:
// - corações: toca e sai um; segurando, acelera (cada vez mais por vez) e sobem ao vivo na ilha;
// - regar (1 por dia), chamar pra focar (1 por dia) e plantar uma flor (1 por semana, fica lá).
// O servidor confere amizade e limites; aqui é só o jeito de mandar.
import { useState, type CSSProperties, type ReactElement } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams } from "react-router";
import { ArrowLeftIcon } from "../../components/icons/arrow-left";
import { BellIcon } from "../../components/icons/bell";
import { CheckIcon } from "../../components/icons/check";
import { DropletIcon } from "../../components/icons/droplet";
import { FlowerIcon } from "../../components/icons/flower";
import { ButtonLink } from "../../components/Button";
import { useIconHover } from "../../components/iconHover";
import { Blob } from "../../components/organic/Blob";
import { arc } from "../../components/organic/curve";
import { Orbit } from "../../components/organic/Orbit";
import { fadeUp, popIn, spring, stagger } from "../../lib/motion";
import { toast } from "../../lib/toast";
import { useNow } from "../../lib/useNow";
import { useProfile } from "../account/queries";
import { GardenStage } from "../gardens/GardenStage";
import { GARDEN_COLORS } from "../gardens/gardenOptions";
import { summarizePlants } from "../gardens/plants";
import { formatMinutes, todayIn } from "../stats/insights";
import { HeartTap } from "./HeartTap";
import {
  useFriendGardens,
  useFriendPlants,
  useFriends,
  useGardenFlowers,
  useLastFlower,
  useLastGift,
  usePlantFlower,
  useRanking,
  useSendGift,
} from "./queries";
import type { GiftShow } from "../../three/GiftEffects";
import layout from "../gardens/GardenLayout.module.css";
import styles from "./FriendGarden.module.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function FriendGarden() {
  const { userId = "" } = useParams();
  const gardens = useFriendGardens(userId);
  const plants = useFriendPlants(userId);
  const friends = useFriends();
  const ranking = useRanking();
  const profile = useProfile();
  const gift = useSendGift(userId);
  const now = useNow(60_000, true, Date.now);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState<GiftShow | null>(null);
  const [heartsSent, setHeartsSent] = useState(0);
  const [choosingColor, setChoosingColor] = useState(false);

  const name =
    friends.data?.find((f) => f.user_id === userId)?.username ?? null;
  const handle = name ? `@${name}` : "seu amigo";
  const garden =
    gardens.data?.[Math.min(index, (gardens.data?.length ?? 1) - 1)];
  const gardenPlants = (plants.data ?? []).filter(
    (p) => p.garden_id === garden?.id,
  );
  const flowers = useGardenFlowers(garden?.id ?? null);
  const { grown } = summarizePlants(gardenPlants);
  const week = ranking.data?.find((r) => r.user_id === userId);

  const timeZone =
    profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayIn(timeZone, now);
  const lastWater = useLastGift(userId, "water");
  const lastSeed = useLastGift(userId, "seed");
  const doneToday = (at: string | null | undefined) =>
    !!at && todayIn(timeZone, Date.parse(at)) === today;
  const lastFlower = useLastFlower(
    userId,
    (gardens.data ?? []).map((g) => g.id),
  );
  const nextFlowerIn = lastFlower.data
    ? Date.parse(lastFlower.data) + WEEK_MS - now
    : 0;
  const plant = usePlantFlower(userId);

  const play = (extra: Partial<GiftShow>) =>
    setShow((s) => ({
      id: (s?.id ?? 0) + 1,
      water: false,
      hearts: 0,
      ...extra,
    }));

  const water = () =>
    gift.mutate(
      { kind: "water" },
      {
        onSuccess: () => {
          play({ water: true });
          toast.success(`Você regou o jardim de ${handle}`);
        },
        onError: (error) => toast.error(error.message),
      },
    );

  const nudge = () =>
    gift.mutate(
      { kind: "seed" },
      {
        onSuccess: () => {
          play({ seed: true });
          toast.success(`Você chamou ${handle} pra focar`);
        },
        onError: (error) => toast.error(error.message),
      },
    );

  const plantFlower = (color: string) => {
    if (!garden) return;
    plant.mutate(
      { gardenId: garden.id, color },
      {
        onSuccess: () => {
          setChoosingColor(false);
          toast.success(`Você plantou uma flor em ${garden.name}`);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (gardens.isError) {
    return (
      <div className={layout.status}>
        <p>
          Vocês não são amigos (ou a amizade foi desfeita), então esse jardim
          não aparece.
        </p>
        <ButtonLink to="/amigos" variant="secondary">
          Voltar pros amigos
        </ButtonLink>
      </div>
    );
  }
  if (gardens.isPending)
    return <p className={layout.status}>Abrindo o jardim…</p>;

  return (
    <motion.div
      className={styles.page}
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp} className={styles.top}>
        <Link to="/amigos" className={styles.back}>
          <ArrowLeftIcon size={15} /> Amigos
        </Link>
      </motion.div>

      <motion.header className={styles.header} variants={fadeUp}>
        <h1>{handle}</h1>
        <p className={styles.meta}>
          <span className="mono">{formatMinutes(week?.minutes ?? 0)}</span> de
          foco esta semana
          {garden && (
            <>
              {" "}
              · <span className="mono">{grown}</span>{" "}
              {grown === 1 ? "árvore adulta" : "árvores adultas"} aqui
            </>
          )}
        </p>
      </motion.header>

      {(gardens.data?.length ?? 0) > 1 && (
        <motion.div variants={fadeUp}>
          <Orbit
            className={styles.tabs}
            role="tablist"
            aria-label="Jardins"
            bend={10}
            tilt={3}
          >
            {gardens.data?.map((g, i) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={g.id === garden?.id}
                className={styles.tab}
                onClick={() => setIndex(i)}
              >
                <span
                  className={styles.dot}
                  style={{ background: g.color }}
                  aria-hidden="true"
                />
                {g.name}
              </button>
            ))}
          </Orbit>
        </motion.div>
      )}

      <figure
        className={styles.stageWrap}
        aria-label={
          garden ? `Jardim ${garden.name} de ${handle}` : `Jardins de ${handle}`
        }
      >
        <Blob className={styles.blob} />
        <motion.div
          className={styles.stage}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring.soft, opacity: { duration: 0.3 } }}
        >
          {garden ? (
            <GardenStage
              garden={garden}
              plants={gardenPlants}
              neglected={false}
              seal={null}
              gifts={show}
              flowers={flowers.data}
              liveHearts={heartsSent}
              visiting
              owner={name}
            />
          ) : (
            <p className={layout.status}>
              {handle} ainda não criou nenhum jardim.
            </p>
          )}
        </motion.div>
      </figure>

      {garden && (
        <motion.section
          className={styles.gifts}
          variants={fadeUp}
          aria-labelledby="carinhos"
        >
          {/* sem título na tela (o coração fala por si); fica pro leitor de tela */}
          <h2 id="carinhos" className="visually-hidden">
            Mandar um carinho
          </h2>

          {/* o coração no meio e as três ações num arco em volta dele */}
          <div className={styles.carinho}>
            <HeartTap
              to={userId}
              onSent={(n) => setHeartsSent((total) => total + n)}
            />
            <motion.div
              className={styles.actions}
              variants={stagger(0.08, 0.2)}
            >
              <ActionTile
                index={0}
                icon={<DropletIcon size={26} />}
                label={
                  doneToday(lastWater.data) ? "Regado hoje" : "Regar o jardim"
                }
                hint="1 por dia"
                done={doneToday(lastWater.data)}
                disabled={doneToday(lastWater.data) || gift.isPending}
                onClick={water}
              />
              <ActionTile
                index={1}
                icon={<BellIcon size={26} />}
                label={
                  doneToday(lastSeed.data)
                    ? "Chamado hoje"
                    : "Chamar para sessão"
                }
                hint="1 por dia"
                done={doneToday(lastSeed.data)}
                disabled={doneToday(lastSeed.data) || gift.isPending}
                onClick={nudge}
              />
              <ActionTile
                index={2}
                icon={<FlowerIcon size={26} />}
                label={
                  nextFlowerIn > 0
                    ? `Nova flor em ${Math.ceil(nextFlowerIn / 86_400_000)} d`
                    : "Plantar uma flor"
                }
                hint="1 por semana"
                done={nextFlowerIn > 0}
                disabled={nextFlowerIn > 0 || plant.isPending}
                pressed={choosingColor}
                onClick={() => setChoosingColor((c) => !c)}
              />
            </motion.div>
          </div>

          <AnimatePresence>
            {choosingColor && nextFlowerIn <= 0 && (
              <motion.div
                className={styles.colors}
                role="group"
                aria-label="Cor da flor"
                initial="hidden"
                animate="show"
                exit="hidden"
                variants={stagger(0.04)}
              >
                {GARDEN_COLORS.map((c, i) => (
                  <motion.button
                    key={c.value}
                    type="button"
                    className={styles.swatch}
                    style={{
                      background: c.value,
                      translate: `0 ${arc(i, GARDEN_COLORS.length, 14, 0).lift}px`,
                    }}
                    aria-label={c.label}
                    disabled={plant.isPending}
                    variants={popIn}
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => plantFlower(c.value)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </motion.div>
  );
}

/** Posição de cada ação no arco em volta do coração (desktop): esquerda, embaixo, direita. */
const SPOTS = [
  { x: -160, y: 36 },
  { x: 0, y: 196 },
  { x: 160, y: 36 },
];

/** Carinho: um círculo com o ícone (anima no hover), o nome e o limite embaixo. */
function ActionTile({
  index,
  icon,
  label,
  hint,
  done,
  disabled,
  pressed,
  onClick,
}: {
  index: number;
  icon: ReactElement;
  label: string;
  hint: string;
  done?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  const animated = useIconHover(icon);
  const spot = {
    "--x": `${SPOTS[index].x}px`,
    "--y": `${SPOTS[index].y}px`,
  } as CSSProperties;
  return (
    <motion.button
      type="button"
      className={styles.tile}
      style={spot}
      disabled={disabled}
      aria-pressed={pressed}
      data-done={done || undefined}
      variants={popIn}
      whileHover={
        disabled
          ? undefined
          : { scale: 1.06, rotate: index === 1 ? 0 : index === 0 ? -3 : 3 }
      }
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      {...animated.hover}
    >
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileIcon}>
        {animated.node}
        {done && (
          <span className={styles.check} aria-hidden="true">
            <CheckIcon size={13} strokeWidth={2.6} />
          </span>
        )}
      </span>
      <span className={styles.tileHint}>{hint}</span>
    </motion.button>
  );
}
