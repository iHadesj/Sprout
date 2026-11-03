// Moldura das telas logadas: o cabeçalho solto sobre o papel (a marca com o broto do dia, a data
// do caderno e a navegação em texto, com um traço de tinta curvo que desliza até a página atual)
// e a troca de telas em círculo.
// No celular a navegação desce pro rodapé numa cápsula com ícones (zona do polegar) e a data
// ocupa o canto direito do cabeçalho.
// Durante o foco tudo isso some (menos tentação de clicar em outra coisa).
import { useEffect, useState, type ReactElement } from "react";
import { LayoutGroup, motion } from "motion/react";
import { Link, NavLink, useLocation } from "react-router";
import { AnimatedOutlet } from "../components/AnimatedOutlet";
import { formatNotebookDate } from "../components/brand/notebookDate";
import { sproutLeaves } from "../components/brand/sproutLeaves";
import { Wordmark } from "../components/brand/Wordmark";
import { ChartColumnIncreasingIcon } from "../components/icons/chart-column-increasing";
import { HomeIcon } from "../components/icons/home";
import { UserIcon } from "../components/icons/user";
import { UsersIcon } from "../components/icons/users";
import { useIconHover } from "../components/iconHover";
import { InkUnderline } from "../components/organic/InkUnderline";
import { Toaster } from "../components/Toaster";
import { useFriends } from "../features/friends/queries";
import { useToday } from "../features/stats/useToday";
import { useFocusStore } from "../stores/focusStore";
import styles from "./Layout.module.css";

const LINKS = [
  { to: "/", label: "Início", end: true, icon: <HomeIcon size={20} /> },
  {
    to: "/estatisticas",
    label: "Diário de campo",
    short: "Diário",
    end: false,
    icon: <ChartColumnIncreasingIcon size={20} />,
  },
  { to: "/amigos", label: "Amigos", end: false, icon: <UsersIcon size={20} /> },
  { to: "/conta", label: "Ficha", end: false, icon: <UserIcon size={20} /> },
];

/** O broto se desenha uma vez por visita, não a cada vez que o Layout monta (sair e entrar de novo). */
let markDrawn = false;

export function Layout() {
  const focusing = useFocusStore((s) => s.timer.phase === "focus");
  const { pathname } = useLocation();
  // pedido de amizade esperando resposta: bolinha no "Amigos"
  const friends = useFriends();
  const pending =
    friends.data?.some((f) => f.direction === "incoming") ?? false;
  // /jardim/:id e /jardim/:id/foco são a mesma tela (a cena 3D não pode remontar)
  const routeKey = pathname.split("/").slice(0, 3).join("/");
  // o broto só lê os minutos que o banco já contou hoje
  const { today, todayMinutes, timeZone, clock } = useToday();
  const [drawMark] = useState(() => !markDrawn);
  useEffect(() => {
    markDrawn = true;
  }, []);

  return (
    <LayoutGroup>
      <div className={styles.shell}>
        {/* só opacidade: um transform aqui viraria referência do position: fixed da nav do celular */}
        <motion.header
          className={styles.header}
          animate={{ opacity: focusing ? 0 : 1 }}
          transition={{ duration: 0.25 }}
          aria-hidden={focusing}
          inert={focusing}
        >
          <div className={styles.masthead}>
            <Link to="/" className={styles.brand} aria-label="Sprout, início">
              <Wordmark leaves={sproutLeaves(todayMinutes)} draw={drawMark} />
            </Link>
            <time className={styles.date} dateTime={today}>
              {formatNotebookDate(clock, timeZone)}
            </time>
          </div>
          <nav className={styles.nav} aria-label="Principal">
            {LINKS.map((link) => (
              <NavItem
                key={link.to}
                {...link}
                badge={link.to === "/amigos" && pending}
              />
            ))}
          </nav>
        </motion.header>
        <main id="app-main" className={styles.main}>
          <AnimatedOutlet routeKey={routeKey} reveal />
        </main>
        <Toaster />
      </div>
    </LayoutGroup>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  short?: string;
  end: boolean;
  icon: ReactElement;
  badge: boolean;
}

function NavItem({ to, label, short, end, icon, badge }: NavItemProps) {
  const animated = useIconHover(icon);
  return (
    <NavLink to={to} end={end} className={styles.link} {...animated.hover}>
      {({ isActive }) => (
        <>
          <span className={styles.icon} aria-hidden="true">
            {animated.node}
          </span>
          <span className={styles.text}>
            <span className={styles.full}>{label}</span>
            <span className={styles.short}>{short ?? label}</span>
            {isActive && <InkUnderline layoutId="nav-ink" />}
          </span>
          {badge && (
            <span className={styles.badge} aria-label="pedido de amizade" />
          )}
        </>
      )}
    </NavLink>
  );
}
