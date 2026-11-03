// Gráficos da tela de estatísticas, em HTML e CSS (sem biblioteca de gráfico).
// Regras: série única = uma cor só; barras finas com ponta arredondada; grade discreta;
// só o maior valor rotulado; tooltip no hover E no foco do teclado; e todo valor também
// aparece numa tabela, pra ninguém depender do tooltip.
import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { fadeUp } from "../../lib/motion";
import { formatMinutes, type DayPoint } from "./insights";
import styles from "./StatsScreen.module.css";

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayLabel = (day: string) =>
  WEEKDAY.format(new Date(`${day}T12:00:00Z`)).replace(".", "");

/** Topo da escala em múltiplos de 30 min (mínimo 1 h), pra os rótulos serem números redondos. */
function niceTop(max: number) {
  return Math.max(60, Math.ceil(max / 30) * 30);
}

interface StatTileProps {
  label: string;
  value: number;
  /** como escrever o número (ex.: minutos -> "3 h 20 min"); ele conta até o valor */
  format?: (n: number) => string;
  detail?: string;
}

export function StatTile({ label, value, format, detail }: StatTileProps) {
  return (
    <motion.div className={styles.tile} variants={fadeUp}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>
        <AnimatedNumber
          value={value}
          format={format ? (n) => format(Math.round(n)) : undefined}
        />
      </p>
      {detail && <p className={styles.tileDetail}>{detail}</p>}
    </motion.div>
  );
}

export function DailyBars({ days }: { days: DayPoint[] }) {
  const max = Math.max(0, ...days.map((d) => d.minutes));
  const top = niceTop(max);
  const peak = max > 0 ? days.findIndex((d) => d.minutes === max) : -1;

  return (
    <figure className={styles.figure}>
      <div className={styles.plot}>
        <div className={styles.grid} aria-hidden="true">
          {[top, top / 2, 0].map((tick) => (
            <span key={tick} className={styles.gridLine}>
              <span className={styles.gridLabel}>
                {tick === 0 ? "0" : formatMinutes(tick)}
              </span>
            </span>
          ))}
        </div>
        <ol className={styles.columns}>
          {days.map((d, i) => {
            const label = i === days.length - 1 ? "hoje" : dayLabel(d.day);
            const value = d.minutes
              ? `${formatMinutes(d.minutes)} · ${d.sessions} ${d.sessions === 1 ? "sessão" : "sessões"}`
              : "sem foco";
            return (
              <li
                key={d.day}
                className={styles.column}
                tabIndex={0}
                aria-label={`${label}: ${value}`}
              >
                <motion.span
                  className={styles.columnBar}
                  initial={{ height: "0%" }}
                  animate={{ height: `${(d.minutes / top) * 100}%` }}
                  transition={{
                    type: "spring",
                    stiffness: 140,
                    damping: 20,
                    delay: 0.15 + i * 0.035,
                  }}
                />
                {i === peak && (
                  <motion.span
                    className={styles.columnCap}
                    style={{ bottom: `${(d.minutes / top) * 100}%` }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    {formatMinutes(d.minutes)}
                  </motion.span>
                )}
                <span className={styles.tooltip} role="tooltip">
                  <strong>
                    {d.minutes ? formatMinutes(d.minutes) : "sem foco"}
                  </strong>
                  <span>
                    {label}
                    {d.sessions > 0 &&
                      ` · ${d.sessions} ${d.sessions === 1 ? "sessão" : "sessões"}`}
                  </span>
                </span>
                <span className={styles.columnTick} aria-hidden="true">
                  {i === days.length - 1 ? "hoje" : Number(d.day.slice(8))}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <details className={styles.tableView}>
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Foco</th>
              <th scope="col">Sessões</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td>{dayLabel(d.day)}</td>
                <td>{formatMinutes(d.minutes)}</td>
                <td>{d.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export interface BarRow {
  key: string;
  label: string;
  /** bolinha de identidade ao lado do nome (ex.: cor do jardim); a barra fica na cor única */
  swatch?: string;
  value: number;
  display: string;
  detail?: string;
}

/** Barras horizontais em forma de tabela: nome, barra e valor sempre escritos. */
export function BarTable({
  caption,
  rows,
  valueHeader,
}: {
  caption: string;
  rows: BarRow[];
  valueHeader: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <table className={styles.barTable}>
      <caption className="visually-hidden">{caption}</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">Nome</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className={styles.barName}>
              {row.swatch && (
                <span
                  className={styles.swatch}
                  style={{ "--swatch": row.swatch } as CSSProperties}
                  aria-hidden="true"
                />
              )}
              <span>
                {row.label}
                {row.detail && <small>{row.detail}</small>}
              </span>
            </th>
            <td className={styles.barCell}>
              <div className={styles.barInner}>
                <span className={styles.barTrack} aria-hidden="true">
                  <motion.span
                    className={styles.bar}
                    initial={{ width: "0%" }}
                    animate={{ width: `${(row.value / max) * 100}%` }}
                    transition={{
                      type: "spring",
                      stiffness: 110,
                      damping: 20,
                      delay: 0.2,
                    }}
                  />
                </span>
                <span className={styles.barValue}>{row.display}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
